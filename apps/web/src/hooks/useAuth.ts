import { useAuthStore } from "@/stores/auth";
import { useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";

export const useAuth = (requireAuth = true) => {
  const navigate = useNavigate();
  const { isAuthenticated, setAuth } = useAuthStore();

  useEffect(() => {
    const checkAuth = () => {
      const hasCookie = document.cookie.includes("session=");
      // setAuth(hasCookie);

      if (requireAuth && !hasCookie) {
        navigate({
          to: "/login",
          search: {
            redirect_to: window.location.pathname,
          },
        });
      }
    };

    checkAuth();
  }, [navigate, requireAuth]);

  return { isAuthenticated };
};
