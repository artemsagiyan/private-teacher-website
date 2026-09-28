'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/store/auth.store';
import { isNavActive, navForRole, roleLabel, type NavItem } from './nav';
import { Wordmark } from '@/components/layout/wordmark';
import { UserAvatar } from './user-avatar';

export function DashboardSidebar({
  onNavigate,
  className,
}: {
  onNavigate?: () => void;
  className?: string;
}) {
  const { user } = useAuthStore();
  const pathname = usePathname();
  const nav = navForRole(user?.role);
  const initials = [user?.firstName?.[0], user?.lastName?.[0]]
    .filter(Boolean)
    .join('');

  return (
    <aside
      className={cn(
        'sidebar flex h-full w-60 shrink-0 flex-col',
        className,
      )}
    >
      <div className="flex h-14 shrink-0 items-center px-5">
        <Link
          href="/"
          onClick={onNavigate}
          className="group flex items-center gap-2.5"
        >
          <img src="/swan.png" alt="" className="h-8 w-8 shrink-0 object-contain" />
          <Wordmark className="text-base" />
        </Link>
      </div>

      <div className="mx-4 h-px bg-[rgb(var(--sidebar-border))]" />

      <nav className="mt-1 flex-1 space-y-0.5 overflow-y-auto p-3">
        {nav.map((item) => (
          <NavLink
            key={item.href}
            item={item}
            active={isNavActive(pathname, item.href, user?.role)}
            onNavigate={onNavigate}
          />
        ))}
      </nav>

      <div className="mx-4 h-px bg-[rgb(var(--sidebar-border))]" />

      <div className="p-3">
        <div className="flex cursor-default items-center gap-3 rounded-xl px-3 py-2.5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary-600 text-[0.65rem] font-bold text-white">
            <UserAvatar className="h-full w-full object-cover" fallback={initials || '?'} />
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-[rgb(var(--text))]">
              {user?.firstName} {user?.lastName}
            </p>
            <p className="truncate text-xs text-[rgb(var(--text-3))]">
              {roleLabel[user?.role ?? ''] ?? user?.role}
            </p>
          </div>
        </div>
      </div>
    </aside>
  );
}

function NavLink({
  item,
  active,
  onNavigate,
}: {
  item: NavItem;
  active: boolean;
  onNavigate?: () => void;
}) {
  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      className={cn(
        'flex items-center gap-3 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors',
        active
          ? 'bg-[#E8DEF8] text-[#1D192B]'
          : 'text-[rgb(var(--text-2))] hover:bg-[#E7E0EC] hover:text-[rgb(var(--text))]',
      )}
    >
      <item.icon
        className={cn(
          'h-4 w-4 shrink-0',
          active ? 'text-[#1D192B]' : 'text-[rgb(var(--text-3))]',
        )}
      />
      <span className="truncate">{item.label}</span>
    </Link>
  );
}
