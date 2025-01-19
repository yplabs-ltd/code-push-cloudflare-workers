import type { Context } from "hono";
import type { Env } from "../types/env";

export enum LogLevel {
  DEBUG = "DEBUG",
  INFO = "INFO",
  WARN = "WARN",
  ERROR = "ERROR",
}

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  data?: Record<string, unknown>;
  requestId?: string;
  accountId?: string;
  error?: unknown;
}

export class Logger {
  private readonly ctx: Context<Env>;

  constructor(ctx: Context<Env>) {
    this.ctx = ctx;
  }

  debug(message: string, data?: Record<string, unknown>): void {
    this.log(LogLevel.DEBUG, message, data);
  }

  info(message: string, data?: Record<string, unknown>): void {
    this.log(LogLevel.INFO, message, data);
  }

  warn(message: string, data?: Record<string, unknown>): void {
    this.log(LogLevel.WARN, message, data);
  }

  error(
    message: string,
    error?: unknown,
    data?: Record<string, unknown>,
  ): void {
    this.log(LogLevel.ERROR, message, data, error);
  }

  private log(
    level: LogLevel,
    message: string,
    data?: Record<string, unknown>,
    error?: unknown,
  ): void {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      requestId: this.ctx.req.header("x-request-id"),
      accountId: this.ctx.get("auth")?.accountId,
    };

    if (data) {
      entry.data = this.sanitizeData(data);
    }

    if (error) {
      entry.error = this.formatError(error);
    }

    // In production, we would send this to a logging service
    console.log(JSON.stringify(entry));
  }

  private sanitizeData(data: Record<string, unknown>): Record<string, unknown> {
    const sanitized: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(data)) {
      if (this.isSensitiveKey(key)) {
        sanitized[key] = "[REDACTED]";
      } else {
        sanitized[key] = value;
      }
    }
    return sanitized;
  }

  private isSensitiveKey(key: string): boolean {
    const sensitiveKeys = [
      "password",
      "token",
      "secret",
      "key",
      "authorization",
      "cookie",
    ];
    return sensitiveKeys.some((k) => key.toLowerCase().includes(k));
  }

  private formatError(error: unknown): unknown {
    if (error instanceof Error) {
      return {
        name: error.name,
        message: error.message,
        stack: error.stack,
        cause: error.cause,
      };
    }
    return error;
  }
}
