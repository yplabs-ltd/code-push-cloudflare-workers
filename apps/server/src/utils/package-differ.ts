import { compare } from "compare-versions";
import { strToU8, unzipSync, zipSync } from "fflate";
import type { BlobStorageProvider } from "../storage/blob";
import type { StorageProvider } from "../storage/storage";
import type { Package } from "../types/schemas";
import * as hashUtils from "./hash-utils";

interface DiffArchive {
  deletedFiles: string[];
  newOrUpdatedFiles: Map<string, string>;
}

export class PackageDiffer {
  private static MANIFEST_FILE = "hotcodepush.json";

  constructor(
    private readonly storage: StorageProvider,
    private readonly appId: string,
    private readonly deploymentId: string,
    private newFileData: ArrayBuffer,
    private maxDiffPackageCount = 5,
  ) {}

  async generateManifest(): Promise<hashUtils.PackageManifest> {
    try {
      const decompressed = unzipSync(new Uint8Array(this.newFileData));
      const fileMap = new Map<string, string>();

      for (const [filename, content] of Object.entries(decompressed)) {
        const normalizedPath =
          hashUtils.PackageManifest.normalizePath(filename);
        if (!hashUtils.PackageManifest.isIgnored(normalizedPath)) {
          const hash = await hashUtils.computeHash(content);
          fileMap.set(normalizedPath, hash);
        }
      }

      return new hashUtils.PackageManifest(fileMap);
    } catch {
      // Not a valid zip file, compute hash of entire content
      const hash = await hashUtils.computeHash(
        new Uint8Array(this.newFileData),
      );
      return new hashUtils.PackageManifest(new Map([["/", hash]]));
    }
  }
  async generateDiffs(history: Package[]): Promise<Map<string, string>> {
    if (!history?.length) {
      return new Map();
    }

    const newManifest = await this.generateManifest();
    const diffResults = new Map<string, string>();

    // Get candidates to generate diffs against
    const packagesToProcess = this.getPackagesForDiff(history);
    if (!packagesToProcess.length) {
      return diffResults;
    }

    for (const oldPackage of packagesToProcess) {
      if (oldPackage.packageHash === undefined) {
        continue;
      }

      if (!oldPackage.manifestBlobUrl) {
        // Skip packages without manifest - can't generate accurate diff
        continue;
      }

      // Get old package manifest
      const oldManifestResponse = await fetch(oldPackage.manifestBlobUrl);
      if (!oldManifestResponse.ok) {
        continue;
      }

      const oldManifestText = await oldManifestResponse.text();
      const oldManifest =
        hashUtils.PackageManifest.deserialize(oldManifestText);
      if (!oldManifest) {
        continue;
      }

      // Generate diff between manifests
      const diff = this.generateDiffBetweenManifests(oldManifest, newManifest);

      // If diff exists, create diff archive
      if (diff.deletedFiles.length > 0 || diff.newOrUpdatedFiles.size > 0) {
        // Follow the same pattern as D1StorageProvider:
        // apps/${appId}/deployments/${deploymentId}/${filename}
        const blobId = `apps/${this.appId}/deployments/${this.deploymentId}/diff_${oldPackage.packageHash}.zip`;

        const diffArchive = await this.createDiffArchive(
          diff,
          oldPackage.packageHash,
          blobId,
        );
        if (diffArchive) {
          diffResults.set(oldPackage.packageHash, diffArchive);
        }
      }
    }

    return diffResults;
  }

  private getPackagesForDiff(history: Package[]): Package[] {
    if (!history?.length) {
      return [];
    }

    // Get current release's app version
    const currentRelease = history[history.length - 1];
    if (!currentRelease) {
      return [];
    }

    const validPackages: Package[] = [];
    let foundNewPackage = false;

    // Process history in reverse chronological order
    for (let i = history.length - 1; i >= 0; i--) {
      const historicalPackage = history[i];

      // Skip until we find current package
      if (!foundNewPackage) {
        foundNewPackage = true;
        continue;
      }

      // Stop if we've collected enough packages
      if (validPackages.length >= this.maxDiffPackageCount) {
        break;
      }

      // Only diff against packages with matching appVersion
      const versionsMatch = this.isMatchingVersion(
        currentRelease.appVersion,
        historicalPackage.appVersion,
      );

      if (versionsMatch && historicalPackage.packageHash) {
        validPackages.push(historicalPackage);
      }
    }

    return validPackages;
  }

  private isMatchingVersion(baseVersion: string, newVersion: string): boolean {
    try {
      // Check if versions match exactly or satisfy semver ranges
      return (
        baseVersion === newVersion ||
        compare(baseVersion, newVersion, "=") ||
        compare(newVersion, baseVersion, "=")
      );
    } catch {
      return false;
    }
  }

  private generateDiffBetweenManifests(
    oldManifest: hashUtils.PackageManifest,
    newManifest: hashUtils.PackageManifest,
  ): DiffArchive {
    const diff: DiffArchive = {
      deletedFiles: [],
      newOrUpdatedFiles: new Map(),
    };

    const oldMap = oldManifest.toMap();
    const newMap = newManifest.toMap();

    // Find modified and new files
    newMap.forEach((hash, name) => {
      if (!oldMap.has(name) || oldMap.get(name) !== hash) {
        diff.newOrUpdatedFiles.set(name, hash);
      }
    });

    // Find deleted files
    oldMap.forEach((hash, name) => {
      if (!newMap.has(name)) {
        diff.deletedFiles.push(name);
      }
    });

    return diff;
  }

  private async createDiffArchive(
    diff: DiffArchive,
    oldPackageHash: string,
    blobId: string,
  ): Promise<string | undefined> {
    try {
      // Get new package contents
      const decompressed = unzipSync(new Uint8Array(this.newFileData));

      // Create diff archive
      const diffArchive: Record<string, Uint8Array> = {};

      // Add manifest file containing deleted files
      const manifestContent = JSON.stringify({
        deletedFiles: diff.deletedFiles,
      });
      diffArchive[PackageDiffer.MANIFEST_FILE] = strToU8(manifestContent);

      // Add modified/new files
      for (const [filename] of diff.newOrUpdatedFiles) {
        const content = decompressed[filename];
        if (content) {
          diffArchive[filename] = content;
        }
      }

      // Create zip containing diff
      const zipped = zipSync(diffArchive);

      // Store diff blob using provided ID
      await this.storage.addBlob(blobId, zipped, zipped.length);
      return blobId;
    } catch (err) {
      console.error("Failed to create diff archive:", err);
      return undefined;
    }
  }
}

export async function createPackageDiffer(
  storage: StorageProvider,
  appId: string,
  deploymentId: string,
  packageData: ArrayBuffer,
  maxDiffPackageCount = 5,
): Promise<PackageDiffer> {
  return new PackageDiffer(
    storage,
    appId,
    deploymentId,
    packageData,
    maxDiffPackageCount,
  );
}
