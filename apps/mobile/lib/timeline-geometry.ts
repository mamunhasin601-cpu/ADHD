import { formatInTimeZone } from 'date-fns-tz';
import { TIMELINE_CONFIG } from './timeline-config';
import { isValidIANATimezone } from './timezone';

export interface WallClockFields {
  hours: number;
  minutes: number;
}

/**
 * Extracts presentation-only wall-clock fields for timeline geometry.
 * A valid profile zone wins; missing/invalid zones explicitly use device-local
 * Date fields. Validation happens before date-fns-tz is called.
 */
export function getTimelineWallClock(
  instant: Date,
  profileTimezone?: string | null,
): WallClockFields {
  if (profileTimezone && isValidIANATimezone(profileTimezone)) {
    const [hours, minutes] = formatInTimeZone(instant, profileTimezone, 'HH:mm')
      .split(':')
      .map(Number);
    return { hours, minutes };
  }

  return { hours: instant.getHours(), minutes: instant.getMinutes() };
}

export function getTimelineMinutesFromStart(
  instant: Date,
  profileTimezone?: string | null,
): number {
  const { hours, minutes } = getTimelineWallClock(instant, profileTimezone);
  return (hours - TIMELINE_CONFIG.dayStartHour) * 60 + minutes;
}

/** Returns null when the profile-local current time is outside 06:00–24:00. */
export function getVisibleTimelineTop(
  instant: Date,
  profileTimezone?: string | null,
): number | null {
  const minutes = getTimelineMinutesFromStart(instant, profileTimezone);
  const visibleMinutes =
    (TIMELINE_CONFIG.dayEndHour - TIMELINE_CONFIG.dayStartHour) * 60;
  if (minutes < 0 || minutes > visibleMinutes) return null;
  return (minutes / 60) * TIMELINE_CONFIG.hourHeight;
}
