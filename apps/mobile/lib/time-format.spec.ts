import { formatClockTime, formatWallClock } from './time-format';

describe('time-format contract', () => {
  const midnight = new Date('2026-01-01T00:05:00.000Z');
  it('resolves SYSTEM to 24-hour device convention', () => expect(formatClockTime(midnight, 'SYSTEM', { timeZone: 'UTC', deviceHourCycle: 'h23' })).toBe('00:05'));
  it('resolves SYSTEM to 12-hour device convention', () => expect(formatClockTime(midnight, 'SYSTEM', { timeZone: 'UTC', deviceHourCycle: 'h12' })).toBe('12:05 AM'));
  it('forces H24 with leading zero', () => expect(formatWallClock(2, 3, 'H24')).toBe('02:03'));
  it('forces H12 without an hour leading zero', () => expect(formatWallClock(2, 3, 'H12')).toBe('2:03 AM'));
  it('distinguishes midnight and noon', () => { expect(formatWallClock(0, 0, 'H12')).toBe('12:00 AM'); expect(formatWallClock(12, 0, 'H12')).toBe('12:00 PM'); });
  it('supports an explicit IANA timezone', () => expect(formatClockTime(new Date('2026-01-01T12:30:00Z'), 'H24', { timeZone: 'Europe/Moscow' })).toBe('15:30'));
  it('does not mutate the Date or timestamp', () => { const d = new Date('2026-01-01T12:30:00Z'); const before=d.getTime(); formatClockTime(d,'H12',{timeZone:'Asia/Tokyo'}); expect(d.getTime()).toBe(before); });
});
