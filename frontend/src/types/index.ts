export type UserRole = 'admin' | 'teacher' | 'student';

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  phone?: string;
  avatarUrl?: string;
  isBlocked: boolean;
  isEmailVerified: boolean;
  createdAt: string;
}

export interface Teacher {
  id: string;
  userId: string;
  bio?: string;
  subjects?: string;
  inviteCode?: string;
  user: User;
  students?: Student[];
}

export interface Student {
  id: string;
  userId: string;
  teacherId?: string;
  teacher?: Teacher;
  user: User;
}

export type SlotStatus = 'available' | 'booked' | 'unavailable' | 'cancelled';
export type LessonType = 'individual' | 'group';

export interface CalendarSlot {
  id: string;
  teacherId: string;
  startTime: string;
  endTime: string;
  status: SlotStatus;
  lessonType: LessonType;
  capacity: number;
  bookedCount: number;
  note?: string;
  isRecurring: boolean;
  recurringGroupId?: string;
  createdAt: string;
}

export type BookingStatus =
  | 'confirmed'
  | 'cancelled_by_student'
  | 'cancelled_by_teacher'
  | 'completed';

export interface Booking {
  id: string;
  studentId: string;
  slotId: string;
  status: BookingStatus;
  cancellationReason?: string;
  isRecurring: boolean;
  recurringGroupId?: string;
  createdAt: string;
  slot: CalendarSlot & { teacher?: Teacher };
  student?: Student;
}

export type NotificationType =
  | 'booking_confirmed'
  | 'booking_cancelled'
  | 'schedule_changed'
  | 'reminder_24h'
  | 'reminder_1h'
  | 'teacher_invitation';

export interface Notification {
  id: string;
  userId: string;
  message: string;
  type: NotificationType;
  isRead: boolean;
  relatedId?: string;
  createdAt: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  user: User;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}
