import { DefaultApiFactory } from "@code-push-cloudflare-workers/api-client";
import axios from "axios";
import { config } from "./config";

// 인증은 서버가 심는 httpOnly 세션 쿠키로 처리한다(GitHub OAuth, 동일 오리진).
// withCredentials로 쿠키를 함께 전송하고, 클라이언트에서 토큰을 다루지 않는다.
// (쿠키가 실리려면 웹이 VITE_API_URL과 동일 오리진에 배포되어야 한다.)
const axiosInstance = axios.create({ withCredentials: true });

axiosInstance.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error?.response?.status;
    if (
      (status === 401 || status === 403) &&
      !window.location.pathname.includes("/login")
    ) {
      window.location.href = "/login";
    }
    return Promise.reject(error);
  },
);

export const api = DefaultApiFactory(
  {
    basePath: config.apiUrl,
    isJsonMime(mime: string) {
      return /json/.test(mime);
    },
  },
  undefined,
  axiosInstance,
);
