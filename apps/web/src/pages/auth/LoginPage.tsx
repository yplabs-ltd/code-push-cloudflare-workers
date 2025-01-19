import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { config } from "@/lib/config";
import { useAuthStore } from "@/stores/auth";
import { useNavigate } from "@tanstack/react-router";
import { Github } from "lucide-react";
import { useEffect } from "react";

export const LoginPage = () => {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuthStore();

  useEffect(() => {
    if (isAuthenticated) {
      navigate({ to: "/" });
    }
  }, [isAuthenticated, navigate]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/50 px-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold tracking-tight">
            Welcome to CodePush
          </CardTitle>
          <CardDescription>Sign in to your account to continue</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* {error && (
            <div className="rounded-md bg-destructive/15 p-3 text-sm text-destructive">
              {error === "registration_disabled"
                ? "Registration is currently disabled"
                : "An error occurred during authentication"}
            </div>
          )} */}
          <Button className="w-full" variant="outline" asChild>
            <a href={config.githubOAuthUrl}>
              <Github className="mr-2 h-5 w-5" />
              Continue with GitHub
            </a>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};
