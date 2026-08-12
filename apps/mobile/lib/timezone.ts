/**
 * Timezone helpers for IANA-correct date operations on the mobile client.
 *
 * Rules (per Task 0006 / ADR-008 D-2):
 * - The server is the sole authority on day boundaries; the client uses the
 *   `userTimezone` string returned by the server.
 * - Never use `toISOString().slice(0, 10)` for local calendar dates.
 * - Never approximate calendar days by adding fixed 24 h milliseconds.
 * - All conversion goes through `date-fns-tz` so DST transitions are handled.
 *
 * Picker contract (Task 0006B):
 * - DateTimePicker returns a Date whose local (device-tz) fields reflect what
 *   the user saw on screen. Use pickerDateToLocalString / pickerTimeToLocalFields
 *   to extract those device-local fields, then interpret them in the profile tz.
 * - Never pass the picker's absolute UTC instant through profile-tz formatters
 *   to derive the destination — that changes the user's visible choice when
 *   device tz ≠ profile tz.
 */

import { toDate, formatInTimeZone } from 'date-fns-tz';

// ─────────────────────────────────────────────────────────────────────────────
// Core primitives
// ─────────────────────────────────────────────────────────────────────────────

export function getLocalDateString(instant: Date, timezone: string): string {
  return formatInTimeZone(instant, timezone, 'yyyy-MM-dd');
}

export function localMidnightToInstant(dateStr: string, timezone: string): Date {
  return toDate(`${dateStr}T00:00:00`, { timeZone: timezone });
}

/**
 * Returns the UTC Date for a wall-clock time on a calendar date in the given
 * IANA timezone. For spring-forward gaps, date-fns-tz advances to the next
 * valid instant. For fall-back ambiguity, the first occurrence is used.
 * Call validateWallClock to detect and reject nonexistent gap times.
 */
export function localDateTimeToInstant(
  dateStr: string,
  hours: number,
  minutes: number,
  timezone: string,
): Date {
  const hh = String(hours).padStart(2, '0');
  const mm = String(minutes).padStart(2, '0');
  return toDate(`${dateStr}T${hh}:${mm}:00`, { timeZone: timezone });
}

// ─────────────────────────────────────────────────────────────────────────────
// Picker helpers (Task 0006B)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns YYYY-MM-DD using the Date's device-local calendar fields.
 * DateTimePicker shows device timezone; getFullYear/getMonth/getDate capture
 * exactly what the user saw, regardless of the device UTC offset.
 */
