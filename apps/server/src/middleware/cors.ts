import type { Context } from "hono";
import { cors } from "hono/cors";

export const corsMiddleware = (c: Context) =>
  cors({
    origin: (origin) => {
      // Check allowed origins from environment
      const allowedOrigins = (c.env.CORS_ORIGINS || "").split(",");
      if (allowedOrigins.includes(origin)) {
        return origin;
      }
      return allowedOrigins[0]; // Default to first allowed origin
    },
    credentials: true,
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
    allowHeaders: [
      "Content-Type",
      "Authorization",
      "X-Requested-With",
      "X-CodePush-SDK-Version",
      "X-CodePush-Plugin-Version",
    ],
    exposeHeaders: ["Location"],
  });
