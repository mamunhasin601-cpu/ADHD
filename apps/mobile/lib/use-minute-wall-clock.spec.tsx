import { act, renderHook } from '@testing-library/react-native';
import { AppState } from 'react-native';
import { millisecondsToNextMinute, useMinuteWallClock } from './use-minute-wall-clock';

describe('useMinuteWallClock', () => {
  let appStateHandler: ((state: string) => void) | undefined;
  let remove: jest.Mock;

  beforeEach(() => {
    jest.useFakeTimers();
    remove = jest.fn();
    appStateHandler = undefined;
    jest.spyOn(AppState, 'addEventListener').mockImplementation(((_event: string, handler: (state: string) => void) => {
      appStateHandler = handler;
      return { remove };
    }) as any);
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('mounts from Date.now immediately and aligns the next wake to the system minute', () => {
    jest.setSystemTime(new Date('2026-09-28T16:18:37.250Z'));
    const clock = renderHook(() => useMinuteWallClock('UTC'));
    expect(clock.result.current.nowMs).toBe(new Date('2026-09-28T16:18:37.250Z').getTime());
    expect(millisecondsToNextMinute(clock.result.current.nowMs)).toBe(22_750);
    act(() => jest.advanceTimersByTime(22_749));
    expect(clock.result.current.nowMs).toBe(new Date('2026-09-28T16:18:37.250Z').getTime());
    act(() => jest.advanceTimersByTime(1));
    expect(clock.result.current.nowMs).toBe(new Date('2026-09-28T16:19:00.000Z').getTime());
    clock.unmount();
  });

  it('uses fresh Date.now after a late JS wake instead of adding one minute', () => {
    jest.setSystemTime(new Date('2026-09-28T16:19:59.000Z'));
    const clock = renderHook(() => useMinuteWallClock());
    jest.setSystemTime(new Date('2026-09-28T16:23:12.000Z'));
    act(() => jest.advanceTimersByTime(1_000));
    expect(clock.result.current.nowMs).toBe(new Date('2026-09-28T16:23:13.000Z').getTime());
    clock.unmount();
  });

  it('resyncs immediately on background to active and on the focus callback', () => {
    jest.setSystemTime(new Date('2026-09-28T16:18:10.000Z'));
    const clock = renderHook(() => useMinuteWallClock());
    jest.setSystemTime(new Date('2026-09-28T16:20:44.000Z'));
    act(() => appStateHandler?.('active'));
    expect(clock.result.current.nowMs).toBe(new Date('2026-09-28T16:20:44.000Z').getTime());
    jest.setSystemTime(new Date('2026-09-28T16:22:05.000Z'));
    act(() => clock.result.current.resync());
    expect(clock.result.current.nowMs).toBe(new Date('2026-09-28T16:22:05.000Z').getTime());
    clock.unmount();
  });

  it('resyncs when timezone identity changes and cleans its timeout and subscription', () => {
    jest.setSystemTime(new Date('2026-09-28T16:18:10.000Z'));
    const clear = jest.spyOn(global, 'clearTimeout');
    const clock = renderHook(({ zone }) => useMinuteWallClock(zone), { initialProps: { zone: 'UTC' } });
    jest.setSystemTime(new Date('2026-09-28T16:18:42.000Z'));
    clock.rerender({ zone: 'Europe/Moscow' });
    expect(clock.result.current.nowMs).toBe(new Date('2026-09-28T16:18:42.000Z').getTime());
    clock.unmount();
    expect(remove).toHaveBeenCalledTimes(1);
    expect(clear).toHaveBeenCalled();
  });
});
