import { OpenAPIHono, createRoute } from "@hono/zod-openapi";
import { HTTPException } from "hono/http-exception";
import { z } from "zod";
import { authMiddleware } from "../middleware/auth";
import { getStorageProvider } from "../storage/factory";
import type { Env } from "../types/env";
import { isStorageError } from "../types/error";
import {
  type AccessKey,
  AccessKeySchema,
  AccountSchema,
  type App,
  AppSchema,
  CollaboratorSchema,
  DeploymentSchema,
  MetricsSchema,
  type Package,
  type PackageInfo,
  PackageInfoUpdateSchema,
  PackageSchema,
} from "../types/schemas";
import { MetricsManager } from "../utils/metrics";
import { createPackageDiffer } from "../utils/package-differ";
import {
  generateAccessKey,
  generateDeploymentKey,
  generateKey,
} from "../utils/security";
import { urlEncode } from "../utils/urlencode";

const router = new OpenAPIHono<Env>();

router.use("/account/*", authMiddleware());
router.use("/apps/*", authMiddleware());
router.use("/accessKeys/*", authMiddleware());
router.use("/collaborators/*", authMiddleware());
router.use("/metrics/*", authMiddleware());

const DEFAULT_ACCESS_KEY_EXPIRY = 1000 * 60 * 60 * 24 * 60; // 60 days
const ACCESS_KEY_MASKING_STRING = "(hidden)";

