/**
 * Общие TypeScript-типы для всего монорепозитория.
 * Используются как в backend (NestJS), так и в mobile (Expo) и web (Next.js).
 */

// ────────────────────────────────────────────────────────────
// User
// ────────────────────────────────────────────────────────────

export interface User {
  id: string;
  email: string | null;
  phone: string | null;
  timezone: string;
  hasCompletedOnboarding: boolean;
  createdAt: Date;
}

// ────────────────────────────────────────────────────────────
// Task
// ────────────────────────────────────────────────────────────

export interface Task {
  id: string;
  userId: string;
  title: string;
  startTime: Date | null;
  durationMinutes: number;
  color: string;
  isRecurring: boolean;
  recurrenceRule: string | null; // iCal RRULE, напр. "FREQ=DAILY;BYDAY=MO,TU,WE,TH,FR"
  parentTaskId: string | null;   // для подзадач
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  subTasks?: Task[];
}

export interface CreateTaskDto {
  title: string;
  startTime?: string | null; // ISO 8601
  durationMinutes?: number;
  color?: string;
  isRecurring?: boolean;
  recurrenceRule?: string | null;
  parentTaskId?: string | null;
}

export interface UpdateTaskDto extends Partial<CreateTaskDto> {
  completedAt?: string | null;
}

// ────────────────────────────────────────────────────────────
// Routine
// ────────────────────────────────────────────────────────────

/** daysOfWeek: 0=Вс, 1=Пн, ..., 6=Сб */
export interface Routine {
  id: string;
  userId: string;
  name: string;
  daysOfWeek: number[];
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateRoutineDto {
  name: string;
  daysOfWeek: number[];
}

export interface UpdateRoutineDto extends Partial<CreateRoutineDto> {}

// ────────────────────────────────────────────────────────────
// FocusSession (body doubling)
// ────────────────────────────────────────────────────────────

export interface FocusSession {
  id: string;
  hostUserId: string;
  dailyRoomUrl: string | null;
  isPublic: boolean;
  maxParticipants: number;
  timerMinutes: number;
  createdAt: Date;
  endedAt: Date | null;
}

export interface FocusSessionParticipant {
  id: string;
  sessionId: string;
  userId: string;
  joinedAt: Date;
  leftAt: Date | null;
}

// ────────────────────────────────────────────────────────────
// Auth
// ────────────────────────────────────────────────────────────

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface JwtPayload {
  sub: string;  // userId
  email: string | null;
  phone: string | null;
  iat?: number;
  exp?: number;
}

// ────────────────────────────────────────────────────────────
// Notification
// ────────────────────────────────────────────────────────────

export interface NotificationLog {
  id: string;
  userId: string;
  taskId: string | null;
  sentAt: Date;
  delivered: boolean;
}

// ────────────────────────────────────────────────────────────
// API response helpers
// ────────────────────────────────────────────────────────────

export interface ApiResponse<T> {
  data: T;
  message?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
}
