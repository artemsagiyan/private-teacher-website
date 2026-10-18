import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { format, formatDistanceToNow } from 'date-fns';
import { ru } from 'date-fns/locale';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: string | Date) {
  return format(new Date(date), 'd MMMM yyyy', { locale: ru });
}

export function formatDateTime(date: string | Date) {
  return format(new Date(date), 'd MMMM yyyy, HH:mm', { locale: ru });
}

export function formatTime(date: string | Date) {
  return format(new Date(date), 'HH:mm');
}

export function timeAgo(date: string | Date) {
  return formatDistanceToNow(new Date(date), { addSuffix: true, locale: ru });
}

export function getSlotColor(status: string) {
  switch (status) {
    case 'available': return 'rgb(var(--brand-warm))';
    case 'booked':    return 'rgb(var(--brand-deep))';
    case 'cancelled': return 'rgb(var(--primary-500))';
    default:          return 'rgb(var(--brand-warm))';
  }
}

export function getSlotTextColor(status: string) {
  return status === 'available' ? 'rgb(var(--brand-deep))' : 'rgb(var(--primary-fg))';
}

export function fullName(user?: { firstName?: string; lastName?: string }) {
  if (!user) return '';
  return `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim();
}
