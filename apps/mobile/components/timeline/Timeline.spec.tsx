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
      return property === "ScrollView" ? ScrollView : Reflect.get(target, property);
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
import { act, fireEvent, render, screen } from "@testing-library/react-native";
import { Timeline } from "./Timeline";
import type { Task } from "@focus/shared-types";

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
  onCreateAt: jest.fn(),
  shouldAutoScroll: false,
  currentDate: new Date(2026, 7, 12, 0, 0),
};
describe("Timeline clock labels", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUser.timeFormat = "H24";
    mockUser.timezone = undefined;
  });
  it("renders H24 labels", () => {
    render(<Timeline {...props} />);
    expect(screen.getByText("06:00")).toBeTruthy();
    expect(screen.getByText("14:00")).toBeTruthy();
  });
  it("renders H12 labels with AM/PM", () => {
    mockUser.timeFormat = "H12";
    render(<Timeline {...props} />);
    expect(screen.getByText(/6:00.*AM/i)).toBeTruthy();
    expect(screen.getAllByText(/2:00.*PM/i).length).toBeGreaterThan(0);
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
  it("passes the unchanged selected wall-clock Date to onCreateAt", () => {
    render(<Timeline {...props} />);
    const canvas = screen.getByText("06:00").parent?.parent;
    fireEvent(canvas!, "responderRelease", {
      nativeEvent: { locationY: 8 * 64 + 32 },
    });
    const selected = props.onCreateAt.mock.calls[0][0] as Date;
    expect(selected.getFullYear()).toBe(2026);
    expect(selected.getMonth()).toBe(7);
    expect(selected.getDate()).toBe(12);
    expect(selected.getHours()).toBe(14);
    expect(selected.getMinutes()).toBe(30);
  });
  it.each([
    ["Europe/Moscow", "2026-08-13", "2026-08-13T11:30:00.000Z"],
    ["America/New_York", "2026-08-13", "2026-08-13T18:30:00.000Z"],
  ])("keeps a tapped slot on %s profile day %s", (timezone, dateKey, expected) => {
    mockUser.timezone = timezone;
    render(<Timeline {...props} currentDateKey={dateKey} profileTimezone={timezone} />);
    const canvas = screen.getByText("06:00").parent?.parent;
    fireEvent(canvas!, "responderRelease", {
      nativeEvent: { locationY: 8 * 64 + 32 },
    });
    expect(props.onCreateAt).toHaveBeenLastCalledWith(new Date(expected));
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

    expect(screen.getByText("Свободное окно · 45 мин")).toBeTruthy();
    const window = screen.getByTestId("timeline-free-window-240-285");
    expect(window.props.pointerEvents).toBe("none");
    expect(window.props.accessibilityRole).toBeUndefined();
    expect(window.props.accessibilityLabel).toBe(
      "Свободное окно с 10:00 до 10:45, 45 минут",
    );
    expect(screen.queryByRole("button", { name: /Свободное окно/ })).toBeNull();
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
    expect(screen.getByText("Свободное окно · 45 мин")).toBeTruthy();
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

    expect(window12.props.style[1]).toEqual(geometry24);
    expect(screen.getByTestId("task-block-row-first").props.style[1].top).toBe(taskTop24);
    expect(window24.props.accessibilityLabel).toContain("11:00");
    expect(window12.props.accessibilityLabel).toMatch(/11:00\s*AM/i);
    expect(screen.getByText("Свободное окно · 45 мин")).toBeTruthy();
  });

  it.each([
    ["2026-12-31", "2026-12-31T11:45:00.000Z"],
    ["2027-01-01", "2027-01-01T11:45:00.000Z"],
  ])("lets a free-window press reach exact Moscow slot on %s", (dateKey, expected) => {
    const tasks = [
      taskAt("first", new Date("2027-01-01T11:00:00.000Z"), 30),
      taskAt("second", new Date("2027-01-01T12:00:00.000Z"), 30),
    ];
    render(
      <Timeline
        {...props}
        tasks={tasks}
        currentDateKey={dateKey}
        profileTimezone="Europe/Moscow"
      />,
    );
    const window = screen.getByTestId("timeline-free-window-510-540");
    const geometry = window.props.style[1];
    const canvas = screen.getByText("06:00").parent?.parent;
    fireEvent(canvas!, "responderRelease", {
      nativeEvent: { locationY: geometry.top + geometry.height / 2 },
    });

    expect(window.props.pointerEvents).toBe("none");
    expect(props.onCreateAt).toHaveBeenLastCalledWith(new Date(expected));
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
    expect(screen.getByText("Свободное окно · 30 мин")).toBeTruthy();
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
