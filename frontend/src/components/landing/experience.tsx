'use client';

import { useRef, useState, type PointerEvent, type ReactNode } from 'react';
import Link from 'next/link';
import {
  BookOpen,
  Calendar,
  ClipboardList,
  Mail,
  PenLine,
  Video,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type Scene = 'calendar' | 'board' | 'lesson' | 'report' | 'homework' | 'practice';

const PENS = ['#6750A4', '#1D1B20', '#B3261E'];

const scenes: { id: Scene; title: string }[] = [
  { id: 'calendar', title: 'Своё расписание' },
  { id: 'board', title: 'Общая доска' },
  { id: 'lesson', title: 'Урок' },
  { id: 'report', title: 'Отчёт' },
  { id: 'homework', title: 'Домашнее задание' },
  { id: 'practice', title: 'Что решать' },
];

const lessonHints = [
  { task: 'x² − 9 = 0', hint: 'Перенести 9 и извлечь корень. Не забыть оба знака.' },
  { task: 'x² − 5x = 0', hint: 'Вынести x за скобку. Один корень равен нулю.' },
  { task: 'x² − 7x + 12 = 0', hint: 'Два числа в сумме 7 и в произведении 12: это 3 и 4.' },
  { task: 'x² + 6x + 5 = 0', hint: 'Корни отрицательные: их сумма −6, произведение 5.' },
  { task: '2x² − 7x + 3 = 0', hint: 'Дискриминант 49 − 24. Коэффициент при x² остаётся в знаменателе.' },
  { task: '2x² − 5x − 3 = 0', hint: 'Дискриминант 25 + 24. В ответ записать только больший корень.' },
];

const homeworkTasks = [
  'Решите уравнение: x² − 9 = 0.',
  'Решите уравнение: x² − 5x = 0.',
  'Решите уравнение: x² − 7x + 12 = 0.',
  'Решите уравнение: x² + 6x + 5 = 0.',
  'Решите уравнение: 2x² − 7x + 3 = 0.',
  'Найдите больший корень уравнения: 2x² − 5x − 3 = 0.',
];

export function LandingExperience() {
  const glow = useRef<HTMLDivElement>(null);
  const [scene, setScene] = useState<Scene>('calendar');
  const [pen, setPen] = useState(PENS[0]);
  const [strokes, setStrokes] = useState(0);

  const open = (next: Scene) => {
    setScene(next);
  };

  return (
    <div
      className="relative"
      onMouseMove={(event) => {
        const host = event.currentTarget.getBoundingClientRect();
        const node = glow.current;
        if (!node) return;
        node.style.transform = `translate(${event.clientX - host.left - 180}px, ${event.clientY - host.top - 180}px)`;
      }}
    >
      <div
        ref={glow}
        className="pointer-events-none absolute left-0 top-0 z-0 h-[360px] w-[360px] rounded-full bg-[#6750A4]/10 blur-3xl"
        aria-hidden
      />

      <section className="relative z-10 mx-auto grid w-full max-w-6xl items-start gap-10 px-5 py-12 lg:grid-cols-[0.9fr_1.1fr] lg:py-16">
        <div>
          <p className="text-sm font-medium text-[#6750A4]">Онлайн-занятия с репетитором</p>
          <h1 className="mt-3 max-w-xl text-4xl font-normal leading-[1.15] sm:text-5xl">
            Урок, доска и отчёт родителям — в одном кабинете
          </h1>
          <p className="mt-5 max-w-lg text-base leading-7 text-[#49454F]">
            Ученик записывается на свободное время. На доске можно рисовать сразу, расписание показывает занятую неделю.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link href="/auth/register">
              <Button size="xl" className="w-full sm:w-auto">Записаться</Button>
            </Link>
            <Link href="/auth/login">
              <Button size="xl" variant="outline" className="w-full sm:w-auto">Войти</Button>
            </Link>
          </div>
        </div>

        <Stage
          scene={scene}
          setScene={open}
          pen={pen}
          setPen={setPen}
          onStroke={() => setStrokes((value) => value + 1)}
          onClear={() => setStrokes(0)}
        />
      </section>

      <section id="features" className="relative z-10 px-5 pb-8">
        <div className="mx-auto max-w-6xl">
          <h2 className="max-w-xl text-3xl font-normal sm:text-4xl">
            Карточки открывают кабинет сверху
          </h2>
          <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <button type="button" onClick={() => open('calendar')} className={cardClass(scene === 'calendar')}>
              <IconTile><Calendar className="h-5 w-5" /></IconTile>
              <h3 className="mt-4 text-lg font-medium">Своё расписание</h3>
              <img src="/calendar-week.png" alt="Заполненная неделя: алгебра, физика и геометрия" className="mt-4 w-full rounded-lg" />
            </button>
            <div className={cardClass(scene === 'board')}>
              <button type="button" onClick={() => open('board')} className="text-left">
                <IconTile><PenLine className="h-5 w-5" /></IconTile>
                <h3 className="mt-4 text-lg font-medium">Общая доска</h3>
                <p className="mt-1 text-sm leading-6 text-[#49454F]">Штрихов на доске: {strokes}.</p>
              </button>
              <div className="mt-4 flex gap-2">
                {PENS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    aria-label={`Цвет ${color}`}
                    onClick={() => {
                      open('board');
                      setPen(color);
                    }}
                    className={cn('h-8 w-8 rounded-lg border-2', pen === color ? 'border-[#1D1B20]' : 'border-transparent')}
                    style={{ background: color }}
                  />
                ))}
              </div>
            </div>
            <button type="button" onClick={() => open('lesson')} className={cardClass(scene === 'lesson')}>
              <IconTile><Video className="h-5 w-5" /></IconTile>
              <h3 className="mt-4 text-lg font-medium">Урок один на один</h3>
              <img src="/lesson-cats.png" alt="Два кота на видеосвязи: один говорит «смотри», второй отвечает «ага»" className="mt-4 w-full rounded-lg" />
            </button>
            <button type="button" onClick={() => open('report')} className={cardClass(scene === 'report')}>
              <IconTile><ClipboardList className="h-5 w-5" /></IconTile>
              <h3 className="mt-4 text-lg font-medium">Отчёт после занятия</h3>
              <p className="mt-1 text-sm leading-6 text-[#49454F]">Пример: алгебра, 1 октября. Квадратные уравнения и теорема Пифагора.</p>
            </button>
            <button type="button" onClick={() => open('homework')} className={cardClass(scene === 'homework')}>
              <IconTile><Mail className="h-5 w-5" /></IconTile>
              <h3 className="mt-4 text-lg font-medium">Домашнее задание</h3>
              <p className="mt-1 text-sm leading-6 text-[#49454F]">ОГЭ, квадратные уравнения: от неполного к уравнению с коэффициентом.</p>
            </button>
            <button type="button" onClick={() => open('practice')} className={cardClass(scene === 'practice')}>
              <IconTile><BookOpen className="h-5 w-5" /></IconTile>
              <h3 className="mt-4 text-lg font-medium">Что решать на уроке</h3>
              <ul className="mt-3 space-y-2">
                {lessonHints.slice(0, 3).map((item) => (
                  <li key={item.task} className="text-sm leading-5 text-[#49454F]">
                    <span className="font-medium text-[#1D1B20]">{item.task}.</span> {item.hint}
                  </li>
                ))}
              </ul>
            </button>
          </div>
        </div>
      </section>

      <section id="how" className="relative z-10 px-5 py-10">
        <div className="mx-auto grid max-w-6xl gap-8 lg:grid-cols-[0.8fr_1.2fr]">
          <h2 className="text-3xl font-normal sm:text-4xl">Как проходит занятие</h2>
          <ol className="space-y-3">
            {([
              { n: '1', title: 'Преподаватель открывает время', text: 'В календаре появляется слот. Ученик видит только своего преподавателя.' },
              { n: '2', title: 'Ученик записывается и заходит в урок', text: 'Напоминание приходит за сутки и за час. Видео и доска открываются из кабинета.' },
              { n: '3', title: 'После урока уходит отчёт', text: 'Итоги и домашнее задание приходят ученику. Если указана почта родителя — и ему.' },
            ]).map(({ n, title, text }) => (
              <li key={n} className="flex gap-4 rounded-lg bg-white p-5 shadow-card">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#E8DEF8] text-sm font-medium text-[#1D192B]">
                  {n}
                </span>
                <span>
                  <span className="block text-base font-medium">{title}</span>
                  <span className="mt-1 block text-sm leading-6 text-[#49454F]">{text}</span>
                </span>
              </li>
            ))}
          </ol>
        </div>
      </section>
    </div>
  );
}

