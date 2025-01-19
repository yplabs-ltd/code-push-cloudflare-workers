import { Layout } from "@/components/Layout";
import { AuthProvider } from "@/components/auth/AuthProvider";
import { AppDetailPage } from "@/pages/apps/AppDetailPage";
import { AppsPage } from "@/pages/apps/AppsPage";
import { LoginPage } from "@/pages/auth/LoginPage";
import { DashboardPage } from "@/pages/dashboard/DashboardPage";
import { DeploymentDetailPage } from "@/pages/deployments/DeploymentDetailPage";
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
  const isAuthenticated = useAuthStore.getState().isAuthenticated;
  if (!isAuthenticated) {
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
  component: ({ children }) => <Layout>{children}</Layout>,
});

// Protected routes
const indexRoute = createRoute({
  getParentRoute: () => protectedRoute,
  path: "/",
  component: DashboardPage,
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
