'use client';

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { User, BookOpen, Lock, Mail } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';
import { Teacher } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { fullName } from '@/lib/utils';

export default function TeacherProfilePage() {
  const { user, setUser } = useAuthStore();
  const [teacher, setTeacher] = useState<Teacher | null>(null);
  const [savingUser, setSavingUser]       = useState(false);
  const [savingTeacher, setSavingTeacher] = useState(false);
  const [changingPwd, setChangingPwd]     = useState(false);

  const uForm = useForm({ defaultValues: { firstName: user?.firstName ?? '', lastName: user?.lastName ?? '' } });
  const tForm = useForm<{ bio: string; subjects: string }>({ defaultValues: { bio: '', subjects: '' } });
  const pForm = useForm<{ oldPassword: string; newPassword: string; confirm: string }>();

  useEffect(() => {
    api.get<Teacher>('/teachers/me').then((t) => {
      setTeacher(t);
      tForm.reset({ bio: t.bio ?? '', subjects: t.subjects ?? '' });
    });
  }, []);

  const onUserSave = async (data: any) => {
    setSavingUser(true);
    try { const u = await api.patch('/users/profile', data); setUser(u as any); toast.success('Сохранено'); }
    finally { setSavingUser(false); }
  };

  const onTeacherSave = async (data: { bio: string; subjects: string }) => {
    setSavingTeacher(true);
    try { await api.patch('/teachers/profile', data); toast.success('Информация обновлена'); }
    finally { setSavingTeacher(false); }
  };

  const onPwdChange = async (data: any) => {
    if (data.newPassword !== data.confirm) { toast.error('Пароли не совпадают'); return; }
    setChangingPwd(true);
    try {
      await api.post('/users/change-password', { oldPassword: data.oldPassword, newPassword: data.newPassword });
      toast.success('Пароль изменён');
      pForm.reset();
    } catch (err: any) { toast.error(err.response?.data?.message || 'Ошибка'); }
    finally { setChangingPwd(false); }
  };

  const initials = [user?.firstName?.[0], user?.lastName?.[0]].filter(Boolean).join('');

  return (
    <div className="space-y-5 max-w-lg">
      <div>
        <h1 className="text-xl font-semibold text-[rgb(var(--text))] tracking-tight">Настройки</h1>
        <p className="text-sm text-[rgb(var(--text-2))] mt-0.5">Личные данные и информация преподавателя</p>
      </div>

      {/* Avatar summary */}
      <div className="flex items-center gap-4 p-4 rounded-2xl bg-[rgb(var(--surface))] border border-[rgb(var(--border))] shadow-card">
        <div className="h-14 w-14 rounded-2xl icon-violet flex items-center justify-center text-white text-xl font-bold shrink-0">
          {initials || <User className="h-6 w-6" />}
        </div>
        <div>
          <p className="font-semibold text-[rgb(var(--text))]">{fullName(user ?? undefined) || 'Нет имени'}</p>
          <div className="flex items-center gap-1.5 mt-0.5">
            <Mail className="h-3 w-3 text-[rgb(var(--text-3))]" />
            <p className="text-xs text-[rgb(var(--text-2))]">{user?.email}</p>
          </div>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-4 w-4 text-[rgb(var(--text-3))]" /> Личные данные
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={uForm.handleSubmit(onUserSave)} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <Input label="Имя" placeholder="Анна" {...uForm.register('firstName')} />
              <Input label="Фамилия" placeholder="Смирнова" {...uForm.register('lastName')} />
            </div>
            <div>
              <p className="text-xs text-[rgb(var(--text-3))] uppercase tracking-wide font-medium mb-1.5">Email</p>
              <p className="text-sm text-[rgb(var(--text-2))]">{user?.email}</p>
            </div>
            <Button type="submit" isLoading={savingUser}>Сохранить</Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-[rgb(var(--text-3))]" /> Информация преподавателя
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={tForm.handleSubmit(onTeacherSave)} className="space-y-4">
            <Input
              label="Предметы"
              placeholder="Математика, Физика, Информатика"
              {...tForm.register('subjects')}
            />
            <div className="flex flex-col gap-1.5">
              <p className="text-xs font-medium text-[rgb(var(--text-2))] tracking-wide uppercase">О себе</p>
              <textarea
                className="flex min-h-[100px] w-full rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--surface))] px-3 py-2 text-sm text-[rgb(var(--text))] placeholder:text-[rgb(var(--text-3))] focus:outline-none focus:ring-2 focus:ring-primary-500/40 focus:border-primary-500 transition-all resize-none"
                placeholder="Расскажите о своём опыте и методах обучения..."
                {...tForm.register('bio')}
              />
            </div>
            <Button type="submit" isLoading={savingTeacher}>Сохранить</Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lock className="h-4 w-4 text-[rgb(var(--text-3))]" /> Сменить пароль
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={pForm.handleSubmit(onPwdChange)} className="space-y-4">
            <Input label="Текущий пароль" type="password" placeholder="••••••••" {...pForm.register('oldPassword')} />
            <Input label="Новый пароль" type="password" placeholder="Минимум 8 символов" {...pForm.register('newPassword')} />
            <Input label="Подтверждение" type="password" placeholder="Повторите новый пароль" {...pForm.register('confirm')} />
            <Button type="submit" isLoading={changingPwd} variant="outline">Сменить пароль</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
