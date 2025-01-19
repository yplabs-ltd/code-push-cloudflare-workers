import { OpenAPIHono, createRoute } from "@hono/zod-openapi";
import { compare, satisfies } from "compare-versions";
import qs from "qs";
import type { z } from "zod";
import { getStorageProvider } from "../storage/factory";
import type { Env } from "../types/env";
import { isStorageError } from "../types/error";
import {
  ApiResponse,
  DeploymentReportBody,
  DownloadReportBody,
  LegacyUpdateCheckParams,
  type LegacyUpdateCheckResponse,
  LegacyUpdateCheckResponseSchema,
  type Package,
  UpdateCheckParams,
  type UpdateCheckResponse,
  UpdateCheckResponseSchema,
} from "../types/schemas";
import { convertObjectToSnakeCase } from "../utils/convention";
import { MetricsManager } from "../utils/metrics";
import { rolloutStrategy } from "../utils/rollout";
import { normalizeVersion } from "../utils/version";

const router = new OpenAPIHono<Env>();

const routes = {
  updateCheck: createRoute({
    method: "get",
    path: "/updateCheck",
    request: {
      query: UpdateCheckParams,
    },
    responses: {
      200: {
        description: "",
        content: {
          "application/json": {
            schema: UpdateCheckResponseSchema,
          },
        },
      },
    },
  }),
  updateCheckV1: createRoute({
    method: "get",
    path: "/v0.1/public/codepush/update_check",
    request: {
      query: LegacyUpdateCheckParams,
    },
    responses: {
      200: {
        description: "",
        content: {
          "application/json": {
            schema: LegacyUpdateCheckResponseSchema,
          },
        },
      },
    },
  }),

  deploymentReport: createRoute({
    method: "post",
    path: "/reportStatus/deploy",
    request: {
      body: {
        content: {
          "application/json": {
            schema: DeploymentReportBody,
          },
        },
      },
    },
    responses: {
      200: {
        description: "",
        content: {
          "application/json": {
            schema: ApiResponse,
          },
        },
      },
    },
  }),
  deploymentReportV1: createRoute({
    method: "post",
    path: "/v0.1/public/codepush/report_status/deploy",
    request: {
      body: {
        content: {
          "application/json": {
            schema: DeploymentReportBody,
          },
        },
      },
    },
    responses: {
      200: {
        description: "",
        content: {
          "application/json": {
            schema: ApiResponse,
          },
        },
      },
    },
  }),

  downloadReport: createRoute({
    method: "post",
    path: "/reportStatus/download",
    request: {
      body: {
        content: {
          "application/json": {
            schema: DownloadReportBody,
          },
        },
      },
    },
    responses: {
      200: {
        description: "",
        content: {
          "application/json": {
            schema: ApiResponse,
          },
        },
      },
    },
  }),
  downloadReportV1: createRoute({
    method: "post",
    path: "/v0.1/public/codepush/report_status/download",
    request: {
      body: {
        content: {
          "application/json": {
            schema: DownloadReportBody,
          },
        },
      },
    },
    responses: {
      200: {
        description: "",
        content: {
          "application/json": {
            schema: ApiResponse,
          },
        },
      },
    },
  }),
};

