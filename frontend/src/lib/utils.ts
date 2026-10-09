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
    case 'available': return '#9D7960';
    case 'booked':    return '#3F1116';
    case 'cancelled': return '#64343C';
    default:          return '#9D7960';
  }
}

export function getSlotTextColor(status: string) {
  return status === 'available' ? '#3F1116' : '#FFF1E9';
}

export function fullName(user?: { firstName?: string; lastName?: string }) {
  if (!user) return '';
  return `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim();
}
