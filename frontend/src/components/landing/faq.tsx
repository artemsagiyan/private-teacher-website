'use client';

import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

const items = [
  {
    q: 'Сколько длится занятие?',
    a: 'Обычный слот — один час. Преподаватель может поставить и другую длину, если выделит её в календаре.',
  },
  {
    q: 'Что нужно для урока?',
    a: 'Браузер, камера и микрофон. Видео и доска открываются из кабинета, отдельная программа не нужна.',
  },
  {
    q: 'Куда приходит отчёт и домашнее задание?',
    a: 'Ученику — в кабинет и на почту. Если в профиле указана почта родителя, то же письмо уходит и туда.',
  },
  {
    q: 'Как отменить запись?',
    a: 'Ученик может отменить занятие не позже чем за 24 часа. Преподаватель отменяет слот в расписании.',
  },
];

export function LandingFaq() {
  const [open, setOpen] = useState(-1);

  return (
    <div className="divide-y divide-[rgb(var(--border))] border-y border-[rgb(var(--border))]">
      {items.map((item, index) => {
        const expanded = open === index;
        return (
          <div key={item.q}>
            <button
              type="button"
              className="flex w-full items-center justify-between gap-4 py-5 text-left"
              aria-expanded={expanded}
              onClick={() => setOpen(expanded ? -1 : index)}
            >
              <span className="text-lg font-semibold text-[rgb(var(--text))]">
                {item.q}
              </span>
              <ChevronDown
                className={cn(
                  'h-5 w-5 shrink-0 text-[rgb(var(--text-3))] transition-transform',
                  expanded && 'rotate-180',
                )}
              />
            </button>
            {expanded && (
              <p className="max-w-3xl pb-5 text-base leading-7 text-[rgb(var(--text-2))]">
                {item.a}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}
