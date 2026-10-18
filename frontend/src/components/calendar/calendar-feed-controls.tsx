'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Check, Copy, Link2, RefreshCw } from 'lucide-react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

export function CalendarFeedControls() {
  const [feedUrl, setFeedUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const createFeed = async () => {
    setLoading(true);
    try {
      const result = await api.post<{ token: string }>('/calendar/feed-token');
      setFeedUrl(api.publicUrl(`/calendar-feed/${result.token}.ics`));
      setCopied(false);
      toast.success('Ссылка для подписки создана');
    } catch {
      toast.error('Не удалось создать ссылку календаря');
    } finally {
      setLoading(false);
    }
  };

  const copyFeed = async () => {
    try {
      await navigator.clipboard.writeText(feedUrl);
      setCopied(true);
      toast.success('Ссылка скопирована');
    } catch {
      toast.error('Не удалось скопировать ссылку');
    }
  };

  return (
    <Card>
      <CardContent className="flex flex-col gap-3 py-4 md:flex-row md:items-center md:justify-between">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-sm font-medium text-[rgb(var(--text))]">
            <Link2 className="h-4 w-4 text-primary-500" />
            Подписка Google / Яндекс
          </p>
          <p className="mt-1 text-xs text-[rgb(var(--text-2))]">
            Добавьте приватную ссылку как интернет-календарь. Новый выпуск ссылки отключит предыдущий.
          </p>
          {feedUrl && (
            <input
              readOnly
              aria-label="Приватная ссылка календаря"
              value={feedUrl}
              onFocus={(event) => event.currentTarget.select()}
              className="mt-2 w-full rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--surface-2))] px-3 py-2 font-mono text-xs text-[rgb(var(--text))]"
            />
          )}
        </div>
        <div className="flex shrink-0 gap-2">
          {feedUrl && (
            <Button size="sm" variant="outline" onClick={copyFeed}>
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              {copied ? 'Скопировано' : 'Копировать'}
            </Button>
          )}
          <Button size="sm" variant={feedUrl ? 'outline' : 'default'} onClick={createFeed} isLoading={loading}>
            {feedUrl ? <RefreshCw className="h-4 w-4" /> : <Link2 className="h-4 w-4" />}
            {feedUrl ? 'Обновить ссылку' : 'Создать ссылку'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
