import { describe, expect, it } from "vitest";
import {
  CDN_CACHE_CONTROL_HEADER,
  UPDATE_CHECK_CACHE_CONTROL,
  buildUpdateCheckCacheKey,
  isUpdateCheckRequest,
  withDefaultNoStore,
} from "../../src/utils/update-check-cache";

const keyOf = (pathAndQuery: string) =>
  buildUpdateCheckCacheKey(new URL(`https://example.com${pathAndQuery}`));

describe("update_check 캐시 키", () => {
  it("기기 ID만 다른 요청은 같은 키가 된다", () => {
    const a = keyOf(
      "/v0.1/public/codepush/update_check?deployment_key=k&app_version=1.0.0&client_unique_id=device-a",
    );
    const b = keyOf(
      "/v0.1/public/codepush/update_check?deployment_key=k&app_version=1.0.0&client_unique_id=device-b",
    );
    expect(a).toBe(b);
    expect(a).not.toContain("client_unique_id");
  });

  it("새 경로의 기기 ID 이름(clientUniqueId)도 뺀다", () => {
    expect(keyOf("/updateCheck?deploymentKey=k&clientUniqueId=device-a")).toBe(
      keyOf("/updateCheck?deploymentKey=k&clientUniqueId=device-b"),
    );
  });

  it("쿼리 순서만 다른 요청은 같은 키가 된다", () => {
    expect(keyOf("/updateCheck?appVersion=1.0.0&deploymentKey=k")).toBe(
      keyOf("/updateCheck?deploymentKey=k&appVersion=1.0.0"),
    );
  });

  it("공백을 %20으로 쓴 요청과 +로 쓴 요청은 같은 키가 된다", () => {
    expect(keyOf("/updateCheck?deploymentKey=k&label=v%201")).toBe(
      keyOf("/updateCheck?deploymentKey=k&label=v+1"),
    );
  });

  it("값은 정규화하지 않는다", () => {
    expect(keyOf("/updateCheck?deploymentKey=k&isCompanion=false")).not.toBe(
      keyOf("/updateCheck?deploymentKey=k"),
    );
    expect(keyOf("/updateCheck?deploymentKey=K")).not.toBe(
      keyOf("/updateCheck?deploymentKey=k"),
    );
  });

  it("기기 ID가 아닌 값이 다르면 다른 키가 된다", () => {
    expect(keyOf("/updateCheck?deploymentKey=k&packageHash=a")).not.toBe(
      keyOf("/updateCheck?deploymentKey=k&packageHash=b"),
    );
  });

  it("경로가 다르면 쿼리가 같아도 다른 키가 된다", () => {
    expect(keyOf("/updateCheck?label=v1")).not.toBe(
      keyOf("/v0.1/public/codepush/update_check?label=v1"),
    );
  });

  it("쿼리가 없으면 경로만 키가 된다", () => {
    expect(keyOf("/updateCheck?clientUniqueId=device-a")).toBe("/updateCheck");
  });
});

describe("캐시하는 진입점으로 보낼 요청 판단", () => {
  it("update_check GET 두 경로만 보낸다", () => {
    expect(isUpdateCheckRequest("GET", "/updateCheck")).toBe(true);
    expect(
      isUpdateCheckRequest("GET", "/v0.1/public/codepush/update_check"),
    ).toBe(true);
  });

  it("GET이 아니면 보내지 않는다", () => {
    expect(isUpdateCheckRequest("HEAD", "/updateCheck")).toBe(false);
    expect(isUpdateCheckRequest("POST", "/updateCheck")).toBe(false);
  });

  it("그 밖의 경로는 보내지 않는다", () => {
    expect(isUpdateCheckRequest("GET", "/health")).toBe(false);
    expect(isUpdateCheckRequest("GET", "/auth/github/login")).toBe(false);
    expect(isUpdateCheckRequest("GET", "/apps")).toBe(false);
    expect(isUpdateCheckRequest("GET", "/updateCheck/")).toBe(false);
    expect(
      isUpdateCheckRequest("GET", "/v0.1/public/codepush/report_status/deploy"),
    ).toBe(false);
  });
});

describe("Backend 기본값 저장 안 함", () => {
  it("저장 헤더가 없는 200에는 no-store를 붙인다", async () => {
    const result = withDefaultNoStore(Response.json({ ok: true }));
    expect(result.headers.get(CDN_CACHE_CONTROL_HEADER)).toBe("no-store");
    expect(result.status).toBe(200);
    expect(await result.json()).toEqual({ ok: true });
  });

  it("404에도 no-store를 붙인다", () => {
    const result = withDefaultNoStore(new Response(null, { status: 404 }));
    expect(result.headers.get(CDN_CACHE_CONTROL_HEADER)).toBe("no-store");
    expect(result.status).toBe(404);
  });

  it("라우트가 붙인 저장 헤더는 그대로 둔다", () => {
    const result = withDefaultNoStore(
      new Response("{}", {
        headers: { [CDN_CACHE_CONTROL_HEADER]: UPDATE_CHECK_CACHE_CONTROL },
      }),
    );
    expect(result.headers.get(CDN_CACHE_CONTROL_HEADER)).toBe(
      UPDATE_CHECK_CACHE_CONTROL,
    );
  });

  it("5xx에는 아무 헤더도 붙이지 않는다", () => {
    const result = withDefaultNoStore(new Response(null, { status: 500 }));
    expect(result.headers.has(CDN_CACHE_CONTROL_HEADER)).toBe(false);
  });

  it("일반 Cache-Control은 붙이지 않는다", () => {
    const result = withDefaultNoStore(Response.json({ ok: true }));
    expect(result.headers.has("Cache-Control")).toBe(false);
  });
});
