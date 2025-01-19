import type { Context } from "hono";
import type { Env } from "../types/env";
import { getStorageProvider } from "../storage/factory";
import type { StorageProvider } from "../storage/storage";

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
  private readonly ctx: Context<Env>;
  private readonly kv: KVNamespace;
  private readonly storage: StorageProvider;

  constructor(ctx: Context<Env>) {
    this.ctx = ctx;
    this.kv = ctx.env.CODE_PUSH_KV;
    this.storage = getStorageProvider(ctx);
  }

  private async increment(key: string): Promise<void> {
    const currentValue = await this.kv.get(key);
    const newValue = (
      (Number.parseInt(currentValue ?? "0", 10) || 0) + 1
    ).toString();
    await this.kv.put(key, newValue);
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

    await this.increment(this.getMetricKey(deploymentKey, label, type));

    if (status === "DeploymentSucceeded") {
      const clientKey = this.getClientKey(deploymentKey, clientId);
      await this.kv.put(clientKey, label);
      await this.increment(
        this.getMetricKey(deploymentKey, label, MetricType.ACTIVE),
      );
    }
  }

  async recordDeployment(
    deploymentKey: string,
    appVersion: string,
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
      const currentActive = Number.parseInt(
        (await this.kv.get(prevActiveKey)) ?? "0",
        10,
      );
      if (currentActive > 0) {
        await this.kv.put(prevActiveKey, (currentActive - 1).toString());
      }
    }

    const clientKey = this.getClientKey(deploymentKey, clientId);
    await this.kv.put(clientKey, appVersion);
    await this.increment(
      this.getMetricKey(deploymentKey, appVersion, MetricType.ACTIVE),
    );
  }

  async recordDownload(
    deploymentKey: string,
    label: string,
    clientId: string,
  ): Promise<void> {
    await this.increment(
      this.getMetricKey(deploymentKey, label, MetricType.DOWNLOADED),
    );
  }

  async getMetrics(deploymentKey: string): Promise<DeploymentMetrics> {
    const list = await this.kv.list({
      prefix: `${METRICS_PREFIX}${deploymentKey}:`,
    });
    const metrics: DeploymentMetrics = {};

    for (const { name } of list.keys) {
      const [, , label, type] = name.split(":");
      if (!metrics[label]) {
        metrics[label] = {
          active: 0,
          downloads: 0,
          installed: 0,
          failed: 0,
        };
      }

      const value = Number.parseInt((await this.kv.get(name)) ?? "0", 10);

      switch (type as MetricType) {
        case MetricType.ACTIVE:
          metrics[label].active = value;
          break;
        case MetricType.DOWNLOADED:
          metrics[label].downloads = value;
          break;
        case MetricType.DEPLOYMENT_SUCCEEDED:
          metrics[label].installed = value;
          break;
        case MetricType.DEPLOYMENT_FAILED:
          metrics[label].failed = value;
          break;
      }
    }

    return metrics;
  }

  async clearMetrics(deploymentKey: string): Promise<void> {
    const list = await this.kv.list({
      prefix: `${METRICS_PREFIX}${deploymentKey}:`,
    });

    // Delete in batches of 100
    const keys = list.keys.map((k) => k.name);
    for (let i = 0; i < keys.length; i += 100) {
      const batch = keys.slice(i, i + 100);
      await Promise.all(batch.map((key) => this.kv.delete(key)));
    }
  }

  async getActiveDevices(deploymentKey: string): Promise<number> {
    const list = await this.kv.list({
      prefix: `${METRICS_PREFIX}client:${deploymentKey}:`,
    });
    return list.keys.length;
  }
}
