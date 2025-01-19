import { eq } from "drizzle-orm";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import { drizzle } from "drizzle-orm/d1";
import { z } from "zod";
import { accessKey, account } from "../../src/db/schema";
import {
  type AccessKey,
  AccessKeySchema,
  type Account,
} from "../../src/types/schemas";
import { sign } from "../../src/utils/jwt";
import { generateKey } from "../../src/utils/security";

export interface TestUser {
  email: string;
  name: string;
}

export class TestAuth {
  private db: DrizzleD1Database;
  private account: Account | undefined;
  private accessKey: AccessKey | undefined;
  private jwtSecret: string;

  constructor(d1: D1Database, jwtSecret: string) {
    this.db = drizzle(d1);
    this.jwtSecret = jwtSecret;
  }

  async createTestAccount(user: TestUser) {
    // Create test account
    const accountId = generateKey();
    const now = Date.now();

    const newAccount = {
      id: accountId,
      email: user.email,
      name: user.name,
      createdTime: now,
    } satisfies typeof account.$inferInsert;
    await this.db.insert(account).values(newAccount);

    // Create access key
    const keyName = generateKey();
    const keyId = generateKey();

    const newAccessKey = {
      id: keyId,
      name: keyName,
      friendlyName: "Test Access Key",
      createdBy: "Integration Test",
      createdTime: now,
      expires: now + 24 * 60 * 60 * 1000, // 24 hours
      isSession: true,
      accountId,
    } satisfies typeof accessKey.$inferInsert;
    await this.db.insert(accessKey).values(newAccessKey);

    return {
      account: newAccount,
      accessKey: newAccessKey,
    } as const;
  }

  async setupTestAccount(user: TestUser) {
    const { account, accessKey } = await this.createTestAccount(user);
    this.account = account as Account;
    this.accessKey = accessKey;

    return this.account;
  }

  async createTestAccessKey() {
    if (!this.account) {
      throw new Error("Test account not setup - call setupTestAccount first");
    }

    const keyName = generateKey();
    const keyId = generateKey();

    const now = Date.now();
    const newAccessKey = {
      id: keyId,
      name: keyName,
      friendlyName: "Test Access Key",
      createdBy: "Integration Test",
      createdTime: now,
      expires: now + 24 * 60 * 60 * 1000, // 24 hours
      isSession: true,
      accountId: this.account.id,
    } satisfies typeof accessKey.$inferInsert;
    await this.db.insert(accessKey).values(newAccessKey);

    return newAccessKey;
  }

  async getAuthHeaders(useJwt = false): Promise<HeadersInit> {
    if (!this.account || !this.accessKey) {
      throw new Error("Test account not setup - call setupTestAccount first");
    }

    if (useJwt) {
      const token = await sign(
        {
          sub: this.account.id,
          email: this.account.email,
        },
        this.jwtSecret,
      );

      return {
        Cookie: `session=${token}`,
        "Content-Type": "application/json",
      };
    }

    return {
      Authorization: `Bearer ${this.accessKey.name}`,
      "Content-Type": "application/json",
    };
  }

  getCurrentAccountId(): string {
    if (!this.account) {
      throw new Error("Test account not setup - call setupTestAccount first");
    }
    return this.account.id;
  }

  getCurrentEmail(): string {
    if (!this.account) {
      throw new Error("Test account not setup - call setupTestAccount first");
    }
    return this.account.email;
  }

  async cleanup(): Promise<void> {
    if (!this.account) {
      return;
    }

    // Delete access keys
    await this.db
      .delete(accessKey)
      .where(eq(accessKey.accountId, this.account.id));

    // Delete account
    await this.db
      .update(account)
      .set({
        deletedAt: Date.now(),
      })
      .where(eq(account.id, this.account.id));

    this.account = undefined;
    this.accessKey = undefined;
  }
}

// Helper to create test auth instance
export function createTestAuth(d1: D1Database, jwtSecret: string): TestAuth {
  return new TestAuth(d1, jwtSecret);
}

// Default test user
export const DEFAULT_TEST_USER: TestUser = {
  email: "test@example.com",
  name: "Test User",
};