function Stage({
  scene,
  setScene,
  pen,
  setPen,
  onStroke,
  onClear,
}: {
  scene: Scene;
  setScene: (scene: Scene) => void;
  pen: string;
  setPen: (pen: string) => void;
  onStroke: () => void;
  onClear: () => void;
}) {
  return (
    <div id="stage" className="overflow-hidden rounded-lg bg-white shadow-card">
      <div className="flex items-center gap-3 border-b border-[#E7E0EC] px-4 py-3">
        <img src="/swan.png" alt="" className="h-9 w-9 object-contain" />
        <p className="text-sm font-medium">Живой кабинет</p>
      </div>
      <div className="flex gap-1 overflow-x-auto px-3 py-2">
        {scenes.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setScene(item.id)}
            className={cn(
              'shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium',
              scene === item.id ? 'bg-[#6750A4] text-white' : 'text-[#49454F] hover:bg-[#F3EDF7]',
            )}
          >
            {item.title}
          </button>
        ))}
      </div>
      <div className="h-[440px] overflow-hidden bg-[#F7F2FA] p-4">
        <div className={scene === 'board' ? 'h-full' : 'hidden'}>
          <BoardPane pen={pen} setPen={setPen} onStroke={onStroke} onClear={onClear} />
        </div>
        {scene === 'calendar' && (
          <img
            src="/calendar-week.png"
            alt="Неделя 28 сентября — 4 октября, занятия по алгебре, физике и геометрии"
            className="h-full w-full rounded-lg object-contain object-left-top"
          />
        )}
        {scene === 'lesson' && (
          <img
            src="/lesson-cats.png"
            alt="Два кота на видеосвязи разговаривают друг с другом"
            className="h-full w-full rounded-lg object-contain object-left-top"
          />
        )}
        {scene === 'report' && <ReportExample />}
        {scene === 'homework' && <HomeworkExample />}
        {scene === 'practice' && <PracticeHints />}
      </div>
    </div>
  );
}

