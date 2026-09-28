import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { PublicHeader } from '@/components/layout/public-header';
import { PublicFooter } from '@/components/layout/public-footer';
import { LandingShowcase } from '@/components/landing/showcase';

export default function LandingPage() {
  return (
    <div className="flex min-h-screen flex-col bg-[rgb(var(--bg))]">
      <PublicHeader />
      <LandingShowcase />

      <section className="px-5 pb-20">
        <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-6 rounded-3xl bg-[rgb(var(--sidebar-bg))] px-8 py-10 text-white sm:flex-row sm:items-center sm:px-12">
          <div>
            <h2 className="text-3xl text-white sm:text-4xl">Начните с одного слота</h2>
            <p className="mt-2 max-w-md text-sm text-white/65">
              Регистрация ученика занимает минуту. Преподавателю нужен код приглашения.
            </p>
          </div>
          <Link href="/auth/register">
            <Button size="lg" className="bg-white text-[rgb(var(--sidebar-bg))] hover:bg-white/90">
              Зарегистрироваться
            </Button>
          </Link>
        </div>
      </section>

      <PublicFooter />
    </div>
  );
}

