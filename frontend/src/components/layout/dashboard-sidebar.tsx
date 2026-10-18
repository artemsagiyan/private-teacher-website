'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/store/auth.store';
import {
  groupForPath,
  isNavActive,
  navForRole,
  roleLabel,
  type NavGroup,
  type NavItem,
} from './nav';
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
  const navigation = navForRole(user?.role);
  const activeGroup = groupForPath(navigation.groups, pathname);
  const [openGroup, setOpenGroup] = useState<string | undefined>(activeGroup);
  const initials = [user?.firstName?.[0], user?.lastName?.[0]]
    .filter(Boolean)
    .join('');

  useEffect(() => {
    if (activeGroup) setOpenGroup(activeGroup);
  }, [activeGroup]);

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
          <Wordmark light className="text-base" />
        </Link>
      </div>

      <div className="mx-4 h-px bg-[rgb(var(--sidebar-border))]" />

      <nav aria-label="Основная навигация" className="mt-1 flex-1 space-y-0.5 overflow-y-auto p-3">
        <NavLink
          item={navigation.home}
          active={isNavActive(pathname, navigation.home.href, user?.role)}
          onNavigate={onNavigate}
        />
        <div className="my-2 h-px bg-[rgb(var(--sidebar-border))]/70" />
        {navigation.groups.map((group) => (
          <NavGroupSection
            key={group.id}
            group={group}
            pathname={pathname}
            role={user?.role}
            open={openGroup === group.id}
            onToggle={() =>
              setOpenGroup((current) =>
                current === group.id ? undefined : group.id,
              )
            }
            onNavigate={onNavigate}
          />
        ))}
      </nav>

      <div className="mx-4 h-px bg-[rgb(var(--sidebar-border))]" />

      <div className="p-3">
        <div className="flex cursor-default items-center gap-3 rounded-xl px-3 py-2.5">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-[#FEEFDC] text-[0.65rem] font-bold text-[#3F1116]">
            <UserAvatar className="h-full w-full object-cover" fallback={initials || '?'} />
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-[#FFF1E9]">
              {user?.firstName} {user?.lastName}
            </p>
            <p className="truncate text-xs text-[#FEEFDC]/55">
              {roleLabel[user?.role ?? ''] ?? user?.role}
            </p>
          </div>
        </div>
      </div>
    </aside>
  );
}

function NavGroupSection({
  group,
  pathname,
  role,
  open,
  onToggle,
  onNavigate,
}: {
  group: NavGroup;
  pathname: string;
  role?: string;
  open: boolean;
  onToggle: () => void;
  onNavigate?: () => void;
}) {
  const active = group.items.some((item) =>
    isNavActive(pathname, item.href, role),
  );
  const GroupIcon = group.icon;

  return (
    <div className="space-y-0.5">
      <button
        type="button"
        onClick={onToggle}
        className={cn(
          'group flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left text-sm font-medium transition-all',
          active
            ? 'text-[#FFF1E9]'
            : 'text-[#FEEFDC]/65 hover:bg-[#64343C] hover:text-[#FFF1E9]',
        )}
        aria-expanded={open}
        aria-controls={`sidebar-group-${group.id}`}
      >
        <GroupIcon
          className={cn(
            'h-4 w-4 shrink-0',
            active
              ? 'text-[#FEEFDC]'
              : 'text-[#9D7960] group-hover:text-[#FFF1E9]',
          )}
        />
        <span className="min-w-0 flex-1 truncate">{group.label}</span>
        {open ? (
          <ChevronDown className="h-4 w-4 shrink-0 opacity-70" />
        ) : (
          <ChevronRight className="h-4 w-4 shrink-0 opacity-70" />
        )}
      </button>
      <div
        id={`sidebar-group-${group.id}`}
        hidden={!open}
        className="ml-3 space-y-0.5 border-l border-[#9D7960]/35 pl-2"
      >
        {group.items.map((item) => (
          <NavLink
            key={item.href}
            item={item}
            active={isNavActive(pathname, item.href, role)}
            onNavigate={onNavigate}
            nested
          />
        ))}
      </div>
    </div>
  );
}

function NavLink({
  item,
  active,
  onNavigate,
  nested = false,
}: {
  item: NavItem;
  active: boolean;
  onNavigate?: () => void;
  nested?: boolean;
}) {
  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      className={cn(
        'group flex items-center gap-3 rounded-xl text-sm font-medium transition-all',
        nested ? 'px-3 py-2.5' : 'px-4 py-3',
        active
          ? 'bg-[#FFF1E9] text-[#3F1116] shadow-[0_8px_22px_rgb(0_0_0/0.16)]'
          : 'text-[#FEEFDC]/65 hover:bg-[#64343C] hover:text-[#FFF1E9]',
      )}
    >
      <item.icon
        className={cn(
          'h-4 w-4 shrink-0',
          active ? 'text-[#3F1116]' : 'text-[#9D7960] group-hover:text-[#FFF1E9]',
        )}
      />
      <span className="truncate">{item.label}</span>
    </Link>
  );
}
