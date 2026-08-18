import type { Task } from '@focus/shared-types';
import { TIMELINE_CONFIG } from './timeline-config';
import { getTimelineMinutesFromStart } from './timeline-geometry';

export const MIN_FREE_WINDOW_MINUTES = 30;

export interface TimelineFreeWindow {
  startMinutes: number;
  endMinutes: number;
  durationMinutes: number;
  top: number;
  height: number;
}

interface TimelineInterval {
  start: number;
  end: number | null;
}

const visibleMinutes =
  (TIMELINE_CONFIG.dayEndHour - TIMELINE_CONFIG.dayStartHour) * 60;

function toGeometry(startMinutes: number, endMinutes: number): TimelineFreeWindow {
  const durationMinutes = endMinutes - startMinutes;
  return {
    startMinutes,
    endMinutes,
    durationMinutes,
    top: (startMinutes / 60) * TIMELINE_CONFIG.hourHeight,
    height: (durationMinutes / 60) * TIMELINE_CONFIG.hourHeight,
  };
}

/**
 * Returns only bounded, presentation-only gaps proven by the stored plan.
 * Day edges are never availability claims. An unknown-duration task can close
 * a preceding gap at its known start, but makes every later end uncertain.
 */
export function computeTimelineFreeWindows(
  tasks: Task[],
  profileTimezone?: string | null,
): TimelineFreeWindow[] {
  const intervals = tasks
    .filter((task) => task.startTime !== null)
    .map((task): TimelineInterval | null => {
      const startTime = new Date(task.startTime as Date);
      if (Number.isNaN(startTime.getTime())) return null;

      const rawStart = getTimelineMinutesFromStart(startTime, profileTimezone);
      const duration = task.durationMinutes;
      if (duration === null || !Number.isFinite(duration) || duration <= 0) {
        if (rawStart >= visibleMinutes) return null;
        return { start: Math.max(0, rawStart), end: null };
      }

      const rawEnd = rawStart + duration;
      if (rawEnd <= 0 || rawStart >= visibleMinutes) return null;
      const start = Math.max(0, rawStart);
      const end = Math.min(visibleMinutes, rawEnd);
      return end > start ? { start, end } : null;
    })
    .filter((interval): interval is TimelineInterval => interval !== null)
    .sort((a, b) => a.start - b.start || (a.end ?? Infinity) - (b.end ?? Infinity));

  const windows: TimelineFreeWindow[] = [];
  let occupiedEnd: number | null = null;

  for (const interval of intervals) {
    if (occupiedEnd !== null && interval.start > occupiedEnd) {
      if (interval.start - occupiedEnd >= MIN_FREE_WINDOW_MINUTES) {
        windows.push(toGeometry(occupiedEnd, interval.start));
      }
    }

    if (interval.end === null) {
      break;
    }

    occupiedEnd =
      occupiedEnd === null ? interval.end : Math.max(occupiedEnd, interval.end);
  }

  return windows;
}
