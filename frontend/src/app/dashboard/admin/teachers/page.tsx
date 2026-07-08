'use client';

import { useEffect, useState } from 'react';
import { GraduationCap, Users, BookOpen } from 'lucide-react';
import { api } from '@/lib/api';
import { Teacher } from '@/types';
import { fullName, formatDate } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';

function Skeleton({ className }: { className?: string }) {
  return <div className={`skeleton ${className}`} />;
}

export default function AdminTeachersPage() {
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [loading, setLoading]   = useState(true);

  useEffect(() => {
    api.get<Teacher[]>('/admin/teachers').then(setTeachers).finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="space-y-4 animate-pulse">
      <Skeleton className="h-8 w-48 rounded-lg" />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-40 rounded-2xl" />)}
      </div>
    </div>
  );

  return (
    <div className="space-y-5 max-w-5xl">
      <div>
        <h1 className="text-xl font-semibold text-[rgb(var(--text))] tracking-tight">Преподаватели</h1>
        <p className="text-sm text-[rgb(var(--text-2))] mt-0.5">{teachers.length} зарегистрировано</p>
      </div>

      {teachers.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <div className="h-12 w-12 rounded-2xl icon-violet mx-auto flex items-center justify-center mb-4">
              <GraduationCap className="h-6 w-6 text-white" />
            </div>
            <p className="text-sm font-medium text-[rgb(var(--text))]">Преподавателей нет</p>
            <p className="text-xs text-[rgb(var(--text-2))] mt-1">Создайте коды регистрации и пригласите преподавателей</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {teachers.map((t) => (
            <Card key={t.id} className="hover:shadow-card-hover hover:-translate-y-0.5 transition-all duration-200">
              <CardContent className="pt-5">
                <div className="flex items-center gap-3 mb-4">
                  <div className="h-10 w-10 rounded-xl icon-violet flex items-center justify-center text-white text-sm font-bold shrink-0">
                    {t.user?.firstName?.[0]}{t.user?.lastName?.[0]}
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-sm text-[rgb(var(--text))] truncate">{fullName(t.user)}</p>
                    <p className="text-[0.72rem] text-[rgb(var(--text-3))] truncate">{t.user?.email}</p>
                  </div>
                </div>

                {t.subjects && (
                  <div className="flex items-center gap-1.5 mb-2">
                    <BookOpen className="h-3 w-3 text-[rgb(var(--text-3))] shrink-0" />
                    <p className="text-xs text-[rgb(var(--text-2))] truncate">{t.subjects}</p>
                  </div>
                )}

                {t.inviteCode && (
                  <div className="mt-3 px-2 py-1.5 rounded-lg bg-[rgb(var(--surface-2))] border border-[rgb(var(--border))]">
                    <p className="text-[0.68rem] text-[rgb(var(--text-3))] mb-0.5">Код приглашения</p>
                    <p className="font-mono text-xs font-bold text-[rgb(var(--text))] tracking-wider">{t.inviteCode}</p>
                  </div>
                )}

                <div className="flex items-center gap-1.5 mt-3 text-[0.72rem] text-[rgb(var(--text-3))]">
                  <Users className="h-3 w-3" />
                  С {formatDate(t.user?.createdAt ?? '')}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
