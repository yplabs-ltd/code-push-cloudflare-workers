import { Layout } from "@/components/Layout";
import { AuthProvider } from "@/components/auth/AuthProvider";
import { AppDetailPage } from "@/pages/apps/AppDetailPage";
import { AppsPage } from "@/pages/apps/AppsPage";
import { LoginPage } from "@/pages/auth/LoginPage";
import { DeploymentDetailPage } from "@/pages/deployments/DeploymentDetailPage";
import { HistoryPage } from "@/pages/history/HistoryPage";
import { MembersPage } from "@/pages/members/MembersPage";
import { SettingsPage } from "@/pages/settings/SettingsPage";
import { useAuthStore } from "@/stores/auth";
import {
  Outlet,
  createRootRoute,
  createRoute,
  createRouter,
  redirect,
} from "@tanstack/react-router";

// Auth guard
const authGuard = () => {
  const status = useAuthStore.getState().status;
  if (status === "unauthenticated") {
    throw redirect({
      to: "/login",
      search: {
        redirect_to: window.location.pathname,
      },
    });
  }
};

// Root route
const rootRoute = createRootRoute({
  component: () => (
    <AuthProvider>
      <Outlet />
    </AuthProvider>
  ),
});

// Public routes
const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/login",
  component: LoginPage,
});

// Protected routes parent
const protectedRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: "protected",
  beforeLoad: authGuard,
  component: () => (
    <Layout>
      <Outlet />
    </Layout>
  ),
});

// Protected routes
const indexRoute = createRoute({
  getParentRoute: () => protectedRoute,
  path: "/",
  component: HistoryPage,
});

const appsRoute = createRoute({
  getParentRoute: () => protectedRoute,
  path: "/apps",
  component: AppsPage,
});

const appDetailRoute = createRoute({
  getParentRoute: () => protectedRoute,
  path: "/apps/$appName",
  component: AppDetailPage,
});

const deploymentDetailRoute = createRoute({
  getParentRoute: () => protectedRoute,
  path: "/apps/$appName/deployments/$deploymentName",
  component: DeploymentDetailPage,
});

const membersRoute = createRoute({
  getParentRoute: () => protectedRoute,
  path: "/members",
  component: MembersPage,
});

const settingsRoute = createRoute({
  getParentRoute: () => protectedRoute,
  path: "/settings",
  component: SettingsPage,
});

// Create route tree
const routeTree = rootRoute.addChildren([
  loginRoute,
  protectedRoute.addChildren([
    indexRoute,
    appsRoute,
    appDetailRoute,
    deploymentDetailRoute,
    membersRoute,
    settingsRoute,
  ]),
]);

// Create router
export const router = createRouter({
  routeTree,
  defaultPreload: "intent",
});

// Type declarations
declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
