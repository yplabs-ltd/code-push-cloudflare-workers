import path from "node:path";
import {
  defineWorkersProject,
  readD1Migrations,
} from "@cloudflare/vitest-pool-workers/config";

export default defineWorkersProject(async () => {
  // Read all migrations in the `migrations` directory
  const migrationsPath = path.join(__dirname, "drizzle/migrations");
  const migrations = await readD1Migrations(migrationsPath);

  return {
    test: {
      setupFiles: ["./test/apply-migrations.ts"],
      poolOptions: {
        workers: {
          singleWorker: true,
          wrangler: {
            configPath: "./wrangler.toml",
          },
          miniflare: {
            // Add a test-only binding for migrations, so we can apply them in a
            // setup file
            d1Databases: ["DB"],
            bindings: {
              TEST_MIGRATIONS: migrations,
              GITHUB_CLIENT_ID: "xxx",
              GITHUB_CLIENT_SECRET: "xxx",
              JWT_SECRET: "test",
              ACCOUNT_ID: "test",
              R2_BUCKET_NAME: "test",
              R2_ACCESS_KEY_ID: "test",
              R2_SECRET_ACCESS_KEY: "test",
              ENABLE_ACCOUNT_REGISTRATION: "true",
              SERVER_URL: "http://localhost:5173",
            },
            r2Buckets: ["STORAGE_BUCKET"],
          },
        },
      },
    },
  };
});
