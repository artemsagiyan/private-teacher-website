import Link from 'next/link';
import { Calendar, Bell, BookOpen, Users, Shield, Zap, GraduationCap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PublicHeader } from '@/components/layout/public-header';

export default function LandingPage() {
  return (
    <div className="min-h-screen flex flex-col bg-[rgb(var(--bg))]">
      <PublicHeader />

      {/* Hero */}
      <section className="relative flex-1 flex flex-col items-center justify-center text-center px-5 py-28 overflow-hidden">
        {/* Background decorations */}
        <div className="absolute inset-0 bg-grid-pattern dark:bg-grid-pattern-dark bg-[size:32px_32px] opacity-100" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-gradient-radial from-primary-500/10 via-violet-500/5 to-transparent rounded-full blur-3xl pointer-events-none" />
        <div className="absolute top-20 right-20 w-48 h-48 bg-gradient-radial from-violet-500/10 to-transparent rounded-full blur-2xl pointer-events-none" />
        <div className="absolute bottom-20 left-20 w-48 h-48 bg-gradient-radial from-primary-500/10 to-transparent rounded-full blur-2xl pointer-events-none" />

        <div className="relative z-10 max-w-3xl animate-fade-in">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-primary-200 dark:border-primary-800/50 bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300 text-xs font-medium mb-8">
            <Zap className="h-3 w-3" />
            Платформа для репетиторов нового поколения
          </div>

          <h1 className="text-5xl sm:text-6xl md:text-7xl font-bold text-[rgb(var(--text))] mb-6 leading-[1.05] tracking-tight">
            Учитесь у лучших{' '}
            <span className="grad-text">репетиторов</span>{' '}
            онлайн
          </h1>

          <p className="text-lg text-[rgb(var(--text-2))] max-w-xl mx-auto mb-10 leading-relaxed">
            Записывайтесь на занятия в удобное время, отслеживайте прогресс
            и общайтесь с преподавателем — всё в одном месте.
          </p>

          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link href="/auth/register">
              <Button size="xl" variant="gradient" className="w-full sm:w-auto">
                Начать бесплатно
                <span className="ml-1 opacity-70">→</span>
              </Button>
            </Link>
            <Link href="/auth/login">
              <Button size="xl" variant="outline" className="w-full sm:w-auto">
                Войти в аккаунт
              </Button>
            </Link>
          </div>

          {/* Social proof */}
          <div className="mt-12 flex items-center justify-center gap-6 text-xs text-[rgb(var(--text-3))]">
            <span className="flex items-center gap-1.5"><Shield className="h-3 w-3" /> Безопасно</span>
            <span className="w-px h-3 bg-[rgb(var(--border))]" />
            <span className="flex items-center gap-1.5"><Users className="h-3 w-3" /> Для учеников и преподавателей</span>
            <span className="w-px h-3 bg-[rgb(var(--border))]" />
            <span className="flex items-center gap-1.5"><Zap className="h-3 w-3" /> Всегда доступно</span>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-24 px-5 border-t border-[rgb(var(--border))]">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-[rgb(var(--text))] tracking-tight mb-3">
              Всё необходимое для обучения
            </h2>
            <p className="text-[rgb(var(--text-2))] text-sm max-w-lg mx-auto">
              Мощные инструменты для преподавателей и удобный интерфейс для учеников
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {features.map((f) => (
              <div
                key={f.title}
                className="group p-6 rounded-2xl border border-[rgb(var(--border))] bg-[rgb(var(--surface))] hover:shadow-card-hover hover:-translate-y-0.5 transition-all duration-200"
              >
                <div className={`h-10 w-10 rounded-xl ${f.iconBg} flex items-center justify-center mb-4 shadow-sm`}>
                  <f.icon className="h-5 w-5 text-white" />
                </div>
                <h3 className="text-[0.9rem] font-semibold text-[rgb(var(--text))] mb-2">{f.title}</h3>
                <p className="text-[0.82rem] text-[rgb(var(--text-2))] leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-5 border-t border-[rgb(var(--border))]">
        <div className="max-w-2xl mx-auto text-center">
          <div className="inline-flex items-center justify-center h-14 w-14 rounded-2xl icon-blue mb-6 shadow-glow">
            <GraduationCap className="h-7 w-7 text-white" />
          </div>
          <h2 className="text-3xl font-bold text-[rgb(var(--text))] tracking-tight mb-4">
            Готовы начать?
          </h2>
          <p className="text-[rgb(var(--text-2))] mb-8 text-sm">
            Зарегистрируйтесь за 30 секунд и запишитесь на первое занятие.
          </p>
          <Link href="/auth/register">
            <Button size="xl" variant="gradient">
              Зарегистрироваться бесплатно
            </Button>
          </Link>
        </div>
      </section>

      <footer className="py-8 text-center text-xs text-[rgb(var(--text-3))] border-t border-[rgb(var(--border))]">
        © {new Date().getFullYear()} TutorPlatform — все права защищены
      </footer>
    </div>
  );
}

const features = [
  {
    icon: Calendar,
    iconBg: 'icon-blue',
    title: 'Умный календарь',
    desc: 'Создавайте слоты для занятий, ученики записываются в два клика. Никаких ручных согласований.',
  },
  {
    icon: Bell,
    iconBg: 'icon-violet',
    title: 'Авторегистрация уведомлений',
    desc: 'Автоматические напоминания за 24 часа и за 1 час до занятия. Email и уведомления в системе.',
  },
  {
    icon: BookOpen,
    iconBg: 'icon-green',
    title: 'История занятий',
    desc: 'Отслеживайте все прошедшие уроки, записи и статусы в удобном личном кабинете.',
  },
  {
    icon: Users,
    iconBg: 'icon-orange',
    title: 'Управление учениками',
    desc: 'Преподаватель видит всех своих учеников, историю записей и может управлять расписанием.',
  },
  {
    icon: Shield,
    iconBg: 'icon-cyan',
    title: 'Контроль доступа',
    desc: 'Гибкая система ролей: администратор, преподаватель, ученик — каждый видит только своё.',
  },
  {
    icon: Zap,
    iconBg: 'icon-red',
    title: 'Быстро и надёжно',
    desc: 'Современный стек технологий обеспечивает скорость и стабильность платформы.',
  },
];
