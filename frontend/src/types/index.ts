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
  hasPassword?: boolean;
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
  teacher?: Teacher;
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
  | 'teacher_invitation'
  | 'lesson_report_ready'
  | 'lesson_failed';

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

export type LessonStatus =
  | 'waiting'
  | 'starting'
  | 'active'
  | 'ending'
  | 'processing'
  | 'completed'
  | 'failed';

export interface LessonReport {
  summary: string;
  topics: string[];
  achievements: string[];
  difficulties: string[];
  homework: string[];
  recommendations: string[];
  keyMoments: Array<{ time?: string; description: string }>;
}

export interface LessonRecord {
  id: string;
  slotId: string;
  roomName: string;
  status: LessonStatus;
  participantCount: number;
  startedAt?: string;
  endedAt?: string;
  endReason?: 'teacher' | 'empty_room' | 'room_finished' | 'system';
  boardUpdatedAt?: string;
  boardRevision?: number;
  transcriptLanguage?: string;
  transcriptDurationSeconds?: number;
  processingError?: string;
  createdAt: string;
  slot: CalendarSlot;
  teacher?: Teacher;
  report?: LessonReport | { summary: string } | null;
  files: {
    board: boolean;
    recording: boolean;
    transcript: boolean;
    report: boolean;
  };
}
