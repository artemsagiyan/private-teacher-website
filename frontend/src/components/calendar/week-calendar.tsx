'use client';

import { useEffect, useRef, useState } from 'react';
import FullCalendar from '@fullcalendar/react';
import timeGridPlugin from '@fullcalendar/timegrid';
import dayGridPlugin from '@fullcalendar/daygrid';
import interactionPlugin from '@fullcalendar/interaction';
import ruLocale from '@fullcalendar/core/locales/ru';
import type {
  DateSelectArg,
  EventClickArg,
  EventInput,
} from '@fullcalendar/core';
import { CAL_SLOT_MAX, CAL_SLOT_MIN } from '@/lib/lesson';
import { Segmented } from '@/components/ui/segmented';
import { cn } from '@/lib/utils';

export type CalendarView = 'timeGridWeek' | 'timeGridDay';

type Props = {
  events: EventInput[];
  onEventClick?: (info: EventClickArg) => void;
  onDateSelect?: (info: DateSelectArg) => void;
  selectable?: boolean;
  className?: string;
  initialView?: CalendarView;
};

function dayHeaderContent(args: { date: Date; isToday: boolean }) {
  const wd = args.date
    .toLocaleDateString('ru', { weekday: 'short' })
    .toUpperCase();
  return {
    html: `<div class="cal-day-header"><span class="cal-weekday">${wd}</span><span class="cal-daynum${args.isToday ? ' cal-today' : ''}">${args.date.getDate()}</span></div>`,
  };
}

export function WeekCalendar({
  events,
  onEventClick,
  onDateSelect,
  selectable = false,
  className,
  initialView = 'timeGridWeek',
}: Props) {
  const calendarRef = useRef<FullCalendar | null>(null);
  const [view, setView] = useState<CalendarView>(initialView);
  const [narrow, setNarrow] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 768px)');
    const apply = () => {
      const isNarrow = mq.matches;
      setNarrow(isNarrow);
      const next: CalendarView = isNarrow ? 'timeGridDay' : 'timeGridWeek';
      setView(next);
      calendarRef.current?.getApi().changeView(next);
    };
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, []);

  const changeView = (next: CalendarView) => {
    setView(next);
    calendarRef.current?.getApi().changeView(next);
  };

  return (
    <div
      className={cn(
        'rounded-2xl border border-[rgb(var(--border))] bg-[rgb(var(--surface))] p-3 shadow-card sm:p-4',
        className,
      )}
    >
      <div className="mb-3 flex items-center justify-end md:hidden">
        <Segmented
          size="sm"
          value={view}
          onChange={changeView}
          options={[
            { value: 'timeGridDay', label: 'День' },
            { value: 'timeGridWeek', label: 'Неделя' },
          ]}
        />
      </div>

      <FullCalendar
        ref={calendarRef}
        plugins={[timeGridPlugin, dayGridPlugin, interactionPlugin]}
        initialView={narrow ? 'timeGridDay' : initialView}
        locale={ruLocale}
        firstDay={1}
        headerToolbar={{
          left: 'prev,next today',
          center: 'title',
          right: narrow ? '' : 'timeGridDay,timeGridWeek',
        }}
        buttonText={{
          today: 'Сегодня',
          week: 'Неделя',
          day: 'День',
        }}
        dayHeaderContent={dayHeaderContent}
        events={events}
        eventClick={onEventClick}
        selectable={selectable}
        selectMirror={selectable}
        select={onDateSelect}
        height="auto"
        slotMinTime={CAL_SLOT_MIN}
        slotMaxTime={CAL_SLOT_MAX}
        slotDuration="00:30:00"
        slotLabelInterval="01:00:00"
        allDaySlot={false}
        nowIndicator
        longPressDelay={200}
        eventDisplay="block"
      />
    </div>
  );
}
