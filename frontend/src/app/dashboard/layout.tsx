'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth.store';
import { DashboardSidebar } from '@/components/layout/dashboard-sidebar';
import { DashboardHeader } from '@/components/layout/dashboard-header';

function homeForRole(role?: string) {
  if (role === 'teacher') return '/dashboard/teacher';
  if (role === 'admin') return '/dashboard/admin';
  return '/dashboard/student';
}

function isAllowedPath(pathname: string, role?: string) {
  if (pathname.startsWith('/dashboard/lessons')) return true;
  const home = homeForRole(role);
  return pathname === home || pathname.startsWith(`${home}/`);
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { isAuthenticated, isLoading, fetchMe, user } = useAuthStore();

  useEffect(() => {
    fetchMe().then(() => {
      const state = useAuthStore.getState();
      if (!state.isAuthenticated) {
        router.replace('/auth/login');
        return;
      }
      const role = state.user?.role;
      if (role && !isAllowedPath(window.location.pathname, role)) {
        router.replace(homeForRole(role));
      }
    });
  }, [router, fetchMe]);

  useEffect(() => {
    if (!user?.role || isLoading) return;
    if (!isAllowedPath(pathname, user.role)) {
      router.replace(homeForRole(user.role));
    }
  }, [pathname, user?.role, isLoading, router]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[rgb(var(--bg))]">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 rounded-full border-2 border-primary-500 border-t-transparent animate-spin" />
          <p className="text-xs text-[rgb(var(--text-3))]">Загрузка...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) return null;

  return (
    <div className="flex min-h-screen bg-[rgb(var(--bg))]">
      <div className="sticky top-0 hidden h-screen shrink-0 md:flex">
        <DashboardSidebar />
      </div>
      <div className="flex min-h-screen min-w-0 flex-1 flex-col">
        <DashboardHeader />
        <main className="animate-fade-in flex-1 overflow-auto p-4 sm:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
