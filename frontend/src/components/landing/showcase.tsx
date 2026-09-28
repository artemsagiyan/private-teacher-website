'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  Bell,
  BookOpen,
  Calendar,
  Check,
  PenLine,
  Shield,
  Users,
  Video,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type Role = 'student' | 'teacher';
type Scene = 'schedule' | 'lesson' | 'report';

const SLOTS = ['08:00', '18:00', '19:00'] as const;

const steps = [
  {
    n: '01',
    scene: 'schedule' as const,
    title: 'Открываете слот',
    desc: 'Преподаватель отмечает свободное время. Одиночное занятие или серия на несколько недель.',
  },
  {
    n: '02',
    scene: 'schedule' as const,
    title: 'Ученик записывается',
    desc: 'В календаре видно, куда можно попасть. Напоминание приходит за сутки и за час.',
  },
  {
    n: '03',
    scene: 'lesson' as const,
    title: 'Урок и отчёт',
    desc: 'Видео и доска открываются из карточки занятия. После урока остаётся история.',
  },
];

const features = [
  {
    icon: Calendar,
    iconBg: 'icon-blue',
    title: 'Календарь',
    desc: 'Слоты, серии и отмена без переписки. Ученик видит только своего преподавателя.',
    detail: 'Нажмите время в карточке справа — слот сразу меняет статус.',
  },
  {
    icon: Video,
    iconBg: 'icon-cyan',
    title: 'Видеовстреча',
    desc: 'Вход открывается перед началом и остаётся доступным, пока урок идёт.',
    detail: 'Переключите карточку на «Урок»: видео и доска в одном окне.',
  },
  {
    icon: BookOpen,
    iconBg: 'icon-green',
    title: 'Доска и материалы',
    desc: 'Общая доска сохраняется вместе с уроком, а не в отдельном сервисе.',
    detail: 'После занятия рисунок не пропадает — он остаётся в истории урока.',
  },
  {
    icon: Bell,
    iconBg: 'icon-orange',
    title: 'Напоминания',
    desc: 'Письмо и уведомление в кабинете, чтобы занятие не потерялось.',
    detail: 'За сутки и за час. Повторно одно и то же письмо не уходит.',
  },
  {
    icon: Users,
    iconBg: 'icon-violet',
    title: 'Ученики',
    desc: 'Привязка по коду, список учеников и их записи у преподавателя.',
    detail: 'Переключите роль на «Преподаватель» и откройте свободный час.',
  },
  {
    icon: Shield,
    iconBg: 'icon-red',
    title: 'Роли',
    desc: 'Ученик, преподаватель и администратор видят только свои разделы.',
    detail: 'Один и тот же слот выглядит по-разному для ученика и преподавателя.',
  },
];