const routes = {
  // Account routes
  account: {
    get: createRoute({
      method: "get",
      path: "/account",
      responses: {
        200: {
          description: "Account details retrieved successfully",
          content: {
            "application/json": {
              schema: z.object({
                account: AccountSchema,
              }),
            },
          },
        },
      },
    }),
  },

  // Access key routes
  accessKeys: {
    list: createRoute({
      method: "get",
      path: "/accessKeys",
      responses: {
        200: {
          description: "Access keys retrieved successfully",
          content: {
            "application/json": {
              schema: z.object({
                accessKeys: z.array(AccessKeySchema),
              }),
            },
          },
        },
      },
    }),

    create: createRoute({
      method: "post",
      path: "/accessKeys",
      request: {
        body: {
          content: {
            "application/json": {
              schema: z.object({
                friendlyName: z.string().min(1),
                ttl: z.number().optional(),
                createdBy: z.string().optional(),
              }),
            },
          },
        },
      },
      responses: {
        201: {
          description: "Access key created successfully",
          content: {
            "application/json": {
              schema: z.object({
                accessKey: AccessKeySchema,
              }),
            },
          },
        },
      },
    }),

    get: createRoute({
      method: "get",
      path: "/accessKeys/:accessKeyName",
      request: {
        params: z.object({
          accessKeyName: z.string(),
        }),
      },
      responses: {
        200: {
          description: "Access key retrieved successfully",
          content: {
            "application/json": {
              schema: z.object({
                accessKey: AccessKeySchema,
              }),
            },
          },
        },
      },
    }),

    update: createRoute({
      method: "patch",
      path: "/accessKeys/:accessKeyName",
      request: {
        params: z.object({
          accessKeyName: z.string(),
        }),
        body: {
          content: {
            "application/json": {
              schema: z.object({
                friendlyName: z.string().optional(),
                ttl: z.number().min(0).optional(),
              }),
            },
          },
        },
      },
      responses: {
        200: {
          description: "Access key updated successfully",
          content: {
            "application/json": {
              schema: z.object({
                accessKey: AccessKeySchema,
              }),
            },
          },
        },
      },
    }),

    remove: createRoute({
      method: "delete",
      path: "/accessKeys/:accessKeyName",
      request: {
        params: z.object({
          accessKeyName: z.string(),
        }),
      },
      responses: {
        204: {
          description: "Access key removed successfully",
        },
      },
    }),
  },

  // Apps routes
  apps: {
    list: createRoute({
      method: "get",
      path: "/apps",
      responses: {
        200: {
          description: "Apps retrieved successfully",
          content: {
            "application/json": {
              schema: z.object({
                apps: z.array(AppSchema),
              }),
            },
          },
        },
      },
    }),

    create: createRoute({
      method: "post",
      path: "/apps/",
      request: {
        body: {
          content: {
            "application/json": {
              schema: z.object({
                name: z.string().min(1),
                manuallyProvisionDeployments: z.boolean().optional(),
              }),
            },
          },
        },
      },
      responses: {
        201: {
          description: "App created successfully",
          content: {
            "application/json": {
              schema: z.object({
                app: AppSchema,
              }),
            },
          },
        },
      },
    }),

    get: createRoute({
      method: "get",
      path: "/apps/:appName",
      description: "Get app details",
      request: {
        params: z.object({
          appName: z.string(),
        }),
      },
      responses: {
        200: {
          description: "App details retrieved successfully",
          content: {
            "application/json": {
              schema: z.object({
                app: AppSchema,
              }),
            },
          },
        },
      },
    }),

    update: createRoute({
      method: "patch",
      path: "/apps/:appName",
      description: "Update app details",
      request: {
        params: z.object({
          appName: z.string(),
        }),
        body: {
          content: {
            "application/json": {
              schema: z.object({
                name: z.string(),
              }),
            },
          },
        },
      },
      responses: {
        200: {
          description: "App updated successfully",
          content: {
            "application/json": {
              schema: z.object({
                app: AppSchema,
              }),
            },
          },
        },
      },
    }),

    remove: createRoute({
      method: "delete",
      path: "/apps/:appName",
      description: "Delete an app",
      request: {
        params: z.object({
          appName: z.string(),
        }),
      },
      responses: {
        204: {
          description: "App deleted successfully",
        },
      },
    }),

    transfer: createRoute({
      method: "post",
      path: "/apps/:appName/transfer/:email",
      description: "Transfer app ownership",
      request: {
        params: z.object({
          appName: z.string(),
          email: z.string().email(),
        }),
      },
      responses: {
        201: {
          description: "App transferred successfully",
        },
      },
    }),
  },

  // Deployments routes
  deployments: {
    list: createRoute({
      method: "get",
      path: "/apps/:appName/deployments/",
      description: "List app deployments",
      request: {
        params: z.object({
          appName: z.string(),
        }),
      },
      responses: {
        200: {
          description: "Deployments retrieved successfully",
          content: {
            "application/json": {
              schema: z.object({
                deployments: z.array(DeploymentSchema),
              }),
            },
          },
        },
      },
    }),

    create: createRoute({
      method: "post",
      path: "/apps/:appName/deployments/",
      description: "Create new deployment",
      request: {
        params: z.object({
          appName: z.string(),
        }),
        body: {
          content: {
            "application/json": {
              schema: z.object({
                name: z.string(),
                key: z.string().optional(),
              }),
            },
          },
        },
      },
      responses: {
        201: {
          description: "Deployment created successfully",
          content: {
            "application/json": {
              schema: z.object({
                deployment: DeploymentSchema,
              }),
            },
          },
        },
      },
    }),

    get: createRoute({
      method: "get",
      path: "/apps/:appName/deployments/:deploymentName",
      description: "Get deployment details",
      request: {
        params: z.object({
          appName: z.string(),
          deploymentName: z.string(),
        }),
      },
      responses: {
        200: {
          description: "Deployment details retrieved successfully",
          content: {
            "application/json": {
              schema: z.object({
                deployment: DeploymentSchema,
              }),
            },
          },
        },
      },
    }),

    remove: createRoute({
      method: "delete",
      path: "/apps/:appName/deployments/:deploymentName",
      description: "Remove deployment",
      request: {
        params: z.object({
          appName: z.string(),
          deploymentName: z.string(),
        }),
      },
      responses: {
        204: {
          description: "Deployment removed successfully",
        },
      },
    }),

    update: createRoute({
      method: "patch",
      path: "/apps/:appName/deployments/:deploymentName",
      description: "Update deployment",
      request: {
        params: z.object({
          appName: z.string(),
          deploymentName: z.string(),
        }),
        body: {
          content: {
            "application/json": {
              schema: z.object({
                name: z.string(),
              }),
            },
          },
        },
      },
      responses: {
        200: {
          description: "Deployment updated successfully",
          content: {
            "application/json": {
              schema: z.object({
                deployment: DeploymentSchema,
              }),
            },
          },
        },
      },
    }),

    // Release management
    release: {
      create: createRoute({
        method: "post",
        path: "/apps/:appName/deployments/:deploymentName/release",
        description: "Release new package version",
        request: {
          params: z.object({
            appName: z.string(),
            deploymentName: z.string(),
          }),
          body: {
            content: {
              "multipart/form-data": {
                schema: z.object({
                  package: z.instanceof(Blob),
                  packageInfo: z.string().transform((str) => {
                    try {
                      return JSON.parse(str) as PackageInfo;
                    } catch {
                      throw new Error("Invalid package info");
                    }
                  }),
                }),
              },
            },
          },
        },
        responses: {
          201: {
            description: "Package released successfully",
            content: {
              "application/json": {
                schema: z.object({
                  package: PackageSchema,
                }),
              },
            },
          },
        },
      }),
      update: createRoute({
        method: "patch",
        path: "/apps/:appName/deployments/:deploymentName/release",
        description: "Update release",
        request: {
          params: z.object({
            appName: z.string(),
            deploymentName: z.string(),
          }),
          body: {
            content: {
              "application/json": {
                schema: z.object({
                  packageInfo: PackageInfoUpdateSchema,
                }),
              },
            },
          },
        },
        responses: {
          200: {
            description: "Release updated successfully",
          },
        },
      }),
    },
    history: createRoute({
      method: "get",
      path: "/apps/:appName/deployments/:deploymentName/history",
      description: "Get deployment history",
      request: {
        params: z.object({
          appName: z.string(),
          deploymentName: z.string(),
        }),
      },
      responses: {
        200: {
          description: "Deployment history retrieved successfully",
        },
      },
    }),

    promote: createRoute({
      method: "post",
      path: "/apps/:appName/deployments/:sourceDeploymentName/promote/:destDeploymentName",
      description: "Promote deployment to another deployment",
      request: {
        params: z.object({
          appName: z.string(),
          sourceDeploymentName: z.string(),
          destDeploymentName: z.string(),
        }),
        body: {
          content: {
            "application/json": {
              schema: z.object({
                packageInfo: PackageSchema.partial().optional(),
              }),
            },
          },
        },
      },
      responses: {
        201: {
          description: "Deployment promoted successfully",
          content: {
            "application/json": {
              schema: z.object({
                package: PackageSchema,
              }),
            },
          },
        },
      },
    }),

    rollback: createRoute({
      method: "post",
      path: "/apps/:appName/deployments/:deploymentName/rollback/:targetRelease?",
      description: "Rollback deployment to previous release",
      request: {
        params: z.object({
          appName: z.string(),
          deploymentName: z.string(),
          targetRelease: z.string().optional(),
        }),
      },
      responses: {
        201: {
          description: "Deployment rolled back successfully",
          content: {
            "application/json": {
              schema: z.object({
                package: PackageSchema,
              }),
            },
          },
        },
      },
    }),
  },

  // Collaborator routes
  collaborators: {
    list: createRoute({
      method: "get",
      path: "/apps/:appName/collaborators",
      description: "List app collaborators",
      request: {
        params: z.object({
          appName: z.string(),
        }),
      },
      responses: {
        200: {
          description: "Collaborators retrieved successfully",
          content: {
            "application/json": {
              schema: z.object({
                collaborators: z.record(CollaboratorSchema),
              }),
            },
          },
        },
      },
    }),

    add: createRoute({
      method: "post",
      path: "/apps/:appName/collaborators/:email",
      description: "Add collaborator to app",
      request: {
        params: z.object({
          appName: z.string(),
          email: z.string().email(),
        }),
      },
      responses: {
        201: {
          description: "Collaborator added successfully",
        },
      },
    }),

    remove: createRoute({
      method: "delete",
      path: "/apps/:appName/collaborators/:email",
      description: "Remove collaborator from app",
      request: {
        params: z.object({
          appName: z.string(),
          email: z.string().email(),
        }),
      },
      responses: {
        204: {
          description: "Collaborator removed successfully",
        },
      },
    }),
  },

  // Metrics routes
  metrics: {
    get: createRoute({
      method: "get",
      path: "/apps/:appName/deployments/:deploymentName/metrics",
      description: "Get deployment metrics",
      request: {
        params: z.object({
          appName: z.string(),
          deploymentName: z.string(),
        }),
      },
      responses: {
        200: {
          description: "Metrics retrieved successfully",
          content: {
            "application/json": {
              schema: z.object({
                metrics: z.record(MetricsSchema),
              }),
            },
          },
        },
      },
    }),
  },
};

