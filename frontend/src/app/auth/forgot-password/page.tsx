'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { GraduationCap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { api } from '@/lib/api';

const schema = z.object({
  email: z.string().email('Введите корректный email'),
});
type FormData = z.infer<typeof schema>;

export default function ForgotPasswordPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  const onSubmit = async (data: FormData) => {
    setIsLoading(true);
    try {
      await api.post('/auth/forgot-password', data);
      setSent(true);
      toast.success('Если аккаунт существует, мы отправили письмо');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Не удалось отправить письмо');
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
        <h1 className="text-2xl font-bold text-[rgb(var(--text))] mb-2">
          Сброс пароля
        </h1>
        <p className="text-sm text-[rgb(var(--text-2))] mb-6">
          Укажите email — пришлём ссылку для нового пароля.
        </p>
        {sent ? (
          <p className="text-sm text-[rgb(var(--text-2))]">
            Проверьте почту. Затем вернитесь на{' '}
            <Link href="/auth/login" className="text-primary-600 hover:underline">
              страницу входа
            </Link>
            .
          </p>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <Input
              label="Email"
              type="email"
              error={errors.email?.message}
              {...register('email')}
            />
            <Button type="submit" className="w-full" isLoading={isLoading}>
              Отправить ссылку
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
