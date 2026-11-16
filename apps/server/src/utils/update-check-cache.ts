export const CDN_CACHE_CONTROL_HEADER = "Cloudflare-CDN-Cache-Control";

export const UPDATE_CHECK_CACHE_CONTROL =
  "max-age=60, stale-while-revalidate=60, stale-if-error=600";

const UPDATE_CHECK_PATHS = new Set([
  "/updateCheck",
  "/v0.1/public/codepush/update_check",
]);

const DEVICE_ID_PARAMS = ["client_unique_id", "clientUniqueId"];

declare module "hono" {
  interface ContextVariableMap {
    updateCheckNoStore: boolean;
  }
}

export const isUpdateCheckRequest = (
  method: string,
  pathname: string,
): boolean => method === "GET" && UPDATE_CHECK_PATHS.has(pathname);

// 값은 건드리지 않는다. 핸들러가 쿼리 원문을 읽어서(is_companion="false"도 참),
// 값을 정규화하면 서버가 다르게 판정하는 요청이 같은 키로 묶인다.
export const buildUpdateCheckCacheKey = (url: URL): string => {
  const params = new URLSearchParams(url.search);
  for (const name of DEVICE_ID_PARAMS) {
    params.delete(name);
  }
  params.sort();
  const query = params.toString();
  return query ? `${url.pathname}?${query}` : url.pathname;
};

// 5xx에는 붙이지 않는다. no-store가 붙은 5xx에서 stale-if-error가 도는지 문서에 없다.
export const withDefaultNoStore = (response: Response): Response => {
  if (
    response.status >= 500 ||
    response.headers.has(CDN_CACHE_CONTROL_HEADER)
  ) {
    return response;
  }
  const result = new Response(response.body, response);
  result.headers.set(CDN_CACHE_CONTROL_HEADER, "no-store");
  return result;
};
