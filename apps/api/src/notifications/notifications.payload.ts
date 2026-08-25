/**
 * Exact allowlist for task-reminder messages sent to Expo.
 * The token is delivery addressing only; no caller metadata is accepted.
 */
export interface TaskReminderExpoPayload {
  readonly to: string;
  readonly title: 'Focus';
  readonly body: 'Пора начинать';
  readonly sound: 'default';
  readonly data: {
    readonly type: 'task-reminder';
  };
}

export function buildTaskReminderExpoPayload(token: string): TaskReminderExpoPayload {
  return {
    to: token,
    title: 'Focus',
    body: 'Пора начинать',
    sound: 'default',
    data: { type: 'task-reminder' },
  };
}
