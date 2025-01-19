import { and, eq, isNull } from "drizzle-orm";
import { type DrizzleD1Database, drizzle } from "drizzle-orm/d1";
import type { Context } from "hono";
import * as schema from "../db/schema";
import type { Env } from "../types/env";
import { ErrorCode } from "../types/error";
import type {
  AccessKey,
  Account,
  App,
  Collaborator,
  CollaboratorMap,
  Deployment,
  DeploymentInfo,
  Package,
  PackageHashToBlobInfoMap,
} from "../types/schemas";
import { generateKey } from "../utils/security";
import { BlobStorageProvider } from "./blob";
import { type StorageProvider, createStorageError } from "./storage";

export class D1StorageProvider implements StorageProvider {
  private readonly db: DrizzleD1Database<typeof schema>;
  private readonly blob: BlobStorageProvider;

  constructor(private readonly ctx: Context<Env>) {
    this.db = drizzle(ctx.env.DB, { schema });
    this.blob = new BlobStorageProvider(ctx);
  }

  // Helper methods
  private getBlobPath(
    appId: string,
    deploymentId: string,
    filename: string,
  ): string {
    return `apps/${appId}/deployments/${deploymentId}/${filename}`;
  }

  private mapPackageFromDB(
    dbPackage: typeof schema.packages.$inferSelect,
  ): Omit<Package, "diffPackageMap" | "blobUrl" | "manifestBlobUrl"> {
    return {
      appVersion: dbPackage.appVersion,
      description: dbPackage.description ?? undefined,
      isDisabled: dbPackage.isDisabled,
      isMandatory: dbPackage.isMandatory,
      label: dbPackage.label,
      originalDeployment: dbPackage.originalDeployment ?? undefined,
      originalLabel: dbPackage.originalLabel ?? undefined,
      packageHash: dbPackage.packageHash,
      releasedBy: dbPackage.releasedBy ?? undefined,
      releaseMethod: dbPackage.releaseMethod ?? undefined,
      rollout: dbPackage.rollout ?? undefined,
      size: dbPackage.size,
      uploadTime: dbPackage.uploadTime,
    };
  }

  // Account operations
  async addAccount(account: Omit<Account, "id">): Promise<string> {
    const id = generateKey();

    // Check if email exists
    const existing = await this.db.query.account.findFirst({
      where: eq(schema.account.email, account.email.toLowerCase()),
    });

    if (existing) {
      throw createStorageError(
        ErrorCode.AlreadyExists,
        "Account already exists",
      );
    }

    // Create account
    await this.db.insert(schema.account).values({
      id,
      email: account.email.toLowerCase(),
      name: account.name,
      githubId: account.gitHubId,
      createdTime: account.createdTime,
    });

    return id;
  }

  async getAccount(accountId: string): Promise<Account> {
    const account = await this.db.query.account.findFirst({
      where: and(
        eq(schema.account.id, accountId),
        isNull(schema.account.deletedAt),
      ),
    });

    if (!account) {
      throw createStorageError(ErrorCode.NotFound, "Account not found");
    }

    return {
      id: account.id,
      email: account.email,
      name: account.name,
      gitHubId: account.githubId ?? undefined,
      createdTime: account.createdTime,
      linkedProviders: account.githubId ? ["GitHub"] : [],
    };
  }

  async getAccountByEmail(email: string): Promise<Account> {
    const account = await this.db.query.account.findFirst({
      where: and(
        eq(schema.account.email, email.toLowerCase()),
        isNull(schema.account.deletedAt),
      ),
    });

    if (!account) {
      throw createStorageError(ErrorCode.NotFound, "Account not found");
    }

    return {
      id: account.id,
      email: account.email,
      name: account.name,
      gitHubId: account.githubId ?? undefined,
      createdTime: account.createdTime,
      linkedProviders: account.githubId ? ["GitHub"] : [],
    };
  }

  async updateAccount(email: string, updates: Partial<Account>): Promise<void> {
    const account = await this.db.query.account.findFirst({
      where: and(
        eq(schema.account.email, email.toLowerCase()),
        isNull(schema.account.deletedAt),
      ),
    });

    if (!account) {
      throw createStorageError(ErrorCode.NotFound, "Account not found");
    }

    await this.db
      .update(schema.account)
      .set({
        githubId: updates.gitHubId,
        name: updates.name,
      })
      .where(eq(schema.account.id, account.id));
  }

