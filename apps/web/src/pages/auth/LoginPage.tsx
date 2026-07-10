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
  const { status } = useAuthStore();
  const error = new URLSearchParams(window.location.search).get("error");

  useEffect(() => {
    if (status === "authenticated") {
      navigate({ to: "/" });
    }
  }, [status, navigate]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/50 px-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold tracking-tight">
            CodePush 로그인
          </CardTitle>
          <CardDescription>GitHub 계정으로 로그인하세요</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <div className="rounded-md bg-destructive/15 p-3 text-sm text-destructive">
              {error === "registration_disabled"
                ? "가입이 비활성화되어 있습니다."
                : "인증 중 오류가 발생했습니다."}
            </div>
          )}
          <Button className="w-full" asChild>
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
