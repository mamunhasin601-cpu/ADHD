import type { TimeFormat } from '@focus/shared-types';
import { formatWallClock } from './time-format';
import { TIMELINE_CONFIG } from './timeline-config';
import type { TimelineFreeWindow } from './timeline-free-windows';

function formatTimelineMinute(
  minutesFromStart: number,
  timeFormat: TimeFormat,
): string {
  const totalMinutes =
    TIMELINE_CONFIG.dayStartHour * 60 + minutesFromStart;
  return formatWallClock(
    Math.floor(totalMinutes / 60) % 24,
    totalMinutes % 60,
    timeFormat,
  );
}

function minuteWord(minutes: number): string {
  const lastTwo = minutes % 100;
  const last = minutes % 10;
  if (lastTwo >= 11 && lastTwo <= 14) return 'минут';
  if (last === 1) return 'минута';
  if (last >= 2 && last <= 4) return 'минуты';
  return 'минут';
}

function hourWord(hours: number): string {
  const lastTwo = hours % 100;
  const last = hours % 10;
  if (lastTwo >= 11 && lastTwo <= 14) return 'часов';
  if (last === 1) return 'час';
  if (last >= 2 && last <= 4) return 'часа';
  return 'часов';
}

export function formatTimelineFreeWindowDuration(durationMinutes: number): string {
  const hours = Math.floor(durationMinutes / 60);
  const minutes = durationMinutes % 60;

  if (hours > 0 && minutes > 0) return `${hours} ч ${minutes} мин`;
  if (hours > 0) return `${hours} ч`;
  return `${minutes} мин`;
}

function formatTimelineFreeWindowDurationSpoken(durationMinutes: number): string {
  const hours = Math.floor(durationMinutes / 60);
  const minutes = durationMinutes % 60;
  const parts: string[] = [];

  if (hours > 0) parts.push(`${hours} ${hourWord(hours)}`);
  if (minutes > 0 || hours === 0) parts.push(`${minutes} ${minuteWord(minutes)}`);
  return parts.join(' ');
}

/** Presentation-only accessibility copy derived from computed geometry. */
export function formatTimelineFreeWindowAccessibilityLabel(
  window: TimelineFreeWindow,
  timeFormat: TimeFormat,
): string {
  const start = formatTimelineMinute(window.startMinutes, timeFormat);
  const end = formatTimelineMinute(window.endMinutes, timeFormat);
  return `Свободное окно с ${start} до ${end}, ${formatTimelineFreeWindowDurationSpoken(window.durationMinutes)}`;
}
