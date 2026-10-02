const mockUser: { timeFormat: string; timezone?: string } = { timeFormat: "H24" };
const mockScrollTo = jest.fn();
jest.mock("react-native", () => {
  const React = require("react");
  const ReactNative = jest.requireActual("react-native");
  const ScrollView = React.forwardRef((props: any, ref: any) => {
    React.useImperativeHandle(ref, () => ({ scrollTo: mockScrollTo }));
    return <ReactNative.ScrollView {...props} />;
  });
  return new Proxy(ReactNative, {
    get(target, property) {
      if (property === "ScrollView") return ScrollView;
      if (property === "useWindowDimensions") return () => ({ width: 360, height: 640, scale: 1, fontScale: 1 });
      return Reflect.get(target, property);
    },
  });
});
jest.mock("../../stores/auth.store", () => ({
  useAuthStore: (selector: any) => selector({ user: mockUser }),
}));
jest.mock("./NowIndicator", () => {
  const { View } = require("react-native");
  return { NowIndicator: (props: any) => <View testID="now-indicator" {...props} /> };
});
import React from "react";
import { Pressable, Text, View } from "react-native";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react-native";
import { Timeline } from "./Timeline";
import type { Task } from "@focus/shared-types";
import { TIMELINE_CONFIG } from "../../lib/timeline-config";

const taskAt = (id: string, startTime: Date, durationMinutes: number | null, completedAt: Date | null = null): Task => ({
  id,
  userId: "user",
  title: id,
  startTime,
  durationMinutes,
  color: "#6B5BFC",
  isRecurring: false,
  recurrenceRule: null,
  parentTaskId: null,
  completedAt,
  startedAt: null,
  firstStep: null,
  createdAt: new Date(),
  updatedAt: new Date(),
});

const task = (id: string, hour: number, minute: number, durationMinutes: number | null, completedAt: Date | null = null): Task =>
  taskAt(id, new Date(2026, 7, 12, hour, minute), durationMinutes, completedAt);

const props = {
  tasks: [],
  onToggle: jest.fn(),
  onOpenTask: jest.fn(),
  onCreateTask: jest.fn(),
  shouldAutoScroll: false,
};

function backgroundEvent(y = 300, x = 100) {
  return { nativeEvent: { pageX: x, pageY: y, locationY: 28 } };
}

function tapBackground(y: number) {
  const background = screen.getByTestId("timeline-create-background");
  fireEvent(background, "responderGrant", backgroundEvent(y));
  fireEvent(background, "responderRelease", backgroundEvent(y));
}
describe("Timeline clock labels", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUser.timeFormat = "H24";
    mockUser.timezone = undefined;
  });
  it("renders H24 labels", () => {
    render(<Timeline {...props} />);
    expect(screen.getByText("06:00")).toBeTruthy();
    expect(screen.getByText("15:00")).toBeTruthy();
  });
  it("renders H12 labels with AM/PM", () => {
    mockUser.timeFormat = "H12";
    render(<Timeline {...props} />);
    expect(screen.getByText(/6:00.*AM/i)).toBeTruthy();
    expect(screen.getAllByText(/3:00.*PM/i).length).toBeGreaterThan(0);
  });
  it("resolves SYSTEM from the device convention", () => {
    mockUser.timeFormat = "SYSTEM";
    const spy = jest
      .spyOn(Intl, "DateTimeFormat")
      .mockImplementation(((locale: any, options: any) => ({
        resolvedOptions: () => ({ hourCycle: "h12", hour12: true }),
        format: (date: Date) =>
          options?.hourCycle === "h12"
            ? `${date.getUTCHours() % 12 || 12}:00 PM`
            : "x",
      })) as any);
    try {
      render(<Timeline {...props} />);
      expect(screen.getAllByText("6:00 PM").length).toBeGreaterThan(0);
    } finally {
      spy.mockRestore();
    }
  });
  it("keeps slot positions unchanged across formats", () => {
    const { getByTestId, rerender } = render(<Timeline {...props} />);
    const top24 = getByTestId("timeline-hour-14").props.style[1].top;
    mockUser.timeFormat = "H12";
    rerender(<Timeline {...props} />);
    expect(getByTestId("timeline-hour-14").props.style[1].top).toBe(top24);
  });
  it("renders NowIndicator only for Today and passes the profile timezone", () => {
    jest.useFakeTimers().setSystemTime(new Date("2026-08-13T00:30:00.000Z"));
    const { rerender } = render(<Timeline {...props} shouldAutoScroll={false} profileTimezone="Europe/Moscow" />);
    expect(screen.queryByTestId("now-indicator")).toBeNull();
    rerender(<Timeline {...props} shouldAutoScroll profileTimezone="Europe/Moscow" />);
    expect(screen.getByTestId("now-indicator").props.profileTimezone).toBe("Europe/Moscow");
    rerender(<Timeline {...props} shouldAutoScroll={false} profileTimezone="Europe/Moscow" />);
    expect(screen.queryByTestId("now-indicator")).toBeNull();
    jest.useRealTimers();
  });
});