function throwIfInvalidPermissions(
  app: App,
  requiredPermission: "Owner" | "Collaborator",
): void {
  const collaboratorsMap = app.collaborators;
  let isPermitted = false;

  if (collaboratorsMap) {
    for (const email of Object.keys(collaboratorsMap)) {
      if (collaboratorsMap[email].isCurrentAccount) {
        const permission = collaboratorsMap[email].permission;
        isPermitted =
          permission === "Owner" || permission === requiredPermission;
        break;
      }
    }
  }

  if (!isPermitted) {
    throw new HTTPException(403, {
      message: `This action requires ${requiredPermission} permissions on the app`,
    });
  }
}

// Account routes
router.openapi(routes.account.get, async (c) => {
  const storage = getStorageProvider(c);
  const accountId = c.var.auth.accountId;

  const account = await storage.getAccount(accountId);
  return c.json({
    account,
  });
});

// Access Key routes
router.openapi(routes.accessKeys.list, async (c) => {
  const storage = getStorageProvider(c);
  const accountId = c.var.auth.accountId;

  const accessKeys = await storage.getAccessKeys(accountId);

  // Sort by creation time
  accessKeys.sort((first, second) => {
    const firstTime = first.createdTime || 0;
    const secondTime = second.createdTime || 0;
    return firstTime - secondTime;
  });

  // Mask the actual key strings
  const maskedKeys = accessKeys.map((key) => ({
    ...key,
    name: ACCESS_KEY_MASKING_STRING,
  }));

  return c.json({ accessKeys: maskedKeys });
});

router.openapi(routes.accessKeys.create, async (c) => {
  const storage = getStorageProvider(c);
  const accountId = c.var.auth.accountId;
  const body = c.req.valid("json");

  const keyName = generateAccessKey();
  const accessKey: Omit<AccessKey, "id"> = {
    name: keyName,
    friendlyName: body.friendlyName,
    description: body.friendlyName,
    createdBy: body.createdBy || c.req.header("user-agent") || "Unknown",
    createdTime: Date.now(),
    expires: Date.now() + (body.ttl || DEFAULT_ACCESS_KEY_EXPIRY),
    isSession: false,
  };

  // Check for duplicates
  const existingKeys = await storage.getAccessKeys(accountId);
  const isDuplicateName = existingKeys.some((key) => key.name === keyName);
  const isDuplicateFriendlyName = existingKeys.some(
    (key) => key.friendlyName === body.friendlyName,
  );

  if (isDuplicateName) {
    throw new HTTPException(409, {
      message: `The access key "${keyName}" already exists.`,
    });
  }
  if (isDuplicateFriendlyName) {
    throw new HTTPException(409, {
      message: `The access key "${body.friendlyName}" already exists.`,
    });
  }

  const id = await storage.addAccessKey(accountId, accessKey);
  const createdKey = await storage.getAccessKey(accountId, id);

  c.header("Location", urlEncode`/accessKeys/${createdKey.friendlyName}`);
  return c.json({ accessKey: createdKey }, 201);
});

