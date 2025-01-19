import { env } from "cloudflare:test";
import type * as schema from "../../src/db/schema";
import type {
  Account,
  App,
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

export function createTestApp(): App {
  return {
    id: generateKey(),
    name: `test-app-${generateKey()}`,
    collaborators: {},
    deployments: [],
    createdTime: Date.now(),
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
  ...args: Parameters<typeof env.STORAGE_BUCKET.put>
) {
  return env.STORAGE_BUCKET.put(...args);
}
