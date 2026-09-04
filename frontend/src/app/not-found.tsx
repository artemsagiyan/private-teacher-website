import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-[50vh] flex flex-col items-center justify-center gap-3 p-8 text-center">
      <h1 className="text-xl font-semibold">Страница не найдена</h1>
      <Link href="/" className="text-sm text-primary-600 hover:underline">
        На главную
      </Link>
    </div>
  );
}
