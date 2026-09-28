'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Menu, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Wordmark } from '@/components/layout/wordmark';

export function PublicHeader() {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 bg-[#FEF7FF]/90 shadow-[0_1px_2px_rgba(0,0,0,0.08)] backdrop-blur">
      <div className="mx-auto flex h-[72px] max-w-6xl items-center justify-between px-5">
        <Link href="/" className="flex items-center gap-2.5">
          <img src="/swan.png" alt="" className="h-10 w-10 object-contain" />
          <Wordmark className="text-lg" />
        </Link>

        <nav className="hidden md:flex items-center gap-6 text-sm text-[rgb(var(--text-2))]">
          <Link href="/#how" className="hover:text-[rgb(var(--text))] transition-colors">
            Как это работает
          </Link>
          <Link href="/#features" className="hover:text-[rgb(var(--text))] transition-colors">
            Возможности
          </Link>
          <Link href="/contacts" className="hover:text-[rgb(var(--text))] transition-colors">
            Контакты
          </Link>
        </nav>

        <div className="flex items-center gap-2">
          <button
            type="button"
            className="md:hidden h-8 w-8 rounded-lg flex items-center justify-center text-[rgb(var(--text-2))]"
            aria-label="Открыть меню"
            onClick={() => setOpen(true)}
          >
            <Menu className="h-5 w-5" />
          </button>
          <Link href="/auth/login" className="hidden sm:block">
            <Button variant="outline" size="sm">
              Войти
            </Button>
          </Link>
          <Link href="/auth/register" className="hidden sm:block">
            <Button size="sm">Записаться</Button>
          </Link>
        </div>
      </div>

      {open && (
        <div className="md:hidden border-t border-[rgb(var(--border))] bg-[rgb(var(--surface))] px-5 py-4 space-y-3">
          <div className="flex justify-end">
            <button type="button" aria-label="Закрыть" onClick={() => setOpen(false)}>
              <X className="h-5 w-5 text-[rgb(var(--text-2))]" />
            </button>
          </div>
          <Link href="/#how" onClick={() => setOpen(false)} className="block text-sm">
            Как это работает
          </Link>
          <Link href="/#features" onClick={() => setOpen(false)} className="block text-sm">
            Возможности
          </Link>
          <Link href="/contacts" onClick={() => setOpen(false)} className="block text-sm">
            Контакты
          </Link>
          <Link href="/auth/login" onClick={() => setOpen(false)} className="block text-sm">
            Войти
          </Link>
          <Link href="/auth/register" onClick={() => setOpen(false)} className="block text-sm font-medium">
            Регистрация
          </Link>
        </div>
      )}
    </header>
  );
}
