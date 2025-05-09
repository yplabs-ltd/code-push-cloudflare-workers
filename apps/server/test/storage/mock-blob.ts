import type { Context } from "hono";
import type { IBlobStorageProvider } from "../../src/storage/blob";
import type { CacheProvider } from "../../src/storage/cache";
import type { Env } from "../../src/types/env";
import type { BucketProvider } from "../../src/storage/bucket";

export class MockBlobStorageProvider implements IBlobStorageProvider {
  private readonly store = new Map<string, ArrayBuffer>();
  private readonly urls = new Map<string, string>();

  constructor(
    private readonly ctx: Context<Env>,
    private readonly cache: CacheProvider,
    private readonly bucketProvider: BucketProvider,
  ) {}

  async addBlob(
    blobId: string,
    data: ArrayBuffer,
    size: number,
  ): Promise<string> {
    this.store.set(blobId, data);
    await this.bucketProvider.put(blobId, new Uint8Array(data).buffer, {
      customMetadata: {},
    });

    const url = `https://mock-storage.com/${blobId}`;
    this.urls.set(blobId, url);
    return url;
  }

  async getBlobUrl(path: string): Promise<string> {
    const url = this.urls.get(path) || `https://mock-storage.com/${path}`;
    this.urls.set(path, url);
    return url;
  }

  async removeBlob(path: string): Promise<void> {
    this.store.delete(path);
    this.urls.delete(path);
    await this.bucketProvider.delete(path);
  }

  async moveBlob(sourceUrl: string, targetPath: string): Promise<string> {
    // Extract blobId from URL or path
    const sourceBlobId = sourceUrl.startsWith("https://")
      ? sourceUrl.split("/").pop()
      : sourceUrl;
    if (!sourceBlobId) {
      throw new Error(`Invalid source URL: ${sourceUrl}`);
    }

    const data = this.store.get(sourceBlobId);
    if (!data) {
      throw new Error(`Blob not found: ${sourceBlobId}`);
    }

    const targetBlobId = targetPath.split("/").pop();
    if (!targetBlobId) {
      throw new Error(`Invalid target path: ${targetPath}`);
    }

    this.store.set(targetBlobId, data);
    this.store.delete(sourceBlobId);
    await this.bucketProvider.put(targetBlobId, new Uint8Array(data).buffer, {
      customMetadata: {},
    });
    await this.bucketProvider.delete(sourceBlobId);

    const url = `https://mock-storage.com/${targetBlobId}`;
    this.urls.set(targetBlobId, url);
    return url;
  }

  async deletePath(prefix: string): Promise<void> {
    for (const [key] of this.store) {
      if (key.startsWith(prefix)) {
        this.store.delete(key);
        this.urls.delete(key);
        await this.bucketProvider.delete(key);
      }
    }
  }
} 