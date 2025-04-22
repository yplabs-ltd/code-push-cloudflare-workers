import { AwsClient } from "aws4fetch";
import type { Context } from "hono";
import type { Env } from "../types/env";
import { ErrorCode, isStorageError } from "../types/error";
import type { BucketProvider } from "./bucket";
import type { CacheProvider } from "./cache";
import { createStorageError } from "./storage";
export interface IBlobStorageProvider {
  addBlob(blobId: string, data: ArrayBuffer, size: number): Promise<string>;
  getBlobUrl(path: string): Promise<string>;
  removeBlob(path: string): Promise<void>;
  moveBlob(sourcePath: string, destinationPath: string): Promise<string>;
  deletePath(prefix: string): Promise<void>;
}

export class BlobStorageProvider implements IBlobStorageProvider {
  private readonly aws: AwsClient;
  private readonly accountId: string;
  private readonly bucketName: string;
  private readonly cacheKeys = {
    blobUrl: (path: string) => `blob-url:${path}`,
  };

  constructor(
    private readonly ctx: Context<Env>,
    private readonly cache: CacheProvider,
    private readonly objectStorage: BucketProvider,
  ) {
    this.accountId = ctx.env.ACCOUNT_ID;
    this.bucketName = ctx.env.R2_BUCKET_NAME;
    this.aws = new AwsClient({
      accessKeyId: ctx.env.R2_ACCESS_KEY_ID,
      secretAccessKey: ctx.env.R2_SECRET_ACCESS_KEY,
    });
  }

  async addBlob(
    blobId: string,
    data: ArrayBuffer,
    size: number,
  ): Promise<string> {
    try {
      await this.objectStorage.put(blobId, data, {
        customMetadata: {
          size: size.toString(),
        },
      });
      return blobId;
    } catch (error) {
      console.error("Error uploading blob:", error);
      throw createStorageError(
        ErrorCode.ConnectionFailed,
        "Failed to upload blob to storage",
      );
    }
  }

  async getBlobUrl(path: string): Promise<string> {
    const cacheKey = this.cacheKeys.blobUrl(path);
    const cachedUrl = await this.cache.get(cacheKey);
    if (cachedUrl) {
      return cachedUrl;
    }

    try {
      const object = await this.objectStorage.head(path);
      if (!object) {
        throw createStorageError(ErrorCode.NotFound, "Blob not found");
      }

      // Construct URL for the R2 object
      const url = this.objectStorage.buildUrl(
        this.bucketName,
        path,
        this.accountId,
      );

      // Set expiration to 1 hour (3600 seconds)
      url.searchParams.set("X-Amz-Expires", "3600");

      // Generate presigned URL
      const signed = await this.aws.sign(
        new Request(url, {
          method: "GET",
        }),
        {
          aws: { signQuery: true },
        },
      );

      await this.cache.set(cacheKey, signed.url, 1800);
      return signed.url;
    } catch (error) {
      if (isStorageError(error) && error.code === ErrorCode.NotFound) {
        throw error;
      }
      console.error("Error getting blob URL:", error);
      throw createStorageError(
        ErrorCode.ConnectionFailed,
        "Failed to get blob URL",
      );
    }
  }

  async removeBlob(path: string): Promise<void> {
    try {
      await this.objectStorage.delete(path);
    } catch (error) {
      console.error("Error removing blob:", error);
      throw createStorageError(
        ErrorCode.ConnectionFailed,
        "Failed to remove blob",
      );
    }
  }

  async moveBlob(sourcePath: string, destinationPath: string): Promise<string> {
    try {
      const parsedSrcPath = sourcePath.includes("?")
        ? sourcePath.split("?")[0].split("/").pop()
        : sourcePath;
      const actualSourcePath = parsedSrcPath ?? "";
      const sourceObject = await this.objectStorage.get(actualSourcePath);
      if (!sourceObject) {
        throw createStorageError(ErrorCode.NotFound, "Source blob not found");
      }

      // Copy to new location
      await this.objectStorage.put(
        destinationPath,
        await sourceObject.arrayBuffer(),
        {
          customMetadata: sourceObject.customMetadata,
        },
      );

      // Delete original
      await this.objectStorage.delete(sourcePath);

      // Return URL for new location
      return await this.getBlobUrl(destinationPath);
    } catch (error) {
      console.error("Error moving blob:", error);
      throw createStorageError(
        ErrorCode.ConnectionFailed,
        "Failed to move blob",
      );
    }
  }

  async deletePath(prefix: string): Promise<void> {
    try {
      const objects = await this.objectStorage.list({
        prefix,
      });

      // Delete objects in batches of 1000 (R2 limit)
      const deletePromises: Promise<void>[] = [];
      const batch: string[] = [];

      for (const object of objects.objects) {
        batch.push(object.key);
        if (batch.length === 1000) {
          deletePromises.push(this.deleteObjects(batch));
          batch.length = 0;
        }
      }

      if (batch.length > 0) {
        deletePromises.push(this.deleteObjects(batch));
      }

      await Promise.all(deletePromises);
    } catch (error) {
      console.error("Error deleting path:", error);
      throw createStorageError(
        ErrorCode.ConnectionFailed,
        "Failed to delete path",
      );
    }
  }

  private async deleteObjects(keys: string[]): Promise<void> {
    try {
      await Promise.all(keys.map((key) => this.objectStorage.delete(key)));
    } catch (error) {
      console.error("Error deleting objects:", error);
      throw createStorageError(
        ErrorCode.ConnectionFailed,
        "Failed to delete objects",
      );
    }
  }
}
