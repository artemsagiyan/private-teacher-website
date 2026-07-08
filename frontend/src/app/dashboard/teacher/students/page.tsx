'use client';

import { useEffect, useState } from 'react';
import { Users, Phone, Mail, Calendar } from 'lucide-react';
import { api } from '@/lib/api';
import { Student } from '@/types';
import { fullName, formatDate } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';

function Skeleton({ className }: { className?: string }) {
  return <div className={`skeleton ${className}`} />;
}

export default function TeacherStudentsPage() {
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading]   = useState(true);

  useEffect(() => {
    api.get<Student[]>('/teachers/students').then(setStudents).finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="space-y-4 animate-pulse">
      <Skeleton className="h-8 w-40 rounded-lg" />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-44 rounded-2xl" />)}
      </div>
    </div>
  );

  return (
    <div className="space-y-5 max-w-5xl">
      <div>
        <h1 className="text-xl font-semibold text-[rgb(var(--text))] tracking-tight">Мои ученики</h1>
        <p className="text-sm text-[rgb(var(--text-2))] mt-0.5">{students.length} привязано</p>
      </div>

      {students.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <div className="h-12 w-12 rounded-2xl icon-blue mx-auto flex items-center justify-center mb-4">
              <Users className="h-6 w-6 text-white" />
            </div>
            <p className="text-sm font-medium text-[rgb(var(--text))]">Пока нет учеников</p>
            <p className="text-xs text-[rgb(var(--text-2))] mt-1 max-w-xs mx-auto">
              Поделитесь кодом приглашения с главного экрана — ученики привяжутся автоматически
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {students.map((s) => (
            <Card key={s.id} className="hover:shadow-card-hover hover:-translate-y-0.5 transition-all duration-200">
              <CardContent className="pt-5">
                <div className="flex items-center gap-3 mb-4">
                  <div className="h-10 w-10 rounded-xl icon-blue flex items-center justify-center text-white text-sm font-bold shrink-0">
                    {s.user?.firstName?.[0]}{s.user?.lastName?.[0]}
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-sm text-[rgb(var(--text))] truncate">{fullName(s.user)}</p>
                    <p className="text-[0.72rem] text-[rgb(var(--text-3))]">Ученик</p>
                  </div>
                </div>

                <div className="space-y-1.5">
                  {s.user?.email && (
                    <div className="flex items-center gap-2 text-xs text-[rgb(var(--text-2))]">
                      <Mail className="h-3 w-3 text-[rgb(var(--text-3))] shrink-0" />
                      <span className="truncate">{s.user.email}</span>
                    </div>
                  )}
                  {s.user?.phone && (
                    <div className="flex items-center gap-2 text-xs text-[rgb(var(--text-2))]">
                      <Phone className="h-3 w-3 text-[rgb(var(--text-3))] shrink-0" />
                      {s.user.phone}
                    </div>
                  )}
                  <div className="flex items-center gap-2 text-xs text-[rgb(var(--text-3))]">
                    <Calendar className="h-3 w-3 shrink-0" />
                    С {formatDate(s.user?.createdAt ?? '')}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
