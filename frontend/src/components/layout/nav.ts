import {
  LayoutDashboard,
  Calendar,
  BookOpen,
  Users,
  Bell,
  Settings,
  Shield,
  BarChart3,
  GraduationCap,
  History,
  type LucideIcon,
} from 'lucide-react';

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
};

export const studentNav: NavItem[] = [
  { href: '/dashboard/student', label: 'Главная', icon: LayoutDashboard },
  { href: '/dashboard/student/calendar', label: 'Расписание', icon: Calendar },
  { href: '/dashboard/student/bookings', label: 'Мои занятия', icon: BookOpen },
  { href: '/dashboard/student/lessons', label: 'История уроков', icon: History },
  { href: '/dashboard/student/teacher', label: 'Преподаватель', icon: Users },
  { href: '/dashboard/student/notifications', label: 'Уведомления', icon: Bell },
  { href: '/dashboard/student/profile', label: 'Профиль', icon: Settings },
];

export const teacherNav: NavItem[] = [
  { href: '/dashboard/teacher', label: 'Главная', icon: LayoutDashboard },
  { href: '/dashboard/teacher/calendar', label: 'Расписание', icon: Calendar },
  { href: '/dashboard/teacher/lessons', label: 'История уроков', icon: History },
  { href: '/dashboard/teacher/students', label: 'Ученики', icon: Users },
  { href: '/dashboard/teacher/notifications', label: 'Уведомления', icon: Bell },
  { href: '/dashboard/teacher/profile', label: 'Настройки', icon: Settings },
];

export const adminNav: NavItem[] = [
  { href: '/dashboard/admin', label: 'Статистика', icon: BarChart3 },
  { href: '/dashboard/admin/users', label: 'Пользователи', icon: Users },
  { href: '/dashboard/admin/teachers', label: 'Преподаватели', icon: GraduationCap },
  { href: '/dashboard/admin/codes', label: 'Коды доступа', icon: Shield },
  { href: '/dashboard/admin/calendar', label: 'Все занятия', icon: Calendar },
];

export const roleLabel: Record<string, string> = {
  student: 'Ученик',
  teacher: 'Преподаватель',
  admin: 'Администратор',
};

export function navForRole(role?: string): NavItem[] {
  if (role === 'teacher') return teacherNav;
  if (role === 'admin') return adminNav;
  return studentNav;
}

export function isNavActive(pathname: string, href: string, role?: string) {
  const home = `/dashboard/${role ?? 'student'}`;
  if (href === home) return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}
