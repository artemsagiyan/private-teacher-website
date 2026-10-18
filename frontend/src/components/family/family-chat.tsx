'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import { Loader2, MessageCircle, Send } from 'lucide-react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

type FamilyMessage = {
  id: string;
  senderType: 'parent' | 'teacher';
  senderName: string;
  body: string;
  createdAt: string;
};

export function FamilyChat({
  token,
  studentId,
}: {
  token?: string;
  studentId?: string;
}) {
  const [messages, setMessages] = useState<FamilyMessage[]>([]);
  const [body, setBody] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const path = token
    ? `/family/${encodeURIComponent(token)}/messages`
    : `/family/teacher/${encodeURIComponent(studentId ?? '')}/messages`;

  const load = useCallback(async () => {
    try {
      const value = await api.get<FamilyMessage[]>(path);
      setMessages(value);
      setError('');
    } catch (reason: any) {
      setError(reason.response?.data?.message || 'Не удалось загрузить сообщения');
    } finally {
      setLoading(false);
    }
  }, [path]);

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => void load(), 30_000);
    return () => window.clearInterval(timer);
  }, [load]);

  const send = async (event: FormEvent) => {
    event.preventDefault();
    const message = body.trim();
    if (!message || sending) return;
    setSending(true);
    setError('');
    try {
      const created = await api.post<FamilyMessage>(path, { body: message });
      setMessages((current) => [...current, created].slice(-100));
      setBody('');
    } catch (reason: any) {
      setError(reason.response?.data?.message || 'Не удалось отправить сообщение');
    } finally {
      setSending(false);
    }
  };

  return (
    <Card className="family-chat">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MessageCircle className="h-4 w-4 text-primary-500" />
          Чат с преподавателем
        </CardTitle>
        <p className="text-xs text-[rgb(var(--text-3))]">
          Сообщения доступны семье и текущему преподавателю ученика.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="max-h-80 space-y-3 overflow-y-auto rounded-xl bg-[rgb(var(--surface-2))] p-3" aria-live="polite">
          {loading ? (
            <div className="flex items-center justify-center py-8 text-sm text-[rgb(var(--text-2))]">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />Загружаем переписку
            </div>
          ) : messages.length ? (
            messages.map((message) => (
              <article
                key={message.id}
                className={`max-w-[90%] rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--surface))] p-3 ${message.senderType === 'teacher' ? 'ml-auto' : ''}`}
              >
                <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
                  <span className="text-xs font-semibold text-[rgb(var(--text))]">{message.senderName}</span>
                  <time className="text-[0.7rem] text-[rgb(var(--text-3))]" dateTime={message.createdAt}>
                    {new Date(message.createdAt).toLocaleString('ru-RU', { dateStyle: 'short', timeStyle: 'short' })}
                  </time>
                </div>
                <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-5 text-[rgb(var(--text-2))]">{message.body}</p>
              </article>
            ))
          ) : (
            <p className="py-8 text-center text-sm text-[rgb(var(--text-2))]">
              Переписка ещё не началась. Напишите преподавателю, чтобы задать вопрос.
            </p>
          )}
        </div>
        {error && <p className="text-sm text-rose-600" role="alert">{error}</p>}
        <form onSubmit={send} className="family-chat-compose space-y-2">
          <label htmlFor="family-chat-message" className="sr-only">Сообщение преподавателю</label>
          <textarea
            id="family-chat-message"
            value={body}
            onChange={(event) => setBody(event.target.value.slice(0, 3000))}
            maxLength={3000}
            rows={3}
            placeholder="Напишите сообщение…"
            className="w-full resize-y rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--surface))] px-3 py-2.5 text-sm text-[rgb(var(--text))] outline-none focus:border-primary-500"
          />
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs text-[rgb(var(--text-3))]">До 3000 символов · не отправляйте пароли и коды доступа</span>
            <Button type="submit" size="sm" isLoading={sending} disabled={!body.trim()}>
              {!sending && <Send className="h-4 w-4" />}
              Отправить
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
