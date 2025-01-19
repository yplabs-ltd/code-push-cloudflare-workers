import { SELF } from "cloudflare:test";
import { expect } from "vitest";
import type { AccessKey } from "../../src/types/schemas";
import { generateKey } from "../../src/utils/security";

export async function createTestAccessKey(): Promise<AccessKey> {
  const key = generateKey();
  const response = await SELF.fetch("http://localhost/management/accessKeys", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer test-token",
    },
    body: JSON.stringify({
      name: key,
      friendlyName: "Test Access Key",
      createdBy: "Test",
      ttl: 3600000, // 1 hour
    }),
  });

  expect(response.status).toBe(201);
  return response.json().then((r) => r.accessKey);
}

export class TestAuth {
  static readonly TEST_TOKEN = "test-token";
  private accessKey: AccessKey | undefined;

  async getAuthHeaders(): Promise<HeadersInit> {
    if (!this.accessKey) {
      this.accessKey = await createTestAccessKey();
    }

    return {
      Authorization: `Bearer ${this.accessKey.name}`,
      "Content-Type": "application/json",
    };
  }

  async cleanup(): Promise<void> {
    if (this.accessKey) {
      await SELF.fetch(
        `http://localhost/management/accessKeys/${this.accessKey.name}`,
        {
          method: "DELETE",
          headers: await this.getAuthHeaders(),
        },
      );
    }
  }
}
