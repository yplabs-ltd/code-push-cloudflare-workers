import { OpenAPIHono, createRoute } from "@hono/zod-openapi";
import { setCookie } from "hono/cookie";
import { z } from "zod";
import {
  getGitHubAccessToken,
  getGitHubUser,
  getGoogleAccessToken,
  getGoogleUser,
  isGitHubOrgMember,
} from "../middleware/auth";
import { getStorageProvider } from "../storage/factory";
import type { Env } from "../types/env";
import { sign } from "../utils/jwt";
import { generateKey } from "../utils/security";

const router = new OpenAPIHono<Env>();

const LoginErrorResponse = z.object({
  error: z.string(),
  error_description: z.string().optional(),
});

const routes = {
  login: createRoute({
    method: "get",
    path: "/login",
    responses: {
      302: {
        description: "Redirect to GitHub OAuth",
      },
    },
  }),

  callback: createRoute({
    method: "get",
    path: "/github/callback",
    request: {
      query: z.object({
        code: z.string(),
        state: z.string().optional(),
      }),
    },
    responses: {
      302: {
        description: "Redirect to dashboard with session",
      },
      400: {
        content: {
          "application/json": {
            schema: LoginErrorResponse,
          },
        },
        description: "Login error",
      },
    },
  }),

  googleLogin: createRoute({
    method: "get",
    path: "/google/login",
    responses: {
      302: {
        description: "Redirect to Google OAuth",
      },
    },
  }),

  googleCallback: createRoute({
    method: "get",
    path: "/google/callback",
    request: {
      query: z.object({
        code: z.string(),
        state: z.string().optional(),
      }),
    },
    responses: {
      302: {
        description: "Redirect to dashboard with session",
      },
      400: {
        content: {
          "application/json": {
            schema: LoginErrorResponse,
          },
        },
        description: "Login error",
      },
    },
  }),

  logout: createRoute({
    method: "get",
    path: "/logout",
    responses: {
      302: {
        description: "Redirect to login page",
      },
    },
  }),
};

// OAuth login
router.openapi(routes.login, async (c) => {
  // 웹 로그인은 ?client=web[&redirect_to=]을 state로 전달 → 콜백이 리다이렉트로 응답.
  // 미지정(=CLI)이면 콜백은 기존 JSON 토큰을 반환한다.
  const state = JSON.stringify({
    client: c.req.query("client") ?? "cli",
    redirectTo: c.req.query("redirect_to") ?? "/",
  });
  const params = new URLSearchParams({
    client_id: c.env.GITHUB_CLIENT_ID,
    redirect_uri: `${c.env.SERVER_URL}/auth/github/callback`,
    // read:org — 콜백에서 org 멤버십 확인에 필요
    scope: "user:email read:org",
    state,
  });

  return c.redirect(
    `https://github.com/login/oauth/authorize?${params.toString()}`,
  );
});

// OAuth callback
router.openapi(routes.callback, async (c) => {
  try {
    const { code, state } = c.req.valid("query");
    if (!code) {
      return c.json(
        {
          error: "invalid_request",
          error_description: "No code provided",
        },
        400,
      );
    }

    // state에서 client/redirectTo를 미리 파싱 → 에러 리다이렉트도 웹 오리진으로 되돌린다.
    let client = "cli";
    let redirectTo = "/";
    try {
      const parsed = JSON.parse(state ?? "{}");
      client = parsed.client ?? "cli";
      redirectTo = parsed.redirectTo ?? "/";
    } catch {}
    // 웹은 절대 URL(웹 오리진 기준), CLI는 상대경로로 로그인 에러 페이지 리다이렉트.
    // (상대 "/login"이면 서버 도메인에 갇히므로 웹은 redirectTo 기준 절대 URL로.)
    const loginErrorRedirect = (errorCode: string) =>
      client === "web"
        ? c.redirect(
            new URL(`/login?error=${errorCode}`, redirectTo).toString(),
          )
        : c.redirect(`/login?error=${errorCode}`);

    // Exchange code for access token
    const accessToken = await getGitHubAccessToken(code, c.env);
    const githubUser = await getGitHubUser(accessToken);

    // 기관(org) 멤버십 검사 — 비멤버는 로그인/가입 모두 거부
    const isOrgMember = await isGitHubOrgMember(accessToken, c.env.GITHUB_ORG);
    if (!isOrgMember) {
      return loginErrorRedirect("not_org_member");
    }

    const storage = getStorageProvider(c);

    // Find or create account
    let accountId: string;
    try {
      const account = await storage.getAccountByEmail(githubUser.email);

      // Update GitHub ID if not set
      if (!account.gitHubId) {
        await storage.updateAccount(account.email, {
          ...account,
          gitHubId: githubUser.id,
        });
      }

      accountId = account.id;
    } catch {
      // Create new account if registration is enabled
      if (c.env.ENABLE_ACCOUNT_REGISTRATION !== "true") {
        return loginErrorRedirect("registration_disabled");
      }

      accountId = await storage.addAccount({
        email: githubUser.email,
        name: githubUser.name,
        gitHubId: githubUser.id,
        createdTime: Date.now(),
        linkedProviders: ["GitHub"],
      });
    }

    // Create access key for session
    const accessKeyName = generateKey();
    await storage.addAccessKey(accountId, {
      name: accessKeyName,
      friendlyName: "GitHub OAuth Session",
      createdBy: c.req.header("User-Agent") ?? "Unknown",
      createdTime: Date.now(),
      expires: Date.now() + 60 * 24 * 60 * 60 * 1000, // 60 days
      isSession: true,
    });
    // Create JWT token
    const token = await sign(
      {
        sub: accountId,
        email: githubUser.email,
      },
      c.env.JWT_SECRET,
    );

    // Set session cookie
    setCookie(c, "session", token, {
      httpOnly: true,
      secure: true,
      sameSite: "Lax",
      path: "/",
      domain: c.env.COOKIE_DOMAIN || undefined,
      maxAge: 60 * 60 * 24, // 1 day
    });

    // Handle post-login redirect
    const error = c.req.query("error");
    if (error) {
      return loginErrorRedirect(error);
    }

    // 웹: 세션 쿠키로 대시보드 리다이렉트 / CLI: 기존 JSON 토큰 유지
    if (client === "web") {
      return c.redirect(redirectTo);
    }
    return c.json({
      accessKeyName,
      token,
    });
  } catch (error) {
    console.error("Auth error:", error);

    return c.json(
      {
        error: "auth_failed",
        error_description: "Authentication failed",
      },
      400,
    );
  }
});