describe("Timeline background gesture isolation", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });
  afterEach(() => {
    cleanup();
    act(() => jest.runOnlyPendingTimers());
    jest.useRealTimers();
  });

  it.each([12, 15, 18])("creates once without time arguments near %s:00", (hour) => {
    render(<Timeline {...props} profileTimezone="Europe/Samara" />);
    expect(screen.getByTestId(`timeline-hour-${hour}`).props.pointerEvents).toBe("none");
    tapBackground((hour - TIMELINE_CONFIG.dayStartHour) * TIMELINE_CONFIG.hourHeight);
    expect(props.onCreateTask).toHaveBeenCalledTimes(1);
    expect(props.onCreateTask).toHaveBeenCalledWith();
  });

  it("consumes a grant once and ignores repeated or unowned releases", () => {
    render(<Timeline {...props} />);
    const background = screen.getByTestId("timeline-create-background");
    fireEvent(background, "responderRelease", backgroundEvent());
    expect(props.onCreateTask).not.toHaveBeenCalled();
    tapBackground(300);
    fireEvent(background, "responderRelease", backgroundEvent());
    expect(props.onCreateTask).toHaveBeenCalledTimes(1);
    tapBackground(400);
    expect(props.onCreateTask).toHaveBeenCalledTimes(2);
  });

  it.each(["vertical", "horizontal", "return-to-origin", "release-only"])("rejects a %s drag", (kind) => {
    render(<Timeline {...props} />);
    const background = screen.getByTestId("timeline-create-background");
    fireEvent(background, "responderGrant", backgroundEvent());
    if (kind !== "release-only") {
      fireEvent(background, "responderMove", backgroundEvent(kind === "horizontal" ? 300 : 330, kind === "horizontal" ? 140 : 100));
    }
    fireEvent(background, "responderRelease", backgroundEvent(kind === "return-to-origin" || kind === "horizontal" ? 300 : 330, kind === "horizontal" ? 140 : 100));
    expect(props.onCreateTask).not.toHaveBeenCalled();
  });

  it.each(["responderTerminate", "scrollBeginDrag", "momentumScrollBegin"])("cancels on %s", (event) => {
    render(<Timeline {...props} />);
    const background = screen.getByTestId("timeline-create-background");
    expect(background.props.onResponderTerminationRequest()).toBe(true);
    expect(background.props.onMoveShouldSetResponder()).toBe(false);
    fireEvent(background, "responderGrant", backgroundEvent());
    fireEvent(event === "responderTerminate" ? background : screen.getByTestId("timeline-scroll"), event);
    fireEvent(background, "responderRelease", backgroundEvent());
    expect(props.onCreateTask).not.toHaveBeenCalled();
  });

  it("rejects multitouch even if the gesture ends with one finger", () => {
    render(<Timeline {...props} />);
    const background = screen.getByTestId("timeline-create-background");
    fireEvent(background, "responderGrant", backgroundEvent());
    fireEvent(background, "responderStart", { nativeEvent: { pageX: 100, pageY: 300, touches: [{}, {}] } });
    fireEvent(background, "responderRelease", backgroundEvent());
    expect(props.onCreateTask).not.toHaveBeenCalled();
  });

  it("accepts a fresh tap after scrolling cancelled the previous gesture", () => {
    render(<Timeline {...props} />);
    const background = screen.getByTestId("timeline-create-background");
    fireEvent(background, "responderGrant", backgroundEvent());
    fireEvent(screen.getByTestId("timeline-scroll"), "scrollBeginDrag");
    fireEvent(background, "responderRelease", backgroundEvent());
    expect(props.onCreateTask).not.toHaveBeenCalled();
    tapBackground(600);
    expect(props.onCreateTask).toHaveBeenCalledTimes(1);
    expect(props.onCreateTask).toHaveBeenCalledWith();
  });

  it("leaves card presses, completion and long presses outside the creation responder", () => {
    const planned = task("planned", 10, 0, 60);
    render(<Timeline {...props} tasks={[planned]} onMoveToThoughts={jest.fn()} />);
    const canvas = screen.getByTestId("timeline-canvas");
    expect(canvas.props.onStartShouldSetResponder).toBeUndefined();
    expect(canvas.props.onResponderRelease).toBeUndefined();
    const card = screen.getByRole("button", { name: /^planned/ });
    fireEvent.press(card);
    expect(props.onOpenTask).toHaveBeenCalledWith(planned);
    fireEvent.press(screen.getByRole("checkbox"));
    expect(props.onToggle).toHaveBeenCalledWith(planned.id);
    fireEvent(card, "longPress");
    expect(screen.getByText('В «Мысли»')).toBeTruthy();
    expect(props.onCreateTask).not.toHaveBeenCalled();
  });

  it("does not create from an interactive focused card", () => {
    const focused = task("focused", 12, 0, 30);
    render(<Timeline {...props} tasks={[focused]} focusedTaskId={focused.id}
      renderFocusedTask={(entry, showActions) => <Pressable onPress={() => props.onOpenTask(entry)} onLongPress={showActions}><Text>Focused action</Text></Pressable>} />);
    fireEvent.press(screen.getByText("Focused action"));
    fireEvent(screen.getByText("Focused action"), "longPress");
    expect(props.onOpenTask).toHaveBeenCalledWith(focused);
    expect(screen.getByText("Перенести")).toBeTruthy();
    expect(props.onCreateTask).not.toHaveBeenCalled();
  });
});

