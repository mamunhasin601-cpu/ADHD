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
