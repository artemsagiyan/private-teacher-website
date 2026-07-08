import { PublicHeader } from '@/components/layout/public-header';

export default function ContactsPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <PublicHeader />
      <main className="flex-1 flex items-center justify-center p-8">
        <div className="max-w-lg text-center">
          <h1 className="text-3xl font-bold mb-4 dark:text-white">Контакты</h1>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            Если у вас есть вопросы или предложения, свяжитесь с нами.
          </p>
          <p className="text-primary-600 dark:text-primary-400">support@tutor-platform.com</p>
        </div>
      </main>
    </div>
  );
}
