/** Имя очереди BullMQ для напоминаний о задачах */
export const TASK_REMINDERS_QUEUE = 'task-reminders';

/** Имена job-типов в очереди */
export const JOBS = {
  TASK_REMINDER: 'task-reminder',
  RANDOM_CHECKIN: 'random-checkin',
} as const;

export type JobName = (typeof JOBS)[keyof typeof JOBS];
