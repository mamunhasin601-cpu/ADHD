import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';

export function millisecondsToNextMinute(nowMs: number): number {
  const remainder = ((nowMs % 60_000) + 60_000) % 60_000;
  return remainder === 0 ? 60_000 : 60_000 - remainder;
}

/** One drift-free wall clock for every time-derived value on Today. */
export function useMinuteWallClock(resyncKey?: string | null) {
  const [nowMs, setNowMs] = useState(() => Date.now());
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(false);

  const schedule = useCallback(() => {
    if (timeoutRef.current !== null) clearTimeout(timeoutRef.current);
    const delay = millisecondsToNextMinute(Date.now());
    timeoutRef.current = setTimeout(() => {
      if (!mountedRef.current) return;
      setNowMs(Date.now());
      schedule();
    }, delay);
  }, []);

  const resync = useCallback(() => {
    if (!mountedRef.current) return;
    setNowMs(Date.now());
    schedule();
  }, [schedule]);

  useEffect(() => {
    mountedRef.current = true;
    setNowMs(Date.now());
    schedule();
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') resync();
    });
    return () => {
      mountedRef.current = false;
      if (timeoutRef.current !== null) clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
      subscription.remove();
    };
  }, [resync, schedule]);

  useEffect(() => {
    if (mountedRef.current) resync();
  }, [resync, resyncKey]);

  return { nowMs, resync };
}
