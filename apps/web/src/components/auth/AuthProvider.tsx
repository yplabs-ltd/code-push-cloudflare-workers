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
  const { status, setAuthenticated, setUnauthenticated } = useAuthStore();

  // 세션 쿠키는 withCredentials로 자동 전송된다. accountGet 성공=인증됨.
  const { data, isSuccess, isError } = useQuery({
    queryKey: ['account'],
    queryFn: async () => {
      const response = await api.accountGet();
      return response.data;
    },
    retry: false,
  });

  useEffect(() => {
    if (isSuccess && data?.account) {
      setAuthenticated({
        id: data.account.id,
        name: data.account.name,
        email: data.account.email,
      });
    }
  }, [isSuccess, data, setAuthenticated]);

  useEffect(() => {
    if (isError) {
      setUnauthenticated();
    }
  }, [isError, setUnauthenticated]);

  useEffect(() => {
    // 미인증이 확정된 경우에만 로그인으로. loading 중에는 리다이렉트하지 않는다.
    if (
      status === 'unauthenticated' &&
      !window.location.pathname.includes('/login')
    ) {
      navigate({
        to: '/login',
        search: {
          redirect_to: window.location.pathname,
        },
      });
    }
  }, [status, navigate]);

  return <>{children}</>;
};
