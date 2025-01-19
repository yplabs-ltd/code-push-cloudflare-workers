import type { Context } from "hono";
import { HTTPException } from "hono/http-exception";
import { ErrorCode, type StorageError } from "../types/storage";

export class AppError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode: number = 500,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: unknown) {
    super(message, "VALIDATION_ERROR", 400, details);
    this.name = "ValidationError";
  }
}

export class AuthError extends AppError {
  constructor(message: string) {
    super(message, "AUTH_ERROR", 401);
    this.name = "AuthError";
  }
}

export class ForbiddenError extends AppError {
  constructor(message: string) {
    super(message, "FORBIDDEN", 403);
    this.name = "ForbiddenError";
  }
}

export class NotFoundError extends AppError {
  constructor(message: string) {
    super(message, "NOT_FOUND", 404);
    this.name = "NotFoundError";
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super(message, "CONFLICT", 409);
    this.name = "ConflictError";
  }
}

export function handleError(error: unknown, c: Context): Response {
  console.error("Error:", error);

  if (error instanceof AppError) {
    return c.json({
      error: error.code,
      error_description: error.message,
      details: error.details,
    }); // TODO: set status
  }

  if (error instanceof HTTPException) {
    return c.json(
      {
        error: "HTTP_ERROR",
        error_description: error.message,
      },
      error.status,
    );
  }

  if (isStorageError(error)) {
    // const statusCode = storageErrorToStatusCode(error.code);
    return c.json({
      error: "STORAGE_ERROR",
      error_description: error.message,
    });
  }

  return c.json(
    {
      error: "INTERNAL_ERROR",
      error_description: "An unexpected error occurred",
    },
    500,
  );
}

function isStorageError(error: unknown): error is StorageError {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    "source" in error &&
    error.source === "storage"
  );
}
function storageErrorToStatusCode(code: ErrorCode): number {
  switch (code) {
    case ErrorCode.NotFound:
      return 404;
    case ErrorCode.AlreadyExists:
      return 409;
    case ErrorCode.Invalid:
      return 400;
    case ErrorCode.Expired:
      return 401;
    case ErrorCode.TooLarge:
      return 413;
    case ErrorCode.ConnectionFailed:
      return 503;
    default:
      return 500;
  }
}
