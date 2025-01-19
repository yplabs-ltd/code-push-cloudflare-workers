import { DefaultApiFactory } from "@code-push-cloudflare-workers/api-client";
import type { AxiosRequestConfig } from "axios";
import { config } from "./config";
console.log(config);

export const api = DefaultApiFactory({
  baseOptions: {
    baseURL: config.apiUrl,
    withCredentials: true,
  } satisfies AxiosRequestConfig,
  isJsonMime(mime) {
    return /json/.test(mime);
  },
});
