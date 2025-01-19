import { z } from "@hono/zod-openapi";

// Common validation patterns
export const patterns = {
  semver: /^\d+\.\d+\.\d+$/,
  resourceName: /^[a-zA-Z0-9\-_]+$/,
  deploymentKey: /^dk_[a-zA-Z0-9]{32}$/,
  accessKey: /^ck_[a-zA-Z0-9]{32}$/,
  packageHash: /^[a-f0-9]{64}$/,
} as const;

// Base schemas
export const BasePackageInfo = z.object({
  appVersion: z.string().regex(patterns.semver),
  description: z.string().optional(),
  isDisabled: z.boolean().optional(),
  isMandatory: z.boolean().optional(),
  rollout: z.number().min(0).max(100).optional(),
});

export const BaseDeployment = z.object({
  name: z.string().min(1).regex(patterns.resourceName),
  key: z.string().regex(patterns.deploymentKey).optional(),
});

export const BaseApp = z.object({
  name: z.string().min(1).regex(patterns.resourceName),
});

export const BaseCollaborator = z.object({
  email: z.string().email(),
  permission: z.enum(["Owner", "Collaborator"]),
});

// Response schemas
export const ErrorResponse = z.object({
  error: z.string(),
  error_description: z.string().optional(),
});

export const SuccessResponse = z.object({
  status: z.literal("ok"),
});

// Utility functions
export function validateSemver(version: string): boolean {
  return patterns.semver.test(version);
}

export function validateResourceName(name: string): boolean {
  return patterns.resourceName.test(name);
}

export function validateEmail(email: string): boolean {
  return z.string().email().safeParse(email).success;
}

// Helper for common pagination parameters
export const PaginationParams = z.object({
  page: z.number().min(1).optional().default(1),
  limit: z.number().min(1).max(100).optional().default(20),
});

// Helper for common sort parameters
export const SortParams = z.object({
  sortBy: z.string(),
  order: z.enum(["asc", "desc"]).default("asc"),
});

// Helper for date range parameters
export const DateRangeParams = z.object({
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
});

export type PaginationParamsType = z.infer<typeof PaginationParams>;
export type SortParamsType = z.infer<typeof SortParams>;
export type DateRangeParamsType = z.infer<typeof DateRangeParams>;

export const queryCompatibleBoolean = z.preprocess((value: unknown) => {
  if (typeof value === "boolean") {
    return value;
  }

  if (value === "true" || value === "1") {
    return true;
  }
  if (value === "false" || value === "0") {
    return false;
  }

  return value;
}, z.boolean());
