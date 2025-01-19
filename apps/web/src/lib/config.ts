export const config = {
  apiUrl: import.meta.env.VITE_API_URL,
  githubOAuthUrl: `${import.meta.env.VITE_API_URL}/auth/github/login`,
} as const;
