import { z } from "@hono/zod-openapi";
import { validate } from "compare-versions";
import { queryCompatibleBoolean } from "../utils/validation";
import { isValidVersion, normalizeVersion } from "../utils/version";

// Enums
export const ReleaseMethod = z.enum(["Upload", "Promote", "Rollback"]);
export type ReleaseMethod = z.infer<typeof ReleaseMethod>;

export const Permission = z.enum(["Owner", "Collaborator"]);
export type Permission = z.infer<typeof Permission>;

// Schemas
export const ErrorSchema = z.object({
  error: z.string(),
  error_description: z.string().optional(),
});
export type ErrorSchema = z.infer<typeof ErrorSchema>;

export const CollaboratorSchema = z.object({
  accountId: z.string(),
  permission: Permission,
  isCurrentAccount: z.boolean().nullish(),
});
export type Collaborator = z.infer<typeof CollaboratorSchema>;

export const CollaboratorMapSchema = z.record(CollaboratorSchema);
export type CollaboratorMap = z.infer<typeof CollaboratorMapSchema>;

export const CollaboratorPropertiesSchema = z.object({
  accountId: z.string().optional(),
  isCurrentAccount: z.boolean().optional(),
  permission: Permission,
});
export type CollaboratorProperties = z.infer<
  typeof CollaboratorPropertiesSchema
>;

export const BlobInfoSchema = z.object({
  size: z.number(),
  url: z.string(),
});
export type BlobInfo = z.infer<typeof BlobInfoSchema>;

export const PackageHashToBlobInfoMapSchema = z.record(BlobInfoSchema);
export type PackageHashToBlobInfoMap = z.infer<
  typeof PackageHashToBlobInfoMapSchema
>;

export const PackageInfoSchema = z.object({
  appVersion: z.string().regex(/^\d+\.\d+\.\d+$/),
  description: z.string().optional(),
  isDisabled: z.boolean().optional(),
  isMandatory: z.boolean().optional(),
  rollout: z.number().min(0).max(100).nullish(),
});
export type PackageInfo = z.infer<typeof PackageInfoSchema>;

export const PackageInfoUpdateSchema = z.object({
  appVersion: z
    .string()
    .regex(/^\d+\.\d+\.\d+$/)
    .nullable()
    .optional(),
  description: z.string().nullable().optional(),
  isDisabled: z.boolean().nullable().optional(),
});
export type PackageInfoUpdate = z.infer<typeof PackageInfoUpdateSchema>;

export const PackageSchema = z.object({
  appVersion: z.string().regex(/^\d+\.\d+\.\d+$/),
  blobUrl: z.string(),
  description: z.string().optional(),
  diffPackageMap: PackageHashToBlobInfoMapSchema.optional(),
  isDisabled: z.boolean(),
  isMandatory: z.boolean(),
  label: z.string().optional(),
  manifestBlobUrl: z.string(),
  originalDeployment: z.string().optional(),
  originalLabel: z.string().optional(),
  packageHash: z.string(),
  releasedBy: z.string().optional(),
  releaseMethod: ReleaseMethod.optional(),
  rollout: z.number().min(0).max(100).nullish(),
  size: z.number(),
  uploadTime: z.number(),
});
export type Package = z.infer<typeof PackageSchema>;

export const DeploymentSchema = z.object({
  id: z.string(),
  name: z.string(),
  key: z.string(),
  package: PackageSchema.nullish(),
  createdTime: z.number(),
});
export type Deployment = z.infer<typeof DeploymentSchema>;

export const DeploymentInfoSchema = z.object({
  appId: z.string(),
  deploymentId: z.string(),
});
export type DeploymentInfo = z.infer<typeof DeploymentInfoSchema>;

export const AppSchema = z.object({
  id: z.string(),
  name: z.string(),
  collaborators: z.record(CollaboratorSchema).default({}),
  deployments: z.array(z.string()),
  createdTime: z.number(),
});
export type App = z.infer<typeof AppSchema>;

