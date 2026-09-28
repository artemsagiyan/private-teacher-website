import Link from 'next/link';

export function PublicFooter() {
  return (
    <footer className="border-t border-[rgb(var(--border))]">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-5 py-8 text-sm text-[rgb(var(--text-3))] sm:flex-row sm:items-center sm:justify-between">
        <p>© {new Date().getFullYear()} TutorPlatform</p>
        <div className="flex gap-5">
          <Link href="/#features" className="hover:text-[rgb(var(--text))]">
            Возможности
          </Link>
          <Link href="/contacts" className="hover:text-[rgb(var(--text))]">
            Контакты
          </Link>
          <Link href="/auth/login" className="hover:text-[rgb(var(--text))]">
            Войти
          </Link>
        </div>
      </div>
    </footer>
  );
}
