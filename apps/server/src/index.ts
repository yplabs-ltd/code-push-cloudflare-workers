import { WorkerEntrypoint } from "cloudflare:workers";
import { OpenAPIHono } from "@hono/zod-openapi";
import { Hono } from "hono";
import { prettyJSON } from "hono/pretty-json";
import { secureHeaders } from "hono/secure-headers";
import { handlers } from "./handlers";
import { authMiddleware } from "./middleware/auth";
import { corsMiddleware } from "./middleware/cors";
import { logging } from "./middleware/logging";
import { acquisitionRouter } from "./routes/acquisition";
import { authRouter } from "./routes/auth";
import { managementRouter } from "./routes/management";
import { errorHandler, handle404 } from "./storage/error";
import type { Env } from "./types/env";
import {
  buildUpdateCheckCacheKey,
  isUpdateCheckRequest,
  withDefaultNoStore,
} from "./utils/update-check-cache";

// Create Hono app
const app = new OpenAPIHono<Env>();

// Global middleware
app.use("*", logging());
app.use("*", prettyJSON());
app.use("*", secureHeaders());
app.use("*", (c, next) => corsMiddleware(c)(c, next));
// Mount routers
app.route("/", managementRouter);
app.route("/", acquisitionRouter);
app.route("/auth", authRouter);

// Global error handling
app.notFound(handle404);
app.onError(errorHandler);

// Health check
app.get("/health", (c) => c.json({ status: "ok" }));
app.get("/authenticated", authMiddleware(), handlers.authenticatedHandler);

app.doc("/docs", {
  openapi: "3.0.0",
  info: {
    title: "CodePush API",
    version: "1.0.0",
  },
});

// Workers Cache가 앞에 붙는 진입점. update_check GET만 들어온다.
export class Backend extends WorkerEntrypoint<Env["Bindings"]> {
  async fetch(request: Request): Promise<Response> {
    const response = await app.fetch(request, this.env, this.ctx);
    return withDefaultNoStore(response);
  }
}

type GatewayContext = ExecutionContext & {
  exports?: { Backend?: Fetcher };
};

export default {
  async fetch(
    request: Request,
    env: Env["Bindings"],
    ctx: GatewayContext,
  ): Promise<Response> {
    const url = new URL(request.url);
    if (!isUpdateCheckRequest(request.method, url.pathname)) {
      return app.fetch(request, env, ctx);
    }

    const backend = ctx.exports?.Backend;
    if (!backend) {
      console.warn("ctx.exports.Backend 없음: update_check를 캐시 없이 처리");
      return app.fetch(request, env, ctx);
    }

    const response = await backend.fetch(request, {
      cf: { cacheKey: buildUpdateCheckCacheKey(url) },
    });
    console.log({
      message: "update_check cache",
      cacheStatus: response.headers.get("cf-cache-status") ?? "NONE",
      path: url.pathname,
      status: response.status,
    });
    return response;
  },
};
