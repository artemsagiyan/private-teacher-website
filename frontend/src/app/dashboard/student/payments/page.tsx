'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

type Payment = { id: string; amount: number; currency: string; dueAt: string; paidAt: string | null; status: 'pending' | 'paid' | 'overdue' | 'cancelled'; description: string | null; teacher?: { user?: { firstName: string; lastName: string } } };

export default function StudentPaymentsPage() {
  const [rows, setRows] = useState<Payment[]>([]);
  useEffect(() => { api.get<Payment[]>('/payments/student').then(setRows).catch(() => toast.error('Не удалось загрузить оплату')); }, []);
  return <div className="mx-auto max-w-4xl space-y-5"><header><h1 className="text-xl font-semibold text-[rgb(var(--text))]">Оплаты</h1><p className="mt-1 text-sm text-[rgb(var(--text-2))]">Начисления от преподавателя и сроки оплаты.</p></header><Card><CardHeader><CardTitle>История оплат</CardTitle></CardHeader><CardContent>{rows.length ? <div className="space-y-2">{rows.map((row) => <div key={row.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[rgb(var(--border))] p-4"><div><p className="font-medium text-[rgb(var(--text))]">{row.description || 'Занятия'} · {row.amount.toLocaleString('ru-RU')} ₽</p><p className="mt-1 text-xs text-[rgb(var(--text-2))]">Срок: {new Date(row.dueAt).toLocaleDateString('ru-RU')}{row.paidAt ? ` · оплачено ${new Date(row.paidAt).toLocaleDateString('ru-RU')}` : ''}</p></div><span className={`text-xs font-medium ${row.status === 'paid' ? 'text-emerald-700' : row.status === 'overdue' ? 'text-rose-700' : 'text-amber-700'}`}>{statusLabel(row.status)}</span></div>)}</div> : <p className="text-sm text-[rgb(var(--text-2))]">Начислений пока нет.</p>}</CardContent></Card></div>;
}
function statusLabel(status: Payment['status']) { return ({ pending: 'Ожидается', overdue: 'Просрочено', paid: 'Оплачено', cancelled: 'Отменено' })[status]; }
