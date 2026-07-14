import type { Context, MiddlewareHandler } from "hono";
import { getCookie } from "hono/cookie";
import { HTTPException } from "hono/http-exception";
import { getStorageProvider } from "../storage/factory";
import type { Env } from "../types/env";
import { verify } from "../utils/jwt";

export interface AuthContext {
  accountId: string;
  isAuthenticated: boolean;
}

declare module "hono" {
  interface ContextVariableMap {
    auth: AuthContext;
  }
}

export interface GitHubTokenResponse {
  access_token: string;
  token_type: string;
  scope: string;
  error?: string;
  error_description?: string;
}

export interface GitHubUser {
  id: string;
  email: string;
  name: string;
}

interface GitHubEmail {
  email: string;
  primary: boolean;
  verified: boolean;
  visibility: string | null;
}

export type GitHubProfile = {
  id: string;
  displayName: string;
  username: string;
  profileUrl: string;
  photos: [{ value: string }];
  emails: Array<{ value: string }>;
  _json: {
    login: string;
    id: number;
    node_id: string;
    avatar_url: string;
    url: string;
    html_url: string;
    name: string;
    email: string | null;
    bio: string;
  };
};

// Auth middleware
export const authMiddleware = (): MiddlewareHandler<Env> => {
  return async (c: Context<Env>, next: () => Promise<void>) => {
    // const isWebRequest = c.req.header("

    try {
      const storage = getStorageProvider(c);
      let token: string | undefined;

      // Try cookie first
      const sessionCookie = getCookie(c, "session");
      if (sessionCookie) {
        token = sessionCookie;
      } else {
        // Fall back to Authorization header
        const authHeader = c.req.header("Authorization");
        if (authHeader) {
          const [type, headerToken] = authHeader.split(" ");
          if (type === "Bearer") {
            token = headerToken;
          }
        }
      }

      if (!token) {
        throw new HTTPException(401, { message: "No authentication token" });
      }

      try {
        // Try JWT first
        const payload = await verify(token, c.env.JWT_SECRET);
        c.set("auth", {
          accountId: payload.sub,
          isAuthenticated: true,
        });
      } catch {
        // Try access key if JWT fails
        try {
          const accountId = await storage.getAccountIdFromAccessKey(token);
          c.set("auth", {
            accountId,
            isAuthenticated: true,
          });
        } catch {
          throw new HTTPException(401, { message: "Invalid access token" });
        }
      }

      await next();
    } catch (error) {
      if (error instanceof HTTPException) {
        throw error;
      }
      throw new HTTPException(401, { message: "Authentication failed" });
    }
  };
};

// GitHub OAuth helpers
export async function getGitHubAccessToken(
  code: string,
  env: Env["Bindings"],
): Promise<string> {
  const params = new URLSearchParams({
    client_id: env.GITHUB_CLIENT_ID,
    client_secret: env.GITHUB_CLIENT_SECRET,
    code,
  });

  const response = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params,
  });

  const data = (await response.json()) as GitHubTokenResponse;
  if (data.error) {
    throw new Error(data.error_description || "Failed to get access token");
  }

  return data.access_token;
}

// 지정한 org의 활성 멤버인지 확인. read:org 스코프 토큰 필요.
// 멤버가 아니거나 확인 실패(404/403 등) 시 false → 비멤버로 간주해 로그인 거부.
export async function isGitHubOrgMember(
  accessToken: string,
  org: string,
): Promise<boolean> {
  const response = await fetch(
    `https://api.github.com/user/memberships/orgs/${org}`,
    {
      headers: {
        authorization: `Bearer ${accessToken}`,
        accept: "application/vnd.github.v3+json",
        "user-agent": "code-push-cloudflare-workers/0.0",
      },
    },
  );

  if (!response.ok) {
    return false;
  }

  const membership = (await response.json()) as { state?: string };
  return membership.state === "active";
}

// Google OAuth helpers
export interface GoogleUser {
  id: string;
  email: string;
  name: string;
}

export async function getGoogleAccessToken(
  code: string,
  env: Env["Bindings"],
): Promise<string> {
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      client_id: env.GOOGLE_CLIENT_ID ?? "",
      client_secret: env.GOOGLE_CLIENT_SECRET ?? "",
      redirect_uri: `${env.SERVER_URL}/auth/google/callback`,
    }),
  });

  const data = (await response.json()) as {
    access_token?: string;
    error?: string;
    error_description?: string;
  };
  if (!data.access_token) {
    throw new Error(
      data.error_description || "Failed to get Google access token",
    );
  }

  return data.access_token;
}

// ID token 파싱 대신 userinfo 엔드포인트 사용 — Workers엔 Buffer가 없고,
// 토큰이 Google에서 TLS로 직접 온 것이라 서명 검증이 불필요하다.
export async function getGoogleUser(accessToken: string): Promise<GoogleUser> {
  const response = await fetch(
    "https://openidconnect.googleapis.com/v1/userinfo",
    {
      headers: { authorization: `Bearer ${accessToken}` },
    },
  );

  if (!response.ok) {
    throw new Error("Failed to get Google user data");
  }

  const data = await response.json<{
    sub: string;
    email?: string;
    email_verified?: boolean;
    name?: string;
  }>();

  // 도메인 게이트가 이메일 기반이므로 미검증 이메일은 거부
  if (!data.email || data.email_verified === false) {
    throw new Error("No verified email in Google userinfo");
  }

  return {
    id: data.sub,
    email: data.email,
    name: data.name || data.email.split("@")[0],
  };
}

export async function getGitHubUser(accessToken: string): Promise<GitHubUser> {
  const [userResponse, emailsResponse] = await Promise.all([
    fetch("https://api.github.com/user", {
      headers: {
        authorization: `Bearer ${accessToken}`,
        accept: "application/vnd.github.v3+json",
        "user-agent": "code-push-cloudflare-workers/0.0",
      },
    }),
    fetch("https://api.github.com/user/emails", {
      headers: {
        authorization: `Bearer ${accessToken}`,
        accept: "application/vnd.github.v3+json",
        "user-agent": "code-push-cloudflare-workers/0.0",
      },
    }),
  ]);

  if (!userResponse.ok || !emailsResponse.ok) {
    throw new Error("Failed to get GitHub user data");
  }

  const [userData, emails] = await Promise.all([
    userResponse.json<GitHubProfile["_json"]>(),
    emailsResponse.json<
      {
        email: string;
        primary: boolean;
        verified: boolean;
      }[]
    >(),
  ]);

  // Find primary email
  const primaryEmail = emails.find((email) => email.primary)?.email;
  if (!primaryEmail) {
    throw new Error("No primary email found");
  }

  return {
    id: userData.id.toString(),
    email: primaryEmail,
    name: userData.name || userData.login,
  };
}
