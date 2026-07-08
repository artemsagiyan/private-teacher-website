'use client';

import Link from 'next/link';
import { useTheme } from 'next-themes';
import { Sun, Moon, GraduationCap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export function PublicHeader() {
  const { theme, setTheme } = useTheme();

  return (
    <header className="sticky top-0 z-50 glass border-b border-[rgb(var(--border)/0.6)]">
      <div className="max-w-6xl mx-auto px-5 h-14 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2.5 group">
          <div className="h-7 w-7 rounded-lg icon-blue flex items-center justify-center shadow-glow">
            <GraduationCap className="h-4 w-4 text-white" />
          </div>
          <span className="font-bold text-[0.9rem] tracking-tight text-[rgb(var(--text))]">
            TutorPlatform
          </span>
        </Link>

        <nav className="hidden md:flex items-center gap-5 text-[0.82rem] text-[rgb(var(--text-2))]">
          <Link href="/#features" className="hover:text-[rgb(var(--text))] transition-colors">Возможности</Link>
          <Link href="/contacts"  className="hover:text-[rgb(var(--text))] transition-colors">Контакты</Link>
        </nav>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className={cn(
              'h-8 w-8 rounded-lg flex items-center justify-center relative',
              'text-[rgb(var(--text-2))] hover:text-[rgb(var(--text))]',
              'hover:bg-[rgb(var(--surface-2))] transition-all',
            )}
          >
            <Sun className="h-4 w-4 absolute dark:opacity-0 dark:scale-50 transition-all" />
            <Moon className="h-4 w-4 absolute opacity-0 scale-50 dark:opacity-100 dark:scale-100 transition-all" />
          </button>
          <Link href="/auth/login"><Button variant="outline" size="sm">Войти</Button></Link>
          <Link href="/auth/register"><Button size="sm">Начать</Button></Link>
        </div>
      </div>
    </header>
  );
}