function BoardPane({
  pen,
  setPen,
  onStroke,
  onClear,
}: {
  pen: string;
  setPen: (pen: string) => void;
  onStroke: () => void;
  onClear: () => void;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);

  const point = (event: PointerEvent<HTMLCanvasElement>) => {
    const node = canvas.current;
    if (!node) return { x: 0, y: 0 };
    const rect = node.getBoundingClientRect();
    return {
      x: (event.clientX - rect.left) * (node.width / rect.width),
      y: (event.clientY - rect.top) * (node.height / rect.height),
    };
  };

  return (
    <div className="flex h-full flex-col">
      <div className="mb-3 flex items-center gap-2">
        {PENS.map((color) => (
          <button
            key={color}
            type="button"
            aria-label={`Цвет ${color}`}
            onClick={() => setPen(color)}
            className={cn('h-8 w-8 rounded-lg border-2', pen === color ? 'border-[#1D1B20]' : 'border-transparent')}
            style={{ background: color }}
          />
        ))}
        <button
          type="button"
          className="ml-auto rounded-lg bg-white px-3 py-1.5 text-xs font-medium shadow-card"
          onClick={() => {
            const node = canvas.current;
            const ctx = node?.getContext('2d');
            if (node && ctx) ctx.clearRect(0, 0, node.width, node.height);
            onClear();
          }}
        >
          Стереть
        </button>
      </div>
      <canvas
        ref={canvas}
        width={900}
        height={420}
        className="min-h-0 w-full flex-1 touch-none rounded-lg bg-white shadow-card"
        onPointerDown={(event) => {
          const ctx = canvas.current?.getContext('2d');
          if (!ctx) return;
          drawing.current = true;
          const { x, y } = point(event);
          ctx.strokeStyle = pen;
          ctx.lineWidth = 4;
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.moveTo(x, y);
          event.currentTarget.setPointerCapture(event.pointerId);
        }}
        onPointerMove={(event) => {
          if (!drawing.current) return;
          const ctx = canvas.current?.getContext('2d');
          if (!ctx) return;
          const { x, y } = point(event);
          ctx.lineTo(x, y);
          ctx.stroke();
        }}
        onPointerUp={() => {
          if (drawing.current) onStroke();
          drawing.current = false;
        }}
      />
    </div>
  );
}