describe("Timeline auto-scroll ownership", () => {
  let frames: FrameRequestCallback[];

  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date("2026-08-13T11:30:00.000Z"));
    frames = [];
    mockScrollTo.mockClear();
    global.requestAnimationFrame = jest.fn((callback: FrameRequestCallback) => {
      frames.push(callback);
      return frames.length;
    });
    global.cancelAnimationFrame = jest.fn();
  });

  afterEach(() => jest.useRealTimers());

  function deliver(index: number) {
    act(() => frames[index](0));
  }

  it("does not deliver a Today scroll after switching to non-Today", () => {
    const { rerender } = render(<Timeline {...props} shouldAutoScroll profileTimezone="Europe/Moscow" />);
    rerender(<Timeline {...props} shouldAutoScroll={false} profileTimezone="Europe/Moscow" />);
    deliver(0);
    expect(cancelAnimationFrame).toHaveBeenCalledWith(1);
    expect(mockScrollTo).not.toHaveBeenCalled();
  });

  it("does not deliver a Today scroll after unmount", () => {
    const { unmount } = render(<Timeline {...props} shouldAutoScroll profileTimezone="Europe/Moscow" />);
    unmount();
    deliver(0);
    expect(mockScrollTo).not.toHaveBeenCalled();
  });

  it("permits one new scroll after returning to Today", () => {
    const { rerender } = render(<Timeline {...props} shouldAutoScroll profileTimezone="Europe/Moscow" />);
    deliver(0);
    rerender(<Timeline {...props} shouldAutoScroll={false} profileTimezone="Europe/Moscow" />);
    rerender(<Timeline {...props} shouldAutoScroll profileTimezone="Europe/Moscow" />);
    deliver(1);
    expect(mockScrollTo).toHaveBeenCalledTimes(2);
  });

  it("uses only the replacement timezone when identity changes before delivery", () => {
    const { rerender } = render(<Timeline {...props} shouldAutoScroll profileTimezone="Europe/Moscow" />);
    rerender(<Timeline {...props} shouldAutoScroll profileTimezone="America/New_York" />);
    deliver(0);
    deliver(1);
    expect(mockScrollTo).toHaveBeenCalledTimes(1);
    expect(mockScrollTo).toHaveBeenCalledWith({ y: 0, animated: false });
  });

  it("does not duplicate a completed scroll on ordinary rerenders", () => {
    const { rerender } = render(<Timeline {...props} shouldAutoScroll profileTimezone="Europe/Moscow" />);
    deliver(0);
    rerender(<Timeline {...props} shouldAutoScroll profileTimezone="Europe/Moscow" tasks={[]} />);
    expect(requestAnimationFrame).toHaveBeenCalledTimes(1);
    expect(mockScrollTo).toHaveBeenCalledTimes(1);
  });
});

