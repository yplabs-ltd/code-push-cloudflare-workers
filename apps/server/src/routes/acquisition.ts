import { OpenAPIHono, createRoute } from "@hono/zod-openapi";
import type { Env } from "../types/env";
import {
  ApiResponse,
  DeploymentReportBody,
  DownloadReportBody,
  LegacyUpdateCheckParams,
  LegacyUpdateCheckResponseSchema,
  type Package,
  UpdateCheckParams,
  UpdateCheckResponseSchema,
} from "../types/schemas";
import { convertObjectToSnakeCase } from "../utils/convention";
import { MetricsManager } from "../utils/metrics";
import { handlers } from "../handlers";

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
  const result = await handlers.updateCheckHandler(c);
  return c.json(result);
});

router.openapi(routes.updateCheckV1, async (c) => {
  const result = await handlers.updateCheckV1Handler(c);
  return c.json(result);
});
router.openapi(routes.deploymentReport, async (c) => {
  const body = c.req.valid("json");
  const metrics = new MetricsManager(c);

  if (body.status) {
    await metrics.recordDeploymentStatus(
      body.deploymentKey.trim(),
      body.label ?? "",
      body.status,
      body.clientUniqueId
    );
  } else {
    await metrics.recordDeployment(
      body.deploymentKey.trim(),
      body.label || body.appVersion,
      body.clientUniqueId,
      body.previousDeploymentKey?.trim(),
      body.previousLabelOrAppVersion
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
      body.clientUniqueId
    );
  } else {
    await metrics.recordDeployment(
      body.deploymentKey.trim(),
      body.label || body.appVersion,
      body.clientUniqueId,
      body.previousDeploymentKey?.trim(),
      body.previousLabelOrAppVersion
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
    body.clientUniqueId
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
    body.clientUniqueId
  );

  const response: ApiResponse = { status: "ok" };
  return c.json(convertObjectToSnakeCase(response));
});

export { router as acquisitionRouter };
