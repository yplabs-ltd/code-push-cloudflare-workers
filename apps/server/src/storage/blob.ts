import { AwsClient } from "aws4fetch";
import type { Context } from "hono";
import type { Env } from "../types/env";
import { ErrorCode, isStorageError } from "../types/error";
import { createStorageError } from "./storage";

export class BlobStorageProvider {
  private readonly storage: R2Bucket;
  private readonly aws: AwsClient;
  private readonly accountId: string;
  private readonly bucketName: string;

  constructor(private readonly ctx: Context<Env>) {
    this.storage = ctx.env.STORAGE_BUCKET;
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
      await this.storage.put(blobId, data, {
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
    try {
      const object = await this.storage.head(path);
      if (!object) {
        throw createStorageError(ErrorCode.NotFound, "Blob not found");
      }

      // Construct URL for the R2 object
      const url = new URL(
        `https://${this.bucketName}.${this.accountId}.r2.cloudflarestorage.com/${path}`,
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
      await this.storage.delete(path);
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
      const sourceObject = await this.storage.get(actualSourcePath);
      if (!sourceObject) {
        throw createStorageError(ErrorCode.NotFound, "Source blob not found");
      }

      // Copy to new location
      await this.storage.put(
        destinationPath,
        await sourceObject.arrayBuffer(),
        {
          customMetadata: sourceObject.customMetadata,
        },
      );

      // Delete original
      await this.storage.delete(sourcePath);

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
      const objects = await this.storage.list({
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
      await Promise.all(keys.map((key) => this.storage.delete(key)));
    } catch (error) {
      console.error("Error deleting objects:", error);
      throw createStorageError(
        ErrorCode.ConnectionFailed,
        "Failed to delete objects",
      );
    }
  }
}
