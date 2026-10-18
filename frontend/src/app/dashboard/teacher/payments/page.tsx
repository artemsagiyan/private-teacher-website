'use client';

import { useCallback, useEffect, useState } from 'react';
import { CircleDollarSign, Download, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import type { Student } from '@/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { fullName } from '@/lib/utils';

type Payment = { id: string; studentId: string; student?: Student; amount: number; currency: string; dueAt: string; paidAt: string | null; status: 'pending' | 'paid' | 'overdue' | 'cancelled'; description: string | null };

export default function TeacherPaymentsPage() {
  const [rows, setRows] = useState<Payment[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [studentId, setStudentId] = useState('');
  const [amount, setAmount] = useState('');
  const [dueAt, setDueAt] = useState(new Date().toISOString().slice(0, 10));
  const [description, setDescription] = useState('Занятие');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const [payments, roster] = await Promise.all([api.get<Payment[]>('/payments/teacher'), api.get<Student[]>('/teachers/students')]);
    setRows(payments); setStudents(roster);
    if (!studentId && roster.length) setStudentId(roster[0].id);
  }, [studentId]);
  useEffect(() => { load().catch(() => toast.error('Не удалось загрузить оплату')).finally(() => setLoading(false)); }, [load]);

  const create = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    try { await api.post('/payments', { studentId, amount: Number(amount), dueAt: new Date(`${dueAt}T12:00:00`).toISOString(), description }); setAmount(''); await load(); toast.success('Начисление добавлено'); }
    catch (error: any) { toast.error(error.response?.data?.message || 'Не удалось добавить начисление'); }
    finally { setSaving(false); }
  };

  const update = async (payment: Payment, status: Payment['status']) => {
    try { await api.patch(`/payments/${payment.id}`, { status }); await load(); toast.success(status === 'paid' ? 'Оплата отмечена' : 'Статус обновлён'); }
    catch (error: any) { toast.error(error.response?.data?.message || 'Не удалось обновить статус'); }
  };

  const exportCsv = () => {
    const values = [['Ученик', 'Сумма', 'Валюта', 'Срок оплаты', 'Статус', 'Описание'], ...rows.map((row) => [fullName(row.student?.user), String(row.amount), row.currency, new Date(row.dueAt).toLocaleDateString('ru-RU'), statusLabel(row.status), row.description ?? ''])];
    const csv = '\uFEFF' + values.map((line) => line.map((cell) => `"${cell.replaceAll('"', '""')}"`).join(';')).join('\r\n');
    const link = document.createElement('a'); link.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' })); link.download = 'tvoimatplan-payments.csv'; link.click(); URL.revokeObjectURL(link.href);
  };

  const due = rows.filter((row) => ['pending', 'overdue'].includes(row.status)).reduce((sum, row) => sum + row.amount, 0);
  const paid = rows.filter((row) => row.status === 'paid').reduce((sum, row) => sum + row.amount, 0);

  if (loading) return <div className="skeleton h-72 max-w-5xl rounded-2xl" />;
  return <div className="mx-auto max-w-5xl space-y-5"><header className="flex flex-wrap items-start justify-between gap-3"><div><h1 className="text-xl font-semibold text-[rgb(var(--text))]">Учёт оплат</h1><p className="mt-1 text-sm text-[rgb(var(--text-2))]">Фиксируйте начисления и отмечайте поступившие оплаты.</p></div><Button variant="outline" onClick={exportCsv}><Download className="h-4 w-4" />Экспорт CSV</Button></header>
    <div className="grid gap-4 sm:grid-cols-2"><Metric label="Оплачено" amount={paid} /><Metric label="Ожидается" amount={due} /></div>
    <Card><CardHeader><CardTitle className="flex items-center gap-2"><Plus className="h-4 w-4 text-primary-500" />Новое начисление</CardTitle></CardHeader><CardContent>{students.length ? <form onSubmit={create} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5"><select required value={studentId} onChange={(e) => setStudentId(e.target.value)} className="rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--surface))] px-3 py-2 text-sm">{students.map((s) => <option key={s.id} value={s.id}>{fullName(s.user)}</option>)}</select><input required min="0.01" step="0.01" type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="Сумма, ₽" className="rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--surface))] px-3 py-2 text-sm" /><input required type="date" value={dueAt} onChange={(e) => setDueAt(e.target.value)} className="rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--surface))] px-3 py-2 text-sm" /><input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="За что" className="rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--surface))] px-3 py-2 text-sm" /><Button type="submit" isLoading={saving}>Добавить</Button></form> : <p className="text-sm text-[rgb(var(--text-2))]">Сначала привяжите ученика к кабинету.</p>}</CardContent></Card>
    <Card><CardHeader><CardTitle>Начисления</CardTitle></CardHeader><CardContent>{rows.length ? <div className="space-y-2">{rows.map((row) => <div key={row.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[rgb(var(--border))] p-4"><div><p className="font-medium text-[rgb(var(--text))]">{fullName(row.student?.user)} · {row.amount.toLocaleString('ru-RU')} ₽</p><p className="mt-1 text-xs text-[rgb(var(--text-2))]">{row.description || 'Занятие'} · до {new Date(row.dueAt).toLocaleDateString('ru-RU')}</p></div><div className="flex items-center gap-2"><span className={`text-xs font-medium ${row.status === 'paid' ? 'text-emerald-700' : row.status === 'overdue' ? 'text-rose-700' : 'text-amber-700'}`}>{statusLabel(row.status)}</span>{row.status !== 'paid' && row.status !== 'cancelled' && <Button size="sm" variant="outline" onClick={() => update(row, 'paid')}>Отметить оплату</Button>}{row.status === 'paid' && <Button size="sm" variant="ghost" onClick={() => update(row, 'pending')}>Отменить отметку</Button>}</div></div>)}</div> : <p className="text-sm text-[rgb(var(--text-2))]">Начислений пока нет.</p>}</CardContent></Card>
  </div>;
}

function Metric({ label, amount }: { label: string; amount: number }) { return <Card><CardContent className="flex items-center gap-3 pt-5"><span className="flex h-10 w-10 items-center justify-center rounded-xl icon-green"><CircleDollarSign className="h-5 w-5 text-white" /></span><div><p className="text-xl font-semibold text-[rgb(var(--text))]">{amount.toLocaleString('ru-RU')} ₽</p><p className="text-xs text-[rgb(var(--text-2))]">{label}</p></div></CardContent></Card>; }
function statusLabel(status: Payment['status']) { return ({ pending: 'Ожидается', overdue: 'Просрочено', paid: 'Оплачено', cancelled: 'Отменено' })[status]; }
