/** Shared lesson/booking window rules — keep in sync with backend livekit config. */

export const LESSON_JOIN_EARLY_MS = 30 * 60_000;
export const LESSON_JOIN_LATE_MS = 120 * 60_000;
export const BOOKING_CANCEL_MIN_HOURS = 24;
export const SLOT_DURATION_MS = 60 * 60_000;
export const RECURRING_WEEKS = 4;
export const CAL_SLOT_MIN = '08:00:00';
export const CAL_SLOT_MAX = '22:00:00';
export const CAL_HOURS_START = 8;
export const CAL_HOURS_END = 22;

export function canJoinLesson(
  startTime: string | Date,
  endTime: string | Date,
  now = Date.now(),
) {
  const start = new Date(startTime).getTime();
  const end = new Date(endTime).getTime();
  return now >= start - LESSON_JOIN_EARLY_MS && now <= end + LESSON_JOIN_LATE_MS;
}

export function canCancelBooking(startTime: string | Date, now = Date.now()) {
  return (new Date(startTime).getTime() - now) / 3_600_000 >= BOOKING_CANCEL_MIN_HOURS;
}

export function lessonTypeLabel(type: string) {
  return type === 'individual' ? 'Индивидуальное' : 'Групповое';
}

export function slotStatusLabel(status: string) {
  switch (status) {
    case 'available':
      return 'Свободно';
    case 'booked':
      return 'Заполнено';
    case 'cancelled':
      return 'Отменено';
    default:
      return status;
  }
}
