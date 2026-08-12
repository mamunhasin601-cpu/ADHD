import type { TimeFormat } from '@focus/shared-types';

export type DeviceHourCycle = 'h12' | 'h23' | 'h24' | 'h11';
export interface ClockFormatOptions {
  timeZone?: string;
  locale?: string;
  deviceHourCycle?: DeviceHourCycle;
}

export function getDeviceHourCycle(locale?: string): DeviceHourCycle {
  const cycle = new Intl.DateTimeFormat(locale, { hour: 'numeric' }).resolvedOptions().hour12 ? 'h12' : 'h23';
  return (cycle ?? 'h23') as DeviceHourCycle;
}

export function uses12HourClock(preference: TimeFormat, deviceHourCycle = getDeviceHourCycle()): boolean {
  return preference === 'H12' || (preference === 'SYSTEM' && (deviceHourCycle === 'h11' || deviceHourCycle === 'h12'));
}

/** Presentation-only formatter: it never mutates or converts the supplied instant. */
export function formatClockTime(date: Date, preference: TimeFormat = 'SYSTEM', options: ClockFormatOptions = {}): string {
  const hour12 = uses12HourClock(preference, options.deviceHourCycle);
  return new Intl.DateTimeFormat(hour12 ? 'en-US' : (options.locale ?? 'ru-RU'), {
    hour: hour12 ? 'numeric' : '2-digit', minute: '2-digit', hour12,
    ...(options.timeZone ? { timeZone: options.timeZone } : {}),
  }).format(date);
}

/** Formats an internal 0–23 wall-clock value without changing it. */
export function formatWallClock(hours: number, minutes: number, preference: TimeFormat = 'SYSTEM', deviceHourCycle?: DeviceHourCycle): string {
  const date = new Date(Date.UTC(2000, 0, 1, hours, minutes));
  return formatClockTime(date, preference, { timeZone: 'UTC', deviceHourCycle });
}

/** Parses an unambiguous wall-clock entry for the selected convention. */
export function parseClockInput(value: string, preference: TimeFormat, deviceHourCycle = getDeviceHourCycle()): { hours: number; minutes: number } | null {
  const twelve = uses12HourClock(preference, deviceHourCycle);
  const match = value.trim().match(twelve ? /^(1[0-2]|[1-9]):([0-5]\d)\s*(AM|PM)$/i : /^([01]?\d|2[0-3]):([0-5]\d)$/);
  if (!match) return null;
  let hours = Number(match[1]); const minutes = Number(match[2]);
  if (twelve) { const pm = match[3].toUpperCase() === 'PM'; hours = hours % 12 + (pm ? 12 : 0); }
  return { hours, minutes };
}
