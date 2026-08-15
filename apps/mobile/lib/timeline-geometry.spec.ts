import {
  getTimelineMinutesFromStart,
  getTimelineWallClock,
  getVisibleTimelineTop,
} from './timeline-geometry';
import { TIMELINE_CONFIG } from './timeline-config';

const topAt1430 = (14.5 - TIMELINE_CONFIG.dayStartHour) * TIMELINE_CONFIG.hourHeight;

describe('profile-local timeline geometry', () => {
  it.each([
    ['Europe/Moscow', '2026-08-13T11:30:00.000Z'],
    ['America/New_York', '2026-08-13T18:30:00.000Z'],
  ])('places a profile-local 14:30 instant in %s at 14:30', (timezone, iso) => {
    expect(getTimelineWallClock(new Date(iso), timezone)).toEqual({ hours: 14, minutes: 30 });
    expect(getVisibleTimelineTop(new Date(iso), timezone)).toBe(topAt1430);
  });

  it('gives the same instant intentionally different coordinates in different zones', () => {
    const instant = new Date('2026-08-13T18:30:00.000Z');
    expect(getTimelineMinutesFromStart(instant, 'America/New_York')).not.toBe(
      getTimelineMinutesFromStart(instant, 'Europe/Moscow'),
    );
  });

  it('does not let device-local fields override a valid profile zone', () => {
    const instant = new Date('2026-08-13T11:30:00.000Z');
    expect(getTimelineWallClock(instant, 'Europe/Moscow')).toEqual({ hours: 14, minutes: 30 });
  });

  it.each([undefined, null, '', 'Not/AZone'])('%p explicitly falls back to device-local fields', (timezone) => {
    const instant = new Date(2026, 7, 13, 14, 37);
    expect(getTimelineWallClock(instant, timezone)).toEqual({ hours: 14, minutes: 37 });
  });

  it('hides profile-local now outside the configured range', () => {
    expect(getVisibleTimelineTop(new Date('2026-08-13T01:30:00.000Z'), 'Europe/Moscow')).toBeNull();
  });

  it.each([
    ['America/New_York', '2026-03-08T18:30:00.000Z'],
    ['America/New_York', '2026-12-31T19:30:00.000Z'],
    ['America/New_York', '2027-01-01T19:30:00.000Z'],
  ])('retains wall-clock identity at DST/month/year fixture %s %s', (timezone, iso) => {
    expect(getTimelineWallClock(new Date(iso), timezone)).toEqual({ hours: 14, minutes: 30 });
  });
});
