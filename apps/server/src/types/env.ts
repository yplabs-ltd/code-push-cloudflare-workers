export interface Env {
  Bindings: {
    DB: D1Database;
    STORAGE_BUCKET: R2Bucket;
    GITHUB_CLIENT_ID: string;
    GITHUB_CLIENT_SECRET: string;
    SERVER_URL: string;
    JWT_SECRET: string;
    ENABLE_ACCOUNT_REGISTRATION: string;
    CORS_ORIGINS: string;
    ACCOUNT_ID: string;
    R2_BUCKET_NAME: string;
    R2_ACCESS_KEY_ID: string;
    R2_SECRET_ACCESS_KEY: string;
    AWS_REGION: string;
    AWS_ACCESS_KEY_ID: string;
    AWS_SECRET_ACCESS_KEY: string;
    AWS_S3_BUCKET_NAME: string;
  };
}
