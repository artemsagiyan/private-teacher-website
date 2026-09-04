'use client';

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="min-h-[50vh] flex flex-col items-center justify-center gap-3 p-8 text-center">
      <h1 className="text-xl font-semibold text-[rgb(var(--text))]">
        Что-то пошло не так
      </h1>
      <p className="text-sm text-[rgb(var(--text-2))] max-w-md">
        {error.message || 'Не удалось отобразить страницу.'}
      </p>
      <button
        type="button"
        onClick={reset}
        className="text-sm text-primary-600 hover:underline"
      >
        Попробовать снова
      </button>
    </div>
  );
}