describe("Timeline free-window presentation", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUser.timeFormat = "H24";
    mockUser.timezone = undefined;
  });

  it("renders a neutral, non-interactive label for a proven internal window", () => {
    render(
      <Timeline
        {...props}
        tasks={[task("first", 9, 0, 60), task("second", 10, 45, 30)]}
      />,
    );

    expect(screen.getByText("45 мин свободно")).toBeTruthy();
    const window = screen.getByTestId("timeline-free-window-240-285");
    expect(window.props.pointerEvents).toBe("none");
    expect(window.props.accessibilityRole).toBeUndefined();
    expect(window.props.accessibilityLabel).toBe(
      "Свободное окно с 10:00 до 10:45, 45 минут",
    );
    expect(screen.queryByRole("button", { name: /Свободное окно/ })).toBeNull();
  });

  it("formats long free windows in hours and minutes", () => {
    render(
      <Timeline
        {...props}
        tasks={[task("first", 9, 0, 30), task("second", 13, 5, 30)]}
      />,
    );

    expect(screen.getByText("3 ч 35 мин свободно")).toBeTruthy();
    expect(screen.queryByText("215 мин свободно")).toBeNull();
    expect(screen.getByTestId("timeline-free-window-210-425").props.accessibilityLabel).toBe(
      "Свободное окно с 09:30 до 13:05, 3 часа 35 минут",
    );
  });

  it("uses H12 start, end, and duration in accessibility copy", () => {
    mockUser.timeFormat = "H12";
    render(
      <Timeline
        {...props}
        tasks={[task("first", 10, 0, 60), task("second", 11, 45, 30)]}
      />,
    );
    const window = screen.getByTestId("timeline-free-window-300-345");
    expect(window.props.accessibilityLabel).toMatch(
      /Свободное окно с 11:00\s*AM до 11:45\s*AM, 45 минут/i,
    );
    expect(screen.getByText("45 мин свободно")).toBeTruthy();
  });

  it("uses the mocked SYSTEM device convention for accessibility copy", () => {
    mockUser.timeFormat = "SYSTEM";
    const spy = jest
      .spyOn(Intl, "DateTimeFormat")
      .mockImplementation(((locale: any, options: any) => ({
        resolvedOptions: () => ({ hourCycle: "h12", hour12: true }),
        format: (date: Date) => {
          const hours = date.getUTCHours();
          const minutes = String(date.getUTCMinutes()).padStart(2, "0");
          return `${hours % 12 || 12}:${minutes} ${hours < 12 ? "AM" : "PM"}`;
        },
      })) as any);
    try {
      render(
        <Timeline
          {...props}
          tasks={[task("first", 10, 0, 60), task("second", 11, 45, 30)]}
        />,
      );
      expect(
        screen.getByTestId("timeline-free-window-300-345").props
          .accessibilityLabel,
      ).toBe("Свободное окно с 11:00 AM до 11:45 AM, 45 минут");
    } finally {
      spy.mockRestore();
    }
  });

  it("changes only presentation when the time format changes", () => {
    const tasks = [task("first", 10, 0, 60), task("second", 11, 45, 30)];
    const view = render(<Timeline {...props} tasks={tasks} />);
    const window24 = screen.getByTestId("timeline-free-window-300-345");
    const taskTop24 = screen.getByTestId("task-block-row-first").props.style[1].top;
    const geometry24 = window24.props.style[1];

    mockUser.timeFormat = "H12";
    view.rerender(<Timeline {...props} tasks={tasks} />);
    const window12 = screen.getByTestId("timeline-free-window-300-345");

    expect(window12.props.style[1]).toMatchObject({ top: geometry24.top, height: geometry24.height });
    expect(window12.props.style[1].left).toBeGreaterThan(geometry24.left);
    expect(screen.getByTestId("task-block-row-first").props.style[1].top).toBe(taskTop24);
    expect(window24.props.accessibilityLabel).toContain("11:00");
    expect(window12.props.accessibilityLabel).toMatch(/11:00\s*AM/i);
    expect(screen.getByText("45 мин свободно")).toBeTruthy();
  });

  it("lets a free-window press create without calculating a Moscow slot", () => {
    const tasks = [
      taskAt("first", new Date("2027-01-01T11:00:00.000Z"), 30),
      taskAt("second", new Date("2027-01-01T12:00:00.000Z"), 30),
    ];
    render(
      <Timeline
        {...props}
        tasks={tasks}
        profileTimezone="Europe/Moscow"
      />,
    );
    const window = screen.getByTestId("timeline-free-window-510-540");
    const geometry = window.props.style[1];
    tapBackground(geometry.top + geometry.height / 2);

    expect(window.props.pointerEvents).toBe("none");
    expect(props.onCreateTask).toHaveBeenCalledTimes(1);
    expect(props.onCreateTask).toHaveBeenCalledWith();
  });

  it("keeps completed scheduled tasks in the displayed historical plan", () => {
    render(
      <Timeline
        {...props}
        tasks={[
          task("completed", 9, 0, 30, new Date()),
          task("next", 10, 0, 30),
        ]}
      />,
    );
    expect(screen.getByText("30 мин свободно")).toBeTruthy();
  });

  it("does not present an unknown-duration task as having a known end", () => {
    render(
      <Timeline
        {...props}
        tasks={[
          task("unknown", 9, 0, null),
          task("known", 11, 0, 30),
          task("next", 12, 0, 30),
        ]}
      />,
    );
    expect(screen.queryByText(/Свободное окно/)).toBeNull();
  });
});

