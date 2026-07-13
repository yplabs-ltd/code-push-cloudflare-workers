export const config = {
  apiUrl: import.meta.env.VITE_API_URL,
  // 콜백이 웹 오리진으로 되돌아오도록 redirect_to에 현재 오리진을 실어 보낸다.
  githubOAuthUrl: `${import.meta.env.VITE_API_URL}/auth/login?client=web&redirect_to=${encodeURIComponent(`${window.location.origin}/`)}`,
  // 로그아웃 후 웹 오리진의 /login으로 되돌아오도록 절대 URL을 redirect_to로 실어 보낸다.
  // (미지정 시 서버가 상대경로 "/login"으로 리다이렉트 → 서버 도메인에 갇힘)
  logoutUrl: `${import.meta.env.VITE_API_URL}/auth/logout?redirect_to=${encodeURIComponent(`${window.location.origin}/login`)}`,
} as const;
