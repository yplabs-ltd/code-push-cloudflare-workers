import { create } from "zustand";

type AuthStatus = "loading" | "authenticated" | "unauthenticated";

interface Account {
  id: string;
  name: string;
  email: string;
}

interface AuthState {
  status: AuthStatus;
  account: Account | null;
  setAuthenticated: (account: Account) => void;
  setUnauthenticated: () => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  // 초기엔 accountGet 결과를 모르므로 loading. AuthProvider가 확정한다.
  status: "loading",
  account: null,
  setAuthenticated: (account) => set({ status: "authenticated", account }),
  setUnauthenticated: () => set({ status: "unauthenticated", account: null }),
  logout: () => {
    set({ status: "unauthenticated", account: null });
    // Clear session cookie
    document.cookie =
      "session=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
  },
}));
