import { env } from "cloudflare:test";
import type * as schema from "../../src/db/schema";
import type {
  AccessKey,
  Account,
  App,
  Collaborator,
  Deployment,
  Package,
} from "../../src/types/schemas";
import { generateDeploymentKey, generateKey } from "../../src/utils/security";

export function createTestAccount(): Account {
  return {
    id: generateKey(),
    email: `test-${generateKey()}@example.com`,
    name: "Test User",
    linkedProviders: ["GitHub"],
    gitHubId: generateKey(),
    createdTime: Date.now(),
  };
}

export function createTestAccessKey(
  accountId: string = generateKey(),
): Omit<AccessKey, "id"> {
  return {
    name: generateKey(),
    friendlyName: `Test Key ${generateKey()}`,
    createdBy: "Test",
    createdTime: Date.now(),
    description: "Test access key",
    expires: Date.now() + 3600000, // 1 hour
    isSession: false,
  };
}

export function createTestApp(overrides: Partial<App> = {}): App {
  return {
    id: generateKey(),
    name: `test-app-${generateKey()}`,
    collaborators: {},
    deployments: [],
    createdTime: Date.now(),
    ...overrides,
  };
}

export function createTestCollaborator(
  accountId: string,
  permission: "Owner" | "Collaborator" = "Collaborator",
): typeof schema.collaborator.$inferInsert {
  return {
    appId: generateKey(),
    accountId,
    permission,
  };
}

export function createTestDeployment(
  appId: string,
): typeof schema.deployment.$inferInsert {
  return {
    id: generateKey(),
    appId,
    name: `test-deployment-${generateKey()}`,
    key: generateDeploymentKey(),
    createdTime: Date.now(),
  };
}

export function createTestPackage(
  deploymentId: string,
  overrides: Partial<typeof schema.packages.$inferInsert> = {},
): typeof schema.packages.$inferInsert {
  return {
    id: generateKey(),
    appVersion: "1.0.0",
    blobPath: `${generateKey()}.zip`,
    description: "Test package",
    isDisabled: false,
    isMandatory: false,
    label: "v1",
    manifestBlobPath: `${generateKey()}-manifest.json`,
    packageHash: generateKey(),
    size: 1024,
    uploadTime: Date.now(),
    deploymentId,
    ...overrides,
  };
}

export async function createTestBlob(
  key: string,
  content: string | Uint8Array,
  options: R2PutOptions = {},
): Promise<{ key: string }> {
  await env.STORAGE_BUCKET.put(key, content, options);
  return { key };
}
