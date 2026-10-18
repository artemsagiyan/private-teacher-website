import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { PublicHeader } from '@/components/layout/public-header';
import { PublicFooter } from '@/components/layout/public-footer';
import { LandingFaq } from '@/components/landing/faq';
import { LandingExperience } from '@/components/landing/experience';

export default function LandingPage() {
  return (
    <div className="flex min-h-screen flex-col overflow-hidden bg-[#FEEFDC] text-[#3F1116]">
      <PublicHeader />
      <LandingExperience />

      <section className="px-5 py-8">
        <div className="mx-auto max-w-7xl rounded-3xl border border-[rgb(var(--border-sub))] bg-[#FFF1E9]/75 px-6 py-10 shadow-card sm:px-10 lg:px-14">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#9D7960]">FAQ</p>
          <h2 className="mt-3 text-3xl font-semibold sm:text-4xl">Всё, чтобы спокойно начать</h2>
          <div className="mt-2">
            <LandingFaq />
          </div>
        </div>
      </section>

      <section className="px-5 py-10">
        <div className="relative mx-auto flex max-w-7xl flex-col items-start justify-between gap-8 overflow-hidden rounded-3xl bg-[#3F1116] px-6 py-12 shadow-[0_18px_55px_rgb(63_17_22/0.24)] sm:flex-row sm:items-center sm:px-12">
          <div>
            <h2 className="relative text-3xl font-semibold tracking-[-0.04em] text-[#FFF1E9] sm:text-4xl">
              Начните с одного занятия
            </h2>
            <p className="relative mt-3 max-w-lg leading-6 text-[#FEEFDC]/75">
              Ученик регистрируется сам. Преподавателю нужен код приглашения.
            </p>
          </div>
          <Link href="/auth/register">
            <Button variant="secondary" size="lg" className="relative">Записаться</Button>
          </Link>
        </div>
      </section>

      <PublicFooter />
    </div>
  );
}
