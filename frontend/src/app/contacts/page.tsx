import { PublicHeader } from '@/components/layout/public-header';
import { Mail, Send } from 'lucide-react';

export default function ContactsPage() {
  return (
    <div className="min-h-screen flex flex-col bg-[rgb(var(--bg))]">
      <PublicHeader />
      <main className="flex-1 flex items-center justify-center p-8">
        <div className="max-w-lg w-full rounded-2xl border border-[rgb(var(--border))] bg-[rgb(var(--surface))] p-8 shadow-card">
          <h1 className="text-3xl font-bold mb-3 text-[rgb(var(--text))]">
            Контакты
          </h1>
          <p className="text-[rgb(var(--text-2))] mb-6 text-sm leading-relaxed">
            Вопросы по занятиям, расписанию и платформе easyphys.ru — напишите
            напрямую.
          </p>
          <div className="space-y-3 text-sm">
            <a
              href="mailto:hello@easyphys.ru"
              className="flex items-center gap-2 text-primary-600 dark:text-primary-400 hover:underline"
            >
              <Mail className="h-4 w-4" /> hello@easyphys.ru
            </a>
            <a
              href="https://t.me/easyphys"
              className="flex items-center gap-2 text-primary-600 dark:text-primary-400 hover:underline"
              target="_blank"
              rel="noreferrer"
            >
              <Send className="h-4 w-4" /> Telegram
            </a>
          </div>
        </div>
      </main>
    </div>
  );
}
