'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { GraduationCap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { api } from '@/lib/api';

const schema = z
  .object({
    password: z.string().min(8, 'Минимум 8 символов'),
    passwordConfirm: z.string().min(8),
  })
  .refine((data) => data.password === data.passwordConfirm, {
    message: 'Пароли не совпадают',
    path: ['passwordConfirm'],
  });
type FormData = z.infer<typeof schema>;

function ResetInner() {
  const router = useRouter();
  const params = useSearchParams();
  const token = params.get('token') || '';
  const [isLoading, setIsLoading] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  const onSubmit = async (data: FormData) => {
    if (!token) {
      toast.error('Нет токена сброса');
      return;
    }
    setIsLoading(true);
    try {
      await api.post('/auth/reset-password', { token, ...data });
      toast.success('Пароль обновлён');
      router.replace('/auth/login');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Ссылка недействительна');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[rgb(var(--bg))] p-6">
      <div className="w-full max-w-sm">
        <Link href="/" className="flex items-center gap-2.5 justify-center mb-8">
          <div className="h-8 w-8 rounded-xl icon-blue flex items-center justify-center">
            <GraduationCap className="h-5 w-5 text-white" />
          </div>
          <span className="font-bold text-[rgb(var(--text))]">TutorPlatform</span>
        </Link>
        <h1 className="text-2xl font-bold text-[rgb(var(--text))] mb-6">
          Новый пароль
        </h1>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <Input
            label="Пароль"
            type="password"
            error={errors.password?.message}
            {...register('password')}
          />
          <Input
            label="Подтверждение"
            type="password"
            error={errors.passwordConfirm?.message}
            {...register('passwordConfirm')}
          />
          <Button type="submit" className="w-full" isLoading={isLoading}>
            Сохранить
          </Button>
        </form>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div className="min-h-screen" />}>
      <ResetInner />
    </Suspense>
  );
}
