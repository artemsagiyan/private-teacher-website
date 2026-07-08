'use client';

import { useEffect, useState } from 'react';
import FullCalendar from '@fullcalendar/react';
import timeGridPlugin from '@fullcalendar/timegrid';
import ruLocale from '@fullcalendar/core/locales/ru';
import { api } from '@/lib/api';
import { CalendarSlot } from '@/types';
import { getSlotColor } from '@/lib/utils';

export default function AdminCalendarPage() {
  const [slots, setSlots] = useState<CalendarSlot[]>([]);

  useEffect(() => {
    api.get<CalendarSlot[]>('/calendar/all').then(setSlots);
  }, []);

  const events = slots.map((s) => ({
    id: s.id,
    title: [
      s.lessonType === 'individual' ? 'Инд.' : 'Гр.',
      s.isRecurring ? '↻' : '',
    ].filter(Boolean).join(' '),
    start: s.startTime,
    end: s.endTime,
    backgroundColor: getSlotColor(s.status),
    borderColor: 'transparent',
    textColor: '#fff',
  }));

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-[rgb(var(--text))] tracking-tight">Все занятия</h1>
        <p className="text-sm text-[rgb(var(--text-2))] mt-0.5">Сводный календарь платформы</p>
      </div>
      <div className="bg-[rgb(var(--surface))] rounded-2xl border border-[rgb(var(--border))] p-4 shadow-card">
        <FullCalendar
          plugins={[timeGridPlugin]}
          initialView="timeGridWeek"
          locale={ruLocale}
          firstDay={1}
          headerToolbar={{ left: 'prev,next today', center: 'title', right: '' }}
          buttonText={{ today: 'Сегодня' }}
          dayHeaderContent={(args) => {
            const wd = args.date.toLocaleDateString('ru', { weekday: 'short' }).toUpperCase();
            return { html: `<div class="cal-day-header"><span class="cal-weekday">${wd}</span><span class="cal-daynum${args.isToday ? ' cal-today' : ''}">${args.date.getDate()}</span></div>` };
          }}
          events={events}
          height="auto"
          slotMinTime="08:00:00"
          slotMaxTime="22:00:00"
          slotDuration="00:30:00"
          slotLabelInterval="01:00:00"
          allDaySlot={false}
          nowIndicator
        />
      </div>
    </div>
  );
}