export const AccountSchema = z.object({
  id: z.string(),
  email: z.string(),
  name: z.string(),
  linkedProviders: z.array(z.string()),
  gitHubId: z.string().optional(),
  createdTime: z.number(),
});
export type Account = z.infer<typeof AccountSchema>;

export const AccessKeySchema = z.object({
  id: z.string(),
  name: z.string().optional(),
  friendlyName: z.string(),
  createdBy: z.string(),
  createdTime: z.number(),
  expires: z.number(),
  description: z.string().optional(),
  isSession: z.boolean().optional(),
});
export type AccessKey = z.infer<typeof AccessKeySchema>;

export const MetricsSchema = z.object({
  active: z.number(),
  downloads: z.number().optional(),
  installed: z.number().optional(),
  failed: z.number().optional(),
});
export type Metrics = z.infer<typeof MetricsSchema>;

export const UpdateCheckResponseSchema = z.object({
  updateInfo: z.object({
    isAvailable: z.boolean(),
    isMandatory: z.boolean(),
    isDisabled: z.boolean().optional().default(false),
    appVersion: z.string(),
    packageHash: z.string().optional(),
    label: z.string().optional(),
    packageSize: z.number().optional(),
    description: z.string().optional(),
    downloadURL: z.string().optional(),
    shouldRunBinaryVersion: z.boolean().optional(),
    updateAppVersion: z.boolean().optional(),
  }),
});
export type UpdateCheckResponse = z.infer<typeof UpdateCheckResponseSchema>;

export const LegacyUpdateCheckResponseSchema = z.object({
  // snakecase
  update_info: z.object({
    is_available: z.boolean(),
    is_mandatory: z.boolean(),
    app_version: z.string(),
    package_hash: z.string().optional(),
    label: z.string().optional(),
    package_size: z.number().optional(),
    description: z.string().optional(),
    download_url: z.string().optional(),
    should_run_binary_version: z.boolean().optional().default(false),
    update_app_version: z.boolean().optional().default(false),
    target_binary_range: z.string().optional(),
  }),
});
export type LegacyUpdateCheckResponse = z.infer<
  typeof LegacyUpdateCheckResponseSchema
>;

export const ApiResponse = z.object({
  status: z.literal("ok"),
});
export type ApiResponse = z.infer<typeof ApiResponse>;

export const UpdateCheckParams = z.object({
  appVersion: z.string().refine(isValidVersion, {
    message: "Invalid version format",
  }),
  deploymentKey: z.string().min(10),
  packageHash: z.string().optional(),
  label: z.string().optional(),
  clientUniqueId: z.string().optional(),
  isCompanion: queryCompatibleBoolean.optional().default(false),
});
export type UpdateCheckParams = z.infer<typeof UpdateCheckParams>;

export const LegacyUpdateCheckParams = z.object({
  app_version: z.string().refine(isValidVersion, {
    message: "Invalid version format",
  }),
  deployment_key: z.string().min(10),
  package_hash: z.string().optional(),
  label: z.string().optional(),
  client_unique_id: z.string().optional(),
  is_companion: queryCompatibleBoolean.optional().default(false),
});
export type LegacyUpdateCheckParams = z.infer<typeof LegacyUpdateCheckParams>;

export const DeploymentReportBody = z.object({
  deploymentKey: z.string(),
  clientUniqueId: z.string(),
  label: z.string().optional(),
  appVersion: z.string(),
  previousDeploymentKey: z.string().optional(),
  previousLabelOrAppVersion: z.string().optional(),
  status: z.enum(["DeploymentSucceeded", "DeploymentFailed"]).optional(),
});

export type DeploymentReportBody = z.infer<typeof DeploymentReportBody>;

export const DownloadReportBody = z.object({
  deploymentKey: z.string(),
  label: z.string(),
  clientUniqueId: z.string(),
});
export type DownloadReportBody = z.infer<typeof DownloadReportBody>;
