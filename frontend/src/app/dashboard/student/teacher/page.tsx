'use client';

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { Users, Mail, BookOpen, FileText, Unlink, Link2 } from 'lucide-react';
import { api } from '@/lib/api';
import { Teacher } from '@/types';
import { fullName } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export default function StudentTeacherPage() {
  const [teacher, setTeacher] = useState<Teacher | null | undefined>(undefined);
  const [loading, setLoading] = useState(false);

  const { register, handleSubmit, formState: { errors } } = useForm<{ inviteCode: string }>();

  useEffect(() => { api.get<Teacher | null>('/students/teacher').then(setTeacher).catch(() => setTeacher(null)); }, []);

  const onAttach = async ({ inviteCode }: { inviteCode: string }) => {
    setLoading(true);
    try {
      await api.post('/students/attach-teacher', { inviteCode });
      const t = await api.get<Teacher | null>('/students/teacher');
      setTeacher(t);
      toast.success('Преподаватель привязан!');
    } catch (err: any) { toast.error(err.response?.data?.message || 'Неверный код или ошибка'); }
    finally { setLoading(false); }
  };

  const onDetach = async () => {
    if (!confirm('Отвязать преподавателя? Вы потеряете доступ к его расписанию.')) return;
    await api.delete('/students/detach-teacher');
    setTeacher(null);
    toast.info('Преподаватель отвязан');
  };

  if (teacher === undefined) return (
    <div className="max-w-lg space-y-4 animate-pulse">
      <div className="skeleton h-8 w-48 rounded-lg" />
      <div className="skeleton h-48 rounded-2xl" />
    </div>
  );

  return (
    <div className="space-y-5 max-w-lg">
      <div>
        <h1 className="text-xl font-semibold text-[rgb(var(--text))] tracking-tight">Мой преподаватель</h1>
        <p className="text-sm text-[rgb(var(--text-2))] mt-0.5">
          {teacher ? 'Вы привязаны к преподавателю' : 'Нет привязанного преподавателя'}
        </p>
      </div>

      {teacher ? (
        <Card>
          <CardContent className="pt-5">
            {/* Header */}
            <div className="flex items-center gap-4 mb-5 pb-5 border-b border-[rgb(var(--border))]">
              <div className="h-14 w-14 rounded-2xl icon-violet flex items-center justify-center text-white text-xl font-bold shrink-0">
                {teacher.user?.firstName?.[0]}{teacher.user?.lastName?.[0]}
              </div>
              <div>
                <p className="text-base font-semibold text-[rgb(var(--text))]">{fullName(teacher.user)}</p>
                <p className="text-xs text-[rgb(var(--text-3))] mt-0.5">Преподаватель</p>
              </div>
            </div>

            {/* Info rows */}
            <div className="space-y-3">
              {teacher.user?.email && (
                <div className="flex items-center gap-3 text-sm">
                  <Mail className="h-4 w-4 text-[rgb(var(--text-3))] shrink-0" />
                  <span className="text-[rgb(var(--text-2))]">{teacher.user.email}</span>
                </div>
              )}
              {teacher.subjects && (
                <div className="flex items-start gap-3 text-sm">
                  <BookOpen className="h-4 w-4 text-[rgb(var(--text-3))] shrink-0 mt-0.5" />
                  <span className="text-[rgb(var(--text-2))]">{teacher.subjects}</span>
                </div>
              )}
              {teacher.bio && (
                <div className="flex items-start gap-3 text-sm">
                  <FileText className="h-4 w-4 text-[rgb(var(--text-3))] shrink-0 mt-0.5" />
                  <span className="text-[rgb(var(--text-2))] leading-relaxed">{teacher.bio}</span>
                </div>
              )}
            </div>

            <div className="mt-5 pt-5 border-t border-[rgb(var(--border))]">
              <button
                onClick={onDetach}
                className="flex items-center gap-2 text-xs text-red-500 hover:text-red-600 transition-colors"
              >
                <Unlink className="h-3.5 w-3.5" />
                Отвязать преподавателя
              </button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Link2 className="h-4 w-4 text-[rgb(var(--text-3))]" />
              Привязать преподавателя
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-[rgb(var(--text-2))] mb-4 leading-relaxed">
              Попросите вашего преподавателя сгенерировать код приглашения в своём кабинете и введите его ниже.
            </p>
            <form onSubmit={handleSubmit(onAttach)} className="space-y-4">
              <Input
                label="Код преподавателя"
                placeholder="DEMO1234"
                hint="8-значный код из кабинета преподавателя"
                error={errors.inviteCode?.message}
                {...register('inviteCode', { required: 'Введите код' })}
              />
              <Button type="submit" isLoading={loading} variant="gradient">
                <Users className="h-4 w-4" />
                Привязать
              </Button>
            </form>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
