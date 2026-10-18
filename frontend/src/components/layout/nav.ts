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
  TrendingUp,
  LibraryBig,
  WalletCards,
  ClipboardCheck,
  type LucideIcon,
} from 'lucide-react';

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
};

export type NavGroup = {
  id: string;
  label: string;
  icon: LucideIcon;
  items: NavItem[];
};

export type RoleNavigation = {
  home: NavItem;
  groups: NavGroup[];
};

export const studentNav: RoleNavigation = {
  home: { href: '/dashboard/student', label: 'Главная', icon: LayoutDashboard },
  groups: [
    {
      id: 'lessons',
      label: 'Занятия',
      icon: Calendar,
      items: [
        { href: '/dashboard/student/calendar', label: 'Расписание', icon: Calendar },
        { href: '/dashboard/student/bookings', label: 'Мои занятия', icon: BookOpen },
        { href: '/dashboard/student/lessons', label: 'История уроков', icon: History },
      ],
    },
    {
      id: 'learning',
      label: 'Подготовка',
      icon: TrendingUp,
      items: [
        { href: '/dashboard/student/progress', label: 'Мой прогресс', icon: TrendingUp },
        { href: '/dashboard/student/homework', label: 'Домашние задания', icon: BookOpen },
        { href: '/dashboard/student/mock-exams', label: 'Пробник', icon: ClipboardCheck },
      ],
    },
    {
      id: 'account',
      label: 'Аккаунт и связь',
      icon: Users,
      items: [
        { href: '/dashboard/student/teacher', label: 'Преподаватель', icon: Users },
        { href: '/dashboard/student/payments', label: 'Оплаты', icon: WalletCards },
        { href: '/dashboard/student/notifications', label: 'Уведомления', icon: Bell },
        { href: '/dashboard/student/profile', label: 'Профиль', icon: Settings },
      ],
    },
  ],
};

export const teacherNav: RoleNavigation = {
  home: { href: '/dashboard/teacher', label: 'Главная', icon: LayoutDashboard },
  groups: [
    {
      id: 'schedule',
      label: 'Занятия',
      icon: Calendar,
      items: [
        { href: '/dashboard/teacher/calendar', label: 'Расписание', icon: Calendar },
        { href: '/dashboard/teacher/lessons', label: 'История уроков', icon: History },
      ],
    },
    {
      id: 'students',
      label: 'Ученики',
      icon: Users,
      items: [
        { href: '/dashboard/teacher/students', label: 'Список учеников', icon: Users },
      ],
    },
    {
      id: 'accounting',
      label: 'Учёт и настройки',
      icon: WalletCards,
      items: [
        { href: '/dashboard/teacher/payments', label: 'Оплаты', icon: WalletCards },
        { href: '/dashboard/teacher/notifications', label: 'Уведомления', icon: Bell },
        { href: '/dashboard/teacher/profile', label: 'Настройки', icon: Settings },
      ],
    },
  ],
};

export const adminNav: RoleNavigation = {
  home: { href: '/dashboard/admin', label: 'Статистика', icon: BarChart3 },
  groups: [
    {
      id: 'people',
      label: 'Люди',
      icon: Users,
      items: [
        { href: '/dashboard/admin/users', label: 'Пользователи', icon: Users },
        { href: '/dashboard/admin/teachers', label: 'Преподаватели', icon: GraduationCap },
      ],
    },
    {
      id: 'platform',
      label: 'Платформа',
      icon: Calendar,
      items: [
        { href: '/dashboard/admin/calendar', label: 'Все занятия', icon: Calendar },
        { href: '/dashboard/admin/curriculum', label: 'Каталог ФИПИ', icon: LibraryBig },
      ],
    },
    {
      id: 'administration',
      label: 'Администрирование',
      icon: Shield,
      items: [
        { href: '/dashboard/admin/codes', label: 'Коды доступа', icon: Shield },
        { href: '/dashboard/admin/notifications', label: 'Уведомления', icon: Bell },
      ],
    },
  ],
};

export const roleLabel: Record<string, string> = {
  student: 'Ученик',
  teacher: 'Преподаватель',
  admin: 'Администратор',
};

export function navForRole(role?: string): RoleNavigation {
  if (role === 'teacher') return teacherNav;
  if (role === 'admin') return adminNav;
  return studentNav;
}

export function groupForPath(groups: NavGroup[], pathname: string) {
  return groups.find((group) =>
    group.items.some((item) => isNavActive(pathname, item.href)),
  )?.id;
}

export function isNavActive(pathname: string, href: string, role?: string) {
  const home = `/dashboard/${role ?? 'student'}`;
  if (href === home) return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}
