import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { PublicHeader } from '@/components/layout/public-header';
import { PublicFooter } from '@/components/layout/public-footer';
import { LandingFaq } from '@/components/landing/faq';
import { LandingExperience } from '@/components/landing/experience';

export default function LandingPage() {
  return (
    <div className="flex min-h-screen flex-col bg-[#FEEFDC] text-[#64343C]">
      <PublicHeader />
      <LandingExperience />

      <section className="px-5 py-8">
        <div className="mx-auto max-w-6xl rounded-lg bg-[#FFF1E9] px-6 py-8 shadow-card sm:px-8">
          <h2 className="text-3xl font-normal sm:text-4xl">Частые вопросы</h2>
          <div className="mt-2">
            <LandingFaq />
          </div>
        </div>
      </section>

      <section className="px-5 py-10">
        <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-6 rounded-lg bg-[#3F1116] px-6 py-10 sm:flex-row sm:items-center sm:px-10">
          <div>
            <h2 className="text-3xl font-normal text-[#FFF1E9] sm:text-4xl">
              Начните с одного занятия
            </h2>
            <p className="mt-2 max-w-lg text-[#FEEFDC]">
              Ученик регистрируется сам. Преподавателю нужен код приглашения.
            </p>
          </div>
          <Link href="/auth/register">
            <Button variant="secondary" size="lg">Записаться</Button>
          </Link>
        </div>
      </section>

      <PublicFooter />
    </div>
  );
}
