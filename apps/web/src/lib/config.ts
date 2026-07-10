export const config = {
  apiUrl: import.meta.env.VITE_API_URL,
  githubOAuthUrl: `${import.meta.env.VITE_API_URL}/auth/login`,
  logoutUrl: `${import.meta.env.VITE_API_URL}/auth/logout`,
} as const;