  async getAccountIdFromAccessKey(accessKey: string): Promise<string> {
    const key = await this.db.query.accessKey.findFirst({
      where: eq(schema.accessKey.name, accessKey),
      columns: {
        accountId: true,
        expires: true,
      },
    });

    if (!key) {
      throw createStorageError(ErrorCode.NotFound, "Access key not found");
    }

    if (Date.now() >= key.expires) {
      throw createStorageError(ErrorCode.Expired, "Access key has expired");
    }

    return key.accountId;
  }

  // App operations
  async addApp(
    accountId: string,
    app: Omit<App, "id" | "collaborators">,
  ): Promise<App> {
    const id = generateKey();

    // Verify account exists
    const account = await this.getAccount(accountId);

    // Create app
    await this.db.insert(schema.app).values({
      id,
      name: app.name,
      createdTime: app.createdTime,
    });

    // Add owner collaborator
    await this.db.insert(schema.collaborator).values({
      appId: id,
      accountId,
      permission: "Owner",
    });

    return {
      id,
      name: app.name,
      createdTime: app.createdTime,
      collaborators: {
        [account.email]: {
          accountId,
          permission: "Owner",
        },
      },
      deployments: [],
    };
  }

  async getApps(accountId: string): Promise<App[]> {
    const apps = await this.db.query.collaborator.findMany({
      where: eq(schema.collaborator.accountId, accountId),
      with: {
        app: {
          with: {
            collaborators: {
              with: {
                account: true,
              },
            },
            deployments: true,
          },
        },
      },
    });

    return apps
      .map((collab) => ({
        id: collab.app.id,
        name: collab.app.name,
        createdTime: collab.app.createdTime,
        collaborators: collab.app.collaborators.reduce<CollaboratorMap>(
          (acc, c) => {
            acc[c.account.email] = {
              accountId: c.accountId,
              permission: c.permission,
              isCurrentAccount: c.accountId === accountId,
            } satisfies Collaborator;
            return acc;
          },
          {},
        ),
        deployments: collab.app.deployments.map((d) => d.name),
      }))
      .sort((a, b) => a.createdTime - b.createdTime);
  }

  async getApp(
    accountId: string,
    condition:
      | {
          appId: string;
        }
      | {
          appName: string;
        },
  ): Promise<App> {
    const app = await this.db.query.app.findFirst({
      where: and(
        "appId" in condition
          ? eq(schema.app.id, condition.appId)
          : eq(schema.app.name, condition.appName),
        isNull(schema.app.deletedAt),
      ),
      with: {
        collaborators: {
          with: {
            account: true,
          },
        },
        deployments: {
          where: isNull(schema.deployment.deletedAt),
        },
      },
    });

    if (!app) {
      throw createStorageError(ErrorCode.NotFound, "App not found");
    }

    // Verify user has access
    const hasAccess = app.collaborators.some((c) => c.accountId === accountId);

    if (!hasAccess) {
      throw createStorageError(ErrorCode.NotFound, "App not found");
    }

    return {
      id: app.id,
      name: app.name,
      createdTime: app.createdTime,
      collaborators: app.collaborators.reduce<CollaboratorMap>((acc, c) => {
        acc[c.account.email] = {
          accountId: c.accountId,
          permission: c.permission,
          isCurrentAccount: c.accountId === accountId,
        } satisfies Collaborator;
        return acc;
      }, {}),
      deployments: app.deployments.map((d) => d.name),
    };
  }

  async updateApp(accountId: string, app: App): Promise<void> {
    const existing = await this.getApp(accountId, {
      appId: app.id,
    });

    // Verify ownership
    const isOwner = Object.values(existing.collaborators).some(
      (c) => c.accountId === accountId && c.permission === "Owner",
    );

    if (!isOwner) {
      throw createStorageError(
        ErrorCode.Invalid,
        "Only owners can update apps",
      );
    }

    await this.db
      .update(schema.app)
      .set({ name: app.name })
      .where(eq(schema.app.id, app.id));
  }

  async removeApp(accountId: string, appId: string): Promise<void> {
    const app = await this.getApp(accountId, { appId });

    // Verify ownership
    const isOwner = Object.values(app.collaborators).some(
      (c) => c.accountId === accountId && c.permission === "Owner",
    );

    if (!isOwner) {
      throw createStorageError(
        ErrorCode.Invalid,
        "Only owners can remove apps",
      );
    }

    // Mark app as deleted
    await this.db
      .update(schema.app)
      .set({ deletedAt: Date.now() })
      .where(eq(schema.app.id, appId));

    // Delete all blobs for this app
    // await this.blob.deletePath(`apps/${appId}`);
  }

