export enum ErrorSource {
  Storage = "storage",
  Rest = "rest",
  Auth = "auth",
  Diffing = "diffing",
}

export interface CodePushError extends Error {
  source: ErrorSource;
  code: number;
  statusCode?: number;
}

export function createError(
  source: ErrorSource,
  message: string,
  code: number,
): CodePushError {
  const error = new Error(message) as CodePushError;
  error.source = source;
  error.code = code;
  return error;
}

export enum ErrorCode {
  ConnectionFailed = 0,
  NotFound = 1,
  AlreadyExists = 2,
  TooLarge = 3,
  Expired = 4,
  Invalid = 5,
  Other = 99,
}

export interface StorageError extends Error {
  code: ErrorCode;
  source: "storage";
}

export const isStorageError = (error: unknown): error is StorageError => {
  return error instanceof Error && (error as StorageError).source === "storage";
};
