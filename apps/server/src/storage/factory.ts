import type { Context } from "hono";
import type { Env } from "../types/env";
import { D1StorageProvider } from "./d1";
import type { StorageProvider } from "./storage";
import { InMemoryCacheProvider, type CacheProvider } from "./cache";

let storageInstance: StorageProvider | null = null;
let lastContext: Context<Env> | null = null;
let cacheInstance: CacheProvider | null = null;

export function getStorageProvider(ctx: Context<Env>): StorageProvider {
  // If context changed or no instance exists, create new instance
  if (!storageInstance || ctx !== lastContext) {
    storageInstance = new D1StorageProvider(ctx, getCacheProvider(ctx));
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