export function pickerDateToLocalString(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Returns { hours, minutes } using the Date's device-local clock fields.
 * DateTimePicker shows device timezone; getHours/getMinutes capture exactly
 * what the user saw. These values are then interpreted in the profile timezone.
 */
export function pickerTimeToLocalFields(date: Date): { hours: number; minutes: number } {
  return { hours: date.getHours(), minutes: date.getMinutes() };
}

// ─────────────────────────────────────────────────────────────────────────────
// Canonical date key (Task 0007A)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns YYYY-MM-DD using the Date's device-local calendar fields.
 *
 * Note this is NOT `toISOString().slice(0, 10)`: that returns the UTC calendar
 * date, which is a different day from the user's local day for part of every
 * 24 h cycle (e.g. 01:00 in Moscow is still the previous UTC date).
 */
export function getDeviceLocalDateString(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * THE canonical YYYY-MM-DD key for everything that refers to the same server
 * day: the Today query, dated task mutations, and Recovery cache invalidation.
 *
 * Why one helper (Task 0007A finding 1): Today previously keyed off the UTC
 * date while Recovery keyed off the profile-timezone date. Around midnight —
 * and always when device tz differs from profile tz — those are different
 * calendar days, so Today could request or invalidate a different key than
 * Recovery, showing yesterday's or tomorrow's tasks.
 *
 * Resolution order:
 * 1. valid profile IANA timezone → the user's calendar date in that zone.
 *    This matches how the server interprets `?date=`, so client and server
 *    always mean the same day.
 * 2. no/invalid profile timezone → the DEVICE-local calendar date. Never UTC.
 *    This keeps historical navigation usable before the profile loads. Recovery
 *    does not rely on this fallback: it refuses to read or write at all without
 *    a valid profile timezone (see RecoverySection).
 */
export function toCanonicalDateParam(date: Date, userTimezone?: string | null): string {
  if (userTimezone && isValidIANATimezone(userTimezone)) {
    try {
      return getLocalDateString(date, userTimezone);
    } catch {
      // fall through to device-local
    }
  }
  return getDeviceLocalDateString(date);
}

// ─────────────────────────────────────────────────────────────────────────────
// Wall-clock validation (Task 0006B)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Validates a wall-clock date AND time in an IANA timezone by round-tripping
 * both the calendar date and the clock fields (Task 0006C hardening).
 *
 * Round-tripping the date as well as the time prevents accepting a zone that
 * skips or shifts the local calendar date at midnight — the instant could
 * format back to a different day while the clock fields still match.
 *
 * Spring-forward gap: date-fns-tz shifts the instant; the clock round-trip
 * mismatches → valid: false. Nonexistent times must be rejected by callers.
 *
 * Fall-back ambiguity: date-fns-tz picks the first occurrence (pre-transition
 * offset). Both round-trips match → valid: true. Policy is deterministic
 * first-occurrence.
 */
export function validateWallClock(
  dateStr: string,
  hours: number,
  minutes: number,
  timezone: string,
): {
  valid: boolean;
  resolvedDate: string;
  resolvedHours: number;
  resolvedMinutes: number;
  instant: Date;
} {
  try {
    // Inside the try: toDate throws RangeError for an invalid IANA zone.
    const instant = localDateTimeToInstant(dateStr, hours, minutes, timezone);
    const resolvedDate = formatInTimeZone(instant, timezone, 'yyyy-MM-dd');
    const resolvedStr = formatInTimeZone(instant, timezone, 'HH:mm');
    const [rH, rM] = resolvedStr.split(':').map(Number);
    const dateMatches = resolvedDate === dateStr;
    const timeMatches = rH === hours && rM === minutes;
    return {
      valid: dateMatches && timeMatches,
      resolvedDate,
      resolvedHours: rH,
      resolvedMinutes: rM,
      instant,
    };
  } catch {
    // Invalid timezone (or unformattable instant). Callers must check `valid`
    // before reading `instant`; an Invalid Date makes misuse fail loudly
    // rather than silently scheduling at a wrong moment.
    return {
      valid: false,
      resolvedDate: dateStr,
      resolvedHours: hours,
      resolvedMinutes: minutes,
      instant: new Date(NaN),
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Timezone validity (Task 0006B)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns true when `tz` is a valid IANA timezone string understood by
 * date-fns-tz / Intl.
 */
export function isValidIANATimezone(tz: string): boolean {
  if (!tz) return false;
  try {
    formatInTimeZone(new Date(0), tz, 'yyyy');
    return true;
  } catch {
    return false;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Calendar-day arithmetic
// ─────────────────────────────────────────────────────────────────────────────

export function addCalendarDays(dateStr: string, days: number): string {
  const [year, month, day] = dateStr.split('-').map(Number);
  const d = new Date(Date.UTC(year, month - 1, day + days));
  return formatInTimeZone(d, 'UTC', 'yyyy-MM-dd');
}

// ─────────────────────────────────────────────────────────────────────────────
// Validation helpers
// ─────────────────────────────────────────────────────────────────────────────

export function isAfterReference(
  candidate: Date,
  referenceInstant: Date = new Date(),
): boolean {
  return candidate.getTime() > referenceInstant.getTime();
}

export function todayLocalDateString(timezone: string, now: Date = new Date()): string {
  return getLocalDateString(now, timezone);
}

// ─────────────────────────────────────────────────────────────────────────────
// Display helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Extracts wall-clock hours/minutes of a UTC instant in an IANA timezone.
 * Retained for non-picker uses. Do NOT use for DateTimePicker results —
 * use pickerTimeToLocalFields instead.
 */
export function getLocalHoursMinutes(
  instant: Date,
  timezone: string,
): { hours: number; minutes: number } {
  const timeStr = formatInTimeZone(instant, timezone, 'HH:mm');
  const [h, m] = timeStr.split(':').map(Number);
  return { hours: h, minutes: m };
}

/**
 * Formats a UTC instant as a human-readable date/time string in the user's
 * IANA timezone, using Russian locale and a compact format.
 */
export function formatDestinationLabel(instant: Date, timezone: string): string {
  return instant.toLocaleString('ru-RU', {
    timeZone: timezone,
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}
