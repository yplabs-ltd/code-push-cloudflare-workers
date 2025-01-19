declare module "cloudflare:test" {
  // Controls the type of `import("cloudflare:test").env`
  interface ProvidedEnv extends Env {
    DB: D1Database;
    STORAGE_BUCKET: R2Bucket;
    TEST_MIGRATIONS: D1Migration[];
  }
}
