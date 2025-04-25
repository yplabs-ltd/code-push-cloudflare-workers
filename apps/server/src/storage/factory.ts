import type { Context } from "hono";
import type { Env } from "../types/env";
import { BlobStorageProvider, type IBlobStorageProvider } from "./blob";
import type { BucketProvider } from "./bucket";
import { type CacheProvider, InMemoryCacheProvider } from "./cache";
import { D1StorageProvider } from "./d1";
import { S3BucketProvider } from "./s3";
import type { StorageProvider } from "./storage";

let storageInstance: StorageProvider | null = null;
let lastContext: Context<Env> | null = null;
let cacheInstance: CacheProvider | null = null;
let blobInstance: IBlobStorageProvider | null = null;
let objectStorageInstance: BucketProvider | null = null;

export function getStorageProvider(ctx: Context<Env>): StorageProvider {
  // If context changed or no instance exists, create new instance
  if (!storageInstance || ctx !== lastContext) {
    const cache = getCacheProvider(ctx);
    const blob = getBlobProvider(ctx, cache);
    storageInstance = new D1StorageProvider(ctx, cache, blob);
    lastContext = ctx;
  }
  return storageInstance;
}

export function getCacheProvider(ctx: Context<Env>): CacheProvider {
  if (!cacheInstance) {
    cacheInstance = new InMemoryCacheProvider();
  }
  return cacheInstance;
}

export function getObjectStorageProvider(ctx: Context<Env>): BucketProvider {
  if (!objectStorageInstance) {
    objectStorageInstance = new S3BucketProvider(
      ctx.env.AWS_REGION,
      ctx.env.AWS_ACCESS_KEY_ID,
      ctx.env.AWS_SECRET_ACCESS_KEY,
      ctx.env.AWS_S3_BUCKET_NAME,
    );
  }
  return objectStorageInstance;
}

export function getBlobProvider(
  ctx: Context<Env>,
  cache: CacheProvider,
): IBlobStorageProvider {
  if (!blobInstance || ctx !== lastContext) {
    const objectStorage = getObjectStorageProvider(ctx);
    blobInstance = new BlobStorageProvider(ctx, cache, objectStorage);
  }
  return blobInstance;
}
