import { api } from '@/lib/api';
import { useAuthStore } from '@/stores/auth';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { useEffect } from 'react';

interface AuthProviderProps {
  children: React.ReactNode;
}

export const AuthProvider = ({ children }: AuthProviderProps) => {
  const navigate = useNavigate();
  const { setAuth, isAuthenticated } = useAuthStore();

  const { data: accountData, isError } = useQuery({
    queryKey: ['account'],
    queryFn: async () => {
      try {
        const response = await api.managementAccountGet();
        return response.data;
      } catch (error) {
        // If unauthorized, clear auth state
        if ((error as any)?.response?.status === 401) {
          setAuth({ isAuthenticated: false, account: null });
        }
        throw error;
      }
    },
    retry: false,
    enabled: true, // Always try to fetch on mount
  });

  useEffect(() => {
    if (accountData?.account) {
      setAuth({
        isAuthenticated: true,
        account: {
          id: accountData.account.id,
          name: accountData.account.name,
          email: accountData.account.email,
        },
      });
    }
  }, [accountData, setAuth]);

  useEffect(() => {
    // If we're not authenticated and not on the login page, redirect
    if (!isAuthenticated && !window.location.pathname.includes('/login')) {
      navigate({
        to: '/login',
        search: {
          redirect_to: window.location.pathname,
        },
      });
    }
  }, [isAuthenticated, navigate]);

  return <>{children}</>;
};
