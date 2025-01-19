import { CreateDeploymentDialog } from "@/components/deployments/CreateDeploymentDialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { api } from "@/lib/api";
import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "@tanstack/react-router";
import {
  Activity,
  Check,
  ChevronRight,
  Clock,
  Copy,
  Package,
  Plus,
  Settings,
  Users2
} from "lucide-react";
import { useState } from "react";

export const AppDetailPage = () => {
  const { appName } = useParams({ from: "/apps/$appName" });
  const [activeTab, setActiveTab] = useState("deployments");
  const [isCreateDeploymentOpen, setIsCreateDeploymentOpen] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const { data: appData } = useQuery({
    queryKey: ["app", appName],
    queryFn: async () => {
      const response = await api.managementAppsAppNameGet(appName);
      return response.data;
    },
  });

  const { data: deploymentData } = useQuery({
    queryKey: ["deployments", appName],
    queryFn: async () => {
      const response = await api.managementAppsAppNameDeploymentsGet(appName);
      return response.data;
    },
  });

  const app = appData?.app;
  const deployments = deploymentData?.deployments ?? [];

  const handleCopyKey = async (key: string) => {
    await navigator.clipboard.writeText(key);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Link to="/apps" className="hover:underline">
              Apps
            </Link>
            <ChevronRight className="h-4 w-4" />
            <span>{appName}</span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight">{appName}</h1>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link to="/apps/$appName/settings" params={{ appName }}>
              <Settings className="mr-2 h-4 w-4" />
              Settings
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link to="/apps/$appName/collaborators" params={{ appName }}>
              <Users2 className="mr-2 h-4 w-4" />
              Collaborators
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">
              Total Deployments
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{deployments.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">
              Latest Release
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {deployments[0]?.package?.label ?? "No releases"}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">
              Active Users
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">-</div>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <div className="flex items-center justify-between">
          <TabsList>
            <TabsTrigger value="deployments">Deployments</TabsTrigger>
            <TabsTrigger value="releases">Release History</TabsTrigger>
          </TabsList>
          <Button onClick={() => setIsCreateDeploymentOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Create Deployment
          </Button>
        </div>

        <TabsContent value="deployments" className="mt-4">
          <div className="rounded-lg border">
            {deployments.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-8">
                <Package className="h-8 w-8 text-muted-foreground" />
                <h3 className="mt-4 font-semibold">No deployments</h3>
                <p className="text-sm text-muted-foreground">
                  Create your first deployment to get started
                </p>
              </div>
            ) : (
              <div className="divide-y">
                {deployments.map((deployment) => (
                  <div
                    key={deployment.id}
                    className="flex items-center justify-between p-4"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <Link
                          to="/apps/$appName/deployments/$deploymentName"
                          params={{
                            appName,
                            deploymentName: deployment.name,
                          }}
                          className="font-medium hover:underline"
                        >
                          {deployment.name}
                        </Link>
                        {deployment.package && (
                          <Badge variant="secondary">
                            {deployment.package.label}
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Clock className="h-4 w-4" />
                        {new Date(deployment.createdTime).toLocaleDateString()}
                        <Activity className="h-4 w-4 ml-2" />
                        {deployment.package?.appVersion ?? "No releases"}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleCopyKey(deployment.key!)}
                      >
                        {copiedKey === deployment.key ? (
                          <Check className="mr-2 h-4 w-4" />
                        ) : (
                          <Copy className="mr-2 h-4 w-4" />
                        )}
                        {copiedKey === deployment.key ? "Copied!" : "Copy Key"}
                      </Button>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="outline" size="sm">
                            Promote To
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent>
                          {deployments
                            .filter((d) => d.id !== deployment.id)
                            .map((d) => (
                              <DropdownMenuItem key={d.id}>
                                {d.name}
                              </DropdownMenuItem>
                            ))}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="releases" className="mt-4">
          <div className="rounded-lg border">
            {deployments.map((deployment) => (
              deployment.package && (
                <div key={deployment.id} className="p-4">
                  <h3 className="font-semibold">{deployment.name}</h3>
                  <div className="mt-2 space-y-2">
                    <div className="text-sm">
                      Version: {deployment.package.appVersion}
                    </div>
                    <div className="text-sm">
                      Label: {deployment.package.label}
                    </div>
                    {deployment.package.description && (
                      <div className="text-sm">
                        Description: {deployment.package.description}
                      </div>
                    )}
                  </div>
                  <Separator className="my-4" />
                </div>
              )
            ))}
          </div>
        </TabsContent>
      </Tabs>

      <CreateDeploymentDialog
        appName={appName}
        open={isCreateDeploymentOpen}
        onOpenChange={setIsCreateDeploymentOpen}
      />
    </div>
  );
};
