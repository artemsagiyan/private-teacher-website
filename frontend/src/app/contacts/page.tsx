import { PublicHeader } from '@/components/layout/public-header';
import { PublicFooter } from '@/components/layout/public-footer';
import { Mail, Send } from 'lucide-react';

export default function ContactsPage() {
  return (
    <div className="flex min-h-screen flex-col bg-[rgb(var(--bg))]">
      <PublicHeader />
      <main className="flex flex-1 items-center justify-center px-5 py-16">
        <div className="w-full max-w-lg rounded-3xl border border-[rgb(var(--border))] bg-[rgb(var(--surface))] p-8 shadow-card sm:p-10">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary-700 dark:text-primary-300">
            Связь
          </p>
          <h1 className="mt-3 text-4xl text-[rgb(var(--text))]">Контакты</h1>
          <p className="mb-8 mt-3 text-sm leading-relaxed text-[rgb(var(--text-2))]">
            Вопросы по занятиям, расписанию и платформе easyphys.ru — напишите
            напрямую.
          </p>
          <div className="space-y-3 text-sm">
            <a
              href="mailto:hello@easyphys.ru"
              className="flex items-center gap-3 rounded-xl border border-[rgb(var(--border))] px-4 py-3 text-[rgb(var(--text))] hover:bg-[rgb(var(--surface-2))]"
            >
              <Mail className="h-4 w-4 text-primary-700 dark:text-primary-300" />
              hello@easyphys.ru
            </a>
            <a
              href="https://t.me/easyphys"
              className="flex items-center gap-3 rounded-xl border border-[rgb(var(--border))] px-4 py-3 text-[rgb(var(--text))] hover:bg-[rgb(var(--surface-2))]"
              target="_blank"
              rel="noreferrer"
            >
              <Send className="h-4 w-4 text-primary-700 dark:text-primary-300" />
              Telegram
            </a>
          </div>
        </div>
      </main>
      <PublicFooter />
    </div>
  );
}
