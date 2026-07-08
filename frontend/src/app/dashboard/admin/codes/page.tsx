'use client';

import { useEffect, useState } from 'react';
import { Plus, Copy, Check, Shield, Clock } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { formatDateTime } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface RegCode { id: string; code: string; isUsed: boolean; usedByEmail?: string; expiresAt: string; createdAt: string; }

export default function AdminCodesPage() {
  const [codes, setCodes]       = useState<RegCode[]>([]);
  const [generating, setGenerating] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const load = async () => { const d = await api.get<RegCode[]>('/admin/codes'); setCodes(d); };
  useEffect(() => { load(); }, []);

  const generate = async () => {
    setGenerating(true);
    try {
      await api.post('/admin/codes', { expiresInDays: 7 });
      toast.success('Код создан — действует 7 дней');
      load();
    } finally { setGenerating(false); }
  };

  const copy = (c: RegCode) => {
    navigator.clipboard.writeText(c.code);
    setCopiedId(c.id);
    setTimeout(() => setCopiedId(null), 2000);
    toast.success('Скопировано');
  };

  const active  = codes.filter((c) => !c.isUsed && new Date(c.expiresAt) > new Date()).length;
  const expired = codes.filter((c) => !c.isUsed && new Date(c.expiresAt) <= new Date()).length;

  return (
    <div className="space-y-5 max-w-4xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-[rgb(var(--text))] tracking-tight">Коды регистрации</h1>
          <p className="text-sm text-[rgb(var(--text-2))] mt-0.5">Для регистрации преподавателей</p>
        </div>
        <Button onClick={generate} isLoading={generating} variant="gradient" size="sm">
          <Plus className="h-4 w-4" /> Создать код
        </Button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Активных', value: active,            iconClass: 'icon-green' },
          { label: 'Использованных', value: codes.filter((c) => c.isUsed).length, iconClass: 'icon-violet' },
          { label: 'Истёкших',  value: expired,           iconClass: 'icon-orange' },
        ].map(({ label, value, iconClass }) => (
          <Card key={label}>
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-3">
                <div className={`h-8 w-8 rounded-lg ${iconClass} flex items-center justify-center shrink-0`}>
                  <Shield className="h-4 w-4 text-white" />
                </div>
                <div>
                  <p className="text-xl font-bold text-[rgb(var(--text))]">{value}</p>
                  <p className="text-[0.72rem] text-[rgb(var(--text-2))]">{label}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardContent className="p-0">
          <table className="w-full text-[0.82rem]">
            <thead>
              <tr className="border-b border-[rgb(var(--border))]">
                {['Код', 'Статус', 'Использован', 'Истекает', ''].map((h) => (
                  <th key={h} className="text-left py-3 px-4 text-xs font-medium text-[rgb(var(--text-3))] uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {codes.length === 0 ? (
                <tr><td colSpan={5} className="py-12 text-center text-[rgb(var(--text-2))] text-sm">Кодов нет — создайте первый</td></tr>
              ) : codes.map((c) => {
                const isExpired = new Date(c.expiresAt) < new Date();
                const status = c.isUsed ? 'used' : isExpired ? 'expired' : 'active';
                const badgeMap = { used: 'secondary', expired: 'danger', active: 'success' } as const;
                const labelMap = { used: 'Использован', expired: 'Истёк', active: 'Активен' };
                return (
                  <tr key={c.id} className="border-b border-[rgb(var(--border))] hover:bg-[rgb(var(--surface-2))] transition-colors last:border-0">
                    <td className="py-3 px-4">
                      <span className="font-mono font-bold tracking-[0.15em] text-[rgb(var(--text))]">{c.code}</span>
                    </td>
                    <td className="py-3 px-4">
                      <Badge variant={badgeMap[status]} dot>{labelMap[status]}</Badge>
                    </td>
                    <td className="py-3 px-4 text-[rgb(var(--text-3))] text-[0.75rem]">
                      {c.usedByEmail || '—'}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-1.5 text-[rgb(var(--text-3))] text-[0.75rem]">
                        <Clock className="h-3 w-3" />
                        {formatDateTime(c.expiresAt)}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      {status === 'active' && (
                        <button
                          onClick={() => copy(c)}
                          className="h-7 w-7 rounded-lg flex items-center justify-center hover:bg-[rgb(var(--surface-2))] transition-colors"
                          title="Скопировать"
                        >
                          {copiedId === c.id
                            ? <Check className="h-4 w-4 text-emerald-500" />
                            : <Copy className="h-4 w-4 text-[rgb(var(--text-3))]" />
                          }
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