router.openapi(routes.accessKeys.get, async (c) => {
  const storage = getStorageProvider(c);
  const accountId = c.var.auth.accountId;
  const { accessKeyName } = c.req.valid("param");

  const accessKeys = await storage.getAccessKeys(accountId);
  const accessKey = accessKeys.find(
    (key) => key.name === accessKeyName || key.friendlyName === accessKeyName,
  );

  if (!accessKey) {
    throw new HTTPException(404, {
      message: `Access key "${accessKeyName}" not found`,
    });
  }

  // Hide the actual key string
  const response = { ...accessKey };
  Reflect.deleteProperty(response, "name");

  return c.json({ accessKey: response });
});

router.openapi(routes.accessKeys.update, async (c) => {
  const storage = getStorageProvider(c);
  const accountId = c.var.auth.accountId;
  const { accessKeyName } = c.req.valid("param");
  const updates = c.req.valid("json");

  const accessKeys = await storage.getAccessKeys(accountId);
  const accessKey = accessKeys.find(
    (key) => key.name === accessKeyName || key.friendlyName === accessKeyName,
  );

  if (!accessKey) {
    throw new HTTPException(404, {
      message: `Access key "${accessKeyName}" not found`,
    });
  }

  if (updates.friendlyName) {
    const isDuplicate = accessKeys.some(
      (key) =>
        key.id !== accessKey.id && key.friendlyName === updates.friendlyName,
    );

    if (isDuplicate) {
      throw new HTTPException(409, {
        message: `Access key "${updates.friendlyName}" already exists`,
      });
    }

    accessKey.friendlyName = updates.friendlyName;
    accessKey.description = updates.friendlyName;
  }

  if (updates.ttl !== undefined) {
    accessKey.expires = Date.now() + updates.ttl;
  }

  await storage.updateAccessKey(accountId, accessKey);

  const response = { ...accessKey };
  Reflect.deleteProperty(response, "name");

  return c.json({ accessKey: response });
});

router.openapi(routes.accessKeys.remove, async (c) => {
  const storage = getStorageProvider(c);
  const accountId = c.var.auth.accountId;
  const { accessKeyName } = c.req.valid("param");

  const accessKeys = await storage.getAccessKeys(accountId);
  const accessKey = accessKeys.find(
    (key) => key.name === accessKeyName || key.friendlyName === accessKeyName,
  );

  if (!accessKey) {
    throw new HTTPException(404, {
      message: `Access key "${accessKeyName}" not found`,
    });
  }

  await storage.removeAccessKey(accountId, accessKey.id);
  return new Response(null, { status: 204 });
});

router.openapi(routes.apps.list, async (c) => {
  const storage = getStorageProvider(c);
  const accountId = c.var.auth.accountId;

  const apps = await storage.getApps(accountId);
  const restApps = apps.map((app) => ({
    ...app,
    collaborators: app.collaborators,
    deployments: app.deployments || [],
  }));

  return c.json({
    apps: restApps.sort((a, b) => a.name.localeCompare(b.name)),
  });
});

router.openapi(routes.apps.create, async (c) => {
  const storage = getStorageProvider(c);
  const accountId = c.var.auth.accountId;
  const body = c.req.valid("json");

  const existingApps = await storage.getApps(accountId);
  if (existingApps.some((app) => app.name === body.name)) {
    throw new HTTPException(409, {
      message: `An app named '${body.name}' already exists.`,
    });
  }

  const app = await storage.addApp(accountId, {
    name: body.name,
    createdTime: Date.now(),
  });

  // Create default deployments if not manually provisioning
  if (!body.manuallyProvisionDeployments) {
    const defaultDeployments = ["Production", "Staging"];
    await Promise.all(
      defaultDeployments.map((name) =>
        storage.addDeployment(accountId, app.id, {
          name,
          key: generateDeploymentKey(),
          createdTime: Date.now(),
        }),
      ),
    );
    app.deployments = defaultDeployments.sort((a, b) => a.localeCompare(b));
  }

  c.header("Location", urlEncode`/apps/${app.name}`);
  return c.json({ app }, 201);
});

router.openapi(routes.apps.get, async (c) => {
  const storage = getStorageProvider(c);
  const accountId = c.var.auth.accountId;
  const { appName } = c.req.valid("param");

  const app = await storage.getApp(accountId, { appName });
  if (!app) {
    throw new HTTPException(404, {
      message: `App "${appName}" not found`,
    });
  }

  return c.json({ app });
});

