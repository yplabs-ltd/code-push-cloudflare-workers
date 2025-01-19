import type { Context } from "hono";
import { HTTPException } from "hono/http-exception";
import { ErrorCode, type StorageError } from "../types/error";

interface ErrorResponse {
  error: string;
}

export const errorHandler = async (
  err: Error,
  c: Context,
): Promise<Response> => {
  if (err instanceof HTTPException) {
    return c.json<ErrorResponse>(
      {
        error: err.message,
      },
      err.status,
    );
  }

  if (isStorageError(err)) {
    switch (err.code) {
      case ErrorCode.NotFound:
        return c.json<ErrorResponse>(
          { error: err.message || "Resource not found" },
          404,
        );
      case ErrorCode.AlreadyExists:
        return c.json<ErrorResponse>(
          { error: err.message || "Resource already exists" },
          409,
        );
      case ErrorCode.Expired:
        return c.json<ErrorResponse>(
          { error: err.message || "Resource has expired" },
          401,
        );
      case ErrorCode.Invalid:
        return c.json<ErrorResponse>(
          { error: err.message || "Invalid request" },
          400,
        );
      case ErrorCode.TooLarge:
        return c.json<ErrorResponse>(
          { error: err.message || "Resource too large" },
          413,
        );
      case ErrorCode.ConnectionFailed:
        return c.json<ErrorResponse>(
          { error: err.message || "Service unavailable" },
          503,
        );
      default:
        console.error("Storage error:", err);
        return c.json<ErrorResponse>({ error: "Internal server error" }, 500);
    }
  }

  console.error("Unhandled error:", err);
  return c.json<ErrorResponse>({ error: "Internal server error" }, 500);
};

export const handle404 = (c: Context): Response => {
  return c.json<ErrorResponse>({ error: "Not Found" }, 404);
};

// biome-ignore lint/suspicious/noExplicitAny: <explanation>
function isStorageError(error: any): error is StorageError {
  return (
    error && typeof error === "object" && "code" in error && "source" in error
  );
}
