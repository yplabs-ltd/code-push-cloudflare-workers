import type { Context, MiddlewareHandler } from "hono";
import type { Env } from "../types/env";
import { AppError } from "./errors";
import { Logger } from "./logger";
import { SECURE_HEADERS } from "./security";

export function createRequestLogger(): MiddlewareHandler<Env> {
  return async (c, next) => {
    const logger = new Logger(c);
    const start = Date.now();

    try {
      await next();
    } catch (error) {
      logger.error("Request failed", error, {
        url: c.req.url,
        method: c.req.method,
        duration: Date.now() - start,
      });
      throw error;
    }

    logger.info("Request completed", {
      url: c.req.url,
      method: c.req.method,
      status: c.res.status,
      duration: Date.now() - start,
    });
  };
}

export function createRateLimiter(
  windowMs: number,
  max: number,
): MiddlewareHandler<Env> {
  return async (c, next) => {
    const ip = c.req.header("cf-connecting-ip") || "unknown";
    const key = `ratelimit:${ip}`;

    const current = await c.env.CODE_PUSH_KV.get(key);
    const count = current ? Number.parseInt(current, 10) : 0;

    if (count >= max) {
      throw new AppError("Too many requests", "RATE_LIMIT_EXCEEDED", 429);
    }

    await c.env.CODE_PUSH_KV.put(key, (count + 1).toString(), {
      expirationTtl: windowMs / 1000,
    });

    await next();
  };
}

export function createSecurityHeaders(): MiddlewareHandler<Env> {
  return async (c, next) => {
    await next();

    for (const [header, value] of Object.entries(SECURE_HEADERS)) {
      c.res.headers.set(header, value);
    }
  };
}

export function createRequestId(): MiddlewareHandler<Env> {
  return async (c, next) => {
    const requestId = c.req.header("x-request-id") || crypto.randomUUID();
    c.res.headers.set("x-request-id", requestId);
    await next();
  };
}

export function createErrorBoundary(): MiddlewareHandler<Env> {
  return async (c, next) => {
    try {
      await next();
    } catch (error) {
      const logger = new Logger(c);
      logger.error("Unhandled error", error);

      if (error instanceof AppError) {
        return c.json(
          {
            error: error.code,
            error_description: error.message,
            details: error.details,
          },
          error.statusCode,
        );
      }

      return c.json(
        {
          error: "INTERNAL_ERROR",
          error_description: "An unexpected error occurred",
        },
        500,
      );
    }
  };
}
