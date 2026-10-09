import Link from 'next/link';
import { Wordmark } from '@/components/layout/wordmark';

export function PublicFooter() {
  return (
    <footer className="mt-4 bg-[#64343C] text-[#FFF1E9]">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-5 py-10 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Wordmark className="text-[#FFF1E9]" />
          <p className="mt-2 max-w-xs text-sm text-[#FEEFDC]">
            Кабинет для занятий с репетитором: урок, доска, отчёт и домашнее задание.
          </p>
        </div>
        <div className="flex gap-8 text-sm">
          <div className="space-y-2">
            <p className="font-semibold">Сайт</p>
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
            <p className="font-semibold">Кабинет</p>
            <Link href="/auth/login" className="block text-[#FEEFDC] hover:text-[#FFF1E9]">
              Войти
            </Link>
            <Link href="/auth/register" className="block text-[#FEEFDC] hover:text-[#FFF1E9]">
              Регистрация
            </Link>
          </div>
        </div>
      </div>
      <div className="border-t border-[#9D7960] px-5 py-4 text-center text-xs text-[#FEEFDC]">
        © {new Date().getFullYear()} ТвойМатПлан
      </div>
    </footer>
  );
}
