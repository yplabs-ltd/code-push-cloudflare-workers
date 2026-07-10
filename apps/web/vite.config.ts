import path from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";

// 세션 쿠키 인증은 동일 오리진을 요구한다. dev에서는 아래 경로들을 서버로 프록시해
// 브라우저가 localhost:3000과만 통신하도록 하고, cookieDomainRewrite로 쿠키를 localhost에 심는다.
// - VITE_PROXY_TARGET: 프록시 대상 서버(기본 로컬 wrangler dev). OAuth까지 dev에서 돌리려면
//   대상 서버의 SERVER_URL=http://localhost:3000, GitHub OAuth 콜백에 localhost:3000 등록 필요.
// - 이 프록시를 쓰려면 웹은 상대경로로 호출해야 하므로 VITE_API_URL은 빈 값(상대)으로 둔다.
const PROXY_PATHS = [
  "/apps",
  "/account",
  "/accessKeys",
  "/auth",
  "/v0.1",
  "/updateCheck",
  "/reportStatus",
  "/docs",
];

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const target = env.VITE_PROXY_TARGET || "http://localhost:8787";

  const proxy = Object.fromEntries(
    PROXY_PATHS.map((p) => [
      p,
      {
        target,
        changeOrigin: true,
        cookieDomainRewrite: "localhost",
      },
    ]),
  );

  return {
    plugins: [react()],
    server: {
      // GitHub OAuth 콜백 URL(localhost:3000)과 동일 오리진 유지를 위해 포트 고정
      port: 3000,
      proxy,
    },
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
  };
});
