'use client';

import { useEffect, useState } from 'react';
import { Users, GraduationCap, BookOpen, TrendingUp } from 'lucide-react';
import { api } from '@/lib/api';
import { Card, CardContent } from '@/components/ui/card';
import { toast } from 'sonner';

interface Stats { totalUsers: number; totalStudents: number; totalTeachers: number; totalBookings: number; }

function Skeleton({ className }: { className?: string }) {
  return <div className={`skeleton ${className}`} />;
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    api
      .get<Stats>('/admin/stats')
      .then(setStats)
      .catch(() => {
        setError(true);
        toast.error('Не удалось загрузить статистику');
      });
  }, []);

  if (error) {
    return <p className="text-sm text-red-500">Не удалось загрузить статистику</p>;
  }

  if (!stats) return (
    <div className="space-y-5 animate-pulse">
      <Skeleton className="h-8 w-40 rounded-lg" />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-32 rounded-2xl" />)}
      </div>
    </div>
  );

  const cards = [
    { icon: Users,        iconClass: 'icon-blue',   label: 'Пользователей',   value: stats.totalUsers,    change: 'всего' },
    { icon: GraduationCap,iconClass: 'icon-violet', label: 'Преподавателей',  value: stats.totalTeachers, change: 'зарегистрировано' },
    { icon: Users,        iconClass: 'icon-green',  label: 'Учеников',        value: stats.totalStudents, change: 'активных' },
    { icon: BookOpen,     iconClass: 'icon-orange', label: 'Записей',         value: stats.totalBookings, change: 'всего' },
  ];

  return (
    <div className="space-y-5 max-w-5xl">
      <div>
        <h1 className="text-xl font-semibold text-[rgb(var(--text))] tracking-tight">Статистика платформы</h1>
        <p className="text-sm text-[rgb(var(--text-2))] mt-0.5">Общий обзор активности</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map(({ icon: Icon, iconClass, label, value, change }) => (
          <Card key={label} className="hover:shadow-card-hover transition-shadow duration-200 group">
            <CardContent className="pt-5">
              <div className="flex items-start justify-between mb-4">
                <div className={`h-10 w-10 rounded-xl ${iconClass} flex items-center justify-center shrink-0 transition-transform group-hover:scale-105`}>
                  <Icon className="h-5 w-5 text-white" />
                </div>
                <TrendingUp className="h-3.5 w-3.5 text-[rgb(var(--text-3))]" />
              </div>
              <p className="text-3xl font-bold text-[rgb(var(--text))] leading-none">{value}</p>
              <p className="text-xs text-[rgb(var(--text-2))] mt-1.5">{label}</p>
              <p className="text-[0.68rem] text-[rgb(var(--text-3))] mt-0.5">{change}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card>
          <CardContent className="pt-5">
            <p className="text-xs font-medium text-[rgb(var(--text-2))] uppercase tracking-wide mb-3">Активность</p>
            <div className="space-y-3">
              {[
                { label: 'Студентов на преподавателя', value: stats.totalTeachers > 0 ? (stats.totalStudents / stats.totalTeachers).toFixed(1) : '—' },
                { label: 'Записей на студента', value: stats.totalStudents > 0 ? (stats.totalBookings / stats.totalStudents).toFixed(1) : '—' },
              ].map(({ label, value }) => (
                <div key={label} className="flex items-center justify-between py-2 border-b border-[rgb(var(--border))] last:border-0">
                  <span className="text-xs text-[rgb(var(--text-2))]">{label}</span>
                  <span className="text-sm font-semibold text-[rgb(var(--text))]">{value}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-5">
            <p className="text-xs font-medium text-[rgb(var(--text-2))] uppercase tracking-wide mb-3">Быстрые действия</p>
            <div className="space-y-2">
              {[
                { href: '/dashboard/admin/users',    label: 'Управление пользователями' },
                { href: '/dashboard/admin/codes',    label: 'Создать код регистрации' },
                { href: '/dashboard/admin/teachers', label: 'Список преподавателей' },
              ].map(({ href, label }) => (
                <a
                  key={href}
                  href={href}
                  className="flex items-center justify-between px-3 py-2 rounded-lg hover:bg-[rgb(var(--surface-2))] transition-colors group"
                >
                  <span className="text-xs text-[rgb(var(--text-2))] group-hover:text-[rgb(var(--text))] transition-colors">{label}</span>
                  <span className="text-[rgb(var(--text-3))] text-xs">→</span>
                </a>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