describe("Timeline focused task presentation", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUser.timeFormat = "H24";
    mockUser.timezone = undefined;
  });

  it("renders the focused task once at its time and reserves space below it", () => {
    const focused = task("focused", 11, 30, 45);
    const following = task("following", 14, 45, 30);
    render(
      <Timeline
        {...props}
        tasks={[focused, following]}
        focusedTaskId={focused.id}
        renderFocusedTask={(entry) => (
          <View testID="rich-focused-card"><Text>{entry.title}</Text></View>
        )}
      />,
    );

    const focusedTop = (11.5 - TIMELINE_CONFIG.dayStartHour) * TIMELINE_CONFIG.hourHeight;
    const baseFocusedHeight = (45 / 60) * TIMELINE_CONFIG.hourHeight;
    const expansion = 220 - baseFocusedHeight;
    expect(screen.getByTestId("timeline-focused-task-focused").props.style[1]).toEqual(
      expect.objectContaining({ top: focusedTop, height: 220 }),
    );
    expect(screen.getByTestId("rich-focused-card")).toBeTruthy();
    expect(screen.queryByTestId("task-block-row-focused")).toBeNull();
    expect(screen.getByTestId("task-block-row-following").props.style[1].top).toBe(
      (14.75 - TIMELINE_CONFIG.dayStartHour) * TIMELINE_CONFIG.hourHeight + expansion + 4,
    );
    expect(screen.getByTestId("timeline-free-window-375-525").props.style[1].top).toBe(
      (12.25 - TIMELINE_CONFIG.dayStartHour) * TIMELINE_CONFIG.hourHeight + expansion + 4,
    );
  });

  it("releases focused expansion immediately after Start changes the rendered state", () => {
    const focused = task("focused-transition", 11, 30, 45);
    const following = task("following-transition", 14, 45, 30);
    const { rerender } = render(
      <Timeline {...props} tasks={[focused, following]} focusedTaskId={focused.id}
        renderFocusedTask={() => <View testID="transition-focused-card" />} />,
    );
    const expandedTop = screen.getByTestId("task-block-row-following-transition").props.style[1].top;

    rerender(
      <Timeline {...props} tasks={[{ ...focused, startedAt: new Date() }, following]} focusedTaskId={focused.id}
        renderFocusedTask={() => <View testID="transition-focused-card" />} />,
    );
    expect(screen.queryByTestId("timeline-focused-task-focused-transition")).toBeNull();
    expect(screen.getByTestId("task-block-row-focused-transition")).toBeTruthy();
    expect(screen.getByTestId("task-block-row-following-transition").props.style[1].top).toBeLessThan(expandedTop);
  });

  it("keeps every legacy overlap visible and labels one card per connected conflict group", () => {
    const first = task("overlap-first", 10, 0, 60);
    const second = task("overlap-second", 10, 15, 45);
    const third = task("overlap-third", 10, 45, 30);
    const states = new Map([
      [first.id, 'planned-now' as const],
      [second.id, 'planned-now' as const],
      [third.id, 'planned-now' as const],
    ]);

    render(<Timeline {...props} tasks={[first, second, third]} taskStates={states} />);

    expect(screen.getByTestId('task-block-row-overlap-first')).toBeTruthy();
    expect(screen.getByTestId('task-block-row-overlap-second')).toBeTruthy();
    expect(screen.getByTestId('task-block-row-overlap-third')).toBeTruthy();
    expect(screen.getAllByText('Задачи пересекаются')).toHaveLength(1);
    expect(screen.getByRole('button', { name: /overlap-first.*Задачи пересекаются/ })).toBeTruthy();
  });

  it("lets a started task own the current-time collision instead of duplicating gutter labels", () => {
    jest.useFakeTimers().setSystemTime(new Date(2026, 7, 12, 11, 30));
    const started = { ...task("started-now", 11, 30, 60), startedAt: new Date(2026, 7, 12, 11, 0) };
    render(<Timeline {...props} tasks={[started]} shouldAutoScroll />);
    expect(screen.getByTestId("now-indicator").props.showBeacon).toBe(false);
    expect(screen.getByTestId("task-elapsed-label-started-now").props.children).toContain("Сейчас 11:30");
    cleanup();
    jest.useRealTimers();
  });

  it("applies one nowMs snapshot to marker, current state, elapsed label and fill at a minute boundary", () => {
    const first = { ...task("clock-first", 16, 18, 30), startedAt: new Date(2026, 7, 12, 16, 18) };
    const second = task("clock-second", 16, 20, 30);
    const before = new Date(2026, 7, 12, 16, 19, 59).getTime();
    const boundary = new Date(2026, 7, 12, 16, 20, 0).getTime();
    const view = render(<Timeline {...props} tasks={[first, second]} shouldAutoScroll nowMs={before} currentTaskId={first.id} />);
    expect(screen.getByTestId("now-indicator").props.nowMs).toBe(before);
    expect(screen.getByTestId("task-elapsed-label-clock-first").props.children).toContain("Сейчас 16:19");
    expect(screen.getByTestId("task-current-cue-clock-first").props.children).toBe('Выполняется');
    const fillBefore = screen.getByTestId("task-elapsed-fill-path-clock-first").props.d;

    view.rerender(<Timeline {...props} tasks={[first, second]} shouldAutoScroll nowMs={boundary} currentTaskId={second.id} />);
    expect(screen.getByTestId("now-indicator").props.nowMs).toBe(boundary);
    expect(screen.getByTestId("task-elapsed-label-clock-first").props.children).toContain("Сейчас 16:20");
    expect(screen.getByTestId("task-current-cue-clock-first").props.children).toBe('Выполняется');
    expect(screen.getByTestId("task-current-cue-clock-second")).toBeTruthy();
    expect(screen.getByTestId("task-elapsed-fill-path-clock-first").props.d).not.toBe(fillBefore);
  });

  it("also removes the external duplicate for an explicitly started unknown-duration task", () => {
    jest.useFakeTimers().setSystemTime(new Date(2026, 7, 12, 11, 30));
    const started = { ...task("started-unknown", 11, 30, null), startedAt: new Date(2026, 7, 12, 11, 0) };
    render(<Timeline {...props} tasks={[started]} shouldAutoScroll />);
    expect(screen.getByTestId("now-indicator").props.showBeacon).toBe(false);
    expect(screen.getByTestId("task-elapsed-label-started-unknown").props.children).toContain("11:30");
    expect(screen.queryByTestId("task-elapsed-fill-started-unknown")).toBeNull();
    cleanup();
    jest.useRealTimers();
  });

  it.each([
    ["before", new Date(2026, 7, 12, 11, 6), true],
    ["boundary", new Date(2026, 7, 12, 11, 10), false],
    ["inside", new Date(2026, 7, 12, 11, 15), false],
  ])("resolves current-time $state an explicitly started task by measured card bounds", (_state, current, showBeacon) => {
    jest.useFakeTimers().setSystemTime(current);
    mockUser.timeFormat = "H12";
    const started = { ...task("h12-collision", 11, 10, 60), startedAt: new Date(2026, 7, 12, 11, 5) };
    render(<Timeline {...props} tasks={[started]} shouldAutoScroll />);
    expect(screen.getByTestId("now-indicator").props.showBeacon).toBe(showBeacon);
    expect(screen.getByTestId("task-scheduled-meta-h12-collision").props.children).toMatch(/11:10\s*AM/);
    expect(screen.getByTestId("task-elapsed-label-h12-collision").props.children).toMatch(/Сейчас 11:(06|10|15)\s*AM/);
    cleanup();
    jest.useRealTimers();
  });

  it("recomputes following geometry when measured overdue content grows and shrinks", () => {
    jest.useFakeTimers().setSystemTime(new Date(2026, 7, 12, 12, 0));
    const started = { ...task("measured-overdue", 10, 0, 30), startedAt: new Date(2026, 7, 11, 10, 0) };
    const following = { ...task("after-measured", 11, 0, 30), kind: "REST" as const };
    render(<Timeline {...props} tasks={[started, following]} />);
    const initialTop = screen.getByTestId("plan-block-row-after-measured").props.style[1].top;

    fireEvent(screen.getByTestId("task-copy-measured-overdue"), "layout", {
      nativeEvent: { layout: { height: 140 } },
    });
    const grownRow = screen.getByTestId("task-block-row-measured-overdue").props.style[1];
    const grownTop = screen.getByTestId("plan-block-row-after-measured").props.style[1].top;
    expect(grownRow.height).toBe(154);
    expect(grownTop).toBeGreaterThanOrEqual(grownRow.top + grownRow.height + 4);
    expect(grownTop).toBeGreaterThan(initialTop);

    fireEvent(screen.getByTestId("task-copy-measured-overdue"), "layout", {
      nativeEvent: { layout: { height: 50 } },
    });
    const shrunkTop = screen.getByTestId("plan-block-row-after-measured").props.style[1].top;
    expect(shrunkTop).toBe(initialTop);
    cleanup();
    jest.useRealTimers();
  });

  it("retries focused auto-scroll after native content measurement", () => {
    jest.useFakeTimers().setSystemTime(new Date("2026-08-13T20:00:00.000Z"));
    const frames: FrameRequestCallback[] = [];
    global.requestAnimationFrame = jest.fn((callback: FrameRequestCallback) => {
      frames.push(callback);
      return frames.length;
    });
    global.cancelAnimationFrame = jest.fn();
    const focused = task("late", 22, 30, 30);
    render(
      <Timeline
        {...props}
        tasks={[focused]}
        focusedTaskId={focused.id}
        renderFocusedTask={() => <View testID="late-focused-card" />}
        shouldAutoScroll
      />,
    );

    act(() => frames[0](0));
    const firstScroll = mockScrollTo.mock.calls.at(-1)?.[0];
    expect(firstScroll.y).toBeGreaterThan(0);
    fireEvent(screen.getByTestId("timeline-scroll"), "contentSizeChange", 320, 1200);
    expect(mockScrollTo).toHaveBeenLastCalledWith(firstScroll);
    jest.useRealTimers();
  });
});

