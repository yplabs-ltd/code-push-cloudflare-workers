export const config = {
  apiUrl: import.meta.env.VITE_API_URL || "http://localhost:8787",
  githubOAuthUrl: `${import.meta.env.VITE_API_URL}/auth/github/login`,
} as const;
