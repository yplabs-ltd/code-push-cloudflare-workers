import JSZip from "jszip";
import type { StorageProvider } from "../storage/storage";
import type { Package } from "../types/schemas";
import { generateKey } from "./security";

interface FileEntry {
  path: string;
  hash: string;
  content: Uint8Array;
}

interface DiffResult {
  deletedFiles: string[];
  newFiles: Map<string, string>;
}

export interface PackageManifest {
  readonly files: Map<string, string>;
  readonly size: number;
  computeHash(): Promise<string>;
  serialize(): string;
}

export interface PackageDiffer {
  generateManifest(): Promise<PackageManifest>;
  computePackageHash(): Promise<string>;
  generateDiffs(history: Package[], storage: StorageProvider): Promise<void>;
}

class PackageManifestImpl implements PackageManifest {
  private readonly fileMap: Map<string, string>;
  private readonly totalSize: number;

  constructor(files: Map<string, string>, size: number) {
    this.fileMap = new Map(files);
    this.totalSize = size;
  }

  get files(): Map<string, string> {
    return new Map(this.fileMap);
  }

  get size(): number {
    return this.totalSize;
  }

  async computeHash(): Promise<string> {
    const entries: string[] = [];
    for (const [path, hash] of this.fileMap.entries()) {
      if (path !== ".codepushrelease") {
        entries.push(`${path}:${hash}`);
      }
    }
    entries.sort();

    const data = new TextEncoder().encode(JSON.stringify(entries));
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
  }

  serialize(): string {
    const obj: Record<string, string> = {};
    for (const [path, hash] of this.fileMap) {
      obj[path] = hash;
    }
    return JSON.stringify(obj);
  }
}

class PackageDifferImpl implements PackageDiffer {
  private readonly zipBuffer: ArrayBuffer;
  private entries: FileEntry[] = [];

  constructor(buffer: ArrayBuffer) {
    this.zipBuffer = buffer;
  }

  async generateManifest(): Promise<PackageManifest> {
    await this.loadEntries();
    const files = new Map<string, string>();
    let totalSize = 0;

    for (const entry of this.entries) {
      files.set(entry.path, entry.hash);
      totalSize += entry.content.length;
    }

    return new PackageManifestImpl(files, totalSize);
  }

  async computePackageHash(): Promise<string> {
    const manifest = await this.generateManifest();
    return manifest.computeHash();
  }

  async generateDiffs(
    history: Package[],
    storage: StorageProvider,
  ): Promise<void> {
    if (history.length === 0) {
      return;
    }

    await this.loadEntries();
    const newManifest = await this.generateManifest();
    const latestPackage = history.at(-1);

    if (!latestPackage || !latestPackage?.packageHash) {
      console.log("No package hash found for package", latestPackage);
      return;
    }

    console.log("Generating diffs for package", latestPackage.packageHash);

    // Only diff against last 5 packages with same app version
    const relevantHistory = history
      .slice(-5)
      .filter(
        (pkg) =>
          pkg.manifestBlobUrl && pkg.appVersion === latestPackage.appVersion,
      );

    for (const oldPackage of relevantHistory) {
      const oldManifestRes = await fetch(oldPackage.manifestBlobUrl);
      const oldManifestData = (await oldManifestRes.json()) as Record<
        string,
        string
      >;
      const oldFiles = new Map<string, string>(Object.entries(oldManifestData));

      const { deletedFiles, newFiles } = this.calculateDiff(
        oldFiles,
        newManifest.files,
      );

      // Skip if no changes
      if (deletedFiles.length === 0 && newFiles.size === 0) {
        continue;
      }

      // Create diff package
      const zip = new JSZip();
      zip.file("hotcodepush.json", JSON.stringify({ deletedFiles }));

      for (const [path] of newFiles.entries()) {
        const entry = this.entries.find((e) => e.path === path);
        if (entry) {
          zip.file(path, entry.content);
        }
      }

      const diffBuffer = await zip.generateAsync({
        type: "arraybuffer",
        compression: "DEFLATE",
      });

      const diffBlobId = generateKey();
      await storage.addBlob(diffBlobId, diffBuffer, diffBuffer.byteLength);
      const diffUrl = await storage.getBlobUrl(diffBlobId);

      // Update diff package map
      if (!latestPackage.diffPackageMap) {
        latestPackage.diffPackageMap = {};
      }

      latestPackage.diffPackageMap[oldPackage.packageHash] = {
        size: diffBuffer.byteLength,
        url: diffUrl,
      };
    }

    // Get deployment info to update history
    const deployment = await storage.getDeploymentInfo(
      latestPackage.originalDeployment,
    );

    await storage.updatePackageHistory(
      deployment.id, // Changed from accountId to id
      deployment.appId,
      deployment.deploymentId,
      history,
    );
  }

  private async loadEntries(): Promise<void> {
    if (this.entries.length > 0) {
      return;
    }

    const zip = await JSZip.loadAsync(this.zipBuffer);

    for (const [path, file] of Object.entries(zip.files)) {
      if (!file.dir) {
        const content = await file.async("uint8array");
        const hashBuffer = await crypto.subtle.digest("SHA-256", content);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const hash = hashArray
          .map((b) => b.toString(16).padStart(2, "0"))
          .join("");

        this.entries.push({
          path,
          hash,
          content,
        });
      }
    }
  }

  private calculateDiff(
    oldFiles: Map<string, string>,
    newFiles: Map<string, string>,
  ): DiffResult {
    const deletedFiles: string[] = [];
    const modifiedFiles = new Map<string, string>();

    // Find deleted files
    for (const [path] of oldFiles) {
      if (!newFiles.has(path)) {
        deletedFiles.push(path);
      }
    }

    // Find new/modified files
    for (const [path, hash] of newFiles) {
      const oldHash = oldFiles.get(path);
      if (!oldHash || oldHash !== hash) {
        modifiedFiles.set(path, hash);
      }
    }

    return {
      deletedFiles,
      newFiles: modifiedFiles,
    };
  }
}

export async function createPackageDiffer(
  buffer: ArrayBuffer,
): Promise<PackageDiffer> {
  return new PackageDifferImpl(buffer);
}
