import { createExecutionContext, env } from "cloudflare:test";
import { describe, expect, it, vi } from "vitest";
import worker from "../src/index";

const bindings = env as unknown as Parameters<typeof worker.fetch>[1];

// 테스트 런타임에는 ctx.exports가 없어, 운영 경로를 보려면 Backend를 직접 넣는다.
const contextWithBackend = () => {
  const backendFetch = vi.fn(
    async (_request: Request, _init?: RequestInit) =>
      new Response("from-backend"),
  );
  const ctx = Object.assign(createExecutionContext(), {
    exports: { Backend: { fetch: backendFetch } as unknown as Fetcher },
  });
  return { ctx, backendFetch };
};

describe("게이트웨이", () => {
  it("update_check GET은 기기 ID를 뺀 캐시 키로 Backend에 보낸다", async () => {
    const { ctx, backendFetch } = contextWithBackend();

    const url =
      "https://example.com/v0.1/public/codepush/update_check?deployment_key=k&client_unique_id=device-a&app_version=1.0.0";

    const response = await worker.fetch(new Request(url), bindings, ctx);

    expect(await response.text()).toBe("from-backend");
    expect(backendFetch).toHaveBeenCalledTimes(1);
    // rollout 판정에 기기 ID가 필요해, 요청 자체는 원래 URL 그대로 가야 한다.
    expect(backendFetch.mock.calls[0][0].url).toBe(url);
    expect(backendFetch.mock.calls[0][1]).toEqual({
      cf: {
        cacheKey:
          "/v0.1/public/codepush/update_check?app_version=1.0.0&deployment_key=k",
      },
    });
  });

  it("update_check가 아니거나 GET이 아니면 Backend에 보내지 않는다", async () => {
    const { ctx, backendFetch } = contextWithBackend();

    const health = await worker.fetch(
      new Request("https://example.com/health"),
      bindings,
      ctx,
    );
    const head = await worker.fetch(
      new Request("https://example.com/updateCheck", { method: "HEAD" }),
      bindings,
      ctx,
    );

    expect(health.status).toBe(200);
    expect(head.status).toBe(400);
    expect(backendFetch).not.toHaveBeenCalled();
  });
});
