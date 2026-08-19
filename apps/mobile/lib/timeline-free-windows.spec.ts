import type { Task } from '@focus/shared-types';
import { TIMELINE_CONFIG } from './timeline-config';
import {
  computeTimelineFreeWindows,
  MIN_FREE_WINDOW_MINUTES,
} from './timeline-free-windows';

function task(
  id: string,
  startTime: Date | null,
  durationMinutes: number | null,
  completedAt: Date | null = null,
): Task {
  return {
    id,
    userId: 'user',
    title: id,
    startTime,
    durationMinutes,
    color: '#6B5BFC',
    isRecurring: false,
    recurrenceRule: null,
    parentTaskId: null,
    completedAt,
    startedAt: null,
    firstStep: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

function planBlock(id: string, kind: 'REST' | 'BUFFER', hour: number, durationMinutes: number | null): Task {
  return { ...task(id, new Date(2026, 7, 18, hour, 0), durationMinutes), kind };
}

describe('timeline free-window geometry', () => {
  it('returns a bounded internal window with matching timeline geometry', () => {
    const windows = computeTimelineFreeWindows([
      task('first', new Date(2026, 7, 18, 9, 0), 60),
      task('second', new Date(2026, 7, 18, 10, 45), 30),
    ]);

    expect(windows).toEqual([
      {
        startMinutes: 240,
        endMinutes: 285,
        durationMinutes: 45,
        top: 4 * TIMELINE_CONFIG.hourHeight,
        height: 0.75 * TIMELINE_CONFIG.hourHeight,
      },
    ]);
  });

  it('does not label an empty day or the day edges as free', () => {
    expect(computeTimelineFreeWindows([])).toEqual([]);
    expect(
      computeTimelineFreeWindows([
        task('only', new Date(2026, 7, 18, 12, 0), 30),
      ]),
    ).toEqual([]);
  });

  it('ignores unscheduled tasks and includes completed scheduled history', () => {
    const windows = computeTimelineFreeWindows([
      task('thought', null, 120),
      task('completed', new Date(2026, 7, 18, 9, 0), 30, new Date()),
      task('next', new Date(2026, 7, 18, 10, 0), 30),
    ]);

    expect(windows).toEqual([
      expect.objectContaining({
        startMinutes: 210,
        endMinutes: 240,
        durationMinutes: 30,
      }),
    ]);
  });

  it('merges overlapping known intervals before measuring the next gap', () => {
    const windows = computeTimelineFreeWindows([
      task('first', new Date(2026, 7, 18, 9, 0), 90),
      task('overlap', new Date(2026, 7, 18, 10, 0), 60),
      task('next', new Date(2026, 7, 18, 12, 0), 30),
    ]);

    expect(windows).toEqual([
      expect.objectContaining({ startMinutes: 300, endMinutes: 360, durationMinutes: 60 }),
    ]);
  });

  it('counts REST and BUFFER as occupied timeline intervals', () => {
    const windows = computeTimelineFreeWindows([
      task('first', new Date(2026, 7, 18, 9, 0), 30),
      planBlock('rest', 'REST', 10, 30),
      planBlock('buffer', 'BUFFER', 11, 30),
      task('last', new Date(2026, 7, 18, 12, 0), 30),
    ]);

    expect(windows.map(({ startMinutes, endMinutes }) => ({ startMinutes, endMinutes }))).toEqual([
      { startMinutes: 210, endMinutes: 240 },
      { startMinutes: 270, endMinutes: 300 },
      { startMinutes: 330, endMinutes: 360 },
    ]);
  });

  it('keeps an invalid unknown-duration block as an uncertainty barrier', () => {
    expect(computeTimelineFreeWindows([
      task('first', new Date(2026, 7, 18, 9, 0), 30),
      planBlock('invalid-rest', 'REST', 10, null),
      task('later', new Date(2026, 7, 18, 12, 0), 30),
      task('last', new Date(2026, 7, 18, 13, 0), 30),
    ])).toEqual([
      expect.objectContaining({ startMinutes: 210, endMinutes: 240 }),
    ]);
  });

  it('returns no window when known intervals touch exactly', () => {
    expect(
      computeTimelineFreeWindows([
        task('first', new Date(2026, 7, 18, 9, 0), 30),
        task('touching', new Date(2026, 7, 18, 9, 30), 30),
      ]),
    ).toEqual([]);
  });

  it('returns a gap of exactly 30 minutes', () => {
    expect(
      computeTimelineFreeWindows([
        task('first', new Date(2026, 7, 18, 9, 0), 30),
        task('second', new Date(2026, 7, 18, 10, 0), 30),
      ]),
    ).toEqual([
      expect.objectContaining({
        startMinutes: 210,
        endMinutes: 240,
        durationMinutes: 30,
      }),
    ]);
  });

  it('uses an unknown start only as a right boundary and proves nothing after it', () => {
    const windows = computeTimelineFreeWindows([
      task('known', new Date(2026, 7, 18, 9, 0), 30),
      task('unknown', new Date(2026, 7, 18, 10, 0), null),
      task('later-known', new Date(2026, 7, 18, 12, 0), 30),
      task('last', new Date(2026, 7, 18, 13, 0), 30),
    ]);

    expect(windows).toEqual([
      expect.objectContaining({ startMinutes: 210, endMinutes: 240, durationMinutes: 30 }),
    ]);
  });

  it('does not invent any later availability when the first task has unknown duration', () => {
    expect(
      computeTimelineFreeWindows([
        task('unknown', new Date(2026, 7, 18, 9, 0), null),
        task('known', new Date(2026, 7, 18, 11, 0), 30),
        task('next', new Date(2026, 7, 18, 12, 0), 30),
      ]),
    ).toEqual([]);
  });

  it('keeps the uncertainty barrier when known and unknown intervals overlap', () => {
    expect(
      computeTimelineFreeWindows([
        task('known-overlap', new Date(2026, 7, 18, 9, 0), 120),
        task('unknown-overlap', new Date(2026, 7, 18, 10, 0), null),
        task('later-known', new Date(2026, 7, 18, 12, 0), 30),
        task('last', new Date(2026, 7, 18, 13, 0), 30),
      ]),
    ).toEqual([]);
  });

  it('suppresses internal gaps shorter than the calm presentation threshold', () => {
    expect(MIN_FREE_WINDOW_MINUTES).toBe(30);
    expect(
      computeTimelineFreeWindows([
        task('first', new Date(2026, 7, 18, 9, 0), 30),
        task('second', new Date(2026, 7, 18, 9, 59), 30),
      ]),
    ).toEqual([]);
  });

  it('clips known occupied intervals to the existing 06:00-24:00 range', () => {
    const windows = computeTimelineFreeWindows([
      task('crossing-start', new Date(2026, 7, 18, 5, 30), 60),
      task('next', new Date(2026, 7, 18, 7, 0), 30),
      task('crossing-end', new Date(2026, 7, 18, 23, 30), 120),
    ]);

    expect(windows).toEqual([
      expect.objectContaining({ startMinutes: 30, endMinutes: 60, durationMinutes: 30 }),
      expect.objectContaining({ startMinutes: 90, endMinutes: 1050, durationMinutes: 960 }),
    ]);
    expect(windows.every((window) => window.startMinutes >= 0)).toBe(true);
    expect(windows.every((window) => window.endMinutes <= 18 * 60)).toBe(true);
  });

  it.each([
    ['Europe/Moscow', '2026-08-18T06:00:00.000Z', '2026-08-18T07:00:00.000Z'],
    ['America/New_York', '2026-08-18T13:00:00.000Z', '2026-08-18T14:00:00.000Z'],
  ])('uses profile-local wall time in %s', (timezone, first, second) => {
    const windows = computeTimelineFreeWindows([
      task('first', new Date(first), 30),
      task('second', new Date(second), 30),
    ], timezone);
    expect(windows).toEqual([
      expect.objectContaining({ startMinutes: 210, endMinutes: 240, durationMinutes: 30 }),
    ]);
  });

  it.each([undefined, null, '', 'Not/AZone'])('%p uses device-local fields without UTC substitution', (timezone) => {
    const windows = computeTimelineFreeWindows([
      task('first', new Date(2026, 7, 18, 9, 0), 30),
      task('second', new Date(2026, 7, 18, 10, 0), 30),
    ], timezone);
    expect(windows[0]).toEqual(
      expect.objectContaining({ startMinutes: 210, endMinutes: 240 }),
    );
  });

  it('gives the same absolute instants intentionally different window coordinates across profile zones', () => {
    const tasks = [
      task('first', new Date('2026-08-18T12:00:00.000Z'), 30),
      task('second', new Date('2026-08-18T13:00:00.000Z'), 30),
    ];
    const moscow = computeTimelineFreeWindows(tasks, 'Europe/Moscow')[0];
    const newYork = computeTimelineFreeWindows(tasks, 'America/New_York')[0];

    expect(moscow.durationMinutes).toBe(newYork.durationMinutes);
    expect(moscow.startMinutes).not.toBe(newYork.startMinutes);
    expect(moscow.endMinutes).not.toBe(newYork.endMinutes);
    expect(moscow.top).not.toBe(newYork.top);
  });

  it('uses device-local Date fields for missing and invalid zones without UTC substitution', () => {
    const first = new Date('2026-08-18T20:15:00.000Z');
    const second = new Date('2026-08-18T21:15:00.000Z');
    const originalGetHours = Date.prototype.getHours;
    const originalGetMinutes = Date.prototype.getMinutes;
    const localHours = jest.spyOn(Date.prototype, 'getHours').mockImplementation(function (this: Date) {
      if (this.getTime() === first.getTime()) return 9;
      if (this.getTime() === second.getTime()) return 10;
      return originalGetHours.call(this);
    });
    const localMinutes = jest.spyOn(Date.prototype, 'getMinutes').mockImplementation(function (this: Date) {
      if (this.getTime() === first.getTime() || this.getTime() === second.getTime()) return 0;
      return originalGetMinutes.call(this);
    });

    try {
      for (const timezone of [undefined, 'Not/AZone']) {
        expect(
          computeTimelineFreeWindows([
            task('first', first, 30),
            task('second', second, 30),
          ], timezone)[0],
        ).toEqual(expect.objectContaining({ startMinutes: 210, endMinutes: 240 }));
      }
    } finally {
      localMinutes.mockRestore();
      localHours.mockRestore();
    }
  });

  it('emits only the internal gap and never leading or trailing windows', () => {
    const windows = computeTimelineFreeWindows([
      task('first', new Date(2026, 7, 18, 10, 0), 30),
      task('second', new Date(2026, 7, 18, 11, 0), 30),
    ]);
    expect(windows).toHaveLength(1);
    expect(windows[0]).toEqual(
      expect.objectContaining({ startMinutes: 270, endMinutes: 300 }),
    );
  });
});
