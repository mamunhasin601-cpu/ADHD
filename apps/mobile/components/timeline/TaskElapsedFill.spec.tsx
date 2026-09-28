import React from 'react';
import { AccessibilityInfo, Animated } from 'react-native';
import { act, render } from '@testing-library/react-native';
import { TaskElapsedFill } from './TaskElapsedFill';

describe('TaskElapsedFill settling lifecycle', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => {
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  it('hydrates statically, animates one finite minute advance, and ignores an ordinary rerender', async () => {
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(false);
    const timing = jest.spyOn(Animated, 'timing');
    const loop = jest.spyOn(Animated, 'loop');
    const view = render(
      <TaskElapsedFill
        taskId="animated"
        progress={0.25}
        startedAt="2026-09-27T10:00:00Z"
        color="#6B5BFC18"
        animationEnabled
      />,
    );
    await act(async () => Promise.resolve());
    expect(timing).not.toHaveBeenCalled();

    view.rerender(
      <TaskElapsedFill
        taskId="animated"
        progress={0.3}
        startedAt="2026-09-27T10:00:00Z"
        color="#6B5BFC18"
        animationEnabled
      />,
    );
    expect(timing).toHaveBeenCalledTimes(4);
    expect(timing.mock.calls.map((call) => call[1].duration)).toEqual([900, 260, 320, 520]);
    expect(loop).not.toHaveBeenCalled();

    act(() => jest.runAllTimers());
    const callCount = timing.mock.calls.length;
    view.rerender(
      <TaskElapsedFill
        taskId="animated"
        progress={0.3}
        startedAt="2026-09-27T10:00:00Z"
        color="#6B5BFC18"
        animationEnabled
      />,
    );
    expect(timing).toHaveBeenCalledTimes(callCount);
  });

  it('uses an immediate static diagonal under Reduce Motion', async () => {
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);
    const timing = jest.spyOn(Animated, 'timing');
    const view = render(
      <TaskElapsedFill
        taskId="reduced"
        progress={0.2}
        startedAt="2026-09-27T10:00:00Z"
        color="#6B5BFC18"
        animationEnabled
      />,
    );
    await act(async () => Promise.resolve());
    view.rerender(
      <TaskElapsedFill
        taskId="reduced"
        progress={0.4}
        startedAt="2026-09-27T10:00:00Z"
        color="#6B5BFC18"
        animationEnabled
      />,
    );
    expect(timing).not.toHaveBeenCalled();
  });

  it('runs the finite settling lifecycle on a real explicit-Start mount, but not hydration', async () => {
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(false);
    const timing = jest.spyOn(Animated, 'timing');
    const loop = jest.spyOn(Animated, 'loop');
    const hydrated = render(
      <TaskElapsedFill
        taskId="hydrated"
        progress={0.4}
        startedAt="2026-09-27T10:00:00Z"
        color="#6B5BFC18"
        animationEnabled
      />,
    );
    await act(async () => Promise.resolve());
    expect(timing).not.toHaveBeenCalled();
    hydrated.unmount();

    render(
      <TaskElapsedFill
        taskId="just-started"
        progress={0}
        startedAt="2026-09-27T10:00:00Z"
        color="#6B5BFC18"
        animationEnabled
        animateOnMount
      />,
    );
    expect(timing).toHaveBeenCalledTimes(4);
    expect(loop).not.toHaveBeenCalled();
  });
});
