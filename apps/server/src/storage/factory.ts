import type { Context } from "hono";
import type { Env } from "../types/env";
import { D1StorageProvider } from "./d1";
import type { StorageProvider } from "./storage";

let storageInstance: StorageProvider | null = null;
let lastContext: Context<Env> | null = null;

export function getStorageProvider(ctx: Context<Env>): StorageProvider {
  // If context changed or no instance exists, create new instance
  if (!storageInstance || ctx !== lastContext) {
    storageInstance = new D1StorageProvider(ctx);
    lastContext = ctx;
  }
  return storageInstance;
}
