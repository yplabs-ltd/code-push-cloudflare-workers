import type { ErrorCode, StorageError } from "../types/error";
import type {
  AccessKey,
  Account,
  App,
  CollaboratorMap,
  Deployment,
  DeploymentInfo,
  Package,
} from "../types/schemas";

export interface StorageProvider {
  // Account operations
  addAccount(account: Omit<Account, "id">): Promise<string>;
  getAccount(accountId: string): Promise<Account>;
  getAccountByEmail(email: string): Promise<Account>;
  getAccountIdFromAccessKey(accessKey: string): Promise<string>;
  updateAccount(email: string, updates: Partial<Account>): Promise<void>;

  // App operations
  addApp(
    accountId: string,
    app: Omit<App, "id" | "collaborators" | "deployments">,
  ): Promise<App>;
  getApps(accountId: string): Promise<App[]>;
  getApp(
    accountId: string,
    condition:
      | {
          appId: string;
        }
      | {
          appName: string;
        },
  ): Promise<App>;
  removeApp(accountId: string, appId: string): Promise<void>;
  updateApp(accountId: string, app: App): Promise<void>;
  transferApp(accountId: string, appId: string, email: string): Promise<void>;

  // Collaborator operations
  addCollaborator(
    accountId: string,
    appId: string,
    email: string,
  ): Promise<void>;
  getCollaborators(accountId: string, appId: string): Promise<CollaboratorMap>;
  removeCollaborator(
    accountId: string,
    appId: string,
    email: string,
  ): Promise<void>;

  // Deployment operations
  addDeployment(
    accountId: string,
    appId: string,
    deployment: Omit<Deployment, "id" | "package">,
  ): Promise<string>;
  getDeployment(
    accountId: string,
    appId: string,
    deploymentId: string,
  ): Promise<Deployment>;
  getDeploymentInfo(deploymentKey: string): Promise<DeploymentInfo>;
  getDeployments(accountId: string, appId: string): Promise<Deployment[]>;
  removeDeployment(
    accountId: string,
    appId: string,
    deploymentId: string,
  ): Promise<void>;
  updateDeployment(
    accountId: string,
    appId: string,
    deployment: Deployment,
  ): Promise<void>;

  // Package operations
  commitPackage(
    accountId: string,
    appId: string,
    deploymentId: string,
    pkg: Omit<Package, "label">,
  ): Promise<Package>;
  getPackageHistory(
    accountId: string,
    appId: string,
    deploymentId: string,
  ): Promise<Package[]>;
  getPackageHistoryFromDeploymentKey(deploymentKey: string): Promise<Package[]>;
  updatePackageHistory(
    accountId: string,
    appId: string,
    deploymentId: string,
    history: Package[],
  ): Promise<void>;
  clearPackageHistory(
    accountId: string,
    appId: string,
    deploymentId: string,
  ): Promise<void>;

  // Access key operations
  addAccessKey(
    accountId: string,
    accessKey: Omit<AccessKey, "id">,
  ): Promise<string>;
  getAccessKey(accountId: string, accessKeyId: string): Promise<AccessKey>;
  getAccessKeys(accountId: string): Promise<AccessKey[]>;
  removeAccessKey(accountId: string, accessKeyId: string): Promise<void>;
  updateAccessKey(accountId: string, accessKey: AccessKey): Promise<void>;

  // Blob operations
  addBlob(
    blobId: string,
    data: ArrayBuffer | Uint8Array,
    size: number,
  ): Promise<string>;
  getBlobUrl(blobId: string): Promise<string>;
  removeBlob(blobId: string): Promise<void>;
}

export function createStorageError(
  code: ErrorCode,
  message?: string,
): StorageError {
  const error = new Error(message) as StorageError;
  error.source = "storage";
  error.code = code;
  if (error.stack) {
    const stackLines = error.stack.split("\n");
    error.stack = [stackLines[0], ...stackLines.slice(2)].join("\n");
  }

  return error;
}

// Storage constants
export const MAX_PACKAGE_HISTORY_LENGTH = 50;
export const MAX_BLOB_SIZE = 200 * 1024 * 1024; // 200MB