  async transferApp(
    accountId: string,
    appId: string,
    email: string,
  ): Promise<void> {
    const app = await this.getApp(accountId, { appId });
    const targetAccount = await this.getAccountByEmail(email);

    // Verify ownership
    const isOwner = Object.values(app.collaborators).some(
      (c) => c.accountId === accountId && c.permission === "Owner",
    );

    if (!isOwner) {
      throw createStorageError(
        ErrorCode.Invalid,
        "Only owners can transfer apps",
      );
    }

    // Update permissions in transaction
    // Demote current owner to collaborator
    await this.db
      .update(schema.collaborator)
      .set({ permission: "Collaborator" })
      .where(
        and(
          eq(schema.collaborator.appId, appId),
          eq(schema.collaborator.accountId, accountId),
        ),
      );

    // Make target account owner
    const existingCollaborator = await this.db.query.collaborator.findFirst({
      where: and(
        eq(schema.collaborator.appId, appId),
        eq(schema.collaborator.accountId, targetAccount.id),
      ),
    });

    if (existingCollaborator) {
      await this.db
        .update(schema.collaborator)
        .set({ permission: "Owner" })
        .where(
          and(
            eq(schema.collaborator.appId, appId),
            eq(schema.collaborator.accountId, targetAccount.id),
          ),
        );
    } else {
      await this.db.insert(schema.collaborator).values({
        appId,
        accountId: targetAccount.id,
        permission: "Owner",
      });
    }
  }

  // Collaborator operations
  async addCollaborator(
    accountId: string,
    appId: string,
    email: string,
  ): Promise<void> {
    const app = await this.getApp(accountId, { appId });
    const collaborator = await this.getAccountByEmail(email);

    // Verify ownership
    const isOwner = Object.values(app.collaborators).some(
      (c) => c.accountId === accountId && c.permission === "Owner",
    );

    if (!isOwner) {
      throw createStorageError(
        ErrorCode.Invalid,
        "Only owners can add collaborators",
      );
    }

    // Check if already a collaborator
    if (app.collaborators[email]) {
      throw createStorageError(
        ErrorCode.AlreadyExists,
        "User is already a collaborator",
      );
    }

    await this.db.insert(schema.collaborator).values({
      appId,
      accountId: collaborator.id,
      permission: "Collaborator",
    });
  }

  async getCollaborators(
    accountId: string,
    appId: string,
  ): Promise<CollaboratorMap> {
    const app = await this.db.query.app.findFirst({
      where: eq(schema.app.id, appId),
      with: {
        collaborators: {
          with: {
            account: true,
          },
        },
      },
    });

    if (!app) {
      throw createStorageError(ErrorCode.NotFound, "App not found");
    }

    return app.collaborators.reduce<CollaboratorMap>((acc, c) => {
      acc[c.account.email] = {
        accountId: c.accountId,
        permission: c.permission,
        isCurrentAccount: c.accountId === accountId,
      } satisfies Collaborator;
      return acc;
    }, {});
  }

  async removeCollaborator(
    accountId: string,
    appId: string,
    email: string,
  ): Promise<void> {
    const app = await this.getApp(accountId, { appId });
    const collaborator = await this.getAccountByEmail(email);

    // Verify ownership or self-removal
    const isOwner = Object.values(app.collaborators).some(
      (c) => c.accountId === accountId && c.permission === "Owner",
    );
    const isSelfRemoval = collaborator.id === accountId;

    if (!isOwner && !isSelfRemoval) {
      throw createStorageError(ErrorCode.Invalid, "Insufficient permissions");
    }

    // Can't remove owner
    if (app.collaborators[email]?.permission === "Owner") {
      throw createStorageError(ErrorCode.Invalid, "Cannot remove owner");
    }

    await this.db
      .delete(schema.collaborator)
      .where(
        and(
          eq(schema.collaborator.appId, appId),
          eq(schema.collaborator.accountId, collaborator.id),
        ),
      );
  }
  async addDeployment(
    accountId: string,
    appId: string,
    deployment: Omit<Deployment, "id" | "package">,
  ): Promise<string> {
    await this.getApp(accountId, { appId });
    const id = generateKey();

    // Check for duplicate deployment name
    const existingDeployment = await this.db.query.deployment.findFirst({
      where: and(
        eq(schema.deployment.appId, appId),
        eq(schema.deployment.name, deployment.name),
      ),
    });

    if (existingDeployment) {
      throw createStorageError(
        ErrorCode.AlreadyExists,
        "Deployment already exists",
      );
    }

    await this.db.insert(schema.deployment).values({
      id,
      appId,
      name: deployment.name,
      key: deployment.key as string,
      createdTime: deployment.createdTime,
    });

    return id;
  }

