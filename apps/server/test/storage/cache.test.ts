import { InMemoryCacheProvider } from "../../src/storage/cache";
import { describe, it, expect, beforeEach } from "vitest";
import { vi } from "vitest";

describe("Cache", () => {
  let cache: InMemoryCacheProvider;
  beforeEach(() => {
    vi.clearAllMocks();
    cache = new InMemoryCacheProvider();
  });

  it("should be able to set and get a value", async () => {
    await cache.set("test", "test");
    expect(await cache.get("test")).toBe("test");
  });

  it("should be able to delete a value", async () => {
    await cache.set("test", "test");
    await cache.del("test");
    expect(await cache.get("test")).toBeNull();
  });

  it("should be able to set a value with an expiration time", async () => {
    await cache.set("test", "test", 1);
    expect(await cache.get("test")).toBe("test");
    await new Promise((resolve) => setTimeout(resolve, 1500));
    expect(await cache.get("test")).toBeNull();
  });

  it("should be inable to get a value that has expired", async () => {
    await cache.set("test", "test", 1);
    await new Promise((resolve) => setTimeout(resolve, 1500));
    expect(await cache.get("test")).toBeNull();
  });

  it("should be inable to get a value deleted", async () => {
    await cache.set("test", "test");
    await cache.del("test");
    expect(await cache.get("test")).toBeNull();
  });
});