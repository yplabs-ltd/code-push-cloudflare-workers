export const config = {
  apiUrl: import.meta.env.VITE_API_URL,
  // 콜백이 웹 오리진으로 되돌아오도록 redirect_to에 현재 오리진을 실어 보낸다.
  githubOAuthUrl: `${import.meta.env.VITE_API_URL}/auth/login?client=web&redirect_to=${encodeURIComponent(`${window.location.origin}/`)}`,
  logoutUrl: `${import.meta.env.VITE_API_URL}/auth/logout`,
} as const;
