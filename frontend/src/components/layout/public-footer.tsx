import Link from 'next/link';
import { Wordmark } from '@/components/layout/wordmark';

export function PublicFooter() {
  return (
    <footer className="mt-4 bg-[#FEF7FF]">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-5 py-10 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Wordmark />
          <p className="mt-2 max-w-xs text-sm text-[rgb(var(--text-3))]">
            Кабинет для занятий с репетитором: урок, доска, отчёт и домашнее задание.
          </p>
        </div>
        <div className="flex gap-8 text-sm">
          <div className="space-y-2">
            <p className="font-semibold">Сайт</p>
            <Link href="/#how" className="block text-[rgb(var(--text-2))] hover:text-[rgb(var(--text))]">
              Как проходит занятие
            </Link>
            <Link href="/#features" className="block text-[rgb(var(--text-2))] hover:text-[rgb(var(--text))]">
              Что входит
            </Link>
            <Link href="/contacts" className="block text-[rgb(var(--text-2))] hover:text-[rgb(var(--text))]">
              Контакты
            </Link>
          </div>
          <div className="space-y-2">
            <p className="font-semibold">Кабинет</p>
            <Link href="/auth/login" className="block text-[rgb(var(--text-2))] hover:text-[rgb(var(--text))]">
              Войти
            </Link>
            <Link href="/auth/register" className="block text-[rgb(var(--text-2))] hover:text-[rgb(var(--text))]">
              Регистрация
            </Link>
          </div>
        </div>
      </div>
      <div className="border-t border-[rgb(var(--border))] px-5 py-4 text-center text-xs text-[rgb(var(--text-3))]">
        © {new Date().getFullYear()} ТвойМатПлан
      </div>
    </footer>
  );
}
