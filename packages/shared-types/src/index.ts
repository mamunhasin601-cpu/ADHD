/**
 * Общие TypeScript-типы для всего монорепозитория.
 * Используются как в backend (NestJS), так и в mobile (Expo) и web (Next.js).
 */

// ────────────────────────────────────────────────────────────
// User
// ────────────────────────────────────────────────────────────

export type Plan = 'FREE' | 'PRO';
export type TimeFormat = 'SYSTEM' | 'H24' | 'H12';
export type TaskKind = 'TASK' | 'REST' | 'BUFFER';
export type RecurrenceEditScope = 'ONLY_THIS' | 'THIS_AND_FUTURE' | 'ENTIRE_SERIES';

export const FREE_TIER_LIMITS = {
  /** Максимальное количество активных задач для Free пользователей */
  maxActiveTasks: 50,
} as const;

export interface User {
  id: string;
  email: string | null;
  phone: string | null;
  timezone: string;
  /** Last authoritative smartphone timezone sync returned by the API. */
  timezoneSyncedAt?: Date | string | null;
  timeFormat: TimeFormat;
  hasCompletedOnboarding: boolean;
  plan: Plan;
  proExpiresAt: Date | null;
  createdAt: Date;
}

// ────────────────────────────────────────────────────────────
// Task
// ────────────────────────────────────────────────────────────

export interface Task {
  id: string;
  userId: string;
  title: string;
  /** Missing only on legacy cached payloads; consumers must treat it as TASK. */
  kind?: TaskKind;
  startTime: Date | null;
  durationMinutes: number | null;
  color: string;
  isRecurring: boolean;
  recurrenceRule: string | null; // iCal RRULE, напр. "FREQ=DAILY;BYDAY=MO,TU,WE,TH,FR"
  /** Present only on a concrete occurrence; the stable id of its series. */
  seriesId?: string | null;
  /** Stable logical family identity shared by every technical series segment. */
  recurrenceRootId?: string | null;
  /** Profile-local YYYY-MM-DD occurrence identity. */
  recurrenceDateKey?: string | null;
  recurrenceEndedAt?: Date | null;
  /** Immutable series anchor metadata supplied for occurrence editing. */
  seriesStartTime?: Date | null;
  seriesTimezone?: string | null;
  seriesRecurrenceRule?: string | null;
  parentTaskId: string | null;   // для подзадач
  completedAt: Date | null;
  /** Server-confirmed start of the currently active task; cleared on lost focus. */
  startedAt: Date | null;
  /** Optional user-authored, observable entry action; not a subtask or start state. */
  firstStep: string | null;
  createdAt: Date;
  updatedAt: Date;
  subTasks?: Task[];
  affectedOccurrenceIds?: string[];
  newOccurrenceIds?: string[];
}

export interface StartTaskRequest {
  confirmSwitch?: boolean;
  confirmEarlyStart?: boolean;
}

export interface ActiveTaskConflict {
  code: 'ACTIVE_TASK_CONFLICT';
  message: string;
  activeTask: Pick<Task, 'id' | 'title' | 'startedAt'>;
}

export interface EarlyStartConflict {
  code: 'EARLY_START_CONFIRMATION_REQUIRED';
  message: string;
  scheduledTask: Pick<Task, 'id' | 'title' | 'startTime'>;
}

export interface CreateTaskDto {
  /** Owner-scoped retry identity for root creation; distinct from task and part ids. */
  createRequestId?: string;
  title: string;
  /** Omitted by legacy clients and therefore persisted as TASK. */
  kind?: TaskKind;
  firstStep?: string | null;
  startTime?: string | null; // ISO 8601
  durationMinutes?: number | null;
  color?: string;
  isRecurring?: boolean;
  recurrenceRule?: string | null;
  deviceTimezone?: string;
  editRecurrenceAnchor?: boolean;
  editRecurrencePattern?: boolean;
  parentTaskId?: string | null;
  subTasks?: TaskPartWrite[];
}

export interface UpdateTaskDto extends Partial<Omit<CreateTaskDto, 'createRequestId'>> {
  completedAt?: string | null;
  /** Required by new clients when editing a concrete recurring occurrence. */
  recurrenceEditScope?: RecurrenceEditScope;
}

export interface TaskPartWrite {
  id?: string;
  title: string;
  completed?: boolean;
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
// Recovery (Guilt-Free Return)
// ────────────────────────────────────────────────────────────

/**
 * GET /tasks/recovery response
 */
export interface OverdueTasksResponse {
  tasks: Task[];
  userTimezone: string;
  /** ISO-8601 UTC — начало текущего локального дня пользователя */
  localDayStart: string;
}

/**
 * Один элемент mapping для reschedule command
 * targetStartTime: ISO-8601 UTC string → reschedule, null → move to Inbox
 */
export interface RescheduleItem {
  taskId: string;
  targetStartTime: string | null;
}

/**
 * POST /tasks/recovery/reschedule request body
 */
export interface RescheduleRecoveryRequest {
  items: RescheduleItem[];
}

/**
 * POST /tasks/recovery/reschedule response
 */
export interface RescheduleRecoveryResponse {
  undoId?: string;
  undoExpiresAt?: string;
  updatedCount: number;
  taskUpdateStatus: 'ok';
  reminderSyncStatus: 'ok' | 'partial';
  /** taskIds для которых reminder sync не удался */
  failedReminderSyncs?: string[];
}

export interface UndoRecoveryResponse {
  restoredCount: number;
  taskRestoreStatus: 'ok' | 'already-undone';
  reminderSyncStatus: 'ok' | 'partial';
  failedReminderSyncs?: string[];
  tasks: Array<{ id: string; startTime: string | Date | null }>;
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