router.openapi(routes.apps.update, async (c) => {
  const storage = getStorageProvider(c);
  const accountId = c.var.auth.accountId;
  const { appName } = c.req.valid("param");
  const updates = c.req.valid("json");

  const app = await storage.getApp(accountId, { appName });
  if (!app) {
    throw new HTTPException(404, {
      message: `App "${appName}" not found`,
    });
  }

  throwIfInvalidPermissions(app, "Owner");

  // Check if new name would create duplicate
  if (updates.name && updates.name !== app.name) {
    const existingApps = await storage.getApps(accountId);
    if (existingApps.some((a) => a.name === updates.name)) {
      throw new HTTPException(409, {
        message: `An app named '${updates.name}' already exists`,
      });
    }
  }

  const updatedApp = {
    ...app,
    name: updates.name || app.name,
  };

  await storage.updateApp(accountId, updatedApp);
  return c.json({ app: updatedApp });
});

router.openapi(routes.apps.remove, async (c) => {
  const storage = getStorageProvider(c);
  const accountId = c.var.auth.accountId;
  const { appName } = c.req.valid("param");

  const app = await storage.getApp(accountId, { appName });
  if (!app) {
    throw new HTTPException(404, {
      message: `App "${appName}" not found`,
    });
  }

  throwIfInvalidPermissions(app, "Owner");

  await storage.removeApp(accountId, app.id);
  return new Response(null, { status: 204 });
});

router.openapi(routes.apps.transfer, async (c) => {
  const storage = getStorageProvider(c);
  const accountId = c.var.auth.accountId;
  const { appName, email } = c.req.valid("param");

  const app = await storage.getApp(accountId, { appName });
  if (!app) {
    throw new HTTPException(404, {
      message: `App "${appName}" not found`,
    });
  }

  throwIfInvalidPermissions(app, "Owner");

  await storage.transferApp(accountId, app.id, email);
  return new Response(null, { status: 201 });
});

// Deployment routes
router.openapi(routes.deployments.list, async (c) => {
  const storage = getStorageProvider(c);
  const accountId = c.var.auth.accountId;
  const { appName } = c.req.valid("param");

  const app = await storage.getApp(accountId, { appName });
  if (!app) {
    throw new HTTPException(404, {
      message: `App "${appName}" not found`,
    });
  }

  throwIfInvalidPermissions(app, "Collaborator");

  const deployments = await storage.getDeployments(accountId, app.id);
  deployments.sort((a, b) => a.name.localeCompare(b.name));

  return c.json({ deployments });
});

router.openapi(routes.deployments.create, async (c) => {
  const storage = getStorageProvider(c);
  const accountId = c.var.auth.accountId;
  const { appName } = c.req.valid("param");
  const body = c.req.valid("json");

  const app = await storage.getApp(accountId, { appName });
  if (!app) {
    throw new HTTPException(404, {
      message: `App "${appName}" not found`,
    });
  }

  throwIfInvalidPermissions(app, "Owner");

  const deployments = await storage.getDeployments(accountId, app.id);
  if (deployments.some((d) => d.name === body.name)) {
    throw new HTTPException(409, {
      message: `A deployment named "${body.name}" already exists`,
    });
  }

  const deploymentKey = body.key || generateDeploymentKey();
  const deploymentId = await storage.addDeployment(accountId, app.id, {
    name: body.name,
    key: deploymentKey,
    createdTime: Date.now(),
  });

  const deployment = await storage.getDeployment(
    accountId,
    app.id,
    deploymentId,
  );

  c.header(
    "Location",
    urlEncode`/apps/${appName}/deployments/${deployment.name}`,
  );
  return c.json({ deployment }, 201);
});

router.openapi(routes.deployments.get, async (c) => {
  const storage = getStorageProvider(c);
  const accountId = c.var.auth.accountId;
  const { appName, deploymentName } = c.req.valid("param");

  const app = await storage.getApp(accountId, { appName });
  if (!app) {
    throw new HTTPException(404, {
      message: `App "${appName}" not found`,
    });
  }

  throwIfInvalidPermissions(app, "Collaborator");

  const deployments = await storage.getDeployments(accountId, app.id);
  const deployment = deployments.find((d) => d.name === deploymentName);

  if (!deployment) {
    throw new HTTPException(404, {
      message: `Deployment "${deploymentName}" not found`,
    });
  }

  return c.json({ deployment });
});

router.openapi(routes.deployments.update, async (c) => {
  const storage = getStorageProvider(c);
  const accountId = c.var.auth.accountId;
  const { appName, deploymentName } = c.req.valid("param");
  const updates = c.req.valid("json");

  const app = await storage.getApp(accountId, { appName });
  if (!app) {
    throw new HTTPException(404, {
      message: `App "${appName}" not found`,
    });
  }

  throwIfInvalidPermissions(app, "Owner");

  const deployments = await storage.getDeployments(accountId, app.id);
  const deployment = deployments.find((d) => d.name === deploymentName);

  if (!deployment) {
    throw new HTTPException(404, {
      message: `Deployment "${deploymentName}" not found`,
    });
  }

  if (updates.name && updates.name !== deployment.name) {
    if (deployments.some((d) => d.name === updates.name)) {
      throw new HTTPException(409, {
        message: `A deployment named "${updates.name}" already exists`,
      });
    }
    deployment.name = updates.name;
  }

  await storage.updateDeployment(accountId, app.id, deployment);
  return c.json({ deployment });
});

