import { and, eq, sql } from "drizzle-orm";
import { type DrizzleD1Database, drizzle } from "drizzle-orm/d1";
import type { Context } from "hono";
import * as schema from "../db/schema";
import { getStorageProvider } from "../storage/factory";
import type { StorageProvider } from "../storage/storage";
import type { Env } from "../types/env";

const METRICS_PREFIX = "metrics:" as const;

const MetricType = {
  ACTIVE: "active",
  DOWNLOADED: "downloaded",
  DEPLOYMENT_SUCCEEDED: "deployment_succeeded",
  DEPLOYMENT_FAILED: "deployment_failed",
} as const;

type MetricType = (typeof MetricType)[keyof typeof MetricType];

export interface MetricsData {
  active: number;
  downloads?: number;
  installed?: number;
  failed?: number;
}

export interface DeploymentMetrics {
  [labelOrVersion: string]: MetricsData;
}

export class MetricsManager {
  private readonly storage: StorageProvider;
  private readonly db: DrizzleD1Database<typeof schema>;

  constructor(private readonly ctx: Context<Env>) {
    this.storage = getStorageProvider(ctx);
    this.db = drizzle(ctx.env.DB, { schema });
  }

  private getMetricKey(
    deploymentKey: string,
    label: string,
    type: MetricType,
  ): string {
    return `${METRICS_PREFIX}${deploymentKey}:${label}:${type}`;
  }

  private getClientKey(deploymentKey: string, clientId: string): string {
    return `${METRICS_PREFIX}client:${deploymentKey}:${clientId}`;
  }

  private async increment(
    deploymentKey: string,
    label: string,
    type: MetricType,
  ): Promise<void> {
    await this.db
      .insert(schema.metrics)
      .values({
        deploymentId: deploymentKey,
        label,
        type,
        count: 1,
      })
      .onConflictDoUpdate({
        target: [
          schema.metrics.deploymentId,
          schema.metrics.label,
          schema.metrics.type,
        ],
        set: {
          count: sql`${schema.metrics.count} + 1`,
        },
      });
  }

  async recordDeploymentStatus(
    deploymentKey: string,
    label: string,
    status: "DeploymentSucceeded" | "DeploymentFailed",
    clientId: string,
  ): Promise<void> {
    const type =
      status === "DeploymentSucceeded"
        ? MetricType.DEPLOYMENT_SUCCEEDED
        : MetricType.DEPLOYMENT_FAILED;

    await this.increment(deploymentKey, label, type);

    if (status === "DeploymentSucceeded") {
      const clientKey = this.getClientKey(deploymentKey, clientId);
      await this.db
        .insert(schema.clientLabels)
        .values({
          deploymentId: deploymentKey,
          clientId,
          label,
        })
        .onConflictDoUpdate({
          target: [
            schema.clientLabels.clientId,
            schema.clientLabels.deploymentId,
          ],
          set: {
            label,
          },
        });
      await this.increment(deploymentKey, label, MetricType.ACTIVE);
    }
  }

  async recordDeployment(
    deploymentKey: string,
    label: string,
    clientId: string,
    previousDeploymentKey?: string,
    previousLabel?: string,
  ): Promise<void> {
    if (previousDeploymentKey && previousLabel) {
      const prevActiveKey = this.getMetricKey(
        previousDeploymentKey,
        previousLabel,
        MetricType.ACTIVE,
      );

      await this.db.run(sql`
        UPDATE metrics
        SET count = count - 1
        WHERE deploymentId = ${previousDeploymentKey} AND label = ${previousLabel} AND type = ${MetricType.ACTIVE} AND count > 0
        `);
    }

    const clientKey = this.getClientKey(deploymentKey, clientId);
    await this.db
      .insert(schema.clientLabels)
      .values({
        deploymentId: deploymentKey,
        clientId,
        label,
      })
      .onConflictDoUpdate({
        target: [
          schema.clientLabels.clientId,
          schema.clientLabels.deploymentId,
        ],
        set: {
          label,
        },
      });
    await this.increment(deploymentKey, label, MetricType.ACTIVE);
  }

  async recordDownload(
    deploymentKey: string,
    label: string,
    clientId: string,
  ): Promise<void> {
    await this.increment(deploymentKey, label, MetricType.DOWNLOADED);
  }

  async getMetrics(deploymentKey: string): Promise<DeploymentMetrics> {
    const results = await this.db.query.metrics.findMany({
      where: eq(schema.metrics.deploymentId, deploymentKey),
    });

    const metrics: DeploymentMetrics = {};

    for (const result of results) {
      if (!metrics[result.label]) {
        metrics[result.label] = {
          active: 0,
          downloads: 0,
          installed: 0,
          failed: 0,
        };
      }

      switch (result.type as MetricType) {
        case MetricType.ACTIVE:
          metrics[result.label].active = result.count;
          break;
        case MetricType.DOWNLOADED:
          metrics[result.label].downloads = result.count;
          break;
        case MetricType.DEPLOYMENT_SUCCEEDED:
          metrics[result.label].installed = result.count;
          break;
        case MetricType.DEPLOYMENT_FAILED:
          metrics[result.label].failed = result.count;
          break;
      }
    }

    return metrics;
  }

  async clearDeploymentMetrics(deploymentKey: string): Promise<void> {
    await this.db
      .delete(schema.metrics)
      .where(eq(schema.metrics.deploymentId, deploymentKey));
    await this.db
      .delete(schema.clientLabels)
      .where(eq(schema.clientLabels.deploymentId, deploymentKey));
  }
}
