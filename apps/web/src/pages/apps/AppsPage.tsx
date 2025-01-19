import { CreateAppDialog } from "@/components/apps/CreateAppDialog";
import { DeleteAppDialog } from "@/components/apps/DeleteAppDialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { api } from "@/lib/api";
import type { ManagementAppsGet200Response } from "@code-push-cloudflare-workers/api-client";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import {
  Link as LinkIcon,
  MoreVertical,
  Package,
  Plus,
  Trash2,
  Users2,
} from "lucide-react";
import { useState } from "react";

export const AppsPage = () => {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [deleteApp, setDeleteApp] = useState<{
    name: string;
    id: string;
  } | null>(null);

  const { data, isLoading } = useQuery<ManagementAppsGet200Response>({
    queryKey: ["apps"],
    queryFn: async () => {
      const response = await api.managementAppsGet();
      return response.data;
    },
  });

  const apps = data?.apps ?? [];

  return (
    <>
      <div className="flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Apps</h1>
            <p className="text-muted-foreground">
              Create and manage your CodePush applications
            </p>
          </div>
          <Button onClick={() => setIsCreateOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Create App
          </Button>
        </div>

        {isLoading ? (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {[...Array(3)].map((_, i) => (
              <Card key={i} className="animate-pulse">
                <CardHeader className="h-24 bg-muted" />
              </Card>
            ))}
          </div>
        ) : apps.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center gap-4 py-12">
              <div className="rounded-full bg-muted p-4">
                <Package className="h-8 w-8 text-muted-foreground" />
              </div>
              <div className="text-center">
                <h2 className="text-lg font-semibold">No apps found</h2>
                <p className="text-sm text-muted-foreground">
                  Create your first app to get started with CodePush
                </p>
              </div>
              <Button onClick={() => setIsCreateOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Create App
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {apps.map((app) => (
              <Card key={app.id}>
                <CardHeader className="flex flex-row items-start justify-between">
                  <div className="space-y-1.5">
                    <CardTitle>
                      <Link
                        to="/apps/$appName"
                        params={{ appName: app.name }}
                        className="hover:underline"
                      >
                        {app.name}
                      </Link>
                    </CardTitle>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary">
                        {app.deployments.length} deployments
                      </Badge>
                      {Object.keys(app.collaborators ?? {}).length > 0 && (
                        <Badge variant="secondary">
                          {Object.keys(app.collaborators ?? {}).length}{" "}
                          collaborators
                        </Badge>
                      )}
                    </div>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="-m-2">
                        <MoreVertical className="h-4 w-4" />
                        <span className="sr-only">Open menu</span>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem asChild>
                        <Link
                          to="/apps/$appName"
                          params={{ appName: app.name }}
                          className="cursor-pointer"
                        >
                          <Package className="mr-2 h-4 w-4" />
                          View App
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild>
                        <Link
                          href="/apps/$appName/collaborators"
                          params={{ appName: app.name }}
                          className="cursor-pointer"
                        >
                          <Users2 className="mr-2 h-4 w-4" />
                          Manage Collaborators
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => {
                          // Copy deployment key to clipboard
                          navigator.clipboard.writeText(
                            app.deployments[0]?.key ?? "",
                          );
                        }}
                      >
                        <LinkIcon className="mr-2 h-4 w-4" />
                        Copy Deployment Key
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        className="text-destructive"
                        onClick={() =>
                          setDeleteApp({ id: app.id, name: app.name })
                        }
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete App
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground">
                  Created {new Date(app.createdTime).toLocaleDateString()}
                </CardContent>
                <CardFooter>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    asChild
                  >
                    <Link to="/apps/$appName" params={{ appName: app.name }}>
                      View Details
                    </Link>
                  </Button>
                </CardFooter>
              </Card>
            ))}
          </div>
        )}
      </div>

      <CreateAppDialog open={isCreateOpen} onOpenChange={setIsCreateOpen} />

      {deleteApp && (
        <DeleteAppDialog
          app={deleteApp}
          open={true}
          onOpenChange={() => setDeleteApp(null)}
        />
      )}
    </>
  );
};
