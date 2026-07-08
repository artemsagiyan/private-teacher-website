'use client';

import { useEffect, useState, useCallback } from 'react';
import { Search, UserX, UserCheck, Users } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { User } from '@/types';
import { formatDate, fullName } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

const roleConfig: Record<string, { label: string; variant: any }> = {
  admin:   { label: 'Администратор', variant: 'violet' },
  teacher: { label: 'Преподаватель', variant: 'default' },
  student: { label: 'Ученик',        variant: 'secondary' },
};

export default function AdminUsersPage() {
  const [users, setUsers]   = useState<User[]>([]);
  const [total, setTotal]   = useState(0);
  const [search, setSearch] = useState('');
  const [page, setPage]     = useState(1);
  const [loading, setLoading] = useState(false);
  const limit = 20;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.get<{ users: User[]; total: number }>('/admin/users', {
        params: { page, limit, search: search || undefined },
      });
      setUsers(data.users);
      setTotal(data.total);
    } finally { setLoading(false); }
  }, [page, search]);

  useEffect(() => { load(); }, [load]);

  const handleBlock = async (u: User) => {
    const action = u.isBlocked ? 'разблокировать' : 'заблокировать';
    if (!confirm(`${action.charAt(0).toUpperCase() + action.slice(1)} ${fullName(u)}?`)) return;
    try {
      await api.patch(`/admin/users/${u.id}/block`, { isBlocked: !u.isBlocked });
      toast.success(u.isBlocked ? 'Пользователь разблокирован' : 'Пользователь заблокирован');
      load();
    } catch { toast.error('Ошибка'); }
  };

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="space-y-5 max-w-5xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-[rgb(var(--text))] tracking-tight">Пользователи</h1>
          <p className="text-sm text-[rgb(var(--text-2))] mt-0.5">{total} всего</p>
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[rgb(var(--text-3))]" />
        <Input
          className="pl-9 text-sm"
          placeholder="Поиск по email или имени..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
        />
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-[0.82rem]">
              <thead>
                <tr className="border-b border-[rgb(var(--border))]">
                  {['Пользователь', 'Роль', 'Статус', 'Дата регистрации', ''].map((h) => (
                    <th key={h} className="text-left py-3 px-4 text-xs font-medium text-[rgb(var(--text-3))] uppercase tracking-wide">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  [...Array(5)].map((_, i) => (
                    <tr key={i} className="border-b border-[rgb(var(--border))]">
                      {[...Array(5)].map((_, j) => (
                        <td key={j} className="py-3 px-4">
                          <div className="skeleton h-4 rounded w-24" />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : users.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-12 text-center">
                      <Users className="h-8 w-8 mx-auto mb-2 text-[rgb(var(--text-3))]" />
                      <p className="text-sm text-[rgb(var(--text-2))]">Пользователи не найдены</p>
                    </td>
                  </tr>
                ) : users.map((u) => (
                  <tr key={u.id} className="border-b border-[rgb(var(--border))] hover:bg-[rgb(var(--surface-2))] transition-colors">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2.5">
                        <div className="h-7 w-7 rounded-lg icon-violet flex items-center justify-center text-white text-[0.65rem] font-bold shrink-0">
                          {u.firstName?.[0]}{u.lastName?.[0]}
                        </div>
                        <div>
                          <p className="font-medium text-[rgb(var(--text))]">{fullName(u) || '—'}</p>
                          <p className="text-[0.72rem] text-[rgb(var(--text-3))]">{u.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <Badge variant={roleConfig[u.role]?.variant ?? 'secondary'}>
                        {roleConfig[u.role]?.label ?? u.role}
                      </Badge>
                    </td>
                    <td className="py-3 px-4">
                      <Badge variant={u.isBlocked ? 'danger' : 'success'} dot>
                        {u.isBlocked ? 'Заблокирован' : 'Активен'}
                      </Badge>
                    </td>
                    <td className="py-3 px-4 text-[rgb(var(--text-3))]">
                      {formatDate(u.createdAt)}
                    </td>
                    <td className="py-3 px-4">
                      <button
                        onClick={() => handleBlock(u)}
                        title={u.isBlocked ? 'Разблокировать' : 'Заблокировать'}
                        className="h-7 w-7 rounded-lg flex items-center justify-center hover:bg-[rgb(var(--surface-2))] transition-colors"
                      >
                        {u.isBlocked
                          ? <UserCheck className="h-4 w-4 text-emerald-500" />
                          : <UserX className="h-4 w-4 text-red-400" />
                        }
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between p-4 border-t border-[rgb(var(--border))]">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                ← Назад
              </Button>
              <span className="text-xs text-[rgb(var(--text-2))]">Страница {page} из {totalPages}</span>
              <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
                Вперёд →
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
