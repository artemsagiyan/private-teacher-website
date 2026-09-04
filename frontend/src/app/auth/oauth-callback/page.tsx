'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { useAuthStore } from '@/store/auth.store';
import { api } from '@/lib/api';
import { AuthTokens } from '@/types';

function homeForRole(role?: string) {
  if (role === 'teacher') return '/dashboard/teacher';
  if (role === 'admin') return '/dashboard/admin';
  return '/dashboard/student';
}

function OAuthCallbackInner() {
  const router = useRouter();
  const params = useSearchParams();
  const { login } = useAuthStore();
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const code = params.get('code');
    if (!code) {
      toast.error('Не удалось войти через Google');
      router.replace('/auth/login');
      return;
    }
    api
      .post<AuthTokens>('/auth/oauth/exchange', { code })
      .then((tokens) => {
        login(tokens);
        router.replace(homeForRole(tokens.user.role));
      })
      .catch(() => {
        setFailed(true);
        toast.error('Сессия Google истекла. Войдите ещё раз.');
        router.replace('/auth/login');
      });
  }, [params, login, router]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin h-10 w-10 border-4 border-primary-500 border-t-transparent rounded-full mx-auto mb-4" />
        <p className="text-[rgb(var(--text-2))]">
          {failed ? 'Ошибка входа' : 'Входим в систему...'}
        </p>
      </div>
    </div>
  );
}

export default function OAuthCallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <div className="animate-spin h-10 w-10 border-4 border-primary-500 border-t-transparent rounded-full" />
        </div>
      }
    >
      <OAuthCallbackInner />
    </Suspense>
  );
}