router.openapi(routes.deployments.remove, async (c) => {
  const storage = getStorageProvider(c);
  const accountId = c.var.auth.accountId;
  const { appName, deploymentName } = c.req.valid("param");

  const app = await storage.getApp(accountId, { appName });
  if (!app) {
    throw new HTTPException(404, {
      message: `App "${appName}" not found`,
    });
  }

  throwIfInvalidPermissions(app, "Owner");

  const deployments = await storage.getDeployments(accountId, app.id);
  const deployment = deployments.find((d) => d.name === deploymentName);

  if (!deployment) {
    throw new HTTPException(404, {
      message: `Deployment "${deploymentName}" not found`,
    });
  }

  await storage.removeDeployment(accountId, app.id, deployment.id);
  return new Response(null, { status: 204 });
});

router.openapi(routes.deployments.release.create, async (c) => {
  const storage = getStorageProvider(c);
  const accountId = c.var.auth.accountId;
  const { appName, deploymentName } = c.req.valid("param");
  const { package: packageFile, packageInfo } = c.req.valid("form");

  if (!packageFile) {
    throw new HTTPException(400, {
      message: "A deployment package must include a file",
    });
  }

  const app = await storage.getApp(accountId, { appName });
  if (!app) {
    throw new HTTPException(404, {
      message: `App "${appName}" not found`,
    });
  }

  throwIfInvalidPermissions(app, "Collaborator");

  const deployments = await storage.getDeployments(accountId, app.id);
  const deployment = deployments.find((d) => d.name === deploymentName);

  if (!deployment) {
    throw new HTTPException(404, {
      message: `Deployment "${deploymentName}" not found`,
    });
  }

  // Check if there's an unfinished rollout
  if (
    deployment.package?.rollout &&
    deployment.package.rollout < 100 &&
    !deployment.package.isDisabled
  ) {
    throw new HTTPException(409, {
      message:
        "Please update the previous release to 100% rollout before releasing a new package",
    });
  }

  const packageData = await packageFile.arrayBuffer();
  const differ = await createPackageDiffer(
    storage,
    app.id,
    deployment.id,
    packageData,
  );
  const manifestResult = await differ.generateManifest();
  const packageHash = await manifestResult.computeHash();

  // Check if this is a duplicate of the current release
  const history = await storage.getPackageHistory(
    accountId,
    app.id,
    deployment.id,
  );
  const lastPackage = history[history.length - 1];
  if (lastPackage && lastPackage.packageHash === packageHash) {
    throw new HTTPException(409, {
      message:
        "The uploaded package was not released because it is identical to the contents of the specified deployment's current release",
    });
  }

  // Store package blob
  const blobId = generateKey();
  await storage.addBlob(blobId, packageData, packageData.byteLength);
  const blobUrl = await storage.getBlobUrl(blobId);

  // Store manifest if available
  let manifestUrl = "";
  if (manifestResult) {
    const manifestBlobId = generateKey();
    const manifestJson = manifestResult.serialize();
    const manifestBuffer = new TextEncoder().encode(manifestJson);
    await storage.addBlob(
      manifestBlobId,
      manifestBuffer,
      manifestBuffer.length,
    );
    manifestUrl = await storage.getBlobUrl(manifestBlobId);
  }

  const newPackage: Omit<Package, "label"> = {
    appVersion: packageInfo.appVersion,
    description: packageInfo.description,
    isDisabled: packageInfo.isDisabled || false,
    isMandatory: packageInfo.isMandatory || false,
    rollout: packageInfo.rollout,
    packageHash,
    size: packageData.byteLength,
    blobUrl,
    manifestBlobUrl: manifestUrl,
    uploadTime: Date.now(),
    releaseMethod: "Upload",
  };

  const releasedPackage = await storage.commitPackage(
    accountId,
    app.id,
    deployment.id,
    newPackage,
  );

  // Generate diffs in background
  if (manifestResult) {
    await differ.generateDiffs(history);
  }

  c.header(
    "Location",
    urlEncode`/apps/${appName}/deployments/${deploymentName}`,
  );
  return c.json({ package: releasedPackage }, 201);
});

