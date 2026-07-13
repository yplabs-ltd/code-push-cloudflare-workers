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
});