router.openapi(routes.updateCheck, async (c) => {
  const storage = getStorageProvider(c);
  const query = c.req.valid("query");

  const { deploymentKey, appVersion: receivedAppVersion } = query;
  const sanitizedAppVersion = normalizeVersion(receivedAppVersion);

  const deploymentInfo = await storage.getDeploymentInfo(deploymentKey.trim());
  const history = await storage.getPackageHistory(
    "", // accountId not needed
    deploymentInfo.appId,
    deploymentInfo.deploymentId,
  );

  // Handle empty package history
  if (!history || history.length === 0) {
    return c.json({
      updateInfo: {
        isAvailable: false,
        isMandatory: false,
        appVersion: receivedAppVersion,
        shouldRunBinaryVersion: true,
      },
    } satisfies UpdateCheckResponse);
  }

  // Find appropriate package using original CodePush logic
  let foundRequestPackageInHistory = false;
  let latestSatisfyingEnabledPackage: Package | undefined;
  let latestEnabledPackage: Package | undefined;
  let shouldMakeUpdateMandatory = false;

  // Iterate history backwards to find appropriate package
  for (let i = history.length - 1; i >= 0; i--) {
    const packageEntry = history[i];

    // Check if this package matches what client is running
    foundRequestPackageInHistory =
      foundRequestPackageInHistory ||
      (!query.label && !query.packageHash) || // Take latest if no identifiers
      (query.label && packageEntry.label === query.label) ||
      (!query.label && packageEntry.packageHash === query.packageHash);

    if (packageEntry.isDisabled) {
      continue;
    }

    latestEnabledPackage ||= packageEntry;

    // Check app version compatibility
    if (!query.isCompanion && packageEntry.appVersion) {
      if (!satisfies(sanitizedAppVersion, packageEntry.appVersion)) {
        // Special handling for pre-release versions
        if (sanitizedAppVersion.includes("-")) {
          // For pre-release versions, we should make the update available
          latestSatisfyingEnabledPackage ||= packageEntry;
        }
        continue;
      }
    }

    // If no appVersion specified, treat it as compatible
    latestSatisfyingEnabledPackage ||= packageEntry;

    if (foundRequestPackageInHistory) {
      break;
    }
    if (packageEntry.isMandatory) {
      shouldMakeUpdateMandatory = true;
      break;
    }
  }

  // No packages at all
  if (!latestEnabledPackage) {
    return c.json({
      updateInfo: {
        isAvailable: false,
        isMandatory: false,
        appVersion: receivedAppVersion,
        shouldRunBinaryVersion: true,
      },
    } satisfies UpdateCheckResponse);
  }

  // No compatible package found for app version
  if (!latestSatisfyingEnabledPackage) {
    return c.json({
      updateInfo: {
        isAvailable: false,
        isMandatory: false,
        appVersion: receivedAppVersion,
        shouldRunBinaryVersion: true,
      },
    } satisfies UpdateCheckResponse);
  }

  // Check if client already has latest compatible version
  if (latestSatisfyingEnabledPackage.packageHash === query.packageHash) {
    const response: UpdateCheckResponse = {
      updateInfo: {
        isAvailable: false,
        isMandatory: false,
        appVersion: receivedAppVersion,
        shouldRunBinaryVersion: true,
      },
    };

    // Add app version info if needed
    if (compare(sanitizedAppVersion, latestEnabledPackage.appVersion, ">")) {
      response.updateInfo.appVersion = latestEnabledPackage.appVersion;
    } else if (
      !satisfies(sanitizedAppVersion, latestEnabledPackage.appVersion)
    ) {
      response.updateInfo.updateAppVersion = true;
      response.updateInfo.appVersion = latestEnabledPackage.appVersion;
    }

    return c.json(response);
  }

  // Prepare update response with appropriate package
  let downloadUrl = latestSatisfyingEnabledPackage.blobUrl;
  let packageSize = latestSatisfyingEnabledPackage.size;

  // Use diff package if available
  if (
    query.packageHash &&
    latestSatisfyingEnabledPackage.diffPackageMap?.[query.packageHash]
  ) {
    const diff =
      latestSatisfyingEnabledPackage.diffPackageMap[query.packageHash];
    downloadUrl = diff.url;
    packageSize = diff.size;
  }

  // Handle rollout if specified
  if (
    typeof latestSatisfyingEnabledPackage.rollout === "number" &&
    latestSatisfyingEnabledPackage.rollout < 100
  ) {
    if (!query.clientUniqueId) {
      return c.json({
        updateInfo: {
          isAvailable: false,
          isMandatory: false,
          appVersion: receivedAppVersion,
        },
      } satisfies UpdateCheckResponse);
    }

    const isInRollout = rolloutStrategy(
      query.clientUniqueId,
      latestSatisfyingEnabledPackage.rollout,
      latestSatisfyingEnabledPackage.packageHash,
    );

    if (!isInRollout) {
      return c.json({
        updateInfo: {
          isAvailable: false,
          isMandatory: false,
          appVersion: receivedAppVersion,
        },
      } satisfies UpdateCheckResponse);
    }
  }

  // Return update info
  return c.json({
    updateInfo: {
      isAvailable: true,
      isMandatory:
        shouldMakeUpdateMandatory || latestSatisfyingEnabledPackage.isMandatory,
      appVersion: receivedAppVersion,
      packageHash: latestSatisfyingEnabledPackage.packageHash,
      label: latestSatisfyingEnabledPackage.label,
      packageSize,
      description: latestSatisfyingEnabledPackage.description,
      downloadURL: downloadUrl,
    },
  } satisfies UpdateCheckResponse);
});