router.openapi(routes.deployments.release.update, async (c) => {
  const storage = getStorageProvider(c);
  const accountId = c.var.auth.accountId;
  const { appName, deploymentName } = c.req.valid("param");
  const { packageInfo } = c.req.valid("json");

  const app = await storage.getApp(accountId, { appName });
  if (!app) {
    throw new HTTPException(404, {
      message: `App "${appName}" not found`,
    });
  }

  throwIfInvalidPermissions(app, "Collaborator");

  const deployments = await storage.getDeployments(accountId, app.id);
  const deployment = deployments.find((d) => d.name === deploymentName);

  if (!deployment) {
    throw new HTTPException(404, {
      message: `Deployment "${deploymentName}" not found`,
    });
  }

  const packageHistory = await storage.getPackageHistory(
    accountId,
    app.id,
    deployment.id,
  );

  const release = packageInfo.label
    ? packageHistory.find((p) => p.label === packageInfo.label)
    : packageHistory[packageHistory.length - 1];

  if (!release) {
    throw new HTTPException(404, {
      message: "Release package not found",
    });
  }
  const updatedRelease = {
    ...release,
  };
  if (packageInfo.appVersion) {
    updatedRelease.appVersion = packageInfo.appVersion;
  }
  if (packageInfo.description) {
    updatedRelease.description = packageInfo.description;
  }
  if (packageInfo.isDisabled) {
    updatedRelease.isDisabled = packageInfo.isDisabled;
  }

  await storage.updatePackage(updatedRelease);
  return c.json({ release: updatedRelease });
});

router.openapi(routes.deployments.promote, async (c) => {
  const storage = getStorageProvider(c);
  const accountId = c.var.auth.accountId;
  const { appName, sourceDeploymentName, destDeploymentName } =
    c.req.valid("param");
  const { packageInfo } = c.req.valid("json");

  const app = await storage.getApp(accountId, { appName });
  if (!app) {
    throw new HTTPException(404, {
      message: `App "${appName}" not found`,
    });
  }

  throwIfInvalidPermissions(app, "Collaborator");

  const deployments = await storage.getDeployments(accountId, app.id);
  const sourceDeployment = deployments.find(
    (d) => d.name === sourceDeploymentName,
  );
  const destDeployment = deployments.find((d) => d.name === destDeploymentName);

  if (!sourceDeployment || !destDeployment) {
    throw new HTTPException(404, {
      message: "Source or destination deployment not found",
    });
  }

  if (!sourceDeployment.package) {
    throw new HTTPException(400, {
      message: "Cannot promote from a deployment with no releases",
    });
  }

  // Check for unfinished rollout in destination
  if (
    destDeployment.package?.rollout &&
    destDeployment.package.rollout < 100 &&
    !destDeployment.package.isDisabled
  ) {
    throw new HTTPException(409, {
      message: "Cannot promote to an unfinished rollout release",
    });
  }

  const newPackage: Omit<Package, "label"> = {
    ...sourceDeployment.package,
    isDisabled: packageInfo?.isDisabled ?? sourceDeployment.package.isDisabled,
    isMandatory:
      packageInfo?.isMandatory ?? sourceDeployment.package.isMandatory,
    description:
      packageInfo?.description ?? sourceDeployment.package.description,
    rollout: packageInfo?.rollout ?? null,
    uploadTime: Date.now(),
    releaseMethod: "Promote",
    originalLabel: sourceDeployment.package.label,
    originalDeployment: sourceDeploymentName,
  };

  const promotedPackage = await storage.commitPackage(
    accountId,
    app.id,
    destDeployment.id,
    newPackage,
  );

  c.header(
    "Location",
    urlEncode`/apps/${appName}/deployments/${destDeploymentName}`,
  );
  return c.json({ package: promotedPackage }, 201);
});

router.openapi(routes.deployments.rollback, async (c) => {
  const storage = getStorageProvider(c);
  const accountId = c.var.auth.accountId;
  const { appName, deploymentName, targetRelease } = c.req.valid("param");

  const app = await storage.getApp(accountId, { appName });
  if (!app) {
    throw new HTTPException(404, {
      message: `App "${appName}" not found`,
    });
  }

  throwIfInvalidPermissions(app, "Collaborator");

  const deployments = await storage.getDeployments(accountId, app.id);
  const deployment = deployments.find((d) => d.name === deploymentName);

  if (!deployment) {
    throw new HTTPException(404, {
      message: `Deployment "${deploymentName}" not found`,
    });
  }

  const history = await storage.getPackageHistory(
    accountId,
    app.id,
    deployment.id,
  );
  if (!history.length) {
    throw new HTTPException(404, {
      message:
        "Cannot perform rollback because there are no releases on this deployment",
    });
  }

  const sourcePackage = history.at(-1);
  let destinationPackage: Package | undefined;

  if (!targetRelease) {
    destinationPackage = history.at(-2);
    if (!destinationPackage) {
      throw new HTTPException(404, {
        message:
          "Cannot perform rollback because there are no prior releases to rollback to",
      });
    }
  } else {
    if (targetRelease === sourcePackage?.label) {
      throw new HTTPException(409, {
        message: `Cannot perform rollback because the target release (${targetRelease}) is already the latest release`,
      });
    }

    destinationPackage = history.find((p) => p.label === targetRelease);
    if (!destinationPackage) {
      throw new HTTPException(404, {
        message: `Cannot perform rollback because the target release (${targetRelease}) could not be found in the deployment history`,
      });
    }
  }

  // Verify app version compatibility
  if (sourcePackage?.appVersion !== destinationPackage.appVersion) {
    throw new HTTPException(409, {
      message: "Cannot perform rollback to a different app version",
    });
  }

  const rollbackPackage: Omit<Package, "label"> = {
    appVersion: destinationPackage.appVersion,
    blobUrl: destinationPackage.blobUrl,
    description: destinationPackage.description,
    diffPackageMap: destinationPackage.diffPackageMap,
    isDisabled: destinationPackage.isDisabled,
    isMandatory: destinationPackage.isMandatory,
    manifestBlobUrl: destinationPackage.manifestBlobUrl,
    packageHash: destinationPackage.packageHash,
    size: destinationPackage.size,
    uploadTime: Date.now(),
    releaseMethod: "Rollback",
    originalLabel: destinationPackage.label,
  };

  const newPackage = await storage.commitPackage(
    accountId,
    app.id,
    deployment.id,
    rollbackPackage,
  );

  c.header(
    "Location",
    urlEncode`/apps/${appName}/deployments/${deploymentName}`,
  );
  return c.json({ package: newPackage }, 201);
});

