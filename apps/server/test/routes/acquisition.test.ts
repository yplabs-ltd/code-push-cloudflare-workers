import { SELF, env } from "cloudflare:test";
import { eq } from "drizzle-orm";
import qs from "qs";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import * as schema from "../../src/db/schema";
import {
  type App,
  type Deployment,
  UpdateCheckResponseSchema,
} from "../../src/types/schemas";
import { rolloutStrategy } from "../../src/utils/rollout";
import { generateKey } from "../../src/utils/security";
import {
  CDN_CACHE_CONTROL_HEADER,
  UPDATE_CHECK_CACHE_CONTROL,
} from "../../src/utils/update-check-cache";
import { type TestAuth, createTestAuth } from "../utils/auth";
import { cleanupDatabase, getTestDb } from "../utils/db";
import {
  createTestAccount,
  createTestApp,
  createTestBlob,
  createTestDeployment,
  createTestPackage,
} from "../utils/fixtures";

describe("Acquisition Routes", () => {
  let auth: TestAuth;
  let db: ReturnType<typeof getTestDb>;
  // const db = getTestDb();
  let app: App;
  let deployment: Deployment;
  let packages: (typeof schema.packages.$inferInsert)[];
  let deployment2: typeof schema.deployment.$inferInsert;
  let packages2: (typeof schema.packages.$inferInsert)[];

  beforeEach(async () => {
    auth = createTestAuth(env.DB, env.JWT_SECRET);
    db = getTestDb();

    await cleanupDatabase();

    // Create test data
    const account = createTestAccount();
    await db.insert(schema.account).values(account);

    app = createTestApp();
    await db.insert(schema.app).values(app);

    // Add owner collaborator
    await db.insert(schema.collaborator).values({
      appId: app.id,
      accountId: account.id,
      permission: "Owner",
    });

    deployment = createTestDeployment(app.id);
    await db.insert(schema.deployment).values({
      ...deployment,
      appId: app.id,
    });

    // Create packages with different states
    packages = [
      createTestPackage(deployment.id, {
        label: "v1",
        packageHash: "hash100",
        isDisabled: false,
        isMandatory: false,
        description: "Test package for 1.0.0",
        blobPath: generateKey("hash100-v1-"),
      }),
      createTestPackage(deployment.id, {
        label: "v2",
        packageHash: "hash101",
        isDisabled: false,
        isMandatory: true,
        description: "Test package for 1.0.0",
        blobPath: generateKey("hash101-v2-"),
      }),
      createTestPackage(deployment.id, {
        label: "v3",
        packageHash: "hash102",
        isDisabled: false,
        isMandatory: false,
        description: "Test package for 1.0.0",
        blobPath: generateKey("hash102-v3-"),
        size: 100,
      }),
    ];

    // Insert packages in sequence
    for (const pkg of packages) {
      await db.insert(schema.packages).values({
        id: pkg.id,
        deploymentId: deployment.id,
        label: pkg.label,
        appVersion: pkg.appVersion,
        description: pkg.description,
        isDisabled: pkg.isDisabled,
        isMandatory: pkg.isMandatory,
        size: pkg.size,
        blobPath: pkg.blobPath,
        manifestBlobPath: pkg.manifestBlobPath,
        packageHash: pkg.packageHash,
        uploadTime: pkg.uploadTime,
      });

      await Promise.all([
        createTestBlob(pkg.blobPath, "test content"),
        createTestBlob(pkg.manifestBlobPath as string, "{}"),
      ]);
    }

    // Create diffs
    await db.insert(schema.packageDiff).values({
      id: generateKey(),
      size: 1,
      packageId: packages[1].id,
      sourcePackageHash: packages[0].packageHash,
      blobPath: (await createTestBlob(generateKey("diff1-"), "test")).key,
    });
    await db.insert(schema.packageDiff).values({
      id: generateKey(),
      size: 3,
      packageId: packages[2].id,
      sourcePackageHash: packages[1].packageHash,
      blobPath: (await createTestBlob(generateKey("diff2-"), "test")).key,
    });

    // Create second deployment for testing app version handling
    deployment2 = createTestDeployment(app.id);
    await db.insert(schema.deployment).values({
      ...deployment2,
      appId: app.id,
    });

    packages2 = [
      createTestPackage(deployment2.id, {
        label: "v1",
        packageHash: "hash200",
        appVersion: "1.0.0",
        description: "Test package for v1",
      }),
      createTestPackage(deployment2.id, {
        label: "v2",
        packageHash: "hash201",
        appVersion: "2.0.0",
        description: "Test package for v2",
      }),
      createTestPackage(deployment2.id, {
        label: "v3",
        packageHash: "hash202",
        appVersion: "3.0.0",
        isDisabled: true,
        description: "Test package for v3",
      }),
      createTestPackage(deployment2.id, {
        label: "v4",
        packageHash: "hash203",
        appVersion: "1.0.0",
        description: "Test package for v4",
      }),
      createTestPackage(deployment2.id, {
        label: "v5",
        packageHash: "hash204",
        appVersion: "3.0.0",
        isMandatory: true,
        description: "Test package for v5",
      }),
      createTestPackage(deployment2.id, {
        label: "v6",
        packageHash: "hash205",
        appVersion: "2.0.0",
        description: "Test package for v6",
      }),
      createTestPackage(deployment2.id, {
        label: "v7",
        packageHash: "hash206",
        appVersion: "3.0.0",
        description: "Test package for v7",
      }),
    ];

    for (const pkg of packages2) {
      await db.insert(schema.packages).values(pkg);
      await Promise.all([
        createTestBlob(pkg.blobPath, "test content"),
        createTestBlob(pkg.manifestBlobPath as string, "{}"),
      ]);
    }
  });

  afterEach(async () => {
    await auth.cleanup();
    await cleanupDatabase();
  });

  describe("GET /updateCheck", () => {
    it("returns 400 for malformed URL without parameters", async () => {
      const response = await SELF.fetch("https://example.com/updateCheck");
      expect(response.status).toBe(400);
    });

    it("returns 400 for malformed URL with missing deploymentKey", async () => {
      const response = await SELF.fetch(
        "https://example.com/updateCheck?appVersion=1.0.0&packageHash=hash123"
      );
      expect(response.status).toBe(400);
    });

    it("returns 400 for malformed URL with missing app version", async () => {
      const response = await SELF.fetch(
        `https://example.com/updateCheck?deploymentKey=${deployment.key}&packageHash=hash123`
      );
      expect(response.status).toBe(400);
    });

    it("returns 400 for malformed URL with non-semver app version", async () => {
      const response = await SELF.fetch(
        `https://example.com/updateCheck?deploymentKey=${deployment.key}&packageHash=hash123&appVersion=notSemver`
      );
      expect(response.status).toBe(400);
    });

    it("returns 404 for incorrect deployment key", async () => {
      const response = await SELF.fetch(
        "https://example.com/updateCheck?deploymentKey=keyThatIsNonExistent&appVersion=1.0.0"
      );
      expect(response.status).toBe(404);
    });

    it("returns 200 and update info for missing patch version by assuming patch version of 0", async () => {
      const response = await SELF.fetch(
        `https://example.com/updateCheck?deploymentKey=${deployment.key}&appVersion=1.0`
      );
      expect(response.status).toBe(200);

      const data = UpdateCheckResponseSchema.parse(await response.json());
      expect(data.updateInfo.isAvailable).toBe(true);
      expect(data.updateInfo.appVersion).toBe("1.0");
    });

    it("returns 200 and update for appVersion with missing patch version and build metadata", async () => {
      const response = await SELF.fetch(
        `https://example.com/updateCheck?${qs.stringify({
          deploymentKey: deployment.key,
          appVersion: "1.0+metadata",
        })}`
      );
      expect(response.status).toBe(200);

      const json = await response.json();
      const data = UpdateCheckResponseSchema.parse(json);
      expect(data.updateInfo.isAvailable).toBe(true);
      expect(data.updateInfo.appVersion).toBe("1.0+metadata");
    });

    it("returns 200 and update for exact version match", async () => {
      const response = await SELF.fetch(
        `https://example.com/updateCheck?deploymentKey=${deployment.key}&appVersion=1.0.0`
      );
      expect(response.status).toBe(200);

      const data = UpdateCheckResponseSchema.parse(await response.json());
      expect(data.updateInfo.isAvailable).toBe(true);
      expect(data.updateInfo.packageHash).toBe("hash102");
    });

    it("returns 200 and available update with diff package URL", async () => {
      const response = await SELF.fetch(
        `https://example.com/updateCheck?deploymentKey=${deployment.key}&appVersion=1.0.0&packageHash=${packages[0].packageHash}`
      );
      expect(response.status).toBe(200);

      const data = UpdateCheckResponseSchema.parse(await response.json());
      expect(data.updateInfo.isAvailable).toBe(true);
      expect(data.updateInfo.downloadURL).includes("hash102-v3-");
      expect(data.updateInfo.packageSize).toBe(100);
    });

    it("returns 200 and no update for same package hash", async () => {
      const response = await SELF.fetch(
        `https://example.com/updateCheck?deploymentKey=${deployment.key}&appVersion=1.0.0&packageHash=${packages[2].packageHash}`
      );
      expect(response.status).toBe(200);

      const data = UpdateCheckResponseSchema.parse(await response.json());
      expect(data.updateInfo.isAvailable).toBe(false);
    });

    it("returns 200 and handles rollout correctly", async () => {
      // Set rollout to 50%
      await db
        .update(schema.packages)
        .set({ rollout: 50 })
        .where(eq(schema.packages.id, packages[2].id));

      const response = await SELF.fetch(
        `https://example.com/updateCheck?deploymentKey=${deployment.key}&appVersion=1.0.0&clientUniqueId=test-device`
      );
      expect(response.status).toBe(200);

      const data = UpdateCheckResponseSchema.parse(await response.json());
      // Note: The actual result depends on the hash of clientUniqueId+releaseLabel
      expect(data.updateInfo.isAvailable).toBeDefined();
    });

    // App version specific tests
    it("returns 200 and no update for greater app version", async () => {
      const packageHash = packages2
        .filter((p) => p.appVersion === "2.0.0")
        .sort((a, b) => b.label.localeCompare(a.label))[0].packageHash;
      const response = await SELF.fetch(
        `https://example.com/updateCheck?deploymentKey=${deployment2.key}&appVersion=2.0.0&packageHash=${packageHash}`
      );
      expect(response.status).toBe(200);

      const json = await response.json();
      const data = UpdateCheckResponseSchema.parse(json);
      expect(data.updateInfo.shouldRunBinaryVersion).toBe(true);
    });

    it("returns 200 and available update for same app version", async () => {
      const response = await SELF.fetch(
        `https://example.com/updateCheck?deploymentKey=${deployment2.key}&appVersion=1.0.0&packageHash=${packages2[0].packageHash}`
      );
      expect(response.status).toBe(200);

      const json = await response.json();
      const data = UpdateCheckResponseSchema.parse(json);
      expect(data.updateInfo.isAvailable).toBe(true);
      expect(data.updateInfo.label).toBe("v4");
    });

    it("returns 200 and correct update for version ranges", async () => {
      // Update a package to use version range
      await db
        .update(schema.packages)
        .set({ appVersion: ">=1.0.0 <2.0.0" })
        .where(eq(schema.packages.id, packages2[3].id));

      const response = await SELF.fetch(
        `https://example.com/updateCheck?deploymentKey=${deployment2.key}&appVersion=1.5.0`
      );
      expect(response.status).toBe(200);

      const data = UpdateCheckResponseSchema.parse(await response.json());
      expect(data.updateInfo.isAvailable).toBe(true);
      expect(data.updateInfo.label).toBe("v4");
    });
  });

  describe("POST /reportStatus/deploy", () => {
    it("returns 400 if invalid json is sent", async () => {
      const response = await SELF.fetch(
        "https://example.com/reportStatus/deploy",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: "{invalid: json",
        }
      );
      expect(response.status).toBe(400);
    });

    it("returns 400 if deploymentKey is unspecified", async () => {
      const response = await SELF.fetch(
        "https://example.com/reportStatus/deploy",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            status: "DeploymentSucceeded",
            label: "v1",
            clientUniqueId: "test-device",
            appVersion: "1.0.0",
          }),
        }
      );
      expect(response.status).toBe(400);
    });

    it("returns 400 if clientUniqueId is unspecified", async () => {
      const response = await SELF.fetch(
        "https://example.com/reportStatus/deploy",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            deploymentKey: deployment.key,
            status: "DeploymentSucceeded",
            label: "v1",
            appVersion: "1.0.0",
          }),
        }
      );
      expect(response.status).toBe(400);
    });

    it("returns 200 for valid deployment report", async () => {
      const response = await SELF.fetch(
        "https://example.com/reportStatus/deploy",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            deploymentKey: deployment.key,
            clientUniqueId: "test-device",
            label: "v1",
            appVersion: "1.0.0",
            status: "DeploymentSucceeded",
          }),
        }
      );
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ status: "ok" });
    });
    it("returns 200 for deployment report with previous deployment info", async () => {
      const response = await SELF.fetch(
        "https://example.com/reportStatus/deploy",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            deploymentKey: deployment.key,
            clientUniqueId: "test-device",
            label: "v2",
            appVersion: "1.0.0",
            status: "DeploymentSucceeded",
            previousDeploymentKey: deployment.key,
            previousLabelOrAppVersion: "v1",
          }),
        }
      );
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ status: "ok" });
    });

    it("returns 200 for deployment report without status", async () => {
      const response = await SELF.fetch(
        "https://example.com/reportStatus/deploy",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            deploymentKey: deployment.key,
            clientUniqueId: "test-device",
            appVersion: "1.0.0",
          }),
        }
      );
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ status: "ok" });
    });

    it("handles deployment key with whitespace", async () => {
      const response = await SELF.fetch(
        "https://example.com/reportStatus/deploy",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            deploymentKey: `  ${deployment.key}  `,
            clientUniqueId: "test-device",
            appVersion: "1.0.0",
            status: "DeploymentSucceeded",
          }),
        }
      );
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ status: "ok" });
    });
  });

  describe("POST /reportStatus/download", () => {
    it("returns 400 if invalid json is sent", async () => {
      const response = await SELF.fetch(
        "https://example.com/reportStatus/download",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: "{invalid: json",
        }
      );
      expect(response.status).toBe(400);
    });

    it("returns 400 if deploymentKey is unspecified", async () => {
      const response = await SELF.fetch(
        "https://example.com/reportStatus/download",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            label: "v1",
            clientUniqueId: "test-device",
          }),
        }
      );
      expect(response.status).toBe(400);
    });

    it("returns 400 if label is unspecified", async () => {
      const response = await SELF.fetch(
        "https://example.com/reportStatus/download",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            deploymentKey: deployment.key,
            clientUniqueId: "test-device",
          }),
        }
      );
      expect(response.status).toBe(400);
    });

    it("returns 200 for valid download report", async () => {
      const response = await SELF.fetch(
        "https://example.com/reportStatus/download",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            deploymentKey: deployment.key,
            label: "v1",
            clientUniqueId: "test-device",
          }),
        }
      );
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ status: "ok" });
    });

    it("handles deployment key with whitespace", async () => {
      const response = await SELF.fetch(
        "https://example.com/reportStatus/download",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            deploymentKey: `  ${deployment.key}  `,
            label: "v1",
            clientUniqueId: "test-device",
          }),
        }
      );
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ status: "ok" });
    });
  });

  describe("Complex update scenarios", () => {
    it("returns appropriate update when multiple versions exist", async () => {
      const response = await SELF.fetch(
        `https://example.com/updateCheck?deploymentKey=${deployment2.key}&appVersion=1.0.0`
      );
      expect(response.status).toBe(200);

      const data = UpdateCheckResponseSchema.parse(await response.json());
      expect(data.updateInfo.isAvailable).toBe(true);
      expect(data.updateInfo.label).toBe("v4");
      expect(data.updateInfo.appVersion).toBe("1.0.0");
    });

    it("handles disabled packages correctly", async () => {
      const response = await SELF.fetch(
        `https://example.com/updateCheck?deploymentKey=${deployment2.key}&appVersion=3.0.0&packageHash=${packages2[2].packageHash}`
      );
      expect(response.status).toBe(200);

      const data = UpdateCheckResponseSchema.parse(await response.json());
      expect(data.updateInfo.isAvailable).toBe(true);
      expect(data.updateInfo.label).toBe("v7");
    });

    it("respects mandatory updates", async () => {
      const response = await SELF.fetch(
        `https://example.com/updateCheck?deploymentKey=${deployment2.key}&appVersion=3.0.0&packageHash=${packages2[4].packageHash}`
      );
      expect(response.status).toBe(200);

      const data = UpdateCheckResponseSchema.parse(await response.json());
      expect(data.updateInfo.isAvailable).toBe(true);
      expect(data.updateInfo.isMandatory).toBe(false);
      expect(data.updateInfo.label).toBe("v7");
    });

    it("handles rollout with specific client ID", async () => {
      // Set a rollout
      await db
        .update(schema.packages)
        .set({ rollout: 50 })
        .where(eq(schema.packages.id, packages2[6].id));

      const response = await SELF.fetch(
        `https://example.com/updateCheck?deploymentKey=${deployment2.key}&appVersion=3.0.0&clientUniqueId=specific-device`
      );
      expect(response.status).toBe(200);

      const data = UpdateCheckResponseSchema.parse(await response.json());
      // Result depends on hash of clientUniqueId+releaseLabel
      expect(data.updateInfo.isAvailable).toBeDefined();
    });

    it("returns no update when rollout excludes client", async () => {
      await db
        .update(schema.packages)
        .set({ rollout: 0 })
        .where(eq(schema.packages.id, packages2[6].id));

      const response = await SELF.fetch(
        `https://example.com/updateCheck?deploymentKey=${deployment2.key}&appVersion=3.0.0&clientUniqueId=any-device`
      );
      expect(response.status).toBe(200);

      const json = await response.json();
      const data = UpdateCheckResponseSchema.parse(json);
      expect(data.updateInfo.isAvailable).toBe(false);
    });

    it("returns update for companion app regardless of version", async () => {
      const response = await SELF.fetch(
        `https://example.com/updateCheck?deploymentKey=${deployment2.key}&appVersion=4.0.0&isCompanion=true`
      );
      expect(response.status).toBe(200);

      const data = UpdateCheckResponseSchema.parse(await response.json());
      expect(data.updateInfo.isAvailable).toBe(true);
    });

    describe("Version compatibility", () => {
      beforeEach(async () => {
        // Add a package with version range
        const blobPath = generateKey("hash207-v8-");
        const manifestBlobPath = generateKey("hash207-v8-");
        await db.insert(schema.packages).values(
          createTestPackage(deployment2.id, {
            label: "v8",
            packageHash: "hash207",
            appVersion: "^2.0.0",
            description: "Package for v2.x",
            blobPath,
            manifestBlobPath,
          }),
        );

        await Promise.all([
          createTestBlob(blobPath, "test content"),
          createTestBlob(manifestBlobPath, "{}"),
        ]);
      });

      it("matches exact versions", async () => {
        const response = await SELF.fetch(
          `https://example.com/updateCheck?deploymentKey=${deployment2.key}&appVersion=2.0.0`
        );
        expect(response.status).toBe(200);

        const data = UpdateCheckResponseSchema.parse(await response.json());
        expect(data.updateInfo.isAvailable).toBe(true);
        expect(data.updateInfo.label).toBe("v8");
      });

      it("matches version ranges", async () => {
        const response = await SELF.fetch(
          `https://example.com/updateCheck?deploymentKey=${deployment2.key}&appVersion=2.1.0`
        );
        expect(response.status).toBe(200);

        const data = UpdateCheckResponseSchema.parse(await response.json());
        expect(data.updateInfo.isAvailable).toBe(true);
        expect(data.updateInfo.label).toBe("v8");
      });

      it("handles pre-release versions correctly", async () => {
        const response = await SELF.fetch(
          `https://example.com/updateCheck?deploymentKey=${deployment2.key}&appVersion=2.0.0-beta`
        );
        expect(response.status).toBe(200);

        const json = await response.json();
        const data = UpdateCheckResponseSchema.parse(json);
        expect(data.updateInfo.isAvailable).toBe(true);
      });
    });
  });

  // 테스트 런타임에는 ctx.exports가 없어 게이트웨이가 앱을 바로 부른다.
  // 그래서 라우트가 붙인 저장 헤더가 응답에 그대로 보인다.
  describe("update_check 저장 헤더", () => {
    const LEGACY_PATH = "https://example.com/v0.1/public/codepush/update_check";
    const cacheHeader = (response: Response) =>
      response.headers.get(CDN_CACHE_CONTROL_HEADER);

    const setRollout = (rollout: number) =>
      db
        .update(schema.packages)
        .set({ rollout })
        .where(eq(schema.packages.id, packages[2].id));

    it("새 경로의 정상 응답에 저장 헤더를 붙인다", async () => {
      const response = await SELF.fetch(
        `https://example.com/updateCheck?deploymentKey=${deployment.key}&appVersion=1.0.0&clientUniqueId=device-a`,
      );
      expect(response.status).toBe(200);
      expect(cacheHeader(response)).toBe(UPDATE_CHECK_CACHE_CONTROL);
      expect(response.headers.has("Cache-Control")).toBe(false);
    });

    it("옛 경로의 정상 응답에 저장 헤더를 붙인다", async () => {
      const response = await SELF.fetch(
        `${LEGACY_PATH}?deployment_key=${deployment.key}&app_version=1.0.0&client_unique_id=device-a`,
      );
      expect(response.status).toBe(200);
      const data = (await response.json()) as {
        update_info: { is_available: boolean; label: string };
      };
      expect(data.update_info.is_available).toBe(true);
      expect(data.update_info.label).toBe("v3");
      expect(cacheHeader(response)).toBe(UPDATE_CHECK_CACHE_CONTROL);
    });

    // packageHash가 매번 새로 만들어져, 받는 기기와 못 받는 기기를 하나씩 골라 둘 다 본다.
    const devicesOnBothSidesOfRollout = (rollout: number) => {
      const candidates = Array.from({ length: 50 }, (_, i) => `device-${i}`);
      const hash = packages[2].packageHash;
      return [
        {
          device: candidates.find((d) => rolloutStrategy(d, rollout, hash)),
          isAvailable: true,
        },
        {
          device: candidates.find((d) => !rolloutStrategy(d, rollout, hash)),
          isAvailable: false,
        },
      ];
    };

    it("rollout 중인 패키지는 받는 기기와 못 받는 기기 응답 모두에 붙이지 않는다", async () => {
      await setRollout(50);

      for (const { device, isAvailable } of devicesOnBothSidesOfRollout(50)) {
        const response = await SELF.fetch(
          `https://example.com/updateCheck?deploymentKey=${deployment.key}&appVersion=1.0.0&clientUniqueId=${device}`,
        );
        expect(response.status).toBe(200);
        const data = UpdateCheckResponseSchema.parse(await response.json());
        expect(data.updateInfo.isAvailable).toBe(isAvailable);
        expect(cacheHeader(response)).toBeNull();
      }
    });

    it("옛 경로의 rollout 응답도 받는 기기와 못 받는 기기 모두에 붙이지 않는다", async () => {
      await setRollout(50);

      for (const { device, isAvailable } of devicesOnBothSidesOfRollout(50)) {
        const response = await SELF.fetch(
          `${LEGACY_PATH}?deployment_key=${deployment.key}&app_version=1.0.0&client_unique_id=${device}`,
        );
        expect(response.status).toBe(200);
        const data = (await response.json()) as {
          update_info: { is_available: boolean };
        };
        expect(data.update_info.is_available).toBe(isAvailable);
        expect(cacheHeader(response)).toBeNull();
      }
    });

    it("rollout 0에도 붙이지 않는다", async () => {
      await setRollout(0);

      const response = await SELF.fetch(
        `https://example.com/updateCheck?deploymentKey=${deployment.key}&appVersion=1.0.0&clientUniqueId=device-a`,
      );
      expect(response.status).toBe(200);
      expect(cacheHeader(response)).toBeNull();
    });

    it("rollout 중인데 기기 ID가 없는 응답에도 붙이지 않는다", async () => {
      await setRollout(50);

      const response = await SELF.fetch(
        `https://example.com/updateCheck?deploymentKey=${deployment.key}&appVersion=1.0.0`,
      );
      expect(response.status).toBe(200);
      expect(cacheHeader(response)).toBeNull();
    });

    it("rollout 중이어도 이미 그 번들인 기기의 응답에는 붙인다", async () => {
      await setRollout(50);

      const response = await SELF.fetch(
        `https://example.com/updateCheck?deploymentKey=${deployment.key}&appVersion=1.0.0&packageHash=${packages[2].packageHash}&clientUniqueId=device-a`,
      );
      expect(response.status).toBe(200);
      const data = UpdateCheckResponseSchema.parse(await response.json());
      expect(data.updateInfo.isAvailable).toBe(false);
      expect(cacheHeader(response)).toBe(UPDATE_CHECK_CACHE_CONTROL);
    });

    it("옛 경로가 없는 배포 키를 200으로 바꾼 응답에는 붙이지 않는다", async () => {
      const response = await SELF.fetch(
        `${LEGACY_PATH}?deployment_key=not-exists&app_version=1.0.0`,
      );
      expect(response.status).toBe(200);
      const data = (await response.json()) as {
        update_info: { is_available: boolean };
      };
      expect(data.update_info.is_available).toBe(false);
      expect(cacheHeader(response)).toBeNull();
    });

    it("404와 400에는 붙이지 않는다", async () => {
      const notFound = await SELF.fetch(
        "https://example.com/updateCheck?deploymentKey=not-exists&appVersion=1.0.0",
      );
      expect(notFound.status).toBe(404);
      expect(cacheHeader(notFound)).toBeNull();

      const badRequest = await SELF.fetch("https://example.com/updateCheck");
      expect(badRequest.status).toBe(400);
      expect(cacheHeader(badRequest)).toBeNull();
    });

    it("D1 에러로 500이 나면 두 경로 모두 붙이지 않는다", async () => {
      await env.DB.exec("ALTER TABLE deployment RENAME TO deployment_renamed");
      try {
        const responses = await Promise.all([
          SELF.fetch(
            `https://example.com/updateCheck?deploymentKey=${deployment.key}&appVersion=1.0.0`,
          ),
          SELF.fetch(
            `${LEGACY_PATH}?deployment_key=${deployment.key}&app_version=1.0.0`,
          ),
        ]);
        for (const response of responses) {
          expect(response.status).toBe(500);
          expect(cacheHeader(response)).toBeNull();
        }
      } finally {
        await env.DB.exec(
          "ALTER TABLE deployment_renamed RENAME TO deployment",
        );
      }
    });

    it("update_check가 아닌 응답에는 붙이지 않는다", async () => {
      const response = await SELF.fetch("https://example.com/health");
      expect(response.status).toBe(200);
      expect(cacheHeader(response)).toBeNull();
    });
  });
});
