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

const PENS = ['#3F1116', '#64343C', '#9D7960'];

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
  const [scene, setScene] = useState<Scene>('calendar');
  const [pen, setPen] = useState(PENS[0]);
  const [strokes, setStrokes] = useState(0);

  const open = (next: Scene) => {
    setScene(next);
  };

  return (
    <div className="relative">

      <section className="relative z-10 mx-auto grid w-full max-w-7xl items-center gap-10 px-5 py-12 sm:py-16 lg:grid-cols-[0.84fr_1.16fr] lg:gap-14 lg:px-8 lg:py-20">
        <div className="relative z-10">
          <p className="inline-flex items-center gap-2 rounded-full border border-[#9D7960]/25 bg-[#FFF1E9]/70 px-3.5 py-2 text-[0.66rem] font-semibold uppercase tracking-[0.16em] text-[#64343C] shadow-[0_4px_16px_rgb(63_17_22/0.05)]"><span className="h-1.5 w-1.5 rounded-full bg-[#9D7960]" />Онлайн-занятия с репетитором</p>
          <h1 className="mt-6 max-w-[650px] font-serif text-[2.8rem] font-medium leading-[1.03] tracking-[-0.055em] text-[#3F1116] sm:text-6xl lg:text-[4.25rem]">
            Математика, в которой появляется <span className="text-[#9D7960]">уверенность</span>
          </h1>
          <p className="mt-6 max-w-lg text-base leading-7 text-[#64343C]/85 sm:text-lg sm:leading-8">
            Живые уроки, общая доска и подготовка по темам — всё связано в одном спокойном и понятном кабинете.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link href="/auth/register">
              <Button variant="gradient" size="xl" className="w-full sm:w-auto">Начать занятия</Button>
            </Link>
            <Link href="/auth/login">
              <Button size="xl" variant="outline" className="w-full sm:w-auto">Войти в кабинет</Button>
            </Link>
          </div>
          <div className="mt-9 flex flex-wrap gap-x-6 gap-y-3 border-t border-[#9D7960]/25 pt-5 text-xs font-medium text-[#64343C]/80">
            <span className="flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-[#3F1116]" />Видео и доска вместе</span>
            <span className="flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-[#9D7960]" />План подготовки</span>
            <span className="flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-[#64343C]" />Отчёт семье</span>
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

      <section id="features" className="relative z-10 px-5 pb-10 pt-5 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#9D7960]">Инструменты занятия</p>
          <h2 className="mt-3 max-w-2xl font-serif text-3xl font-medium tracking-[-0.04em] text-[#3F1116] sm:text-4xl">
            Продуманный процесс — от первого слота до результата
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
                <p className="mt-1 text-sm leading-6 text-[#64343C]">Штрихов на доске: {strokes}.</p>
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
                    className={cn('h-8 w-8 rounded-lg border-2', pen === color ? 'border-[#64343C]' : 'border-transparent')}
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
              <p className="mt-1 text-sm leading-6 text-[#64343C]">Пример: алгебра, 1 октября. Квадратные уравнения и теорема Пифагора.</p>
            </button>
            <button type="button" onClick={() => open('homework')} className={cardClass(scene === 'homework')}>
              <IconTile><Mail className="h-5 w-5" /></IconTile>
              <h3 className="mt-4 text-lg font-medium">Домашнее задание</h3>
              <p className="mt-1 text-sm leading-6 text-[#64343C]">ОГЭ, квадратные уравнения: от неполного к уравнению с коэффициентом.</p>
            </button>
            <button type="button" onClick={() => open('practice')} className={cardClass(scene === 'practice')}>
              <IconTile><BookOpen className="h-5 w-5" /></IconTile>
              <h3 className="mt-4 text-lg font-medium">Что решать на уроке</h3>
              <ul className="mt-3 space-y-2">
                {lessonHints.slice(0, 3).map((item) => (
                  <li key={item.task} className="text-sm leading-5 text-[#64343C]">
                    <span className="font-medium text-[#64343C]">{item.task}.</span> {item.hint}
                  </li>
                ))}
              </ul>
            </button>
          </div>
        </div>
      </section>

      <section id="how" className="relative z-10 px-5 py-12 lg:px-8 lg:py-20">
        <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[0.75fr_1.25fr]">
          <div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#9D7960]">Просто и прозрачно</p><h2 className="mt-3 max-w-sm font-serif text-3xl font-medium tracking-[-0.04em] sm:text-4xl">Как проходит занятие</h2></div>
          <ol className="space-y-3">
            {([
              { n: '1', title: 'Преподаватель открывает время', text: 'В календаре появляется слот. Ученик видит только своего преподавателя.' },
              { n: '2', title: 'Ученик записывается и заходит в урок', text: 'Напоминание приходит за сутки и за час. Видео и доска открываются из кабинета.' },
              { n: '3', title: 'После урока уходит отчёт', text: 'Итоги и домашнее задание приходят ученику. Если указана почта родителя — и ему.' },
            ]).map(({ n, title, text }) => (
              <li key={n} className="group flex gap-4 rounded-2xl border border-[#9D7960]/20 bg-[#FFF1E9]/80 p-5 text-[#3F1116] shadow-card transition-all hover:-translate-y-0.5 hover:border-[#9D7960]/50 hover:shadow-card-hover sm:p-6">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#3F1116] font-serif text-base font-semibold text-[#FFF1E9] shadow-[0_8px_18px_rgb(63_17_22/0.15)]">
                  {n}
                </span>
                <span>
                  <span className="block text-base font-semibold">{title}</span>
                  <span className="mt-1 block text-sm leading-6 text-[#64343C]/80">{text}</span>
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
    <div id="stage" className="relative overflow-hidden rounded-[26px] border border-[#9D7960]/30 bg-[#3F1116] p-2 shadow-[0_28px_75px_rgb(63_17_22/0.22)] sm:p-3">
      <div className="flex items-center gap-3 px-3 py-3 sm:px-4">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#FFF1E9]/10 ring-1 ring-white/10"><img src="/swan.png" alt="" className="h-7 w-7 object-contain" /></span>
        <div className="min-w-0 flex-1"><p className="text-sm font-semibold text-[#FFF1E9]">Живой кабинет</p><p className="mt-0.5 text-[0.65rem] text-[#FEEFDC]/60">Уроки, материалы и прогресс вместе</p></div>
        <span className="hidden items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[0.62rem] font-medium text-[#FEEFDC]/80 sm:flex"><span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />Все в одном месте</span>
      </div>
      <div className="flex gap-1.5 overflow-x-auto px-2 pb-3 sm:px-3">
        {scenes.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setScene(item.id)}
            className={cn(
              'shrink-0 rounded-full px-3.5 py-2 text-[0.68rem] font-semibold transition-colors',
              scene === item.id ? 'bg-[#FEEFDC] text-[#3F1116] shadow-sm' : 'text-[#FFF1E9]/70 hover:bg-white/10 hover:text-[#FFF1E9]',
            )}
          >
            {item.title}
          </button>
        ))}
      </div>
      <div className="min-h-[390px] rounded-[20px] border border-white/10 bg-[#FEEFDC] p-3 sm:min-h-[470px] sm:p-4">
        <div className={scene === 'board' ? 'h-full' : 'hidden'}>
          <BoardPane pen={pen} setPen={setPen} onStroke={onStroke} onClear={onClear} />
        </div>
        {scene === 'calendar' && (
          <img
            src="/calendar-week.png"
            alt="Неделя 28 сентября — 4 октября, занятия по алгебре, физике и геометрии"
            className="w-full rounded-lg object-contain object-left-top"
          />
        )}
        {scene === 'lesson' && (
          <img
            src="/lesson-cats.png"
            alt="Два кота на видеосвязи разговаривают друг с другом"
            className="w-full rounded-lg object-contain object-left-top"
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
            className={cn('h-8 w-8 rounded-lg border-2', pen === color ? 'border-[#64343C]' : 'border-transparent')}
            style={{ background: color }}
          />
        ))}
        <button
          type="button"
          className="ml-auto rounded-lg bg-[#9D7960] px-3 py-1.5 text-xs font-medium text-[#FFF1E9] shadow-card"
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
        className="premium-grid min-h-0 w-full flex-1 touch-none rounded-2xl border border-[#9D7960]/35 bg-[#FFF1E9] shadow-inner"
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
    <article className="h-full overflow-y-auto rounded-2xl border border-[#9D7960]/25 bg-[#FFFDF9] p-5 shadow-card">
      <p className="text-xs font-medium text-[#3F1116]">Пример отчёта · 1 октября</p>
      <h3 className="mt-1 text-lg font-medium">Алгебра, подготовка к ОГЭ</h3>
      <p className="mt-3 text-sm leading-6 text-[#64343C]">
        Разобрали квадратные уравнения: дискриминант и разложение на множители.
        В конце урока нашли гипотенузу прямоугольного треугольника.
      </p>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        {blocks.map((block) => (
          <section key={block.title}>
            <h4 className="text-sm font-medium">{block.title}</h4>
            <ul className="mt-2 space-y-1.5">
              {block.items.map((item) => (
                <li key={item} className="flex gap-2 text-sm leading-5 text-[#64343C]">
                  <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[#3F1116]" />
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
    <article className="h-full overflow-y-auto rounded-2xl border border-[#9D7960]/25 bg-[#FFFDF9] p-5 shadow-card">
      <p className="text-xs font-medium text-[#3F1116]">ОГЭ · квадратные уравнения</p>
      <h3 className="mt-1 text-lg font-medium">К следующему занятию</h3>
      <ol className="mt-4 space-y-3">
        {homeworkTasks.map((task, index) => (
          <li key={task} className="text-sm leading-6">
            <span className="text-[#64343C]">{index + 1}. </span>
            {task}
          </li>
        ))}
      </ol>
    </article>
  );
}

function PracticeHints() {
  return (
    <article className="h-full overflow-y-auto rounded-2xl border border-[#9D7960]/25 bg-[#FFFDF9] p-5 shadow-card">
      <p className="text-xs font-medium text-[#3F1116]">Что решать на уроке</p>
      <h3 className="mt-1 text-lg font-medium">Подсказки к задачам</h3>
      <ul className="mt-4 space-y-3">
        {lessonHints.map((item) => (
          <li key={item.task} className="text-sm leading-6">
            <p className="font-medium">{item.task}</p>
            <p className="text-[#64343C]">{item.hint}</p>
          </li>
        ))}
      </ul>
    </article>
  );
}

function cardClass(active: boolean) {
  return cn(
    'group flex h-full flex-col rounded-2xl border border-[#9D7960]/20 bg-[#FFFDF9]/90 p-5 text-left shadow-card transition-all duration-300 hover:-translate-y-1 hover:border-[#9D7960]/50 hover:shadow-card-hover',
    active && 'border-[#3F1116]/35 bg-[#FFF1E9] ring-1 ring-[#3F1116]/20',
  );
}

function IconTile({ children }: { children: ReactNode }) {
  return (
    <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#64343C]/10 text-[#64343C] ring-1 ring-[#64343C]/10">
      {children}
    </span>
  );
}
