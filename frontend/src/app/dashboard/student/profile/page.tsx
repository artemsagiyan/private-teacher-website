'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { User, Lock, Mail } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { fullName } from '@/lib/utils';
import { UserAvatar } from '@/components/layout/user-avatar';

export default function ProfilePage() {
  const { user, setUser } = useAuthStore();
  const [saving, setSaving]       = useState(false);
  const [changingPwd, setChangingPwd] = useState(false);

  const profileForm = useForm({
    defaultValues: { firstName: user?.firstName ?? '', lastName: user?.lastName ?? '', phone: user?.phone ?? '' },
  });

  const pwdForm = useForm<{ oldPassword: string; newPassword: string; confirm: string }>();

  const onProfileSave = async (data: any) => {
    setSaving(true);
    try {
      const updated = await api.patch('/users/profile', data);
      setUser(updated as any);
      toast.success('Профиль сохранён');
    } catch { toast.error('Ошибка сохранения'); }
    finally { setSaving(false); }
  };

  const onPwdChange = async (data: any) => {
    if (data.newPassword !== data.confirm) { toast.error('Пароли не совпадают'); return; }
    setChangingPwd(true);
    try {
      await api.post('/users/change-password', { oldPassword: data.oldPassword, newPassword: data.newPassword });
      toast.success('Пароль изменён');
      pwdForm.reset();
    } catch (err: any) { toast.error(err.response?.data?.message || 'Ошибка'); }
    finally { setChangingPwd(false); }
  };

  const initials = [user?.firstName?.[0], user?.lastName?.[0]].filter(Boolean).join('');

  const onAvatar = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const form = new FormData();
    form.append('file', file);
    try {
      const updated = await api.post('/users/avatar', form);
      setUser(updated as any);
      toast.success('Аватар обновлён');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Не удалось загрузить');
    }
  };

  return (
    <div className="space-y-5 max-w-lg">
      <div>
        <h1 className="text-xl font-semibold text-[rgb(var(--text))] tracking-tight">Профиль</h1>
        <p className="text-sm text-[rgb(var(--text-2))] mt-0.5">Управление личными данными</p>
      </div>

      {/* Avatar + name summary */}
      <div className="flex items-center gap-4 p-4 rounded-2xl bg-[rgb(var(--surface))] border border-[rgb(var(--border))] shadow-card">
        <div className="h-14 w-14 rounded-2xl icon-violet flex items-center justify-center text-white text-xl font-bold shrink-0 overflow-hidden">
          <UserAvatar
            className="h-full w-full object-cover"
            fallback={initials || <User className="h-6 w-6" />}
          />
        </div>
        <div>
          <p className="font-semibold text-[rgb(var(--text))]">{fullName(user ?? undefined) || 'Нет имени'}</p>
          <label className="mt-1 inline-block text-xs text-primary-600 cursor-pointer hover:underline">
            Сменить фото
            <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={onAvatar} />
          </label>
          <div className="flex items-center gap-1.5 mt-0.5">
            <Mail className="h-3 w-3 text-[rgb(var(--text-3))]" />
            <p className="text-xs text-[rgb(var(--text-2))]">{user?.email}</p>
          </div>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-4 w-4 text-[rgb(var(--text-3))]" />
            Личные данные
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={profileForm.handleSubmit(onProfileSave)} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <Input label="Имя" placeholder="Иван" {...profileForm.register('firstName')} />
              <Input label="Фамилия" placeholder="Иванов" {...profileForm.register('lastName')} />
            </div>
            <Input label="Телефон" type="tel" placeholder="+7 900 000-00-00" {...profileForm.register('phone')} />
            <div className="pt-1">
              <p className="text-xs text-[rgb(var(--text-3))] uppercase tracking-wide font-medium mb-1.5">Email</p>
              <p className="text-sm text-[rgb(var(--text-2))]">{user?.email}</p>
            </div>
            <Button type="submit" isLoading={saving}>Сохранить изменения</Button>
          </form>
        </CardContent>
      </Card>

      {user?.hasPassword !== false && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lock className="h-4 w-4 text-[rgb(var(--text-3))]" />
              Сменить пароль
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={pwdForm.handleSubmit(onPwdChange)} className="space-y-4">
              <Input label="Текущий пароль" type="password" placeholder="••••••••" {...pwdForm.register('oldPassword')} />
              <Input label="Новый пароль" type="password" placeholder="Минимум 8 символов" {...pwdForm.register('newPassword')} />
              <Input label="Подтверждение" type="password" placeholder="Повторите новый пароль" {...pwdForm.register('confirm')} />
              <Button type="submit" isLoading={changingPwd} variant="outline">Сменить пароль</Button>
            </form>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
