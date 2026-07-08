'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard, Calendar, BookOpen, Users, Bell,
  Settings, Shield, BarChart3, GraduationCap, ChevronRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/store/auth.store';

const studentNav = [
  { href: '/dashboard/student',               label: 'Главная',          icon: LayoutDashboard },
  { href: '/dashboard/student/calendar',      label: 'Расписание',       icon: Calendar },
  { href: '/dashboard/student/bookings',      label: 'Мои занятия',      icon: BookOpen },
  { href: '/dashboard/student/teacher',       label: 'Мой преподаватель', icon: Users },
  { href: '/dashboard/student/notifications', label: 'Уведомления',      icon: Bell },
  { href: '/dashboard/student/profile',       label: 'Профиль',          icon: Settings },
];

const teacherNav = [
  { href: '/dashboard/teacher',               label: 'Главная',    icon: LayoutDashboard },
  { href: '/dashboard/teacher/calendar',      label: 'Расписание', icon: Calendar },
  { href: '/dashboard/teacher/students',      label: 'Ученики',    icon: Users },
  { href: '/dashboard/teacher/notifications', label: 'Уведомления', icon: Bell },
  { href: '/dashboard/teacher/profile',       label: 'Настройки',  icon: Settings },
];

const adminNav = [
  { href: '/dashboard/admin',          label: 'Статистика',     icon: BarChart3 },
  { href: '/dashboard/admin/users',    label: 'Пользователи',   icon: Users },
  { href: '/dashboard/admin/teachers', label: 'Преподаватели',  icon: GraduationCap },
  { href: '/dashboard/admin/codes',    label: 'Коды доступа',   icon: Shield },
  { href: '/dashboard/admin/calendar', label: 'Все занятия',    icon: Calendar },
];

const roleLabel: Record<string, string> = {
  student: 'Ученик',
  teacher: 'Преподаватель',
  admin:   'Администратор',
};

export function DashboardSidebar() {
  const { user } = useAuthStore();
  const pathname = usePathname();

  const nav = user?.role === 'teacher' ? teacherNav
            : user?.role === 'admin'   ? adminNav
            : studentNav;

  const initials = [user?.firstName?.[0], user?.lastName?.[0]].filter(Boolean).join('');

  return (
    <aside className="sidebar w-60 hidden md:flex flex-col h-screen sticky top-0 shrink-0">
      {/* Logo */}
      <div className="h-14 flex items-center px-5 shrink-0">
        <Link href="/" className="flex items-center gap-2.5 group">
          <div className="h-7 w-7 rounded-lg icon-blue flex items-center justify-center shadow-glow shrink-0">
            <GraduationCap className="h-4 w-4 text-white" />
          </div>
          <span className="font-bold text-sm text-white/90 tracking-tight group-hover:text-white transition-colors">
            TutorPlatform
          </span>
        </Link>
      </div>

      <div className="h-px bg-[rgb(var(--sidebar-border))] mx-4" />

      {/* Nav */}
      <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto mt-1">
        {nav.map((item) => {
          const isActive = pathname === item.href || (item.href !== '/dashboard/' + user?.role && pathname.startsWith(item.href));
          const exactMatch = pathname === item.href;
          const active = item.href.split('/').length <= 3 ? exactMatch : isActive;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 px-3 py-2 rounded-lg text-[0.82rem] font-medium transition-all duration-150 group relative',
                active
                  ? 'bg-white/10 text-white'
                  : 'text-white/45 hover:text-white/80 hover:bg-white/5',
              )}
            >
              {active && (
                <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-primary-400 rounded-r-full" />
              )}
              <item.icon className={cn('h-4 w-4 shrink-0 transition-colors', active ? 'text-primary-400' : 'text-white/35 group-hover:text-white/60')} />
              <span className="truncate">{item.label}</span>
              {active && <ChevronRight className="h-3 w-3 ml-auto text-white/30" />}
            </Link>
          );
        })}
      </nav>

      <div className="h-px bg-[rgb(var(--sidebar-border))] mx-4" />

      {/* User */}
      <div className="p-3">
        <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-white/5 transition-colors cursor-default">
          <div className="h-7 w-7 rounded-lg icon-violet flex items-center justify-center text-white text-[0.65rem] font-bold shrink-0">
            {initials || '?'}
          </div>
          <div className="min-w-0">
            <p className="text-[0.78rem] font-medium text-white/80 truncate">
              {user?.firstName} {user?.lastName}
            </p>
            <p className="text-[0.68rem] text-white/35 truncate">
              {roleLabel[user?.role ?? ''] ?? user?.role}
            </p>
          </div>
        </div>
      </div>
    </aside>
  );
}