// Collaborator handlers
router.openapi(routes.collaborators.list, async (c) => {
  const storage = getStorageProvider(c);
  const accountId = c.var.auth.accountId;
  const { appName } = c.req.valid("param");

  const app = await storage.getApp(accountId, { appName });
  if (!app) {
    throw new HTTPException(404, {
      message: `App "${appName}" not found`,
    });
  }

  throwIfInvalidPermissions(app, "Collaborator");

  const collaborators = await storage.getCollaborators(accountId, app.id);
  return c.json({ collaborators });
});

router.openapi(routes.collaborators.add, async (c) => {
  const storage = getStorageProvider(c);
  const accountId = c.var.auth.accountId;
  const { appName, email } = c.req.valid("param");

  const app = await storage.getApp(accountId, { appName });
  if (!app) {
    throw new HTTPException(404, {
      message: `App "${appName}" not found`,
    });
  }

  throwIfInvalidPermissions(app, "Owner");

  try {
    await storage.addCollaborator(accountId, app.id, email);
    return new Response(null, { status: 201 });
  } catch (error) {
    if (isStorageError(error) || error instanceof HTTPException) {
      throw error;
    }
    throw new HTTPException(409, {
      message: "The specified account is already a collaborator for this app",
    });
  }
});

router.openapi(routes.collaborators.remove, async (c) => {
  const storage = getStorageProvider(c);
  const accountId = c.var.auth.accountId;
  const { appName, email } = c.req.valid("param");

  const app = await storage.getApp(accountId, { appName });
  if (!app) {
    throw new HTTPException(404, {
      message: `App "${appName}" not found`,
    });
  }

  const collaborators = await storage.getCollaborators(accountId, app.id);
  const collaborator = collaborators[email];

  if (!collaborator) {
    throw new HTTPException(404, {
      message: "The specified account is not a collaborator for this app",
    });
  }

  const isOwner = Object.values(collaborators).some(
    (c) => c.accountId === accountId && c.permission === "Owner",
  );
  const isSelfRemoval = collaborator.accountId === accountId;

  if (!isOwner && !isSelfRemoval) {
    throw new HTTPException(403, {
      message: "Only owners can remove collaborators",
    });
  }

  if (collaborator.permission === "Owner") {
    throw new HTTPException(409, {
      message: "Cannot remove the owner of the app from collaborator list",
    });
  }

  await storage.removeCollaborator(accountId, app.id, email);
  return new Response(null, { status: 204 });
});

// Metrics handler
router.openapi(routes.metrics.get, async (c) => {
  const storage = getStorageProvider(c);
  const accountId = c.var.auth.accountId;
  const { appName, deploymentName } = c.req.valid("param");

  const app = await storage.getApp(accountId, { appName });
  if (!app) {
    throw new HTTPException(404, {
      message: `App "${appName}" not found`,
    });
  }

  throwIfInvalidPermissions(app, "Collaborator");

  const deployments = await storage.getDeployments(accountId, app.id);
  const deployment = deployments.find((d) => d.name === deploymentName);

  if (!deployment) {
    throw new HTTPException(404, {
      message: `Deployment "${deploymentName}" not found`,
    });
  }

  const metrics = new MetricsManager(c);
  const deploymentMetrics = await metrics.getMetrics(deployment.key!);

  return c.json({ metrics: deploymentMetrics });
});

router.openapi(routes.deployments.history, async (c) => {
  const storage = getStorageProvider(c);
  const accountId = c.var.auth.accountId;
  const { appName, deploymentName } = c.req.valid("param");

  const app = await storage.getApp(accountId, { appName });
  if (!app) {
    throw new HTTPException(404, {
      message: `App "${appName}" not found`,
    });
  }

  throwIfInvalidPermissions(app, "Collaborator");

  const deployments = await storage.getDeployments(accountId, app.id);
  const deployment = deployments.find((d) => d.name === deploymentName);

  if (!deployment) {
    throw new HTTPException(404, {
      message: `Deployment "${deploymentName}" not found`,
    });
  }

  const history = await storage.getPackageHistory(
    accountId,
    app.id,
    deployment.id,
  );

  return c.json({ history });
});

export { router as managementRouter };
