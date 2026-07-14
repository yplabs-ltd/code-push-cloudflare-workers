import { SELF, env, fetchMock } from "cloudflare:test";
import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from "vitest";
import { type TestAuth, createTestAuth } from "../utils/auth";
import { cleanupDatabase } from "../utils/db";

describe("Auth Routes", () => {
  let auth: TestAuth;

  beforeAll(() => {
    // 워커의 아웃바운드 fetch(GitHub API)를 가로챈다.
    fetchMock.activate();
    fetchMock.disableNetConnect();
  });

  beforeEach(async () => {
    auth = createTestAuth(env.DB, env.JWT_SECRET);

    await cleanupDatabase();
  });

  afterEach(async () => {
    await auth.cleanup();
  });

  describe("GET /auth/login", () => {
    it("should redirect to GitHub OAuth", async () => {
      const response = await SELF.fetch("https://example.com/auth/login", {
        redirect: "manual",
      });

      expect(response.status).toBe(302);
      expect(response.headers.get("Location")).toMatch(
        /^https:\/\/github.com\/login\/oauth\/authorize/
      );
    });
  });

  describe("GET /auth/github/callback", () => {
    it("should handle invalid code", async () => {
      const response = await SELF.fetch(
        "https://example.com/auth/github/callback?code=invalid",
      );

      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({
        error: "auth_failed",
        error_description: "Authentication failed",
      });
    });
  });

  describe("GET /auth/logout", () => {
    it("should clear session", async () => {
      const response = await SELF.fetch("https://example.com/auth/logout", {
        redirect: "manual",
      });

      expect(response.status).toBe(302);
      expect(response.headers.get("Location")).toBe("/login");
      expect(response.headers.get("Set-Cookie")).toMatch(
        /^session=;.*Max-Age=0/,
      );
    });

    it("should redirect to specified location", async () => {
      const response = await SELF.fetch(
        "http://example.com/auth/logout?redirect_to=/custom",
        {
          redirect: "manual",
        },
      );

      expect(response.status).toBe(302);
      expect(response.headers.get("Location")).toBe("/custom");
    });
  });

  describe("GET /auth/github/callback - org 멤버십 검사", () => {
    const webState = encodeURIComponent(
      JSON.stringify({ client: "web", redirectTo: "http://localhost:5173/" }),
    );

    // GitHub OAuth 왕복(토큰 교환 → 유저/이메일 → org 멤버십)을 목킹한다.
    // 멤버십 응답만 케이스별로 바꿔 콜백 게이트 동작을 검증한다.
    const mockGitHubFlow = (membership: {
      status: number;
      body: object;
    }) => {
      const github = fetchMock.get("https://github.com");
      github
        .intercept({ path: "/login/oauth/access_token", method: "POST" })
        .reply(200, { access_token: "gho_test", token_type: "bearer" });

      const api = fetchMock.get("https://api.github.com");
      api
        .intercept({ path: "/user", method: "GET" })
        .reply(200, { id: 4242, login: "tester", name: "Tester", email: null });
      api
        .intercept({ path: "/user/emails", method: "GET" })
        .reply(200, [
          { email: "tester@example.com", primary: true, verified: true },
        ]);
      api
        .intercept({ path: "/user/memberships/orgs/test-org", method: "GET" })
        .reply(membership.status, membership.body);
    };

    afterEach(() => {
      fetchMock.assertNoPendingInterceptors();
    });

    it("org 멤버(state:active)면 로그인 통과 후 웹 오리진으로 리다이렉트", async () => {
      mockGitHubFlow({ status: 200, body: { state: "active" } });

      const response = await SELF.fetch(
        `https://example.com/auth/github/callback?code=testcode&state=${webState}`,
        { redirect: "manual" },
      );

      expect(response.status).toBe(302);
      expect(response.headers.get("Location")).toBe("http://localhost:5173/");
      expect(response.headers.get("Set-Cookie")).toMatch(/^session=/);
    });

    it("org 비멤버(404)면 not_org_member로 거부(세션 미발급)", async () => {
      mockGitHubFlow({ status: 404, body: { message: "Not Found" } });

      const response = await SELF.fetch(
        `https://example.com/auth/github/callback?code=testcode&state=${webState}`,
        { redirect: "manual" },
      );

      expect(response.status).toBe(302);
      expect(response.headers.get("Location")).toBe(
        "http://localhost:5173/login?error=not_org_member",
      );
      expect(response.headers.get("Set-Cookie")).toBeNull();
    });
  });

  describe("GET /auth/google/login", () => {
    it("should redirect to Google OAuth", async () => {
      const response = await SELF.fetch(
        "https://example.com/auth/google/login",
        { redirect: "manual" },
      );

      expect(response.status).toBe(302);
      expect(response.headers.get("Location")).toMatch(
        /^https:\/\/accounts\.google\.com\/o\/oauth2\/v2\/auth/,
      );
    });
  });

  describe("GET /auth/google/callback - 도메인 게이트", () => {
    const webState = encodeURIComponent(
      JSON.stringify({ client: "web", redirectTo: "http://localhost:5173/" }),
    );

    // Google OAuth 왕복(토큰 교환 → userinfo)을 목킹한다. 이메일만 케이스별로 바꿔
    // 도메인 게이트(GOOGLE_ALLOWED_DOMAIN=test.dev, vitest.config.ts) 동작을 검증한다.
    const mockGoogleFlow = (email: string) => {
      fetchMock
        .get("https://oauth2.googleapis.com")
        .intercept({ path: "/token", method: "POST" })
        .reply(200, { access_token: "ya29_test" });
      fetchMock
        .get("https://openidconnect.googleapis.com")
        .intercept({ path: "/v1/userinfo", method: "GET" })
        .reply(200, {
          sub: "108123456789",
          email,
          email_verified: true,
          name: "Tester",
        });
    };

    afterEach(() => {
      fetchMock.assertNoPendingInterceptors();
    });

    it("허용 도메인 이메일이면 로그인 통과 후 웹 오리진으로 리다이렉트", async () => {
      mockGoogleFlow("tester@test.dev");

      const response = await SELF.fetch(
        `https://example.com/auth/google/callback?code=testcode&state=${webState}`,
        { redirect: "manual" },
      );

      expect(response.status).toBe(302);
      expect(response.headers.get("Location")).toBe("http://localhost:5173/");
      expect(response.headers.get("Set-Cookie")).toMatch(/^session=/);
    });

    it("허용 외 도메인이면 google_domain_not_allowed로 거부(세션 미발급)", async () => {
      mockGoogleFlow("tester@gmail.com");

      const response = await SELF.fetch(
        `https://example.com/auth/google/callback?code=testcode&state=${webState}`,
        { redirect: "manual" },
      );

      expect(response.status).toBe(302);
      expect(response.headers.get("Location")).toBe(
        "http://localhost:5173/login?error=google_domain_not_allowed",
      );
      expect(response.headers.get("Set-Cookie")).toBeNull();
    });

    it("기존 계정과 같은 이메일이면 새 계정을 만들지 않고 연결한다", async () => {
      // 허용 도메인 이메일로 기존(GitHub 기반) 계정 생성
      const db = (await import("../utils/db")).getTestDb();
      const schema = await import("../../src/db/schema");
      await db.insert(schema.account).values({
        id: "existing-account-id",
        email: "tester@test.dev",
        name: "Existing",
        githubId: "4242",
        createdTime: Date.now(),
      });

      mockGoogleFlow("tester@test.dev");

      const response = await SELF.fetch(
        `https://example.com/auth/google/callback?code=testcode&state=${webState}`,
        { redirect: "manual" },
      );

      expect(response.status).toBe(302);
      expect(response.headers.get("Set-Cookie")).toMatch(/^session=/);

      // 계정이 늘지 않고 기존 계정에 googleId가 연결됨
      const accounts = await db.select().from(schema.account);
      expect(accounts).toHaveLength(1);
      expect(accounts[0].id).toBe("existing-account-id");
      expect(accounts[0].googleId).toBe("108123456789");
      expect(accounts[0].githubId).toBe("4242");
    });
  });
});
