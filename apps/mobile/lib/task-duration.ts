export const TASK_DURATION_PRESETS = [null, 15, 30, 45, 60, 90, 120] as const;

export type TaskDurationPreset = (typeof TASK_DURATION_PRESETS)[number];

export function taskDurationLabel(durationMinutes: number | null): string {
  return durationMinutes === null ? 'Не знаю' : `${durationMinutes} мин`;
}
