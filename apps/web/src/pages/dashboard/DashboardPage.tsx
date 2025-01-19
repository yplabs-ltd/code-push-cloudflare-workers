import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { api } from "@/lib/api";
import type { ManagementAppsGet200Response } from "@code-push-cloudflare-workers/api-client";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Plus } from "lucide-react";

export const DashboardPage = () => {
  const { data } = useQuery<ManagementAppsGet200Response>({
    queryKey: ["apps"],
    queryFn: async () => {
      const response = await api.managementAppsGet();
      return response.data;
    },
  });

  const apps = data?.apps ?? [];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between pb-4 border-b">
        <h1 className="text-2xl font-bold">Apps</h1>
        <Button>
          <Plus className="w-5 h-5 mr-2" />
          Create App
        </Button>
      </div>

      {apps.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <p className="text-center text-muted-foreground">
              No apps found. Create your first app to get started.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {apps.map((app) => (
            <Card key={app.id}>
              <CardHeader>
                <Link
                  to="/apps/$appName"
                  params={{ appName: app.name }}
                  className="hover:underline"
                >
                  <CardTitle>{app.name}</CardTitle>
                </Link>
                <p className="text-sm text-muted-foreground">
                  {app.deployments.length} deployments
                </p>
              </CardHeader>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};
