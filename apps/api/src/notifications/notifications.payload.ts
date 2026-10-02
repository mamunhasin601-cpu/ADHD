/**
 * Exact allowlist for task-reminder messages sent to Expo.
 * The token is delivery addressing only; no caller metadata is accepted.
 */
export interface TaskReminderExpoPayload {
  readonly to: string;
  readonly title: 'Focus';
  readonly body: string;
  readonly sound: 'default';
  readonly data: {
    readonly type: 'task-reminder';
    readonly taskId: string;
    readonly scheduledFor: string;
  };
}

export interface TaskReminderContent {
  readonly taskId: string;
  readonly title: string;
  readonly scheduledFor: string;
}

export function buildTaskReminderExpoPayload(
  token: string,
  reminder: TaskReminderContent,
): TaskReminderExpoPayload {
  return {
    to: token,
    title: 'Focus',
    body: `По плану сейчас: «${reminder.title}»`,
    sound: 'default',
    data: {
      type: 'task-reminder',
      taskId: reminder.taskId,
      scheduledFor: reminder.scheduledFor,
    },
  };
}
