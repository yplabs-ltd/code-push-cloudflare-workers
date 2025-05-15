import type { Context } from "hono";
import type { Env } from "../types/env";
import { BlobStorageProvider, type IBlobStorageProvider } from "./blob";
import type { BucketProvider } from "./bucket";
import { type CacheProvider, InMemoryCacheProvider } from "./cache";
import { D1StorageProvider } from "./d1";
import type { StorageProvider } from "./storage";
import { R2BucketProvider } from "./r2";

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
    objectStorageInstance = new R2BucketProvider(ctx.env.STORAGE_BUCKET);
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
