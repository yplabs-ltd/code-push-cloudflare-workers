import {
  DeleteObjectCommand,
  DeleteObjectsCommand,
  GetObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import type {
  BucketObject,
  BucketObjectBody,
  BucketObjects,
  BucketProvider,
} from "./bucket";

export class S3BucketProvider implements BucketProvider {
  private readonly s3: S3Client;
  private readonly bucketName: string;
  private readonly region: string;

  constructor(
    region: string,
    accessKeyId: string,
    secretAccessKey: string,
    bucketName: string,
  ) {
    this.region = region;
    this.bucketName = bucketName;
    this.s3 = new S3Client({
      region,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
    });
  }

  private getEndpoint(path = ""): string {
    return `https://${this.bucketName}.s3.${this.region}.amazonaws.com/${path}`;
  }

  async get(key: string): Promise<BucketObjectBody | null> {
    try {
      const command = new GetObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      });
      const response = await this.s3.send(command);
      if (!response.Body) return null;

      return {
        key,
        size: response.ContentLength || 0,
        lastModified: response.LastModified || new Date(),
        customMetadata: response.Metadata || {},
        arrayBuffer: async () => {
          const body = response.Body as unknown as {
            transformToByteArray: () => Promise<Uint8Array>;
          };
          const bytes = await body.transformToByteArray();
          return bytes.buffer as ArrayBuffer;
        },
      };
    } catch (error) {
      return null;
    }
  }

  async list(options: { prefix: string }): Promise<BucketObjects> {
    try {
      const command = new ListObjectsV2Command({
        Bucket: this.bucketName,
        Prefix: options.prefix,
      });
      const response = await this.s3.send(command);

      return {
        objects: (response.Contents || []).map((item) => ({
          key: item.Key || "",
          size: item.Size || 0,
          lastModified: item.LastModified || new Date(),
          customMetadata: {},
        })),
      };
    } catch (error) {
      return { objects: [] };
    }
  }

  async delete(keys: string[] | string): Promise<void> {
    const keyArray = Array.isArray(keys) ? keys : [keys];

    if (keyArray.length === 1) {
      const command = new DeleteObjectCommand({
        Bucket: this.bucketName,
        Key: keyArray[0],
      });
      await this.s3.send(command);
      return;
    }

    const command = new DeleteObjectsCommand({
      Bucket: this.bucketName,
      Delete: {
        Objects: keyArray.map((key) => ({ Key: key })),
      },
    });
    await this.s3.send(command);
  }

  async put(
    key: string,
    value: ArrayBuffer,
    options: {
      customMetadata: Record<string, string>;
    },
  ): Promise<BucketObject> {
    const command = new PutObjectCommand({
      Bucket: this.bucketName,
      Key: key,
      Body: new Uint8Array(value),
      Metadata: options.customMetadata,
    });
    const response = await this.s3.send(command);
    console.log(response, key);

    return {
      key,
      size: value.byteLength,
      lastModified: new Date(),
      customMetadata: options.customMetadata,
    };
  }

  async head(key: string): Promise<BucketObject | null> {
    try {
      const command = new HeadObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      });
      const response = await this.s3.send(command);

      return {
        key,
        size: response.ContentLength || 0,
        lastModified: response.LastModified || new Date(),
        customMetadata: response.Metadata || {},
      };
    } catch (error) {
      return null;
    }
  }

  buildUrl(_bucketName: string, path: string, _accountId: string): URL {
    return new URL(this.getEndpoint(path));
  }
}
