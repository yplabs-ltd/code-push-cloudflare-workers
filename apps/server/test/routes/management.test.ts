import { SELF, env } from "cloudflare:test";
import { and, eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { z } from "zod";
import * as schema from "../../src/db/schema";
import {
  AccessKeySchema,
  AppSchema,
  CollaboratorSchema,
  DeploymentSchema,
  MetricsSchema,
} from "../../src/types/schemas";
import { generateKey } from "../../src/utils/security";
import { urlEncode } from "../../src/utils/urlencode";
import {
  DEFAULT_TEST_USER,
  type TestAuth,
  type TestUser,
  createTestAuth,
} from "../utils/auth";
import { cleanupDatabase, getTestDb } from "../utils/db";
import {
  createTestAccount,
  createTestApp,
  createTestBlob,
  createTestDeployment,
  createTestPackage,
} from "../utils/fixtures";

describe("Management Routes", () => {
  let auth: TestAuth;
  const db = getTestDb();

  beforeEach(async () => {
    await cleanupDatabase();
    auth = createTestAuth(env.DB, env.JWT_SECRET);
    await auth.setupTestAccount(DEFAULT_TEST_USER);
  });

  afterEach(async () => {
    await auth.cleanup();
    await cleanupDatabase();
  });

  describe("AccessKeys", () => {
    describe("GET /accessKeys", () => {
      it("should list all access keys", async () => {
        const headers = await auth.getAuthHeaders();

        // Create test keys
        await auth.createTestAccessKey();
        await auth.createTestAccessKey();

        const response = await SELF.fetch("https://example.com/accessKeys", {
          headers,
        });

        expect(response.status).toBe(200);
        const data = await response.json();

        // Validate response schema
        const validated = z
          .object({
            accessKeys: z.array(AccessKeySchema),
          })
          .parse(data);

        expect(validated.accessKeys).toHaveLength(3);
        expect(validated.accessKeys[0].name).toBe("(hidden)"); // Keys should be masked
        expect(validated.accessKeys[1].name).toBe("(hidden)");
        expect(validated.accessKeys[2].name).toBe("(hidden)");
      });

      it("returns 401 when not authenticated", async () => {
        const response = await SELF.fetch("https://example.com/accessKeys");
        expect(response.status).toBe(401);
      });
    });

    describe("POST /accessKeys", () => {
      it("creates new access key with defaults", async () => {
        const headers = await auth.getAuthHeaders();

        const response = await SELF.fetch("https://example.com/accessKeys", {
          method: "POST",
          headers,
          body: JSON.stringify({
            friendlyName: "Test Key",
          }),
        });

        expect(response.status).toBe(201);

        const data = await response.json();
        const validated = z
          .object({
            accessKey: AccessKeySchema,
          })
          .parse(data);

        expect(validated.accessKey.friendlyName).toBe("Test Key");
        expect(validated.accessKey.name).toMatch(/^ck_/);
        expect(validated.accessKey.createdBy).toBeDefined();
        expect(validated.accessKey.expires).toBeGreaterThan(Date.now());
      });

      it("creates key with custom TTL", async () => {
        const headers = await auth.getAuthHeaders();
        const ttl = 3600000; // 1 hour

        const response = await SELF.fetch("https://example.com/accessKeys", {
          method: "POST",
          headers,
          body: JSON.stringify({
            friendlyName: "Test Key",
            ttl,
          }),
        });

        expect(response.status).toBe(201);

        const data = await response.json();
        const validated = z
          .object({
            accessKey: AccessKeySchema,
          })
          .parse(data);

        expect(validated.accessKey.expires).toBeLessThanOrEqual(
          Date.now() + ttl + 1000
        );
      });

      it("validates friendlyName", async () => {
        const headers = await auth.getAuthHeaders();

        const response = await SELF.fetch("https://example.com/accessKeys", {
          method: "POST",
          headers,
          body: JSON.stringify({
            friendlyName: "",
          }),
        });

        expect(response.status).toBe(400);
      });

      it("prevents duplicate friendlyNames", async () => {
        const headers = await auth.getAuthHeaders();

        // Create first key
        await SELF.fetch("https://example.com/accessKeys", {
          method: "POST",
          headers,
          body: JSON.stringify({
            friendlyName: "Test Key",
          }),
        });

        // Attempt duplicate
        const response = await SELF.fetch("https://example.com/accessKeys", {
          method: "POST",
          headers,
          body: JSON.stringify({
            friendlyName: "Test Key",
          }),
        });

        expect(response.status).toBe(409);
      });
    });

    describe("GET /accessKeys/:name", () => {
      it("gets access key by name", async () => {
        const headers = await auth.getAuthHeaders();
        const key = await auth.createTestAccessKey();

        const response = await SELF.fetch(
          `https://example.com/accessKeys/${key.name}`,
          {
            headers,
          }
        );

        expect(response.status).toBe(200);

        const data = await response.json();
        const validated = z
          .object({
            accessKey: AccessKeySchema,
          })
          .parse(data);

        expect(validated.accessKey.friendlyName).toBe(key.friendlyName);
        expect(validated.accessKey.name).toBeUndefined(); // Should be removed
      });

      it("gets access key by friendlyName", async () => {
        const headers = await auth.getAuthHeaders();
        const key = await auth.createTestAccessKey();

        const response = await SELF.fetch(
          `https://example.com/accessKeys/${key.friendlyName}`,
          {
            headers,
          }
        );

        expect(response.status).toBe(200);

        const data = await response.json();

        const validated = z
          .object({
            accessKey: AccessKeySchema,
          })
          .parse(data);

        expect(validated.accessKey.friendlyName).toBe(key.friendlyName);
      });

      it("returns 404 for non-existent key", async () => {
        const headers = await auth.getAuthHeaders();

        const response = await SELF.fetch(
          "https://example.com/accessKeys/non-existent",
          {
            headers,
          }
        );

        expect(response.status).toBe(404);
      });
    });

    describe("PATCH /accessKeys/:name", () => {
      it("updates access key friendlyName", async () => {
        const headers = await auth.getAuthHeaders();
        const key = await auth.createTestAccessKey();

        const response = await SELF.fetch(
          `https://example.com/accessKeys/${key.name}`,
          {
            method: "PATCH",
            headers,
            body: JSON.stringify({
              friendlyName: "Updated Name",
            }),
          }
        );

        expect(response.status).toBe(200);

        const data = await response.json();
        const validated = z
          .object({
            accessKey: AccessKeySchema,
          })
          .parse(data);

        expect(validated.accessKey.friendlyName).toBe("Updated Name");
      });

      it("updates access key TTL", async () => {
        const headers = await auth.getAuthHeaders();
        const key = await auth.createTestAccessKey();
        const ttl = 7200000; // 2 hours

        const response = await SELF.fetch(
          `https://example.com/accessKeys/${key.name}`,
          {
            method: "PATCH",
            headers,
            body: JSON.stringify({
              ttl,
            }),
          }
        );

        expect(response.status).toBe(200);

        const data = await response.json();
        const validated = z
          .object({
            accessKey: AccessKeySchema,
          })
          .parse(data);

        expect(validated.accessKey.expires).toBeLessThanOrEqual(
          Date.now() + ttl + 1000
        );
      });

      it("prevents duplicate friendlyName", async () => {
        const headers = await auth.getAuthHeaders();
        const key1 = await auth.createTestAccessKey();
        const key2 = await auth.createTestAccessKey();

        const response = await SELF.fetch(
          `https://example.com/accessKeys/${key2.name}`,
          {
            method: "PATCH",
            headers,
            body: JSON.stringify({
              friendlyName: key1.friendlyName,
            }),
          }
        );

        expect(response.status).toBe(409);
      });

      it("validates ttl", async () => {
        const headers = await auth.getAuthHeaders();
        const key = await auth.createTestAccessKey();

        const response = await SELF.fetch(
          `https://example.com/accessKeys/${key.name}`,
          {
            method: "PATCH",
            headers,
            body: JSON.stringify({
              ttl: -1,
            }),
          }
        );

        expect(response.status).toBe(400);
      });
    });

    describe("DELETE /accessKeys/:name", () => {
      it("deletes access key by name", async () => {
        const headers = await auth.getAuthHeaders();
        const key = await auth.createTestAccessKey();

        const response = await SELF.fetch(
          `https://example.com/accessKeys/${key.name}`,
          {
            method: "DELETE",
            headers,
          }
        );

        expect(response.status).toBe(204);

        // Verify deletion
        const getResponse = await SELF.fetch(
          `https://example.com/accessKeys/${key.name}`,
          {
            headers,
          }
        );
        expect(getResponse.status).toBe(404);
      });

      it("returns 404 for non-existent key", async () => {
        const headers = await auth.getAuthHeaders();

        const response = await SELF.fetch(
          "https://example.com/accessKeys/non-existent",
          {
            method: "DELETE",
            headers,
          }
        );

        expect(response.status).toBe(404);
      });
    });
  });

  describe("Apps", () => {
    describe("GET /apps", () => {
      it("lists all apps for account", async () => {
        const headers = await auth.getAuthHeaders();

        // Create test apps
        const app1 = createTestApp({
          name: `test-app-1-${generateKey()}`,
          createdTime: Date.now(),
        });
        const app2 = createTestApp({
          name: `test-app-2-${generateKey()}`,
          createdTime: app1.createdTime + 1000,
        });
        await db.insert(schema.app).values([app1, app2]);

        // Add collaborations
        await db.insert(schema.collaborator).values([
          {
            appId: app1.id,
            accountId: auth.getCurrentAccountId(),
            permission: "Owner",
          },
          {
            appId: app2.id,
            accountId: auth.getCurrentAccountId(),
            permission: "Collaborator",
          },
        ]);

        const response = await SELF.fetch("https://example.com/apps", {
          headers,
        });

        expect(response.status).toBe(200);
        const data = await response.json();
        const validated = z
          .object({
            apps: z.array(AppSchema),
          })
          .parse(data);

        expect(validated.apps).toHaveLength(2);
        expect(
          validated.apps[0].collaborators[auth.getCurrentEmail()].permission
        ).toBe("Owner");
        expect(
          validated.apps[1].collaborators[auth.getCurrentEmail()].permission
        ).toBe("Collaborator");
      });

      it("sorts apps by name", async () => {
        const headers = await auth.getAuthHeaders();

        const app1 = createTestApp();
        const app2 = createTestApp();
        app1.name = "zzz-app";
        app2.name = "aaa-app";

        await db.insert(schema.app).values([app1, app2]);
        await db.insert(schema.collaborator).values([
          {
            appId: app1.id,
            accountId: auth.getCurrentAccountId(),
            permission: "Owner",
          },
          {
            appId: app2.id,
            accountId: auth.getCurrentAccountId(),
            permission: "Owner",
          },
        ]);

        const response = await SELF.fetch("https://example.com/apps", {
          headers,
        });

        expect(response.status).toBe(200);
        const data = await response.json();
        const validated = z
          .object({
            apps: z.array(AppSchema),
          })
          .parse(data);

        expect(validated.apps[0].name).toBe("aaa-app");
        expect(validated.apps[1].name).toBe("zzz-app");
      });

      it("returns empty array when no apps exist", async () => {
        const headers = await auth.getAuthHeaders();

        const response = await SELF.fetch("https://example.com/apps", {
          headers,
        });

        expect(response.status).toBe(200);
        const data = await response.json();
        const validated = z
          .object({
            apps: z.array(AppSchema),
          })
          .parse(data);

        expect(validated.apps).toHaveLength(0);
      });
    });

    describe("POST /apps", () => {
      it("creates new app with default deployments", async () => {
        const headers = await auth.getAuthHeaders();

        const response = await SELF.fetch("https://example.com/apps/", {
          method: "POST",
          headers,
          body: JSON.stringify({
            name: "test-app",
          }),
        });

        expect(response.status).toBe(201);
        const data = await response.json();
        const validated = z
          .object({
            app: AppSchema,
          })
          .parse(data);

        expect(validated.app.name).toBe("test-app");
        expect(validated.app.deployments).toEqual(["Production", "Staging"]);
        expect(
          validated.app.collaborators[auth.getCurrentEmail()].permission
        ).toBe("Owner");

        // Verify deployments were created
        const deployments = await db.query.deployment.findMany({
          where: eq(schema.deployment.appId, validated.app.id),
        });
        expect(deployments).toHaveLength(2);
        expect(deployments.map((d) => d.name).sort()).toEqual([
          "Production",
          "Staging",
        ]);
      });

      it("creates app without default deployments when specified", async () => {
        const headers = await auth.getAuthHeaders();

        const response = await SELF.fetch("https://example.com/apps/", {
          method: "POST",
          headers,
          body: JSON.stringify({
            name: "test-app",
            manuallyProvisionDeployments: true,
          }),
        });

        expect(response.status).toBe(201);
        const data = await response.json();
        const validated = z
          .object({
            app: AppSchema,
          })
          .parse(data);

        expect(validated.app.name).toBe("test-app");
        expect(validated.app.deployments).toHaveLength(0);

        // Verify no deployments were created
        const deployments = await db.query.deployment.findMany({
          where: eq(schema.deployment.appId, validated.app.id),
        });
        expect(deployments).toHaveLength(0);
      });

      it("prevents duplicate app names", async () => {
        const headers = await auth.getAuthHeaders();

        // Create first app
        await SELF.fetch("https://example.com/apps/", {
          method: "POST",
          headers,
          body: JSON.stringify({
            name: "test-app",
          }),
        });

        // Try to create duplicate
        const response = await SELF.fetch("https://example.com/apps/", {
          method: "POST",
          headers,
          body: JSON.stringify({
            name: "test-app",
          }),
        });

        expect(response.status).toBe(409);
      });

      it("validates app name", async () => {
        const headers = await auth.getAuthHeaders();

        const response = await SELF.fetch("https://example.com/apps/", {
          method: "POST",
          headers,
          body: JSON.stringify({
            name: "", // Invalid empty name
          }),
        });

        expect(response.status).toBe(400);
      });
    });

    describe("GET /apps/:name", () => {
      it("gets app by name", async () => {
        const headers = await auth.getAuthHeaders();

        // Create test app
        const app = createTestApp();
        await db.insert(schema.app).values(app);
        await db.insert(schema.collaborator).values({
          appId: app.id,
          accountId: auth.getCurrentAccountId(),
          permission: "Owner",
        });

        const response = await SELF.fetch(
          `https://example.com/apps/${app.name}`,
          {
            headers,
          }
        );

        expect(response.status).toBe(200);
        const data = await response.json();
        const validated = z
          .object({
            app: AppSchema,
          })
          .parse(data);

        expect(validated.app.name).toBe(app.name);
        expect(validated.app.id).toBe(app.id);
      });

      it("returns 404 for non-existent app", async () => {
        const headers = await auth.getAuthHeaders();

        const response = await SELF.fetch(
          "https://example.com/apps/non-existent",
          {
            headers,
          }
        );

        expect(response.status).toBe(404);
      });

      it("returns 404 if user has no access", async () => {
        const headers = await auth.getAuthHeaders();

        const app = createTestApp();
        const testUser: TestUser = {
          email: "test2@example.com",
          name: "Test User",
        };
        const { account: otherAccount } = await auth.createTestAccount(
          testUser
        );
        await db.insert(schema.app).values(app);
        await db.insert(schema.collaborator).values({
          appId: app.id,
          accountId: otherAccount.id,
          permission: "Owner",
        });

        const response = await SELF.fetch(
          `https://example.com/apps/${app.name}`,
          {
            headers,
          }
        );

        expect(response.status).toBe(404);
      });
    });

    describe("PATCH /apps/:name", () => {
      it("updates app name", async () => {
        const headers = await auth.getAuthHeaders();

        // Create test app
        const app = createTestApp();
        await db.insert(schema.app).values(app);
        await db.insert(schema.collaborator).values({
          appId: app.id,
          accountId: auth.getCurrentAccountId(),
          permission: "Owner",
        });

        const response = await SELF.fetch(
          `https://example.com/apps/${app.name}`,
          {
            method: "PATCH",
            headers,
            body: JSON.stringify({
              name: "updated-name",
            }),
          }
        );

        expect(response.status).toBe(200);
        const data = await response.json();
        const validated = z
          .object({
            app: AppSchema,
          })
          .parse(data);

        expect(validated.app.name).toBe("updated-name");
      });

      it("prevents duplicate names", async () => {
        const headers = await auth.getAuthHeaders();

        // Create two apps
        const app1 = createTestApp();
        const app2 = createTestApp();
        await db.insert(schema.app).values([app1, app2]);
        await db.insert(schema.collaborator).values([
          {
            appId: app1.id,
            accountId: auth.getCurrentAccountId(),
            permission: "Owner",
          },
          {
            appId: app2.id,
            accountId: auth.getCurrentAccountId(),
            permission: "Owner",
          },
        ]);

        // Try to update app2 to app1's name
        const response = await SELF.fetch(
          `https://example.com/apps/${app2.name}`,
          {
            method: "PATCH",
            headers,
            body: JSON.stringify({
              name: app1.name,
            }),
          }
        );

        expect(response.status).toBe(409);
      });

      it("requires owner permission", async () => {
        const headers = await auth.getAuthHeaders();

        // Create app where user is collaborator
        const app = createTestApp();
        await db.insert(schema.app).values(app);
        await db.insert(schema.collaborator).values({
          appId: app.id,
          accountId: auth.getCurrentAccountId(),
          permission: "Collaborator",
        });

        const response = await SELF.fetch(
          `https://example.com/apps/${app.name}`,
          {
            method: "PATCH",
            headers,
            body: JSON.stringify({
              name: "new-name",
            }),
          }
        );

        expect(response.status).toBe(403);
      });
    });

    describe("DELETE /apps/:name", () => {
      it("deletes app and related resources", async () => {
        const headers = await auth.getAuthHeaders();

        // Create test app with deployments and packages
        const app = createTestApp();
        const deployment = createTestDeployment(app.id);
        const package1 = createTestPackage(deployment.id);

        await db.insert(schema.app).values(app);
        await db.insert(schema.collaborator).values({
          appId: app.id,
          accountId: auth.getCurrentAccountId(),
          permission: "Owner",
        });
        await db.insert(schema.deployment).values(deployment);
        await db.insert(schema.packages).values(package1);

        const response = await SELF.fetch(
          `https://example.com/apps/${app.name}`,
          {
            method: "DELETE",
            headers,
          }
        );

        expect(response.status).toBe(204);

        // Verify cascade deletion
        const removedApp = await db.query.app.findFirst({
          where: eq(schema.app.id, app.id),
          columns: {
            deletedAt: true,
          },
        });
        expect(removedApp?.deletedAt).toBeGreaterThan(0);
      });

      it("requires owner permission", async () => {
        const headers = await auth.getAuthHeaders();

        // Create app where user is collaborator
        const app = createTestApp();
        await db.insert(schema.app).values(app);
        await db.insert(schema.collaborator).values({
          appId: app.id,
          accountId: auth.getCurrentAccountId(),
          permission: "Collaborator",
        });

        const response = await SELF.fetch(
          `https://example.com/apps/${app.name}`,
          {
            method: "DELETE",
            headers,
          }
        );

        expect(response.status).toBe(403);
      });

      it("returns 404 for non-existent app", async () => {
        const headers = await auth.getAuthHeaders();

        const response = await SELF.fetch(
          "https://example.com/apps/non-existent",
          {
            method: "DELETE",
            headers,
          }
        );

        expect(response.status).toBe(404);
      });
    });

    describe("POST /apps/:name/transfer/:email", () => {
      it("transfers app ownership", async () => {
        const headers = await auth.getAuthHeaders();

        // Create test app and target account
        const app = createTestApp();
        const testUser: TestUser = {
          email: "test2@example.com",
          name: "Test User 2",
        };
        const { account: targetAccount } = await auth.createTestAccount(
          testUser
        );

        await db.insert(schema.app).values(app);
        await db.insert(schema.collaborator).values({
          appId: app.id,
          accountId: auth.getCurrentAccountId(),
          permission: "Owner",
        });

        const response = await SELF.fetch(
          `https://example.com/apps/${app.name}/transfer/${targetAccount.email}`,
          {
            method: "POST",
            headers,
          }
        );

        expect(response.status).toBe(201);

        // Verify ownership transfer
        const collaborators = await db.query.collaborator.findMany({
          where: eq(schema.collaborator.appId, app.id),
        });

        const originalOwner = collaborators.find(
          (c) => c.accountId === auth.getCurrentAccountId()
        );
        expect(originalOwner?.permission).toBe("Collaborator");

        const newOwner = collaborators.find(
          (c) => c.accountId === targetAccount.id
        );
        expect(newOwner?.permission).toBe("Owner");
      });

      it("prevents transfer to non-existent account", async () => {
        const headers = await auth.getAuthHeaders();

        const app = createTestApp();
        await db.insert(schema.app).values(app);
        await db.insert(schema.collaborator).values({
          appId: app.id,
          accountId: auth.getCurrentAccountId(),
          permission: "Owner",
        });

        const response = await SELF.fetch(
          `https://example.com/apps/${app.name}/transfer/non-existent@example.com`,
          {
            method: "POST",
            headers,
          }
        );

        expect(response.status).toBe(404);
      });

      it("requires owner permission", async () => {
        const headers = await auth.getAuthHeaders();

        const app = createTestApp();
        const targetAccount = createTestAccount();
        await db.insert(schema.account).values(targetAccount);
        await db.insert(schema.app).values(app);
        await db.insert(schema.collaborator).values({
          appId: app.id,
          accountId: auth.getCurrentAccountId(),
          permission: "Collaborator",
        });

        const response = await SELF.fetch(
          `https://example.com/apps/${app.name}/transfer/${targetAccount.email}`,
          {
            method: "POST",
            headers,
          }
        );

        expect(response.status).toBe(403);
      });
    });
  });

  describe("Deployments", () => {
    let app: typeof schema.app.$inferInsert;

    beforeEach(async () => {
      // Create test app
      app = createTestApp();
      await db.insert(schema.app).values(app);
      await db.insert(schema.collaborator).values({
        appId: app.id,
        accountId: auth.getCurrentAccountId(),
        permission: "Owner",
      });
    });

    describe("GET /apps/:name/deployments", () => {
      it("lists all deployments", async () => {
        const headers = await auth.getAuthHeaders();

        const deployment1 = createTestDeployment(app.id);
        const deployment2 = createTestDeployment(app.id);
        await db.insert(schema.deployment).values([deployment1, deployment2]);

        const response = await SELF.fetch(
          `https://example.com/apps/${app.name}/deployments/`,
          { headers }
        );

        expect(response.status).toBe(200);
        const data = await response.json();
        const validated = z
          .object({
            deployments: z.array(DeploymentSchema),
          })
          .parse(data);

        expect(validated.deployments).toHaveLength(2);
        expect(validated.deployments[0].key).toBeDefined();
        expect(validated.deployments[1].key).toBeDefined();
      });

      it("sorts deployments by name", async () => {
        const headers = await auth.getAuthHeaders();

        const deployment1 = createTestDeployment(app.id);
        const deployment2 = createTestDeployment(app.id);
        deployment1.name = "zzz-deployment";
        deployment2.name = "aaa-deployment";
        await db.insert(schema.deployment).values([deployment1, deployment2]);

        const response = await SELF.fetch(
          `https://example.com/apps/${app.name}/deployments/`,
          { headers }
        );

        expect(response.status).toBe(200);
        const data = await response.json();
        const validated = z
          .object({
            deployments: z.array(DeploymentSchema),
          })
          .parse(data);

        expect(validated.deployments[0].name).toBe("aaa-deployment");
        expect(validated.deployments[1].name).toBe("zzz-deployment");
      });

      it("requires collaborator permission", async () => {
        const headers = await auth.getAuthHeaders();

        // Remove collaborator permission
        await db
          .delete(schema.collaborator)
          .where(eq(schema.collaborator.appId, app.id));

        const response = await SELF.fetch(
          `https://example.com/apps/${app.name}/deployments`,
          { headers }
        );

        expect(response.status).toBe(404);
      });
    });

    describe("POST /apps/:name/deployments", () => {
      it("creates new deployment", async () => {
        const headers = await auth.getAuthHeaders();

        const response = await SELF.fetch(
          `https://example.com/apps/${app.name}/deployments/`,
          {
            method: "POST",
            headers,
            body: JSON.stringify({
              name: "test-deployment",
            }),
          }
        );

        expect(response.status).toBe(201);
        const data = await response.json();
        const validated = z
          .object({
            deployment: DeploymentSchema,
          })
          .parse(data);

        expect(validated.deployment.name).toBe("test-deployment");
        expect(validated.deployment.key).toMatch(/^dk_/);
      });

      it("creates deployment with custom key", async () => {
        const headers = await auth.getAuthHeaders();
        const customKey = `dk_${generateKey()}`;

        const response = await SELF.fetch(
          `https://example.com/apps/${app.name}/deployments/`,
          {
            method: "POST",
            headers,
            body: JSON.stringify({
              name: "test-deployment",
              key: customKey,
            }),
          }
        );

        expect(response.status).toBe(201);
        const data = await response.json();
        const validated = z
          .object({
            deployment: DeploymentSchema,
          })
          .parse(data);

        expect(validated.deployment.key).toBe(customKey);
      });

      it("prevents duplicate deployment names", async () => {
        const headers = await auth.getAuthHeaders();

        // Create first deployment
        await SELF.fetch(`https://example.com/apps/${app.name}/deployments/`, {
          method: "POST",
          headers,
          body: JSON.stringify({
            name: "test-deployment",
          }),
        });

        // Try to create duplicate
        const response = await SELF.fetch(
          `https://example.com/apps/${app.name}/deployments/`,
          {
            method: "POST",
            headers,
            body: JSON.stringify({
              name: "test-deployment",
            }),
          }
        );

        expect(response.status).toBe(409);
      });

      it("requires owner permission", async () => {
        const headers = await auth.getAuthHeaders();

        // Change to collaborator
        await db
          .update(schema.collaborator)
          .set({ permission: "Collaborator" })
          .where(eq(schema.collaborator.appId, app.id));

        const response = await SELF.fetch(
          `https://example.com/apps/${app.name}/deployments/`,
          {
            method: "POST",
            headers,
            body: JSON.stringify({
              name: "test-deployment",
            }),
          }
        );

        expect(response.status).toBe(403);
      });
    });

    describe("GET /apps/:name/deployments/:deploymentName", () => {
      it("gets deployment details", async () => {
        const headers = await auth.getAuthHeaders();

        const deployment = createTestDeployment(app.id);
        await db.insert(schema.deployment).values(deployment);

        const response = await SELF.fetch(
          urlEncode`https://example.com/apps/${app.name}/deployments/${deployment.name}`,
          { headers }
        );

        expect(response.status).toBe(200);
        const data = await response.json();
        const validated = z
          .object({
            deployment: DeploymentSchema,
          })
          .parse(data);

        expect(validated.deployment.name).toBe(deployment.name);
        expect(validated.deployment.key).toBe(deployment.key);
      });

      it("includes latest package info", async () => {
        const headers = await auth.getAuthHeaders();

        const deployment = createTestDeployment(app.id);
        await db.insert(schema.deployment).values(deployment);

        const pkg = createTestPackage(deployment.id);
        await db.insert(schema.packages).values(pkg);

        // create blobs
        await Promise.all([
          createTestBlob(pkg.blobPath, "blob1"),
          createTestBlob(pkg.manifestBlobPath as string, "blob2"),
        ]);

        const response = await SELF.fetch(
          urlEncode`https://example.com/apps/${app.name}/deployments/${deployment.name}`,
          { headers }
        );

        expect(response.status).toBe(200);
        const data = await response.json();
        const validated = z
          .object({
            deployment: DeploymentSchema,
          })
          .parse(data);

        expect(validated.deployment.package).toBeDefined();
        expect(validated.deployment.package?.label).toBe(pkg.label);
        expect(validated.deployment.package?.packageHash).toBe(pkg.packageHash);
      });

      it("returns 404 for non-existent deployment", async () => {
        const headers = await auth.getAuthHeaders();

        const response = await SELF.fetch(
          `https://example.com/apps/${app.name}/deployments/non-existent`,
          { headers }
        );

        expect(response.status).toBe(404);
      });
    });

    describe("PATCH /apps/:name/deployments/:deploymentName", () => {
      it("updates deployment name", async () => {
        const headers = await auth.getAuthHeaders();

        const deployment = createTestDeployment(app.id);
        await db.insert(schema.deployment).values(deployment);

        const response = await SELF.fetch(
          `https://example.com/apps/${app.name}/deployments/${deployment.name}/`,
          {
            method: "PATCH",
            headers,
            body: JSON.stringify({
              name: "updated-name",
            }),
          }
        );

        expect(response.status).toBe(200);
        const data = await response.json();
        const validated = z
          .object({
            deployment: DeploymentSchema,
          })
          .parse(data);

        expect(validated.deployment.name).toBe("updated-name");
      });

      it("prevents duplicate names", async () => {
        const headers = await auth.getAuthHeaders();

        const deployment1 = createTestDeployment(app.id);
        const deployment2 = createTestDeployment(app.id);
        await db.insert(schema.deployment).values([deployment1, deployment2]);

        const response = await SELF.fetch(
          `https://example.com/apps/${app.name}/deployments/${deployment2.name}/`,
          {
            method: "PATCH",
            headers,
            body: JSON.stringify({
              name: deployment1.name,
            }),
          }
        );

        expect(response.status).toBe(409);
      });

      it("requires owner permission", async () => {
        const headers = await auth.getAuthHeaders();

        const deployment = createTestDeployment(app.id);
        await db.insert(schema.deployment).values(deployment);

        // Change to collaborator
        await db
          .update(schema.collaborator)
          .set({ permission: "Collaborator" })
          .where(eq(schema.collaborator.appId, app.id));

        const response = await SELF.fetch(
          `https://example.com/apps/${app.name}/deployments/${deployment.name}/`,
          {
            method: "PATCH",
            headers,
            body: JSON.stringify({
              name: "new-name",
            }),
          }
        );

        expect(response.status).toBe(403);
      });
    });

    describe("DELETE /apps/:name/deployments/:deploymentName", () => {
      it("deletes deployment", async () => {
        const headers = await auth.getAuthHeaders();

        const deployment = createTestDeployment(app.id);
        const pkg = createTestPackage(deployment.id);
        await db.insert(schema.deployment).values(deployment);
        await db.insert(schema.packages).values(pkg);

        await Promise.all([
          createTestBlob(pkg.blobPath, "blob1"),
          createTestBlob(pkg.manifestBlobPath as string, "blob2"),
        ]);

        const response = await SELF.fetch(
          `https://example.com/apps/${app.name}/deployments/${deployment.name}`,
          {
            method: "DELETE",
            headers,
          }
        );

        expect(response.status).toBe(204);

        // Verify cascade deletion
        const removedDeployment = await db.query.deployment.findFirst({
          where: eq(schema.deployment.id, deployment.id),
        });
        expect(removedDeployment?.deletedAt).toBeGreaterThan(0);
      });

      it("requires owner permission", async () => {
        const headers = await auth.getAuthHeaders();

        const deployment = createTestDeployment(app.id);
        await db.insert(schema.deployment).values(deployment);

        // Change to collaborator
        await db
          .update(schema.collaborator)
          .set({ permission: "Collaborator" })
          .where(eq(schema.collaborator.appId, app.id));

        const response = await SELF.fetch(
          `https://example.com/apps/${app.name}/deployments/${deployment.name}`,
          {
            method: "DELETE",
            headers,
          }
        );

        expect(response.status).toBe(403);
      });

      it("returns 404 for non-existent deployment", async () => {
        const headers = await auth.getAuthHeaders();

        const response = await SELF.fetch(
          `https://example.com/apps/${app.name}/deployments/non-existent`,
          {
            method: "DELETE",
            headers,
          }
        );

        expect(response.status).toBe(404);
      });
    });
  });

  describe("Collaborators", () => {
    let app: typeof schema.app.$inferInsert;

    beforeEach(async () => {
      app = createTestApp();
      await db.insert(schema.app).values(app);
      await db.insert(schema.collaborator).values({
        appId: app.id,
        accountId: auth.getCurrentAccountId(),
        permission: "Owner",
      });
    });

    describe("GET /apps/:name/collaborators", () => {
      it("lists all collaborators", async () => {
        const headers = await auth.getAuthHeaders();

        const collaboratorAccount = createTestAccount();
        await db.insert(schema.account).values(collaboratorAccount);
        await db.insert(schema.collaborator).values({
          appId: app.id,
          accountId: collaboratorAccount.id,
          permission: "Collaborator",
        });

        const response = await SELF.fetch(
          `https://example.com/apps/${app.name}/collaborators`,
          { headers }
        );

        expect(response.status).toBe(200);
        const data = await response.json();
        const validated = z
          .object({
            collaborators: z.record(CollaboratorSchema),
          })
          .parse(data);

        expect(Object.keys(validated.collaborators)).toHaveLength(2);
        expect(validated.collaborators[auth.getCurrentEmail()].permission).toBe(
          "Owner"
        );
        expect(
          validated.collaborators[collaboratorAccount.email].permission
        ).toBe("Collaborator");
      });

      it("requires collaborator permission", async () => {
        const headers = await auth.getAuthHeaders();

        // Remove collaborator permission
        await db
          .delete(schema.collaborator)
          .where(eq(schema.collaborator.appId, app.id));

        const response = await SELF.fetch(
          `https://example.com/apps/${app.name}/collaborators`,
          { headers }
        );

        expect(response.status).toBe(404);
      });
    });

    describe("POST /apps/:name/collaborators/:email", () => {
      it("adds new collaborator", async () => {
        const headers = await auth.getAuthHeaders();

        const collaboratorAccount = createTestAccount();
        await db.insert(schema.account).values(collaboratorAccount);

        const response = await SELF.fetch(
          `https://example.com/apps/${app.name}/collaborators/${collaboratorAccount.email}`,
          {
            method: "POST",
            headers,
          }
        );

        expect(response.status).toBe(201);

        // Verify collaborator was added
        const collaborator = await db.query.collaborator.findFirst({
          where: and(
            eq(schema.collaborator.appId, app.id),
            eq(schema.collaborator.accountId, collaboratorAccount.id)
          ),
        });
        expect(collaborator).toBeDefined();
        expect(collaborator?.permission).toBe("Collaborator");
      });

      it("prevents adding duplicate collaborator", async () => {
        const headers = await auth.getAuthHeaders();

        const collaboratorAccount = createTestAccount();
        await db.insert(schema.account).values(collaboratorAccount);
        await db.insert(schema.collaborator).values({
          appId: app.id,
          accountId: collaboratorAccount.id,
          permission: "Collaborator",
        });

        const response = await SELF.fetch(
          `https://example.com/apps/${app.name}/collaborators/${collaboratorAccount.email}`,
          {
            method: "POST",
            headers,
          }
        );

        expect(response.status).toBe(409);
      });

      it("requires owner permission", async () => {
        const headers = await auth.getAuthHeaders();

        // Change to collaborator
        await db
          .update(schema.collaborator)
          .set({ permission: "Collaborator" })
          .where(eq(schema.collaborator.appId, app.id));

        const collaboratorAccount = createTestAccount();
        await db.insert(schema.account).values(collaboratorAccount);
        const response = await SELF.fetch(
          `https://example.com/apps/${app.name}/collaborators/${collaboratorAccount.email}`,
          {
            method: "POST",
            headers,
          }
        );

        expect(response.status).toBe(403);
      });

      it("returns 404 for non-existent account", async () => {
        const headers = await auth.getAuthHeaders();

        const response = await SELF.fetch(
          `https://example.com/apps/${app.name}/collaborators/non-existent@example.com`,
          {
            method: "POST",
            headers,
          }
        );

        expect(response.status).toBe(404);
      });
    });

    describe("DELETE /apps/:name/collaborators/:email", () => {
      it("removes collaborator", async () => {
        const headers = await auth.getAuthHeaders();

        const collaboratorAccount = createTestAccount();
        await db.insert(schema.account).values(collaboratorAccount);
        await db.insert(schema.collaborator).values({
          appId: app.id,
          accountId: collaboratorAccount.id,
          permission: "Collaborator",
        });

        const response = await SELF.fetch(
          `https://example.com/apps/${app.name}/collaborators/${collaboratorAccount.email}`,
          {
            method: "DELETE",
            headers,
          }
        );

        expect(response.status).toBe(204);

        // Verify collaborator was removed
        const collaborator = await db.query.collaborator.findFirst({
          where: and(
            eq(schema.collaborator.appId, app.id),
            eq(schema.collaborator.accountId, collaboratorAccount.id)
          ),
        });
        expect(collaborator).toBeFalsy();
      });

      it("allows collaborator to remove themselves", async () => {
        const headers = await auth.getAuthHeaders();

        // Change to collaborator
        await db
          .update(schema.collaborator)
          .set({ permission: "Collaborator" })
          .where(eq(schema.collaborator.appId, app.id));

        const response = await SELF.fetch(
          `https://example.com/apps/${
            app.name
          }/collaborators/${auth.getCurrentEmail()}`,
          {
            method: "DELETE",
            headers,
          }
        );

        expect(response.status).toBe(204);
      });

      it("prevents removing owner", async () => {
        const headers = await auth.getAuthHeaders();

        const response = await SELF.fetch(
          `https://example.com/apps/${
            app.name
          }/collaborators/${auth.getCurrentEmail()}`,
          {
            method: "DELETE",
            headers,
          }
        );

        expect(response.status).toBe(409);
      });

      it("prevents collaborator from removing others", async () => {
        const headers = await auth.getAuthHeaders();

        // Add another collaborator
        const collaboratorAccount = createTestAccount();
        await db.insert(schema.account).values(collaboratorAccount);
        await db.insert(schema.collaborator).values({
          appId: app.id,
          accountId: collaboratorAccount.id,
          permission: "Collaborator",
        });

        // Change current user to collaborator
        await db
          .update(schema.collaborator)
          .set({ permission: "Collaborator" })
          .where(eq(schema.collaborator.appId, app.id));

        const response = await SELF.fetch(
          `https://example.com/apps/${app.name}/collaborators/${collaboratorAccount.email}`,
          {
            method: "DELETE",
            headers,
          }
        );

        expect(response.status).toBe(403);
      });

      it("returns 404 for non-existent collaborator", async () => {
        const headers = await auth.getAuthHeaders();

        const response = await SELF.fetch(
          `https://example.com/apps/${app.name}/collaborators/non-existent@example.com`,
          {
            method: "DELETE",
            headers,
          }
        );

        expect(response.status).toBe(404);
      });
    });
  });

  describe("Metrics", () => {
    let app: typeof schema.app.$inferInsert;
    let deployment: typeof schema.deployment.$inferInsert;

    beforeEach(async () => {
      app = createTestApp();
      await db.insert(schema.app).values(app);
      await db.insert(schema.collaborator).values({
        appId: app.id,
        accountId: auth.getCurrentAccountId(),
        permission: "Owner",
      });

      deployment = createTestDeployment(app.id);
      await db.insert(schema.deployment).values(deployment);
    });

    describe("GET /apps/:name/deployments/:deploymentName/metrics", () => {
      it("returns deployment metrics", async () => {
        const headers = await auth.getAuthHeaders();

        // Add some test metrics
        await db.insert(schema.metrics).values([
          {
            deploymentId: deployment.key,
            label: "v1",
            type: "active",
            count: 10,
          },
          {
            deploymentId: deployment.key,
            label: "v1",
            type: "downloaded",
            count: 20,
          },
          {
            deploymentId: deployment.key,
            label: "v2",
            type: "deployment_succeeded",
            count: 5,
          },
        ]);

        const response = await SELF.fetch(
          `https://example.com/apps/${app.name}/deployments/${deployment.name}/metrics`,
          { headers }
        );

        expect(response.status).toBe(200);
        const data = await response.json();
        const validated = z
          .object({
            metrics: z.record(MetricsSchema),
          })
          .parse(data);

        expect(validated.metrics.v1.active).toBe(10);
        expect(validated.metrics.v1.downloads).toBe(20);
        expect(validated.metrics.v2.installed).toBe(5);
      });

      it("returns empty metrics for new deployment", async () => {
        const headers = await auth.getAuthHeaders();

        const response = await SELF.fetch(
          `https://example.com/apps/${app.name}/deployments/${deployment.name}/metrics`,
          { headers }
        );

        expect(response.status).toBe(200);
        const data = await response.json();
        const validated = z
          .object({
            metrics: z.record(MetricsSchema),
          })
          .parse(data);

        expect(Object.keys(validated.metrics)).toHaveLength(0);
      });

      it("requires collaborator permission", async () => {
        const headers = await auth.getAuthHeaders();

        // Remove collaborator permission
        await db
          .delete(schema.collaborator)
          .where(eq(schema.collaborator.appId, app.id));

        const response = await SELF.fetch(
          `https://example.com/apps/${app.name}/deployments/${deployment.name}/metrics`,
          { headers }
        );

        expect(response.status).toBe(404);
      });

      it("returns 404 for non-existent deployment", async () => {
        const headers = await auth.getAuthHeaders();

        const response = await SELF.fetch(
          `https://example.com/apps/${app.name}/deployments/non-existent/metrics`,
          { headers }
        );

        expect(response.status).toBe(404);
      });
    });
  });
});
