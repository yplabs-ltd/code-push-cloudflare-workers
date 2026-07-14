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
          <CardDescription>GitHub 또는 Google 계정으로 로그인하세요</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <div className="rounded-md bg-destructive/15 p-3 text-sm text-destructive">
              {error === "registration_disabled"
                ? "가입이 비활성화되어 있습니다."
                : error === "not_org_member"
                  ? "기관(GitHub 조직) 소속 유저만 로그인할 수 있습니다."
                  : error === "google_domain_not_allowed"
                    ? "허용된 도메인의 Google 계정만 로그인할 수 있습니다."
                    : "인증 중 오류가 발생했습니다."}
            </div>
          )}
          <Button
            className="w-full bg-black text-white hover:bg-black/85"
            asChild
          >
            <a href={config.githubOAuthUrl}>
              <Github className="mr-2 h-5 w-5" />
              Continue with GitHub
            </a>
          </Button>
          <Button className="w-full" variant="outline" asChild>
            <a href={config.googleOAuthUrl}>
              <svg className="mr-2 h-5 w-5" viewBox="0 0 24 24" aria-hidden>
                <path
                  fill="#4285F4"
                  d="M23.52 12.27c0-.85-.08-1.67-.22-2.45H12v4.63h6.46a5.52 5.52 0 0 1-2.4 3.62v3h3.88c2.27-2.09 3.58-5.17 3.58-8.8Z"
                />
                <path
                  fill="#34A853"
                  d="M12 24c3.24 0 5.96-1.07 7.94-2.91l-3.88-3c-1.07.72-2.45 1.15-4.06 1.15-3.13 0-5.78-2.11-6.72-4.95H1.27v3.1A12 12 0 0 0 12 24Z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.28 14.29a7.2 7.2 0 0 1 0-4.58v-3.1H1.27a12 12 0 0 0 0 10.78l4.01-3.1Z"
                />
                <path
                  fill="#EA4335"
                  d="M12 4.77c1.76 0 3.34.6 4.59 1.8l3.44-3.44C17.95 1.19 15.24 0 12 0A12 12 0 0 0 1.27 6.61l4.01 3.1C6.22 6.87 8.87 4.77 12 4.77Z"
                />
              </svg>
              Continue with Google
            </a>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};
