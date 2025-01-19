import { create } from "zustand";

interface AuthState {
  isAuthenticated: boolean;
  account: {
    id: string;
    name: string;
    email: string;
  } | null;
  setAuth: (data: {
    isAuthenticated: boolean;
    account: AuthState["account"];
  }) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  isAuthenticated: false,
  account: null,
  setAuth: (data) => set(data),
  logout: () => {
    set({ isAuthenticated: false, account: null });
    // Clear session cookie
    document.cookie =
      "session=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
  },
}));
