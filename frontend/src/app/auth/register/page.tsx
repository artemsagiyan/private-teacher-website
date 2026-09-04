'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { GraduationCap, Users, BookOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { api } from '@/lib/api';
import { apiErrorMessage } from '@/lib/api-error';
import { useAuthStore } from '@/store/auth.store';
import { AuthTokens } from '@/types';
import { cn } from '@/lib/utils';

type Tab = 'student' | 'teacher';

const base = z.object({
  firstName: z.string().min(1, 'Обязательное поле'),
  lastName:  z.string().min(1, 'Обязательное поле'),
  email:     z.string().email('Некорректный email'),
  phone:     z.string().optional(),
  password:  z.string().min(8, 'Минимум 8 символов'),
  passwordConfirm: z.string(),
}).refine((d) => d.password === d.passwordConfirm, {
  message: 'Пароли не совпадают', path: ['passwordConfirm'],
});

const studentSchema = base;
const teacherSchema = base.and(z.object({ registrationCode: z.string().min(1, 'Введите код') }));

type StudentData = z.infer<typeof studentSchema>;
type TeacherData = z.infer<typeof teacherSchema>;

export default function RegisterPage() {
  const [tab, setTab] = useState<Tab>('student');
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const { login } = useAuthStore();

  const sf = useForm<StudentData>({ resolver: zodResolver(studentSchema) });
  const tf = useForm<TeacherData>({ resolver: zodResolver(teacherSchema) });

  const onSubmitStudent = async (data: StudentData) => {
    setIsLoading(true);
    try {
      const tokens = await api.post<AuthTokens>('/auth/register/student', data);
      login(tokens);
      toast.success('Аккаунт создан!');
      router.push('/dashboard/student');
    } catch (err: unknown) {
      toast.error(apiErrorMessage(err, 'Ошибка регистрации'));
    } finally {
      setIsLoading(false);
    }
  };

  const onSubmitTeacher = async (data: TeacherData) => {
    setIsLoading(true);
    try {
      const tokens = await api.post<AuthTokens>('/auth/register/teacher', data);
      login(tokens);
      toast.success('Аккаунт преподавателя создан!');
      router.push('/dashboard/teacher');
    } catch (err: unknown) {
      toast.error(apiErrorMessage(err, 'Ошибка регистрации'));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-5 bg-[rgb(var(--bg))]">
      <div className="w-full max-w-md animate-fade-in">
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2.5 mb-6">
            <div className="h-8 w-8 rounded-xl icon-blue flex items-center justify-center shadow-glow">
              <GraduationCap className="h-5 w-5 text-white" />
            </div>
            <span className="font-bold text-[rgb(var(--text))]">TutorPlatform</span>
          </Link>
          <h1 className="text-2xl font-bold text-[rgb(var(--text))] tracking-tight">Создать аккаунт</h1>
          <p className="text-sm text-[rgb(var(--text-2))] mt-1.5">
            Уже есть аккаунт?{' '}
            <Link href="/auth/login" className="text-primary-600 dark:text-primary-400 hover:underline font-medium">Войти</Link>
          </p>
        </div>

        <div className="flex gap-2 mb-5 p-1 rounded-xl bg-[rgb(var(--surface-2))] border border-[rgb(var(--border))]">
          {([
            { key: 'student', label: 'Ученик', icon: BookOpen },
            { key: 'teacher', label: 'Преподаватель', icon: Users },
          ] as { key: Tab; label: string; icon: any }[]).map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={cn(
                'flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-sm font-medium transition-all duration-150',
                tab === key
                  ? 'bg-[rgb(var(--surface))] text-[rgb(var(--text))] shadow-card'
                  : 'text-[rgb(var(--text-2))] hover:text-[rgb(var(--text))]',
              )}
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          ))}
        </div>

        <div className="bg-[rgb(var(--surface))] rounded-2xl border border-[rgb(var(--border))] shadow-card p-6">
          {tab === 'student' ? (
            <form onSubmit={sf.handleSubmit(onSubmitStudent)} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <Input label="Имя" placeholder="Иван" error={sf.formState.errors.firstName?.message} {...sf.register('firstName')} />
                <Input label="Фамилия" placeholder="Иванов" error={sf.formState.errors.lastName?.message} {...sf.register('lastName')} />
              </div>
              <Input label="Email" type="email" placeholder="you@example.com" error={sf.formState.errors.email?.message} {...sf.register('email')} />
              <Input label="Телефон (необязательно)" type="tel" placeholder="+7 900 000-00-00" {...sf.register('phone')} />
              <Input label="Пароль" type="password" placeholder="Минимум 8 символов" error={sf.formState.errors.password?.message} {...sf.register('password')} />
              <Input label="Подтверждение пароля" type="password" placeholder="••••••••" error={sf.formState.errors.passwordConfirm?.message} {...sf.register('passwordConfirm')} />
              <Button type="submit" className="w-full" size="lg" isLoading={isLoading}>Зарегистрироваться</Button>
            </form>
          ) : (
            <form onSubmit={tf.handleSubmit(onSubmitTeacher)} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <Input label="Имя" placeholder="Анна" error={tf.formState.errors.firstName?.message} {...tf.register('firstName')} />
                <Input label="Фамилия" placeholder="Смирнова" error={tf.formState.errors.lastName?.message} {...tf.register('lastName')} />
              </div>
              <Input label="Email" type="email" placeholder="teacher@example.com" error={tf.formState.errors.email?.message} {...tf.register('email')} />
              <Input label="Пароль" type="password" placeholder="Минимум 8 символов" error={tf.formState.errors.password?.message} {...tf.register('password')} />
              <Input label="Подтверждение пароля" type="password" placeholder="••••••••" error={tf.formState.errors.passwordConfirm?.message} {...tf.register('passwordConfirm')} />
              <Input
                label="Код преподавателя"
                placeholder="NEWTEACHER"
                error={(tf.formState.errors as any).registrationCode?.message}
                hint="Код выдаётся администратором платформы"
                {...tf.register('registrationCode')}
              />
              <Button type="submit" className="w-full" size="lg" isLoading={isLoading}>
                Зарегистрироваться как преподаватель
              </Button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
