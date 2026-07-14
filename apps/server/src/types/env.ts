export interface Env {
  Bindings: {
    DB: D1Database;
    STORAGE_BUCKET: R2Bucket;
    GITHUB_CLIENT_ID: string;
    GITHUB_CLIENT_SECRET: string;
    // 로그인 허용 GitHub 조직(org) slug. 콜백에서 이 org 멤버만 로그인/가입 허용.
    GITHUB_ORG: string;
    SERVER_URL: string;
    JWT_SECRET: string;
    ENABLE_ACCOUNT_REGISTRATION: string;
    CORS_ORIGINS: string;
    // 세션 쿠키를 서브도메인 간 공유하기 위한 상위 도메인(예: yplabs.workers.dev). 로컬은 미설정.
    COOKIE_DOMAIN?: string;
    GOOGLE_CLIENT_ID?: string;
    GOOGLE_CLIENT_SECRET?: string;
    // Google 로그인 허용 이메일 도메인(콤마 구분, 예: "yplabs.kr"). 미설정 시 Google 로그인 전부 거부.
    GOOGLE_ALLOWED_DOMAIN?: string;
    ACCOUNT_ID: string;
    R2_BUCKET_NAME: string;
    R2_ACCESS_KEY_ID: string;
    R2_SECRET_ACCESS_KEY: string;
    AWS_REGION: string;
    AWS_ACCESS_KEY_ID: string;
    AWS_SECRET_ACCESS_KEY: string;
    AWS_S3_BUCKET_NAME: string;
    // Slack 릴리즈 알림 webhook의 /services/ 뒤 path segment. 미설정 시 알림 스킵.
    CODE_PUSH_NOTI_SLACK?: string;
  };
}