// Google OAuth login
router.openapi(routes.googleLogin, async (c) => {
  if (!c.env.GOOGLE_CLIENT_ID) {
    return c.json(
      {
        error: "google_not_configured",
        error_description: "Google OAuth is not configured",
      },
      400,
    );
  }

  const state = JSON.stringify({
    client: c.req.query("client") ?? "cli",
    redirectTo: c.req.query("redirect_to") ?? "/",
  });
  const params = new URLSearchParams({
    client_id: c.env.GOOGLE_CLIENT_ID,
    redirect_uri: `${c.env.SERVER_URL}/auth/google/callback`,
    response_type: "code",
    scope: "openid email profile",
    state,
  });

  return c.redirect(
    `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`,
  );
});

// Google OAuth callback
router.openapi(routes.googleCallback, async (c) => {
  try {
    const { code, state } = c.req.valid("query");
    if (!code) {
      return c.json(
        {
          error: "invalid_request",
          error_description: "No code provided",
        },
        400,
      );
    }

    let client = "cli";
    let redirectTo = "/";
    try {
      const parsed = JSON.parse(state ?? "{}");
      client = parsed.client ?? "cli";
      redirectTo = parsed.redirectTo ?? "/";
    } catch {}
    const loginErrorRedirect = (errorCode: string) =>
      client === "web"
        ? c.redirect(
            new URL(`/login?error=${errorCode}`, redirectTo).toString(),
          )
        : c.redirect(`/login?error=${errorCode}`);

    const accessToken = await getGoogleAccessToken(code, c.env);
    const googleUser = await getGoogleUser(accessToken);

    // 허용 도메인 게이트 — GOOGLE_ALLOWED_DOMAIN(콤마 구분) 미설정 시 전부 거부
    const emailDomain = googleUser.email.split("@")[1]?.toLowerCase() ?? "";
    const allowedDomains = (c.env.GOOGLE_ALLOWED_DOMAIN ?? "")
      .split(",")
      .map((domain) => domain.trim().toLowerCase())
      .filter(Boolean);
    if (!allowedDomains.includes(emailDomain)) {
      return loginErrorRedirect("google_domain_not_allowed");
    }

    const storage = getStorageProvider(c);

    // Find or create account
    let accountId: string;
    try {
      const account = await storage.getAccountByEmail(googleUser.email);

      // Update Google ID if not set
      if (!account.googleId) {
        await storage.updateAccount(account.email, {
          ...account,
          googleId: googleUser.id,
        });
      }

      accountId = account.id;
    } catch {
      // Create new account if registration is enabled
      if (c.env.ENABLE_ACCOUNT_REGISTRATION !== "true") {
        return loginErrorRedirect("registration_disabled");
      }

      accountId = await storage.addAccount({
        email: googleUser.email,
        name: googleUser.name,
        googleId: googleUser.id,
        createdTime: Date.now(),
        linkedProviders: ["Google"],
      });
    }

    // Create access key for session
    const accessKeyName = generateKey();
    await storage.addAccessKey(accountId, {
      name: accessKeyName,
      friendlyName: "Google OAuth Session",
      createdBy: c.req.header("User-Agent") ?? "Unknown",
      createdTime: Date.now(),
      expires: Date.now() + 60 * 24 * 60 * 60 * 1000, // 60 days
      isSession: true,
    });
    // Create JWT token
    const token = await sign(
      {
        sub: accountId,
        email: googleUser.email,
      },
      c.env.JWT_SECRET,
    );

    // Set session cookie
    setCookie(c, "session", token, {
      httpOnly: true,
      secure: true,
      sameSite: "Lax",
      path: "/",
      domain: c.env.COOKIE_DOMAIN || undefined,
      maxAge: 60 * 60 * 24, // 1 day
    });

    // 웹: 세션 쿠키로 대시보드 리다이렉트 / CLI: 기존 JSON 토큰 유지
    if (client === "web") {
      return c.redirect(redirectTo);
    }
    return c.json({
      accessKeyName,
      token,
    });
  } catch (error) {
    console.error("Auth error:", error);

    return c.json(
      {
        error: "auth_failed",
        error_description: "Authentication failed",
      },
      400,
    );
  }
});

// Logout
router.openapi(routes.logout, async (c) => {
  // Clear session cookie
  setCookie(c, "session", "", {
    httpOnly: true,
    secure: true,
    sameSite: "Lax",
    path: "/",
    domain: c.env.COOKIE_DOMAIN || undefined,
    maxAge: 0,
  });

  const redirectTo = c.req.query("redirect_to") || "/login";
  return c.redirect(redirectTo);
});

export { router as authRouter };