it('routes a REST block to editing without invoking task completion', () => {
  const onToggle = jest.fn();
  const onOpenTask = jest.fn();
  const rest = { ...task('rest', 10, 0, 45), kind: 'REST' as const, title: 'Тихая пауза' };
  render(<Timeline {...props} tasks={[rest]} onToggle={onToggle} onOpenTask={onOpenTask} />);

  fireEvent.press(screen.getByText('Тихая пауза'));
  expect(onOpenTask).toHaveBeenCalledWith(rest);
  expect(onToggle).not.toHaveBeenCalled();
});

it('opens the secondary action sheet on a task long press and can move it to Thoughts', async () => {
  const planned = task('planned', 10, 0, 45);
  const onMoveToThoughts = jest.fn().mockResolvedValue(undefined);
  render(<Timeline {...props} tasks={[planned]} onMoveToThoughts={onMoveToThoughts} />);

  fireEvent(screen.getByRole('button', { name: /planned/ }), 'longPress');
  expect(screen.getByText('Перенести')).toBeTruthy();
  expect(screen.getByText('В «Мысли»')).toBeTruthy();

  await act(async () => fireEvent.press(screen.getByTestId('task-action-thoughts')));
  expect(onMoveToThoughts).toHaveBeenCalledWith(planned);
});
