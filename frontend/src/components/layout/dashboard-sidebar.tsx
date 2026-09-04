'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { GraduationCap, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/store/auth.store';
import { isNavActive, navForRole, roleLabel, type NavItem } from './nav';
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
          <div className="icon-blue flex h-7 w-7 shrink-0 items-center justify-center rounded-lg shadow-glow">
            <GraduationCap className="h-4 w-4 text-white" />
          </div>
          <span className="text-sm font-bold tracking-tight text-white/90 transition-colors group-hover:text-white">
            TutorPlatform
          </span>
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
        <div className="flex cursor-default items-center gap-3 rounded-lg px-3 py-2.5 transition-colors hover:bg-white/5">
          <div className="icon-violet flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-lg text-[0.65rem] font-bold text-white">
            <UserAvatar className="h-full w-full object-cover" fallback={initials || '?'} />
          </div>
          <div className="min-w-0">
            <p className="truncate text-[0.78rem] font-medium text-white/80">
              {user?.firstName} {user?.lastName}
            </p>
            <p className="truncate text-[0.68rem] text-white/35">
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
        'group relative flex items-center gap-3 rounded-lg px-3 py-2 text-[0.82rem] font-medium transition-all duration-150',
        active
          ? 'bg-white/10 text-white'
          : 'text-white/45 hover:bg-white/5 hover:text-white/80',
      )}
    >
      {active && (
        <span className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-r-full bg-primary-400" />
      )}
      <item.icon
        className={cn(
          'h-4 w-4 shrink-0 transition-colors',
          active
            ? 'text-primary-400'
            : 'text-white/35 group-hover:text-white/60',
        )}
      />
      <span className="truncate">{item.label}</span>
      {active && <ChevronRight className="ml-auto h-3 w-3 text-white/30" />}
    </Link>
  );
}
