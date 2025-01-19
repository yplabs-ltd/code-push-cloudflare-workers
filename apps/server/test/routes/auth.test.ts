import { SELF, env } from "cloudflare:test";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { type TestAuth, createTestAuth } from "../utils/auth";
import { cleanupDatabase } from "../utils/db";

describe("Auth Routes", () => {
  let auth: TestAuth;

  beforeEach(async () => {
    auth = createTestAuth(env.DB, env.JWT_SECRET);

    await cleanupDatabase();
  });

  afterEach(async () => {
    await auth.cleanup();
  });

  describe("GET /auth/github/login", () => {
    it("should redirect to GitHub OAuth", async () => {
      const response = await SELF.fetch(
        "https://example.com/auth/github/login",
        {
          redirect: "manual",
        },
      );

      expect(response.status).toBe(302);
      expect(response.headers.get("Location")).toMatch(
        /^https:\/\/github.com\/login\/oauth\/authorize/,
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
});
