import type { Context } from "hono";
import qs from "qs";
import type { z } from "zod";
import { handlers } from "../handlers";
import type { Env } from "../types/env";
import { isStorageError } from "../types/error";
import type {
  LegacyUpdateCheckParams,
  LegacyUpdateCheckResponse,
  UpdateCheckParams,
} from "../types/schemas";

const updateCheckV1Handler = async (c: Context<Env>) => {
  const query = c.req.query() as unknown as LegacyUpdateCheckParams;

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

    // Create a modified context with transformed query
    const modifiedContext = {
      ...c,
      req: {
        ...c.req,
        query: () => camelCaseQuery,
      },
    } as unknown as Context<Env>;

    // Call the standard updateCheck handler with the modified context
    const result = await handlers.updateCheckHandler(modifiedContext);

    // Transform camelCase response to snake_case for legacy endpoint
    const legacyResponse: LegacyUpdateCheckResponse = {
      update_info: {
        is_available: result.updateInfo.isAvailable,
        is_mandatory: result.updateInfo.isMandatory,
        app_version: result.updateInfo.appVersion,
        should_run_binary_version:
          result.updateInfo.shouldRunBinaryVersion ?? false,
        update_app_version: result.updateInfo.updateAppVersion ?? false,
        package_hash: result.updateInfo.packageHash,
        label: result.updateInfo.label,
        package_size: result.updateInfo.packageSize,
        description: result.updateInfo.description,
        download_url: result.updateInfo.downloadURL,
        target_binary_range: result.updateInfo.appVersion,
      },
    };

    return legacyResponse;
  } catch (error) {
    if (isStorageError(error)) {
      return {
        update_info: {
          is_available: false,
          is_mandatory: false,
          app_version: query.app_version,
          target_binary_range: query.app_version,
          should_run_binary_version: false,
          update_app_version: false,
        },
      } satisfies LegacyUpdateCheckResponse;
    }
    throw error;
  }
};

export { updateCheckV1Handler };