function ReportExample() {
  const blocks = [
    { title: 'Темы', items: ['Квадратные уравнения', 'Дискриминант', 'Теорема Пифагора'] },
    { title: 'Что получилось', items: ['Лучше стали получаться неполные квадратные уравнения', 'Увереннее раскладывает трёхчлен на множители', 'Теорема Пифагора получается без подсказки'] },
    { title: 'Сложности', items: ['При переносе слагаемого теряет знак', 'В примере с дробями считает устно и сбивается'] },
    { title: 'К следующему уроку', items: ['Повторить формулу корней', 'Проговорить, когда дискриминант равен нулю'] },
  ];
  return (
    <article className="h-full overflow-y-auto rounded-lg bg-white p-5 shadow-card">
      <p className="text-xs font-medium text-[#6750A4]">Пример отчёта · 1 октября</p>
      <h3 className="mt-1 text-lg font-medium">Алгебра, подготовка к ОГЭ</h3>
      <p className="mt-3 text-sm leading-6 text-[#49454F]">
        Разобрали квадратные уравнения: дискриминант и разложение на множители.
        В конце урока нашли гипотенузу прямоугольного треугольника.
      </p>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        {blocks.map((block) => (
          <section key={block.title}>
            <h4 className="text-sm font-medium">{block.title}</h4>
            <ul className="mt-2 space-y-1.5">
              {block.items.map((item) => (
                <li key={item} className="flex gap-2 text-sm leading-5 text-[#49454F]">
                  <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[#6750A4]" />
                  {item}
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </article>
  );
}

function HomeworkExample() {
  return (
    <article className="h-full overflow-y-auto rounded-lg bg-white p-5 shadow-card">
      <p className="text-xs font-medium text-[#6750A4]">ОГЭ · квадратные уравнения</p>
      <h3 className="mt-1 text-lg font-medium">К следующему занятию</h3>
      <ol className="mt-4 space-y-3">
        {homeworkTasks.map((task, index) => (
          <li key={task} className="text-sm leading-6">
            <span className="text-[#49454F]">{index + 1}. </span>
            {task}
          </li>
        ))}
      </ol>
    </article>
  );
}

function PracticeHints() {
  return (
    <article className="h-full overflow-y-auto rounded-lg bg-white p-5 shadow-card">
      <p className="text-xs font-medium text-[#6750A4]">Что решать на уроке</p>
      <h3 className="mt-1 text-lg font-medium">Подсказки к задачам</h3>
      <ul className="mt-4 space-y-3">
        {lessonHints.map((item) => (
          <li key={item.task} className="text-sm leading-6">
            <p className="font-medium">{item.task}</p>
            <p className="text-[#49454F]">{item.hint}</p>
          </li>
        ))}
      </ul>
    </article>
  );
}

function cardClass(active: boolean) {
  return cn(
    'flex h-full flex-col rounded-lg bg-white p-5 text-left shadow-card transition hover:-translate-y-0.5 hover:shadow-card-hover',
    active && 'ring-2 ring-[#6750A4]',
  );
}

function IconTile({ children }: { children: ReactNode }) {
  return (
    <span className="flex h-12 w-12 items-center justify-center rounded-lg bg-[#EADDFF] text-[#21005D]">
      {children}
    </span>
  );
}