export function LandingShowcase() {
  const [role, setRole] = useState<Role>('student');
  const [scene, setScene] = useState<Scene>('schedule');
  const [opened, setOpened] = useState<string>('18:00');
  const [booked, setBooked] = useState<string | null>(null);
  const [step, setStep] = useState(1);
  const [feature, setFeature] = useState<number | null>(null);
  const [notice, setNotice] = useState('Выберите время, чтобы записаться');

  const onSlot = (time: string) => {
    setScene('schedule');
    if (role === 'teacher') {
      setOpened(time);
      setNotice(`Слот ${time} открыт для записи`);
      setStep(0);
      return;
    }
    if (time !== opened) {
      setNotice('Это время ещё не открыто');
      return;
    }
    setBooked((current) => {
      const next = current === time ? null : time;
      setNotice(next ? `Вы записаны на ${time}` : 'Запись снята');
      return next;
    });
    setStep(1);
  };

  const showScene = (next: Scene, nextStep: number) => {
    setScene(next);
    setStep(nextStep);
    if (next === 'lesson') setNotice('Урок открыт: видео и доска');
    if (next === 'report') setNotice('Отчёт сохранился в истории');
    if (next === 'schedule') {
      setNotice(
        role === 'teacher'
          ? 'Отметьте час, который отдаёте ученикам'
          : 'Выберите открытое время',
      );
    }
  };

  return (
    <>
      <section className="relative overflow-hidden border-b border-[rgb(var(--border))]">
        <div className="pointer-events-none absolute inset-0 bg-grid-pattern bg-[size:28px_28px] opacity-70" />
        <div className="relative mx-auto grid max-w-6xl items-center gap-14 px-5 py-16 sm:py-24 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="animate-fade-in">
            <p className="mb-5 text-xs font-semibold uppercase tracking-[0.18em] text-primary-700 dark:text-primary-300">
              Кабинет репетитора
            </p>
            <h1 className="max-w-xl text-5xl leading-[1.05] text-[rgb(var(--text))] sm:text-6xl">
              Занятие, расписание и отчёт — в одном месте
            </h1>
            <p className="mt-6 max-w-lg text-base leading-relaxed text-[rgb(var(--text-2))] sm:text-lg">
              Попробуйте карточку справа: откройте слот, запишитесь и перейдите
              в урок. Так же устроен настоящий кабинет.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link href="/auth/register">
                <Button size="xl" className="w-full sm:w-auto">
                  Создать аккаунт
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                </Button>
              </Link>
              <Link href="/auth/login">
                <Button size="xl" variant="outline" className="w-full sm:w-auto">
                  Войти
                </Button>
              </Link>
            </div>
          </div>

          <div className="relative">
            <div className="rounded-3xl border border-[rgb(var(--border))] bg-[rgb(var(--surface))] p-4 shadow-card transition-shadow duration-300 hover:shadow-card-hover sm:p-5">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div
                  className="inline-flex rounded-full border border-[rgb(var(--border))] bg-[rgb(var(--surface-2))] p-1"
                  role="tablist"
                  aria-label="Роль в демо"
                >
                  {(
                    [
                      ['student', 'Ученик'],
                      ['teacher', 'Преподаватель'],
                    ] as const
                  ).map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      role="tab"
                      aria-selected={role === value}
                      onClick={() => {
                        setRole(value);
                        setBooked(null);
                        setNotice(
                          value === 'teacher'
                            ? 'Отметьте час, который отдаёте ученикам'
                            : 'Выберите открытое время',
                        );
                        setScene('schedule');
                        setStep(value === 'teacher' ? 0 : 1);
                      }}
                      className={cn(
                        'rounded-full px-3 py-1 text-xs font-medium transition-all',
                        role === value
                          ? 'bg-[rgb(var(--surface))] text-[rgb(var(--text))] shadow-sm'
                          : 'text-[rgb(var(--text-3))] hover:text-[rgb(var(--text))]',
                      )}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <div className="inline-flex rounded-full border border-[rgb(var(--border))] p-1 text-xs">
                  {(
                    [
                      ['schedule', 'Слоты'],
                      ['lesson', 'Урок'],
                      ['report', 'Отчёт'],
                    ] as const
                  ).map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() =>
                        showScene(value, value === 'schedule' ? (role === 'teacher' ? 0 : 1) : 2)
                      }
                      className={cn(
                        'rounded-full px-2.5 py-1 transition-colors',
                        scene === value
                          ? 'bg-primary-700 text-white'
                          : 'text-[rgb(var(--text-2))] hover:text-[rgb(var(--text))]',
                      )}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              <p
                className="mb-3 min-h-5 text-sm text-[rgb(var(--text-2))] transition-opacity"
                aria-live="polite"
              >
                {notice}
              </p>

              {scene === 'schedule' && (
                <div className="grid grid-cols-3 gap-2 animate-fade-in">
                  {SLOTS.map((time) => {
                    const isOpen = opened === time;
                    const isBooked = booked === time;
                    const label =
                      role === 'teacher'
                        ? isOpen
                          ? 'Открыт'
                          : 'Закрыт'
                        : isBooked
                          ? 'Ваша запись'
                          : isOpen
                            ? 'Свободно'
                            : 'Закрыт';
                    return (
                      <button
                        key={time}
                        type="button"
                        onClick={() => onSlot(time)}
                        className={cn(
                          'rounded-xl border px-2 py-4 text-center transition-all duration-200',
                          'hover:-translate-y-0.5 hover:shadow-card active:translate-y-0',
                          isBooked
                            ? 'border-primary-700 bg-primary-700 text-white'
                            : isOpen
                              ? 'border-primary-300 bg-primary-50 text-primary-900 dark:border-primary-700 dark:bg-primary-900/30 dark:text-primary-100'
                              : 'border-[rgb(var(--border))] bg-[rgb(var(--surface))] text-[rgb(var(--text))] hover:border-primary-300',
                        )}
                      >
                        <p className="text-sm font-medium">{time}</p>
                        <p className={cn('mt-1 text-[11px]', isBooked ? 'text-white/80' : 'text-[rgb(var(--text-3))]')}>
                          {label}
                        </p>
                      </button>
                    );
                  })}
                </div>
              )}

              {scene === 'lesson' && (
                <div className="grid gap-2 animate-fade-in sm:grid-cols-[1.1fr_0.9fr]">
                  <div className="relative overflow-hidden rounded-2xl bg-[rgb(var(--sidebar-bg))] p-4 text-white">
                    <span className="absolute right-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-white/10 px-2 py-1 text-[10px] uppercase tracking-wider">
                      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-red-400" />
                      В эфире
                    </span>
                    <Video className="mt-8 h-8 w-8 text-white/80" />
                    <p className="mt-3 font-display text-2xl">Физика</p>
                    <p className="text-xs text-white/60">
                      {booked ? `${booked} · вы в уроке` : '18:00 · механика'}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-[rgb(var(--border))] bg-[rgb(var(--surface-2))] p-3">
                    <div className="mb-2 flex items-center gap-1.5 text-xs text-[rgb(var(--text-2))]">
                      <PenLine className="h-3.5 w-3.5" /> Доска
                    </div>
                    <svg viewBox="0 0 160 120" className="h-28 w-full">
                      <path
                        d="M12 78 C40 20, 70 100, 100 48 S140 30, 150 62"
                        fill="none"
                        stroke="rgb(20 99 92)"
                        strokeWidth="3"
                        strokeLinecap="round"
                        className="motion-safe:animate-dash"
                        style={{ strokeDasharray: 220 }}
                      />
                      <circle cx="100" cy="48" r="4" fill="rgb(20 99 92)" />
                    </svg>
                  </div>
                </div>
              )}

              {scene === 'report' && (
                <ul className="space-y-2 animate-fade-in">
                  {[
                    'Разобрали силы и ускорение',
                    'Домашнее: задачи 12–15',
                    'Запись и доска сохранены',
                  ].map((line, index) => (
                    <li
                      key={line}
                      className="flex items-center gap-3 rounded-xl border border-[rgb(var(--border))] px-3 py-3 text-sm text-[rgb(var(--text))]"
                      style={{ animationDelay: `${index * 80}ms` }}
                    >
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary-700 text-white">
                        <Check className="h-3.5 w-3.5" />
                      </span>
                      {line}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      </section>

      <section id="how" className="border-b border-[rgb(var(--border))] px-5 py-20">
        <div className="mx-auto max-w-6xl">
          <h2 className="text-4xl text-[rgb(var(--text))]">Как проходит занятие</h2>
          <p className="mt-3 text-sm text-[rgb(var(--text-2))]">
            Нажмите шаг — карточка сверху покажет этот момент.
          </p>
          <div className="mt-10 grid gap-4 md:grid-cols-3">
            {steps.map((item, index) => {
              const active = step === index;
              return (
                <button
                  key={item.n}
                  type="button"
                  onClick={() => {
                    if (index === 0) {
                      setRole('teacher');
                      setBooked(null);
                      setScene('schedule');
                      setNotice('Отметьте час, который отдаёте ученикам');
                    } else if (index === 1) {
                      setRole('student');
                      setBooked(opened);
                      setScene('schedule');
                      setNotice(`Вы записаны на ${opened}`);
                    } else {
                      setScene('lesson');
                      setNotice('Урок открыт: видео и доска');
                    }
                    setStep(index);
                  }}
                  className={cn(
                    'rounded-2xl border p-6 text-left transition-all duration-200',
                    'hover:-translate-y-0.5 hover:shadow-card',
                    active
                      ? 'border-primary-600 bg-[rgb(var(--surface))] shadow-card'
                      : 'border-[rgb(var(--border))] bg-transparent',
                  )}
                >
                  <p className="font-display text-3xl text-primary-700 dark:text-primary-300">
                    {item.n}
                  </p>
                  <h3 className="mt-3 font-sans text-base font-semibold text-[rgb(var(--text))]">
                    {item.title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-[rgb(var(--text-2))]">
                    {item.desc}
                  </p>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      <section id="features" className="px-5 py-20">
        <div className="mx-auto max-w-6xl">
          <div className="mb-12 max-w-xl">
            <h2 className="text-4xl text-[rgb(var(--text))]">Что есть в кабинете</h2>
            <p className="mt-3 text-sm leading-relaxed text-[rgb(var(--text-2))]">
              Нажмите карточку, чтобы раскрыть, как это работает.
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {features.map((item, index) => {
              const open = feature === index;
              return (
                <button
                  key={item.title}
                  type="button"
                  onClick={() => setFeature(open ? null : index)}
                  aria-expanded={open}
                  className={cn(
                    'rounded-2xl border border-[rgb(var(--border))] bg-[rgb(var(--surface))] p-6 text-left shadow-card transition-all duration-200',
                    'hover:-translate-y-1 hover:shadow-card-hover',
                    open && 'border-primary-600',
                  )}
                >
                  <div className={`mb-4 flex h-10 w-10 items-center justify-center rounded-xl ${item.iconBg}`}>
                    <item.icon className="h-5 w-5 text-white" />
                  </div>
                  <h3 className="font-sans text-[0.95rem] font-semibold text-[rgb(var(--text))]">
                    {item.title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-[rgb(var(--text-2))]">
                    {item.desc}
                  </p>
                  <p
                    className={cn(
                      'grid text-sm leading-relaxed text-primary-800 transition-all dark:text-primary-200',
                      open ? 'mt-3 grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0',
                    )}
                  >
                    <span className="overflow-hidden">{item.detail}</span>
                  </p>
                </button>
              );
            })}
          </div>
        </div>
      </section>
    </>
  );
}
