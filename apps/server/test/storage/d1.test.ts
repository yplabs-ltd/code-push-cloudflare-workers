import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { D1StorageProvider } from "../../src/storage/d1";
import { InMemoryCacheProvider } from "../../src/storage/cache";
import type { Context } from "hono";
import type { Env } from "../../src/types/env";
import * as schema from "../../src/db/schema";
import { cleanupDatabase, getTestDb } from "../utils/db";
import {
  createTestAccount,
  createTestApp,
  createTestDeployment,
  createTestPackage,
} from "../utils/fixtures";
import { env } from "cloudflare:test";
import { MockBlobStorageProvider } from "./mock-blob";

describe("D1StorageProvider Cache", () => {
  let storage: D1StorageProvider;
  let mockCtx: Context<Env>;
  let mockCache: InMemoryCacheProvider;
  let mockBlob: MockBlobStorageProvider;
  let db: ReturnType<typeof getTestDb>;
  let account: ReturnType<typeof createTestAccount>;
  let app: ReturnType<typeof createTestApp>;

  beforeEach(async () => {
    db = getTestDb();
    await cleanupDatabase();

    // Create test data
    account = createTestAccount();
    await db.insert(schema.account).values(account);

    app = createTestApp();
    await db.insert(schema.app).values(app);

    // Add owner collaborator
    await db.insert(schema.collaborator).values({
      appId: app.id,
      accountId: account.id,
      permission: "Owner",
    });

    mockCtx = {
      env: {
        DB: env.DB,
      },
    } as unknown as Context<Env>;

    mockCache = new InMemoryCacheProvider();
    mockBlob = new MockBlobStorageProvider(mockCtx, mockCache);
    storage = new D1StorageProvider(mockCtx, mockCache, mockBlob);
    console.log(typeof mockCtx.env.DB.prepare);
  });

  afterEach(async () => {
    await cleanupDatabase();
  });

  it("should cache and return deployment data", async () => {
    const deployment = createTestDeployment(app.id);
    await db.insert(schema.deployment).values(deployment);
    const packageHistory = createTestPackage(deployment.id);
    await db.insert(schema.packages).values(packageHistory);

    const result = await storage.getDeployment(
      account.id,
      app.id,
      deployment.id,
    );

    expect(result.id).toBe(deployment.id);
    expect(
      await mockCache.get(
        `deployment:${account.id}:${app.id}:${deployment.id}`,
      ),
    ).toBe(JSON.stringify(result));
  });

  it("should cache and return package history data", async () => {
    const deployment = createTestDeployment(app.id);
    await db.insert(schema.deployment).values(deployment);
    const packageHistory = createTestPackage(deployment.id);
    await db.insert(schema.packages).values(packageHistory);

    const result = await storage.getPackageHistory(
      account.id,
      app.id,
      deployment.id,
    );

    expect(result.length).toBe(1);
    expect(
      await mockCache.get(`package:${account.id}:${app.id}:${deployment.id}`),
    ).toBe(JSON.stringify(result));
  });

  it("should invalidate cache when committing new package", async () => {
    const deployment = createTestDeployment(app.id);
    await db.insert(schema.deployment).values(deployment);
    const packageHistory = createTestPackage(deployment.id);
    await db.insert(schema.packages).values(packageHistory);

    // First get to populate cache
    await storage.getPackageHistory(account.id, app.id, deployment.id);
    expect(
      await mockCache.get(`package:${account.id}:${app.id}:${deployment.id}`),
    ).toBeDefined();

    // Create test blob data
    const blobId = "test-blob-id";
    const blobData = new ArrayBuffer(1024);
    const blobUrl = await mockBlob.addBlob(blobId, blobData, 1024);

    // Commit new package
    const newPackage = {
      appVersion: "1.0.0",
      description: "Test package",
      isDisabled: false,
      isMandatory: false,
      rollout: 100,
      size: 1024,
      packageHash: "test-hash",
      uploadTime: Date.now(),
      blobUrl,
      manifestBlobUrl: "",
      diffPackageMap: {},
    };

    await storage.commitPackage(account.id, app.id, deployment.id, newPackage);

    // Cache should be invalidated
    expect(
      await mockCache.get(`package:${account.id}:${app.id}:${deployment.id}`),
    ).toBeNull();
  });

  it("should cache and return package history data from deployment key", async () => {
    const deployment = createTestDeployment(app.id);
    await db.insert(schema.deployment).values(deployment);
    const packageHistory = createTestPackage(deployment.id);
    await db.insert(schema.packages).values(packageHistory);

    // First get to populate cache
    await storage.getPackageHistory(account.id, app.id, deployment.id);

    const result = await storage.getPackageHistoryFromDeploymentKey(
      deployment.key,
    );

    expect(result.length).toBe(1);
    expect(
      await mockCache.get(`package:${account.id}:${app.id}:${deployment.id}`),
    ).toBe(JSON.stringify(result));
  });
});
