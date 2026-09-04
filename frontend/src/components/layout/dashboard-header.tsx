'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTheme } from 'next-themes';
import { Menu, Sun, Moon, LogOut, X, Bell } from 'lucide-react';
import { useAuthStore } from '@/store/auth.store';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { DashboardSidebar } from './dashboard-sidebar';
import { api } from '@/lib/api';
import Link from 'next/link';

function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  return (
    <button
      type="button"
      onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
      className={cn(
        'relative flex h-8 w-8 items-center justify-center rounded-lg',
        'text-[rgb(var(--text-2))] hover:text-[rgb(var(--text))]',
        'transition-all duration-150 hover:bg-[rgb(var(--surface-2))]',
      )}
      title="Переключить тему"
      aria-label="Переключить тему"
    >
      <Sun className="absolute h-4 w-4 scale-100 opacity-100 transition-all dark:scale-50 dark:opacity-0" />
      <Moon className="absolute h-4 w-4 scale-50 opacity-0 transition-all dark:scale-100 dark:opacity-100" />
    </button>
  );
}

export function DashboardHeader() {
  const { user, logout } = useAuthStore();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const count = await api.get<number>('/notifications/unread-count');
        if (!cancelled) setUnread(typeof count === 'number' ? count : 0);
      } catch {
        /* ignore */
      }
    };
    void load();
    const id = window.setInterval(load, 45_000);
    const onFocus = () => void load();
    window.addEventListener('focus', onFocus);
    return () => {
      cancelled = true;
      window.clearInterval(id);
      window.removeEventListener('focus', onFocus);
    };
  }, []);

  useEffect(() => {
    if (!menuOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [menuOpen]);

  const handleLogout = async () => {
    await logout();
    toast.success('До свидания!');
    router.push('/');
  };

  return (
    <>
      <header
        className={cn(
          'flex h-14 shrink-0 items-center justify-between gap-3 border-b border-[rgb(var(--border))] bg-[rgb(var(--surface))] px-4 sm:px-6',
        )}
      >
        <div className="flex min-w-0 items-center gap-2">
          <button
            type="button"
            className="flex h-9 w-9 items-center justify-center rounded-lg text-[rgb(var(--text-2))] hover:bg-[rgb(var(--surface-2))] hover:text-[rgb(var(--text))] md:hidden"
            onClick={() => setMenuOpen(true)}
            aria-label="Открыть меню"
          >
            <Menu className="h-5 w-5" />
          </button>
          <p className="truncate text-sm text-[rgb(var(--text-2))]">
            Добро пожаловать,{' '}
            <span className="font-semibold text-[rgb(var(--text))]">
              {user?.firstName}
            </span>
          </p>
        </div>

        <div className="flex items-center gap-1">
          <Link
            href={
              user?.role === 'teacher'
                ? '/dashboard/teacher/notifications'
                : user?.role === 'admin'
                  ? '/dashboard/admin/notifications'
                  : '/dashboard/student/notifications'
            }
            className="relative flex h-8 w-8 items-center justify-center rounded-lg text-[rgb(var(--text-2))] hover:bg-[rgb(var(--surface-2))] hover:text-[rgb(var(--text))]"
            aria-label="Уведомления"
          >
            <Bell className="h-4 w-4" />
            {unread > 0 && (
              <span className="absolute -right-0.5 -top-0.5 min-w-[1rem] rounded-full bg-red-500 px-1 text-[10px] font-bold leading-4 text-white text-center">
                {unread > 9 ? '9+' : unread}
              </span>
            )}
          </Link>
          <ThemeToggle />
          <button
            type="button"
            onClick={handleLogout}
            className={cn(
              'flex h-8 w-8 items-center justify-center rounded-lg',
              'text-[rgb(var(--text-2))] hover:text-red-500',
              'transition-all duration-150 hover:bg-red-50 dark:hover:bg-red-500/10',
            )}
            title="Выйти"
            aria-label="Выйти"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </header>

      {menuOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-black/50 backdrop-blur-[2px]"
            aria-label="Закрыть меню"
            onClick={() => setMenuOpen(false)}
          />
          <div className="absolute inset-y-0 left-0 flex w-[min(18rem,88vw)] animate-slide-in-left shadow-2xl">
            <div className="relative flex h-full w-full flex-col">
              <button
                type="button"
                onClick={() => setMenuOpen(false)}
                className="absolute right-3 top-3 z-10 flex h-8 w-8 items-center justify-center rounded-lg text-white/70 hover:bg-white/10 hover:text-white"
                aria-label="Закрыть"
              >
                <X className="h-4 w-4" />
              </button>
              <DashboardSidebar onNavigate={() => setMenuOpen(false)} />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
