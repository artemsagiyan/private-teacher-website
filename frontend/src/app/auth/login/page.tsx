'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { GraduationCap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { api } from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';
import { AuthTokens } from '@/types';

const schema = z.object({
  email: z.string().email('Введите корректный email'),
  password: z.string().min(8, 'Минимум 8 символов'),
});
type FormData = z.infer<typeof schema>;

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuthStore();
  const [isLoading, setIsLoading] = useState(false);

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const onSubmit = async (data: FormData) => {
    setIsLoading(true);
    try {
      const tokens = await api.post<AuthTokens>('/auth/login', data);
      login(tokens);
      toast.success('Добро пожаловать!');
      const role = tokens.user.role;
      router.push(role === 'teacher' ? '/dashboard/teacher' : role === 'admin' ? '/dashboard/admin' : '/dashboard/student');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Неверный email или пароль');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-[rgb(var(--bg))]">
      {/* Left decorative panel */}
      <div
        className="hidden lg:flex lg:w-[420px] xl:w-[480px] relative flex-col justify-between p-10 overflow-hidden"
        style={{ background: 'rgb(10 10 20)' }}
      >
        <div className="absolute inset-0 bg-grid-pattern-dark bg-[size:28px_28px]" />
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-gradient-radial from-primary-600/20 via-violet-600/10 to-transparent rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-xl icon-blue flex items-center justify-center shadow-glow">
              <GraduationCap className="h-5 w-5 text-white" />
            </div>
            <span className="font-bold text-white/90">TutorPlatform</span>
          </Link>
        </div>

        <div className="relative z-10 space-y-5">
          {[
            { title: 'Занятия в удобное время', desc: 'Гибкое расписание без лишних согласований' },
            { title: 'Уведомления автоматически', desc: 'Напоминания о занятии за 24 часа и за 1 час' },
            { title: 'Всё в одном месте', desc: 'История, расписание и связь с преподавателем' },
          ].map((item) => (
            <div key={item.title} className="flex items-start gap-3">
              <div className="h-5 w-5 rounded-full icon-blue flex items-center justify-center shrink-0 mt-0.5">
                <span className="text-[10px] text-white font-bold">✓</span>
              </div>
              <div>
                <p className="text-sm font-medium text-white/80">{item.title}</p>
                <p className="text-xs text-white/40 mt-0.5">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>

        <p className="relative z-10 text-xs text-white/25">© {new Date().getFullYear()} TutorPlatform</p>
      </div>

      {/* Right form panel */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-sm animate-fade-in">
          <div className="lg:hidden flex justify-center mb-8">
            <Link href="/" className="flex items-center gap-2.5">
              <div className="h-8 w-8 rounded-xl icon-blue flex items-center justify-center shadow-glow">
                <GraduationCap className="h-5 w-5 text-white" />
              </div>
              <span className="font-bold text-[rgb(var(--text))]">TutorPlatform</span>
            </Link>
          </div>

          <div className="mb-8">
            <h1 className="text-2xl font-bold text-[rgb(var(--text))] tracking-tight">Вход в аккаунт</h1>
            <p className="text-sm text-[rgb(var(--text-2))] mt-1.5">
              Нет аккаунта?{' '}
              <Link href="/auth/register" className="text-primary-600 dark:text-primary-400 hover:underline font-medium">
                Зарегистрируйтесь
              </Link>
            </p>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <Input label="Email" type="email" placeholder="you@example.com" error={errors.email?.message} {...register('email')} />
            <Input label="Пароль" type="password" placeholder="••••••••" error={errors.password?.message} {...register('password')} />
            <Button type="submit" className="w-full" size="lg" isLoading={isLoading}>Войти</Button>
          </form>

          <div className="relative my-5">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-[rgb(var(--border))]" />
            </div>
            <div className="relative flex justify-center">
              <span className="px-3 bg-[rgb(var(--bg))] text-xs text-[rgb(var(--text-3))]">или</span>
            </div>
          </div>

          <Button variant="outline" className="w-full" type="button" onClick={() => api.loginWithGoogle()}>
            <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Войти через Google
          </Button>
        </div>
      </div>
    </div>
  );
}