  async getDeployment(
    accountId: string,
    appId: string,
    deploymentId: string,
  ): Promise<Deployment> {
    const deployment = await this.db.query.deployment.findFirst({
      where: and(
        eq(schema.deployment.id, deploymentId),
        isNull(schema.deployment.deletedAt),
      ),
      with: {
        packages: {
          orderBy: (packages, { desc }) => [desc(packages.uploadTime)],
          limit: 1,
        },
      },
    });

    if (!deployment) {
      throw createStorageError(ErrorCode.NotFound, "Deployment not found");
    }

    const returningDeployment: Deployment = {
      id: deployment.id,
      name: deployment.name,
      key: deployment.key,
      createdTime: deployment.createdTime,
      package: null,
    };

    const latestPackage = deployment.packages?.[0];
    if (latestPackage) {
      const [blobUrl, manifestBlobUrl] = await Promise.all([
        this.blob.getBlobUrl(latestPackage.blobPath),
        latestPackage?.manifestBlobPath
          ? this.blob.getBlobUrl(latestPackage.manifestBlobPath)
          : null,
      ]);
      returningDeployment.package = {
        ...this.mapPackageFromDB(latestPackage),
        blobUrl,
        manifestBlobUrl: manifestBlobUrl ?? "",
        diffPackageMap: await this.getPackageDiffs(latestPackage.id),
      } satisfies Package;
    }

    return returningDeployment;
  }

  async getDeployments(
    accountId: string,
    appId: string,
  ): Promise<Deployment[]> {
    const deployments = await this.db.query.deployment.findMany({
      where: eq(schema.deployment.appId, appId),
      with: {
        packages: {
          orderBy: (packages, { desc }) => [desc(packages.uploadTime)],
          limit: 1,
        },
      },
    });

    const results: Deployment[] = [];
    for (const deployment of deployments) {
      const returningDeployment: Deployment = {
        id: deployment.id,
        name: deployment.name,
        key: deployment.key,
        createdTime: deployment.createdTime,
        package: null,
      };

      const latestPackage = deployment.packages[0];
      if (latestPackage) {
        const [blobUrl, manifestBlobUrl] = await Promise.all([
          this.blob.getBlobUrl(latestPackage.blobPath),
          latestPackage.manifestBlobPath
            ? this.blob.getBlobUrl(latestPackage.manifestBlobPath)
            : null,
        ]);

        returningDeployment.package = {
          ...this.mapPackageFromDB(latestPackage),
          blobUrl,
          manifestBlobUrl: manifestBlobUrl ?? "",
          diffPackageMap: await this.getPackageDiffs(latestPackage.id),
        } satisfies Package;
      }

      results.push(returningDeployment);
    }

    return results;
  }

  async getDeploymentInfo(deploymentKey: string): Promise<DeploymentInfo> {
    const deployment = await this.db.query.deployment.findFirst({
      where: and(
        eq(schema.deployment.key, deploymentKey),
        isNull(schema.deployment.deletedAt),
      ),
      columns: {
        id: true,
        appId: true,
      },
    });

    if (!deployment) {
      throw createStorageError(ErrorCode.NotFound, "Deployment not found");
    }

    return {
      appId: deployment.appId,
      deploymentId: deployment.id,
    };
  }

  async updateDeployment(
    accountId: string,
    appId: string,
    deployment: Deployment,
  ): Promise<void> {
    await this.db
      .update(schema.deployment)
      .set({
        name: deployment.name,
      })
      .where(eq(schema.deployment.id, deployment.id));
  }

  async removeDeployment(
    accountId: string,
    appId: string,
    deploymentId: string,
  ): Promise<void> {
    // Mark deployment as deleted
    await this.db
      .update(schema.deployment)
      .set({ deletedAt: Date.now() })
      .where(eq(schema.deployment.id, deploymentId));

    // Delete all blobs for this deployment
    // await this.blob.deletePath(`apps/${appId}/deployments/${deploymentId}`);
  }

