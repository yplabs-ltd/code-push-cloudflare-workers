import type { Context } from "hono";

import { compare, satisfies } from "compare-versions";

import { getStorageProvider } from "../storage/factory";

import type {
  Package,
  UpdateCheckParams,
  UpdateCheckResponse,
} from "../types/schemas";

import type { Env } from "../types/env";
import { rolloutStrategy } from "../utils/rollout";
import { normalizeVersion } from "../utils/version";

// Return data object instead of response
const updateCheckHandler = async (
  c: Context<Env>,
): Promise<UpdateCheckResponse> => {
  const storage = getStorageProvider(c);
  const query = c.req.query() as unknown as UpdateCheckParams;

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
    return {
      updateInfo: {
        isAvailable: false,
        isMandatory: false,
        appVersion: receivedAppVersion,
        shouldRunBinaryVersion: true,
      },
    } satisfies UpdateCheckResponse;
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
    return {
      updateInfo: {
        isAvailable: false,
        isMandatory: false,
        appVersion: receivedAppVersion,
        shouldRunBinaryVersion: true,
      },
    } satisfies UpdateCheckResponse;
  }

  // No compatible package found for app version
  if (!latestSatisfyingEnabledPackage) {
    return {
      updateInfo: {
        isAvailable: false,
        isMandatory: false,
        appVersion: receivedAppVersion,
        shouldRunBinaryVersion: true,
      },
    } satisfies UpdateCheckResponse;
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

    return response;
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
      return {
        updateInfo: {
          isAvailable: false,
          isMandatory: false,
          appVersion: receivedAppVersion,
        },
      } satisfies UpdateCheckResponse;
    }

    const isInRollout = rolloutStrategy(
      query.clientUniqueId,
      latestSatisfyingEnabledPackage.rollout,
      latestSatisfyingEnabledPackage.packageHash,
    );

    if (!isInRollout) {
      return {
        updateInfo: {
          isAvailable: false,
          isMandatory: false,
          appVersion: receivedAppVersion,
        },
      } satisfies UpdateCheckResponse;
    }
  }

  // Return update info
  return {
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
  } satisfies UpdateCheckResponse;
};

export { updateCheckHandler };
