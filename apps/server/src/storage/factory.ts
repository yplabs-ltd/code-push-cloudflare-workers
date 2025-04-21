import type { Context } from "hono";
import type { Env } from "../types/env";
import { D1StorageProvider } from "./d1";
import type { StorageProvider } from "./storage";
import { InMemoryCacheProvider, type CacheProvider } from "./cache";
import { BlobStorageProvider } from "./blob";

let storageInstance: StorageProvider | null = null;
let lastContext: Context<Env> | null = null;
let cacheInstance: CacheProvider | null = null;
let blobInstance: BlobStorageProvider | null = null;

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

export function getBlobProvider(
  ctx: Context<Env>,
  cache: CacheProvider,
): BlobStorageProvider {
  if (!blobInstance || ctx !== lastContext) {
    blobInstance = new BlobStorageProvider(ctx, cache);
  }
  return blobInstance;
}
