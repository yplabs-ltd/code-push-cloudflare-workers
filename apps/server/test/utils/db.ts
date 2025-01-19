import { env } from "cloudflare:test";
import { drizzle } from "drizzle-orm/d1";
import * as schema from "../../src/db/schema";

export async function cleanupDatabase(): Promise<void> {
  const db = drizzle(env.DB, { schema });

  await db.delete(schema.packageDiff);
  await db.delete(schema.packages);
  await db.delete(schema.deployment);
  await db.delete(schema.collaborator);
  await db.delete(schema.app);
  await db.delete(schema.accessKey);
  await db.delete(schema.account);
}

export function getTestDb() {
  return drizzle(env.DB, { schema });
}