router.openapi(routes.updateCheckV1, async (c) => {
  const query = c.req.valid("query");

  try {
    // Transform snake_case query to camelCase for reuse
    const camelCaseQuery = {
      deploymentKey: query.deployment_key,
      appVersion: query.app_version,
      packageHash: query.package_hash,
      label: query.label,
      clientUniqueId: query.client_unique_id,
      isCompanion: query.is_companion,
    } satisfies z.infer<typeof UpdateCheckParams>;

    // Create a new context with transformed query
    const transformedContext = {
      ...c,
      req: { ...c.req, query: camelCaseQuery },
    };

    // Reuse updateCheck logic
    const response = await router.fetch(
      new Request(
        `${c.req.url.split("?")[0].replace("/v0.1/public/codepush/update_check", "/updateCheck")}?${qs.stringify(
          camelCaseQuery,
        )}`,
        { headers: c.req.raw.headers },
      ),
      transformedContext.env,
    );

    const result = UpdateCheckResponseSchema.parse(await response.json());

    // Transform camelCase response to snake_case for legacy endpoint
    const legacyResponse: LegacyUpdateCheckResponse = {
      update_info: {
        is_available: result.updateInfo.isAvailable,
        is_mandatory: result.updateInfo.isMandatory,
        app_version: result.updateInfo.appVersion,
        should_run_binary_version: result.updateInfo.shouldRunBinaryVersion,
        update_app_version: result.updateInfo.updateAppVersion,
        package_hash: result.updateInfo.packageHash,
        label: result.updateInfo.label,
        package_size: result.updateInfo.packageSize,
        description: result.updateInfo.description,
        download_url: result.updateInfo.downloadURL,
      },
    };

    return c.json(legacyResponse);
  } catch (error) {
    if (isStorageError(error)) {
      return c.json({
        update_info: {
          is_available: false,
          is_mandatory: false,
          app_version: query.app_version,
        },
      } satisfies LegacyUpdateCheckResponse);
    }
    throw error;
  }
});
router.openapi(routes.deploymentReport, async (c) => {
  const body = c.req.valid("json");
  const metrics = new MetricsManager(c);

  if (body.status) {
    await metrics.recordDeploymentStatus(
      body.deploymentKey.trim(),
      body.label ?? "",
      body.status,
      body.clientUniqueId,
    );
  } else {
    await metrics.recordDeployment(
      body.deploymentKey.trim(),
      body.label || body.appVersion,
      body.clientUniqueId,
      body.previousDeploymentKey?.trim(),
      body.previousLabelOrAppVersion,
    );
  }

  const response: ApiResponse = { status: "ok" };
  return c.json(response);
});

router.openapi(routes.deploymentReportV1, async (c) => {
  const body = c.req.valid("json");
  const metrics = new MetricsManager(c);

  if (body.status) {
    await metrics.recordDeploymentStatus(
      body.deploymentKey.trim(),
      body.label ?? "",
      body.status,
      body.clientUniqueId,
    );
  } else {
    await metrics.recordDeployment(
      body.deploymentKey.trim(),
      body.label || body.appVersion,
      body.clientUniqueId,
      body.previousDeploymentKey?.trim(),
      body.previousLabelOrAppVersion,
    );
  }

  const response: ApiResponse = { status: "ok" };
  return c.json(convertObjectToSnakeCase(response));
});

router.openapi(routes.downloadReport, async (c) => {
  const body = c.req.valid("json");
  const metrics = new MetricsManager(c);

  await metrics.recordDownload(
    body.deploymentKey.trim(),
    body.label,
    body.clientUniqueId,
  );

  const response: ApiResponse = { status: "ok" };
  return c.json(response);
});

router.openapi(routes.downloadReportV1, async (c) => {
  const body = c.req.valid("json");
  const metrics = new MetricsManager(c);

  await metrics.recordDownload(
    body.deploymentKey.trim(),
    body.label,
    body.clientUniqueId,
  );

  const response: ApiResponse = { status: "ok" };
  return c.json(convertObjectToSnakeCase(response));
});

export { router as acquisitionRouter };