  // Package methods
  private async getPackageDiffs(
    packageId: string,
  ): Promise<PackageHashToBlobInfoMap> {
    const diffs = await this.db.query.packageDiff.findMany({
      where: eq(schema.packageDiff.packageId, packageId),
    });

    const result: PackageHashToBlobInfoMap = {};
    for (const diff of diffs) {
      result[diff.sourcePackageHash] = {
        size: diff.size,
        url: await this.blob.getBlobUrl(diff.blobPath),
      };
    }
    return result;
  }

  async commitPackage(
    accountId: string,
    appId: string,
    deploymentId: string,
    pkg: Omit<Package, "label">,
  ): Promise<Package> {
    // Get current package count for label
    const packagesCount = await this.db.query.packages.findMany({
      where: eq(schema.packages.deploymentId, deploymentId),
      columns: {
        id: true,
      },
    });

    const label = `v${packagesCount.length + 1}`;
    const id = generateKey();

    // Generate blob paths
    const blobPath = this.getBlobPath(appId, deploymentId, `${id}.zip`);
    const manifestBlobPath = pkg.manifestBlobUrl
      ? this.getBlobPath(appId, deploymentId, `${id}-manifest.json`)
      : null;

    // Store the blobs
    const blobUrl = await this.blob.moveBlob(pkg.blobUrl, blobPath);
    let manifestUrl = "";
    if (pkg.manifestBlobUrl && manifestBlobPath) {
      manifestUrl = await this.blob.moveBlob(
        pkg.manifestBlobUrl,
        manifestBlobPath,
      );
    }

    // Insert new package
    await this.db.insert(schema.packages).values({
      id,
      deploymentId,
      label,
      appVersion: pkg.appVersion,
      description: pkg.description,
      isDisabled: pkg.isDisabled,
      isMandatory: pkg.isMandatory,
      rollout: pkg.rollout,
      size: pkg.size,
      blobPath,
      manifestBlobPath,
      packageHash: pkg.packageHash,
      releaseMethod: pkg.releaseMethod,
      originalLabel: pkg.originalLabel,
      originalDeployment: pkg.originalDeployment,
      releasedBy: pkg.releasedBy,
      uploadTime: pkg.uploadTime,
    });

    return {
      ...pkg,
      label,
      blobUrl,
      manifestBlobUrl: manifestUrl,
      diffPackageMap: {},
    };
  }

  async getPackageHistory(
    accountId: string,
    appId: string,
    deploymentId: string,
  ): Promise<Package[]> {
    const packages = await this.db.query.packages.findMany({
      where: and(
        eq(schema.packages.deploymentId, deploymentId),
        isNull(schema.packages.deletedAt),
      ),
      orderBy: (packages, { asc }) => [asc(packages.uploadTime)],
    });

    return Promise.all(
      packages.map(async (p) => ({
        ...this.mapPackageFromDB(p),
        blobUrl: await this.blob.getBlobUrl(p.blobPath),
        // Use empty string as default for manifestBlobUrl
        manifestBlobUrl: p.manifestBlobPath
          ? await this.blob.getBlobUrl(p.manifestBlobPath)
          : "",
        diffPackageMap: await this.getPackageDiffs(p.id),
      })),
    );
  }

  async getPackageHistoryFromDeploymentKey(
    deploymentKey: string,
  ): Promise<Package[]> {
    const deployment = await this.db.query.deployment.findFirst({
      where: eq(schema.deployment.key, deploymentKey),
    });

    if (!deployment) {
      throw createStorageError(ErrorCode.NotFound, "Deployment not found");
    }

    return this.getPackageHistory("", "", deployment.id);
  }

  async updatePackageHistory(
    accountId: string,
    appId: string,
    deploymentId: string,
    history: Package[],
  ): Promise<void> {
    if (!history?.length) {
      throw createStorageError(
        ErrorCode.Invalid,
        "Cannot update with empty history",
      );
    }

    // Delete existing packages
    await this.db
      .update(schema.packages)
      .set({ deletedAt: Date.now() })
      .where(eq(schema.packages.deploymentId, deploymentId));

    // Insert new history
    for (const [index, pkg] of history.entries()) {
      const id = generateKey();
      const blobPath = this.getBlobPath(appId, deploymentId, `${id}.zip`);
      const manifestBlobPath = pkg.manifestBlobUrl
        ? this.getBlobPath(appId, deploymentId, `${id}-manifest.json`)
        : null;

      // Store the blobs
      await this.blob.moveBlob(pkg.blobUrl, blobPath);
      if (pkg.manifestBlobUrl && manifestBlobPath) {
        await this.blob.moveBlob(pkg.manifestBlobUrl, manifestBlobPath);
      }

      await this.db.insert(schema.packages).values({
        id,
        deploymentId,
        label: `v${index + 1}`,
        appVersion: pkg.appVersion,
        description: pkg.description,
        isDisabled: pkg.isDisabled,
        isMandatory: pkg.isMandatory,
        rollout: pkg.rollout,
        size: pkg.size,
        blobPath,
        manifestBlobPath,
        packageHash: pkg.packageHash,
        releaseMethod: pkg.releaseMethod,
        originalLabel: pkg.originalLabel,
        originalDeployment: pkg.originalDeployment,
        releasedBy: pkg.releasedBy,
        uploadTime: pkg.uploadTime,
      });
    }
  }

