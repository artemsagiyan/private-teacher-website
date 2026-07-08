'use client';

import { useRouter } from 'next/navigation';
import { useTheme } from 'next-themes';
import { Sun, Moon, LogOut } from 'lucide-react';
import { useAuthStore } from '@/store/auth.store';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  return (
    <button
      onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
      className={cn(
        'relative h-8 w-8 rounded-lg flex items-center justify-center',
        'text-[rgb(var(--text-2))] hover:text-[rgb(var(--text))]',
        'hover:bg-[rgb(var(--surface-2))] transition-all duration-150',
      )}
      title="Переключить тему"
    >
      <Sun className="h-4 w-4 absolute transition-all dark:opacity-0 dark:scale-50 opacity-100 scale-100" />
      <Moon className="h-4 w-4 absolute transition-all dark:opacity-100 dark:scale-100 opacity-0 scale-50" />
    </button>
  );
}

export function DashboardHeader() {
  const { user, logout } = useAuthStore();
  const router = useRouter();

  const handleLogout = async () => {
    await logout();
    toast.success('До свидания!');
    router.push('/');
  };

  return (
    <header className={cn(
      'h-14 flex items-center justify-between px-6 shrink-0',
      'border-b border-[rgb(var(--border))] bg-[rgb(var(--surface))]',
    )}>
      <p className="text-sm text-[rgb(var(--text-2))]">
        Добро пожаловать,{' '}
        <span className="text-[rgb(var(--text))] font-semibold">{user?.firstName}</span>
      </p>

      <div className="flex items-center gap-1">
        <ThemeToggle />
        <button
          onClick={handleLogout}
          className={cn(
            'h-8 w-8 rounded-lg flex items-center justify-center',
            'text-[rgb(var(--text-2))] hover:text-red-500',
            'hover:bg-red-50 dark:hover:bg-red-500/10 transition-all duration-150',
          )}
          title="Выйти"
        >
          <LogOut className="h-4 w-4" />
        </button>
      </div>
    </header>
  );
}
