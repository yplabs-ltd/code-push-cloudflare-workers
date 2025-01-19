import type { Context, MiddlewareHandler } from "hono";

interface LogEntry {
  timestamp: string;
  method: string;
  url: string;
  status?: number;
  duration?: number;
  error?: unknown;
}

export const logging = (): MiddlewareHandler => {
  return async (c: Context, next: () => Promise<void>): Promise<void> => {
    const start = Date.now();
    const requestLog: LogEntry = {
      timestamp: new Date().toISOString(),
      method: c.req.method,
      url: c.req.url,
    };

    console.log(
      `[${requestLog.timestamp}] ${requestLog.method} ${requestLog.url}`,
    );

    try {
      await next();

      const duration = Date.now() - start;
      const responseLog: LogEntry = {
        ...requestLog,
        status: c.res.status,
        duration,
      };

      console.log(
        `[${responseLog.timestamp}] ${responseLog.method} ${responseLog.url} - ${
          responseLog.status
        } (${responseLog.duration}ms)`,
      );
    } catch (err) {
      const errorLog: LogEntry = {
        ...requestLog,
        error: err,
      };

      console.error(`[${errorLog.timestamp}] Error:`, errorLog.error);
      throw err;
    }
  };
};
