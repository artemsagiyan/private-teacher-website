import Link from 'next/link';
import { Wordmark } from '@/components/layout/wordmark';

export function PublicFooter() {
  return (
    <footer className="relative mt-10 overflow-hidden bg-[#3F1116] text-[#FFF1E9]">
      <div className="relative mx-auto flex max-w-7xl flex-col gap-10 px-5 py-14 lg:flex-row lg:items-start lg:justify-between lg:px-8">
        <div>
          <Wordmark className="text-lg text-[#FFF1E9]" />
          <p className="mt-3 max-w-xs text-sm leading-6 text-[#FEEFDC]/75">
            Кабинет для занятий с репетитором: урок, доска, отчёт и домашнее задание.
          </p>
        </div>
        <div className="flex gap-14 text-sm">
          <div className="space-y-2">
            <p className="mb-3 text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-[#9D7960]">Сайт</p>
            <Link href="/#how" className="block text-[#FEEFDC] hover:text-[#FFF1E9]">
              Как проходит занятие
            </Link>
            <Link href="/#features" className="block text-[#FEEFDC] hover:text-[#FFF1E9]">
              Что входит
            </Link>
            <Link href="/contacts" className="block text-[#FEEFDC] hover:text-[#FFF1E9]">
              Контакты
            </Link>
          </div>
          <div className="space-y-2">
            <p className="mb-3 text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-[#9D7960]">Кабинет</p>
            <Link href="/auth/login" className="block text-[#FEEFDC] hover:text-[#FFF1E9]">
              Войти
            </Link>
            <Link href="/auth/register" className="block text-[#FEEFDC] hover:text-[#FFF1E9]">
              Регистрация
            </Link>
          </div>
        </div>
      </div>
      <div className="relative border-t border-[#9D7960]/30 px-5 py-5 text-center text-xs text-[#FEEFDC]/60">
        © {new Date().getFullYear()} ТвойМатПлан
      </div>
    </footer>
  );
}
