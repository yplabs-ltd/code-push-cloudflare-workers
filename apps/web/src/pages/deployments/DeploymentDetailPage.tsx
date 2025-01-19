import { ReleaseDialog } from "@/components/deployments/ReleaseDialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { api } from "@/lib/api";
import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "@tanstack/react-router";
import {
  Activity,
  AlertTriangle,
  ChevronRight,
  Download,
  RotateCcw,
  Upload,
  Users,
} from "lucide-react";
import { useState } from "react";

export const DeploymentDetailPage = () => {
  const { appName, deploymentName } = useParams({
    from: "/apps/$appName/deployments/$deploymentName",
  });
  const [isReleaseOpen, setIsReleaseOpen] = useState(false);

  const { data: deploymentData } = useQuery({
    queryKey: ["deployment", appName, deploymentName],
    queryFn: async () => {
      const response =
        await api.managementAppsAppNameDeploymentsDeploymentNameGet(
          appName,
          deploymentName,
        );
      return response.data;
    },
  });

  const { data: metricsData } = useQuery({
    queryKey: ["metrics", appName, deploymentName],
    queryFn: async () => {
      const response =
        await api.managementAppsAppNameDeploymentsDeploymentNameMetricsGet(
          appName,
          deploymentName,
        );
      return response.data;
    },
  });

  const deployment = deploymentData?.deployment;
  const metrics = metricsData?.metrics ?? {};

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Link to="/apps" className="hover:underline">
              Apps
            </Link>
            <ChevronRight className="h-4 w-4" />
            <Link
              to="/apps/$appName"
              params={{ appName }}
              className="hover:underline"
            >
              {appName}
            </Link>
            <ChevronRight className="h-4 w-4" />
            <span>{deploymentName}</span>
          </div>
          <div className="flex items-center gap-2">
            <h1 className="text-3xl font-bold tracking-tight">
              {deploymentName}
            </h1>
            {deployment?.package && (
              <Badge variant="secondary">{deployment.package.label}</Badge>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setIsReleaseOpen(true)}>
            <Upload className="mr-2 h-4 w-4" />
            Release
          </Button>
          <Button variant="outline" disabled={!deployment?.package}>
            <RotateCcw className="mr-2 h-4 w-4" />
            Rollback
          </Button>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Active Users</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {Object.values(metrics).reduce(
                (sum, m) => sum + (m.active ?? 0),
                0,
              )}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Downloads</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {Object.values(metrics).reduce(
                (sum, m) => sum + (m.downloads ?? 0),
                0,
              )}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Installations</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {Object.values(metrics).reduce(
                (sum, m) => sum + (m.installed ?? 0),
                0,
              )}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">
              Failed Updates
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {Object.values(metrics).reduce(
                (sum, m) => sum + (m.failed ?? 0),
                0,
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {deployment?.package && (
        <Card>
          <CardHeader>
            <CardTitle>Current Release</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-4">
                <div>
                  <div className="text-sm font-medium text-muted-foreground">
                    Version
                  </div>
                  <div className="flex items-center gap-2">
                    <Activity className="h-4 w-4" />
                    {deployment.package.appVersion}
                  </div>
                </div>
                <div>
                  <div className="text-sm font-medium text-muted-foreground">
                    Release Method
                  </div>
                  <div className="flex items-center gap-2">
                    <Upload className="h-4 w-4" />
                    {deployment.package.releaseMethod}
                  </div>
                </div>
                <div>
                  <div className="text-sm font-medium text-muted-foreground">
                    Size
                  </div>
                  <div className="flex items-center gap-2">
                    <Download className="h-4 w-4" />
                    {(deployment.package.size / 1024).toFixed(2)} KB
                  </div>
                </div>
                <div>
                  <div className="text-sm font-medium text-muted-foreground">
                    Status
                  </div>
                  <div className="flex items-center gap-2">
                    {deployment.package.isDisabled ? (
                      <Badge variant="destructive">Disabled</Badge>
                    ) : (
                      <Badge variant="default">Active</Badge>
                    )}
                  </div>
                </div>
              </div>

              {deployment.package.description && (
                <div>
                  <div className="text-sm font-medium text-muted-foreground">
                    Release Notes
                  </div>
                  <p className="mt-1 text-sm">
                    {deployment.package.description}
                  </p>
                </div>
              )}

              {typeof deployment.package.rollout === "number" &&
                deployment.package.rollout < 100 && (
                  <div className="rounded-md bg-yellow-50 p-4">
                    <div className="flex items-center">
                      <AlertTriangle className="h-5 w-5 text-yellow-400" />
                      <div className="ml-3">
                        <h3 className="text-sm font-medium text-yellow-800">
                          Partial Rollout
                        </h3>
                        <div className="mt-2 text-sm text-yellow-700">
                          This release is currently rolled out to{" "}
                          {deployment.package.rollout}% of users.
                        </div>
                      </div>
                    </div>
                  </div>
                )}
            </div>
          </CardContent>
        </Card>
      )}

      <ReleaseDialog
        appName={appName}
        deploymentName={deploymentName}
        open={isReleaseOpen}
        onOpenChange={setIsReleaseOpen}
      />
    </div>
  );
};
