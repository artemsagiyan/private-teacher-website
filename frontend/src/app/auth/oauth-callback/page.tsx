'use client';

import { Suspense, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuthStore } from '@/store/auth.store';
import { api } from '@/lib/api';

function OAuthCallbackInner() {
  const router = useRouter();
  const params = useSearchParams();
  const { fetchMe } = useAuthStore();

  useEffect(() => {
    const access = params.get('access');
    const refresh = params.get('refresh');
    if (!access || !refresh) {
      router.replace('/auth/login');
      return;
    }
    api.setTokens(access, refresh);
    fetchMe().then(() => {
      const user = useAuthStore.getState().user;
      if (user?.role === 'teacher') router.replace('/dashboard/teacher');
      else if (user?.role === 'admin') router.replace('/dashboard/admin');
      else router.replace('/dashboard/student');
    });
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin h-10 w-10 border-4 border-primary-500 border-t-transparent rounded-full mx-auto mb-4" />
        <p className="text-gray-500">Входим в систему...</p>
      </div>
    </div>
  );
}

export default function OAuthCallbackPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin h-10 w-10 border-4 border-primary-500 border-t-transparent rounded-full" />
      </div>
    }>
      <OAuthCallbackInner />
    </Suspense>
  );
}