  async clearPackageHistory(
    accountId: string,
    appId: string,
    deploymentId: string,
  ): Promise<void> {
    // Delete packages
    await this.db
      .update(schema.packages)
      .set(schema.packages)
      .where(eq(schema.packages.deploymentId, deploymentId));

    // Delete all package blobs
    // await this.blob.deletePath(`apps/${appId}/deployments/${deploymentId}`);
  }

  // Blob operations
  async addBlob(
    blobId: string,
    data: ArrayBuffer,
    size: number,
  ): Promise<string> {
    return this.blob.addBlob(blobId, data, size);
  }

  async getBlobUrl(blobId: string): Promise<string> {
    return this.blob.getBlobUrl(blobId);
  }

  async removeBlob(blobId: string): Promise<void> {
    return this.blob.removeBlob(blobId);
  }

  // Access key methods
  async addAccessKey(
    accountId: string,
    accessKey: Omit<AccessKey, "id">,
  ): Promise<string> {
    const id = generateKey();

    await this.db.insert(schema.accessKey).values({
      id,
      accountId,
      name: accessKey.name as string,
      friendlyName: accessKey.friendlyName,
      description: accessKey.description,
      createdBy: accessKey.createdBy,
      createdTime: accessKey.createdTime,
      expires: accessKey.expires,
      isSession: accessKey.isSession,
    } satisfies typeof schema.accessKey.$inferInsert);

    return id;
  }

  private mapAccessKeyFromDB(
    dbAccessKey: typeof schema.accessKey.$inferSelect,
  ): AccessKey {
    return {
      id: dbAccessKey.id,
      name: dbAccessKey.name,
      friendlyName: dbAccessKey.friendlyName,
      description: dbAccessKey.description ?? undefined,
      createdBy: dbAccessKey.createdBy,
      createdTime: dbAccessKey.createdTime,
      expires: dbAccessKey.expires,
      isSession: dbAccessKey.isSession ?? undefined,
    };
  }

  // For getAccessKey
  async getAccessKey(
    accountId: string,
    accessKeyId: string,
  ): Promise<AccessKey> {
    const key = await this.db.query.accessKey.findFirst({
      where: and(
        eq(schema.accessKey.id, accessKeyId),
        eq(schema.accessKey.accountId, accountId),
        isNull(schema.accessKey.deletedAt),
      ),
    });

    if (!key) {
      throw createStorageError(ErrorCode.NotFound, "Access key not found");
    }

    return this.mapAccessKeyFromDB(key);
  }

  // For getAccessKeys
  async getAccessKeys(accountId: string): Promise<AccessKey[]> {
    const keys = await this.db.query.accessKey.findMany({
      where: and(
        eq(schema.accessKey.accountId, accountId),
        isNull(schema.accessKey.deletedAt),
      ),
    });

    return keys.map(this.mapAccessKeyFromDB);
  }

  async removeAccessKey(accountId: string, accessKeyId: string): Promise<void> {
    const result = await this.db
      .update(schema.accessKey)
      .set({ deletedAt: Date.now() })
      .where(
        and(
          eq(schema.accessKey.id, accessKeyId),
          eq(schema.accessKey.accountId, accountId),
          isNull(schema.accessKey.deletedAt),
        ),
      );

    if (!result) {
      throw createStorageError(ErrorCode.NotFound, "Access key not found");
    }
  }

  async updateAccessKey(
    accountId: string,
    accessKey: AccessKey,
  ): Promise<void> {
    await this.db
      .update(schema.accessKey)
      .set({
        friendlyName: accessKey.friendlyName,
        description: accessKey.description,
        expires: accessKey.expires,
      })
      .where(
        and(
          eq(schema.accessKey.id, accessKey.id),
          eq(schema.accessKey.accountId, accountId),
        ),
      );
  }
}
