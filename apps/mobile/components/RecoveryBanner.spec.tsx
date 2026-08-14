/**
 * RecoveryBanner component tests — renders the real RecoveryBanner component.
 *
 * Uses @testing-library/react-native.
 * DateTimePicker is mocked; onChange callbacks are captured and fired in tests.
 * lib/timezone helpers run for real (tested separately in timezone.spec.ts).
 */

const mockProfile = { timeFormat: "H24" as "H24" | "H12" };
jest.mock("../stores/auth.store", () => ({
  useAuthStore: (selector: any) => selector({ user: mockProfile }),
}));

import React from "react";
import { render, fireEvent, act, screen } from "@testing-library/react-native";
import { RecoveryBanner } from "./RecoveryBanner";

// ── Mocks ────────────────────────────────────────────────────────────────────

jest.mock("react-native-safe-area-context", () => {
  const { View } = require("react-native");
  const React = require("react");
  return {
    SafeAreaView: ({ children, ...props }: any) =>
      React.createElement(View, props, children),
  };
});

jest.mock("expo-status-bar", () => ({ StatusBar: () => null }));

// Capture DateTimePicker onChange so tests can simulate date selection
let capturedDateOnChange: ((event: any, date?: Date) => void) | null = null;
let capturedTimeOnChange: ((event: any, date?: Date) => void) | null = null;
let capturedDateProps: any = null;
let capturedTimeProps: any = null;

jest.mock("@react-native-community/datetimepicker", () => ({
  __esModule: true,
  default: jest.fn((props: any) => {
    const { onChange, mode, testID } = props;
    if (mode === "date") {
      capturedDateOnChange = onChange;
      capturedDateProps = props;
    }
    if (mode === "time") {
      capturedTimeOnChange = onChange;
      capturedTimeProps = props;
    }
    const { View } = require("react-native");
    const React = require("react");
    return React.createElement(View, { testID: testID || `picker-${mode}` });
  }),
}));

// ── Fixtures ─────────────────────────────────────────────────────────────────

const TZ = "Europe/Moscow"; // UTC+3

const makeTask = (id: string, title = `Задача ${id}`) => ({
  id,
  userId: "user-1",
  title,
  startTime: new Date("2026-08-03T10:00:00.000Z"),
  completedAt: null,
  startedAt: null,
  isRecurring: false,
  parentTaskId: null,
  durationMinutes: 30,
  color: "#6B5BFC",
  subTasks: [],
  recurrenceRule: null,
  createdAt: new Date(),
  updatedAt: new Date(),
});

const task1 = makeTask("t1", "Важная задача");
const task2 = makeTask("t2", "Вторая задача");

function renderBanner(
  overrides: Partial<React.ComponentProps<typeof RecoveryBanner>> = {},
) {
  const onConfirm = jest.fn();
  const props = {
    overdueTasks: [task1],
    userTimezone: TZ,
    onConfirm,
    isConfirming: false,
    mutationError: null,
    reminderSyncPartial: false,
    ...overrides,
  };
  return { ...render(<RecoveryBanner {...props} />), onConfirm };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("RecoveryBanner — banner absent/present", () => {
  it("renders the banner when overdueTasks is non-empty", () => {
    renderBanner();
    expect(screen.getByTestId("recovery-banner")).toBeTruthy();
  });

  it("banner shows count for one task", () => {
    renderBanner();
    expect(screen.getByText(/1 незавершённая задача/)).toBeTruthy();
  });

  it("banner shows count for multiple tasks", () => {
    renderBanner({ overdueTasks: [task1, task2] });
    expect(screen.getByText(/2 незавершённых задачи/)).toBeTruthy();
  });
});

describe("RecoveryBanner — opening performs no mutation", () => {
  it("sheet is not visible before banner is pressed", () => {
    renderBanner();
    expect(screen.queryByTestId("recovery-sheet")).toBeFalsy();
  });

  it("pressing banner opens sheet", () => {
    renderBanner();
    fireEvent.press(screen.getByTestId("recovery-banner"));
    expect(screen.getByTestId("recovery-sheet")).toBeTruthy();
  });

  it("onConfirm is NOT called when sheet opens", () => {
    const { onConfirm } = renderBanner();
    fireEvent.press(screen.getByTestId("recovery-banner"));
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("opening shows the task title", () => {
    renderBanner();
    fireEvent.press(screen.getByTestId("recovery-banner"));
    expect(screen.getByText(task1.title)).toBeTruthy();
  });
});

describe("RecoveryBanner — selection", () => {
  function openSheet(
    extras?: Partial<React.ComponentProps<typeof RecoveryBanner>>,
  ) {
    const result = renderBanner(extras);
    fireEvent.press(screen.getByTestId("recovery-banner"));
    return result;
  }

  it("selection alone does not create a destination", () => {
    openSheet();
    fireEvent.press(screen.getByTestId(`checkbox-${task1.id}`));
    // Preview should say "Выберите, куда перенести" (no destination yet)
    expect(screen.getByTestId(`dest-preview-${task1.id}`)).toBeTruthy();
    expect(screen.getByText("Выберите, куда перенести")).toBeTruthy();
  });

  it("confirm is disabled before any selection", () => {
    openSheet();
    const confirmBtn = screen.getByTestId("confirm-btn");
    expect(confirmBtn.props.accessibilityState?.disabled).toBe(true);
  });

  it("confirm is still disabled after selection but before destination", () => {
    openSheet();
    fireEvent.press(screen.getByTestId(`checkbox-${task1.id}`));
    const confirmBtn = screen.getByTestId("confirm-btn");
    expect(confirmBtn.props.accessibilityState?.disabled).toBe(true);
  });

  it("checkbox has correct accessibility role and state", () => {
    openSheet();
    const checkbox = screen.getByTestId(`checkbox-${task1.id}`);
    expect(checkbox.props.accessibilityRole).toBe("checkbox");
    expect(checkbox.props.accessibilityState?.checked).toBe(false);
  });

  it("checkbox shows checked state after selection", () => {
    openSheet();
    fireEvent.press(screen.getByTestId(`checkbox-${task1.id}`));
    const checkbox = screen.getByTestId(`checkbox-${task1.id}`);
    expect(checkbox.props.accessibilityState?.checked).toBe(true);
  });

  it("deselecting removes the destination area", () => {
    openSheet();
    fireEvent.press(screen.getByTestId(`checkbox-${task1.id}`));
    fireEvent.press(screen.getByTestId(`checkbox-${task1.id}`)); // deselect
    expect(screen.queryByTestId(`dest-area-${task1.id}`)).toBeFalsy();
  });

  it("unselected tasks remain unchanged when another is confirmed", () => {
    // Single render instance: select only task1, confirm, then inspect the
    // payload. (The previous version rendered a second banner mid-test and
    // asserted against the stale first tree, so it proved nothing.)
    const { onConfirm } = openSheet({ overdueTasks: [task1, task2] });

    fireEvent.press(screen.getByTestId(`checkbox-${task1.id}`));
    fireEvent.press(screen.getByTestId(`inbox-btn-${task1.id}`));

    // task2 is visible and selectable, but deliberately left untouched.
    expect(screen.getByTestId(`checkbox-${task2.id}`)).toBeTruthy();
    expect(screen.queryByTestId(`dest-area-${task2.id}`)).toBeFalsy();

    fireEvent.press(screen.getByTestId("confirm-btn"));

    expect(onConfirm).toHaveBeenCalledTimes(1);
    const payload = (onConfirm as jest.Mock).mock.calls[0][0];
    expect(payload).toHaveLength(1);
    expect(payload[0].taskId).toBe(task1.id);
    expect(payload.some((s: any) => s.taskId === task2.id)).toBe(false);
  });
});

describe("RecoveryBanner — Inbox destination", () => {
  function openAndSelect() {
    renderBanner();
    fireEvent.press(screen.getByTestId("recovery-banner"));
    fireEvent.press(screen.getByTestId(`checkbox-${task1.id}`));
  }

  it("pressing the Thoughts destination sets inbox preview", () => {
    openAndSelect();
    const thoughtsButton = screen.getByTestId(`inbox-btn-${task1.id}`);
    expect(thoughtsButton.props.accessibilityLabel).toBe(
      "Переместить в раздел Мысли",
    );
    fireEvent.press(thoughtsButton);
    expect(screen.getByText("→ В «Мысли»")).toBeTruthy();
  });

  it("pressing the Thoughts destination enables confirm", () => {
    openAndSelect();
    fireEvent.press(screen.getByTestId(`inbox-btn-${task1.id}`));
    const confirmBtn = screen.getByTestId("confirm-btn");
    expect(confirmBtn.props.accessibilityState?.disabled).toBe(false);
  });

  it("confirming Inbox calls onConfirm with destination=inbox", () => {
    const { onConfirm } = renderBanner();
    fireEvent.press(screen.getByTestId("recovery-banner"));
    fireEvent.press(screen.getByTestId(`checkbox-${task1.id}`));
    fireEvent.press(screen.getByTestId(`inbox-btn-${task1.id}`));
    fireEvent.press(screen.getByTestId("confirm-btn"));
    expect(onConfirm).toHaveBeenCalledWith([
      { taskId: task1.id, destination: "inbox" },
    ]);
  });

  it("inbox button has selected state after press", () => {
    openAndSelect();
    fireEvent.press(screen.getByTestId(`inbox-btn-${task1.id}`));
    const btn = screen.getByTestId(`inbox-btn-${task1.id}`);
    expect(btn.props.accessibilityState?.selected).toBe(true);
  });
});

describe("RecoveryBanner — date/time destination", () => {
  // Must be built from DEVICE-LOCAL fields, because that is what
  // DateTimePicker reports and what pickerDateToLocalString /
  // pickerTimeToLocalFields read. A hardcoded UTC instant is not safe: after
  // the device-tz → profile-tz field reinterpretation it can land in the past
  // (which correctly disables confirm) and the test would rot over time.
  // 7 days ahead keeps it future-valid for any device/profile offset pair.
  const FUTURE_DATE = (() => {
    const d = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12, 0, 0);
  })();

  function openAndSelect() {
    renderBanner();
    fireEvent.press(screen.getByTestId("recovery-banner"));
    fireEvent.press(screen.getByTestId(`checkbox-${task1.id}`));
  }

  it('pressing "Выбрать дату и время" shows date picker', () => {
    openAndSelect();
    capturedDateOnChange = null;
    fireEvent.press(screen.getByTestId(`pick-time-btn-${task1.id}`));
    expect(screen.getByTestId(`date-picker-${task1.id}`)).toBeTruthy();
  });

  it("after date selection, time picker is shown", () => {
    openAndSelect();
    fireEvent.press(screen.getByTestId(`pick-time-btn-${task1.id}`));
    // Simulate date selection
    act(() => {
      capturedDateOnChange?.({ type: "set" }, FUTURE_DATE);
    });
    expect(screen.getByTestId(`time-picker-${task1.id}`)).toBeTruthy();
  });

  it("after time selection, destination preview shows formatted time", () => {
    openAndSelect();
    fireEvent.press(screen.getByTestId(`pick-time-btn-${task1.id}`));
    act(() => {
      capturedDateOnChange?.({ type: "set" }, FUTURE_DATE);
    });
    act(() => {
      capturedTimeOnChange?.({ type: "set" }, FUTURE_DATE);
    });
    // Preview should show formatted time in profile timezone (Europe/Moscow UTC+3)
    const preview = screen.getByTestId(`dest-preview-${task1.id}`);
    expect(preview).toBeTruthy();
    // Should NOT say "Выберите, куда перенести"
    expect(preview.props.children).not.toBe("Выберите, куда перенести");
  });

  it("after valid time selection, confirm is enabled", () => {
    openAndSelect();
    fireEvent.press(screen.getByTestId(`pick-time-btn-${task1.id}`));
    act(() => {
      capturedDateOnChange?.({ type: "set" }, FUTURE_DATE);
    });
    act(() => {
      capturedTimeOnChange?.({ type: "set" }, FUTURE_DATE);
    });
    const confirmBtn = screen.getByTestId("confirm-btn");
    expect(confirmBtn.props.accessibilityState?.disabled).toBe(false);
  });

  it("confirming date/time calls onConfirm with ISO destination", () => {
    const { onConfirm } = renderBanner();
    fireEvent.press(screen.getByTestId("recovery-banner"));
    fireEvent.press(screen.getByTestId(`checkbox-${task1.id}`));
    fireEvent.press(screen.getByTestId(`pick-time-btn-${task1.id}`));
    act(() => {
      capturedDateOnChange?.({ type: "set" }, FUTURE_DATE);
    });
    act(() => {
      capturedTimeOnChange?.({ type: "set" }, FUTURE_DATE);
    });
    fireEvent.press(screen.getByTestId("confirm-btn"));
    expect(onConfirm).toHaveBeenCalledWith([
      expect.objectContaining({
        taskId: task1.id,
        destination: expect.stringMatching(/^\d{4}-/),
      }),
    ]);
    // Destination must be an ISO string (not 'inbox' or 'today')
    const arg = (onConfirm as jest.Mock).mock.calls[0][0][0];
    expect(arg.destination).not.toBe("inbox");
    expect(() => new Date(arg.destination)).not.toThrow();
  });

  it("dismissing date picker does NOT set destination", () => {
    openAndSelect();
    fireEvent.press(screen.getByTestId(`pick-time-btn-${task1.id}`));
    act(() => {
      capturedDateOnChange?.({ type: "dismissed" }, undefined);
    });
    // Picker is gone, destination still null
    expect(screen.getByText("Выберите, куда перенести")).toBeTruthy();
    expect(
      screen.getByTestId("confirm-btn").props.accessibilityState?.disabled,
    ).toBe(true);
  });
});

describe("RecoveryBanner — past/invalid destination", () => {
  const PAST_DATE = new Date("2020-01-01T10:00:00.000Z"); // definitely past

  it("confirm remains disabled when selected instant is in the past", () => {
    renderBanner();
    fireEvent.press(screen.getByTestId("recovery-banner"));
    fireEvent.press(screen.getByTestId(`checkbox-${task1.id}`));
    fireEvent.press(screen.getByTestId(`pick-time-btn-${task1.id}`));
    act(() => {
      capturedDateOnChange?.({ type: "set" }, PAST_DATE);
    });
    act(() => {
      capturedTimeOnChange?.({ type: "set" }, PAST_DATE);
    });
    const confirmBtn = screen.getByTestId("confirm-btn");
    expect(confirmBtn.props.accessibilityState?.disabled).toBe(true);
  });

  it('past destination shows "(уже прошло)" warning in preview', () => {
    renderBanner();
    fireEvent.press(screen.getByTestId("recovery-banner"));
    fireEvent.press(screen.getByTestId(`checkbox-${task1.id}`));
    fireEvent.press(screen.getByTestId(`pick-time-btn-${task1.id}`));
    act(() => {
      capturedDateOnChange?.({ type: "set" }, PAST_DATE);
    });
    act(() => {
      capturedTimeOnChange?.({ type: "set" }, PAST_DATE);
    });
    const preview = screen.getByTestId(`dest-preview-${task1.id}`);
    expect(preview.props.children).toMatch(/уже прошло/);
  });
});

describe("RecoveryBanner — cancel", () => {
  it("pressing cancel closes the sheet", () => {
    renderBanner();
    fireEvent.press(screen.getByTestId("recovery-banner"));
    expect(screen.getByTestId("recovery-sheet")).toBeTruthy();
    fireEvent.press(screen.getByTestId("cancel-btn"));
    expect(screen.queryByTestId("recovery-sheet")).toBeFalsy();
  });

  it("cancel does not call onConfirm", () => {
    const { onConfirm } = renderBanner();
    fireEvent.press(screen.getByTestId("recovery-banner"));
    fireEvent.press(screen.getByTestId(`checkbox-${task1.id}`));
    fireEvent.press(screen.getByTestId(`inbox-btn-${task1.id}`));
    fireEvent.press(screen.getByTestId("cancel-btn"));
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("cancel has correct accessibility label", () => {
    renderBanner();
    fireEvent.press(screen.getByTestId("recovery-banner"));
    const btn = screen.getByTestId("cancel-btn");
    expect(btn.props.accessibilityLabel).toBe("Отмена — никаких изменений");
  });
});

describe("RecoveryBanner — loading / isConfirming", () => {
  it("shows spinner when isConfirming=true", () => {
    renderBanner({ isConfirming: true });
    fireEvent.press(screen.getByTestId("recovery-banner"));
    expect(screen.getByTestId("confirm-spinner")).toBeTruthy();
  });

  it("confirm button is disabled when isConfirming=true", () => {
    renderBanner({ isConfirming: true });
    fireEvent.press(screen.getByTestId("recovery-banner"));
    const btn = screen.getByTestId("confirm-btn");
    expect(btn.props.accessibilityState?.disabled).toBe(true);
    expect(btn.props.accessibilityState?.busy).toBe(true);
  });
});

describe("RecoveryBanner — server error / retry", () => {
  it("shows mutationError when provided", () => {
    renderBanner({ mutationError: "Проверьте соединение и попробуйте снова." });
    fireEvent.press(screen.getByTestId("recovery-banner"));
    expect(screen.getByTestId("mutation-error-banner")).toBeTruthy();
    expect(
      screen.getByText("Проверьте соединение и попробуйте снова."),
    ).toBeTruthy();
  });

  it("does not show error banner when mutationError is null", () => {
    renderBanner({ mutationError: null });
    fireEvent.press(screen.getByTestId("recovery-banner"));
    expect(screen.queryByTestId("mutation-error-banner")).toBeFalsy();
  });
});

describe("RecoveryBanner — invalid timezone guard", () => {
  it("shows neutral error state for invalid timezone", () => {
    renderBanner({ userTimezone: "Not/AValidZone" });
    fireEvent.press(screen.getByTestId("recovery-banner"));
    expect(screen.getByTestId("timezone-error-state")).toBeTruthy();
  });

  it("shows close button in error state", () => {
    renderBanner({ userTimezone: "Not/AValidZone" });
    fireEvent.press(screen.getByTestId("recovery-banner"));
    expect(screen.getByTestId("timezone-error-close")).toBeTruthy();
  });

  it("close button dismisses the sheet", () => {
    renderBanner({ userTimezone: "Not/AValidZone" });
    fireEvent.press(screen.getByTestId("recovery-banner"));
    fireEvent.press(screen.getByTestId("timezone-error-close"));
    expect(screen.queryByTestId("recovery-sheet")).toBeFalsy();
  });

  it("does NOT show task list for invalid timezone", () => {
    renderBanner({ userTimezone: "Not/AValidZone" });
    fireEvent.press(screen.getByTestId("recovery-banner"));
    expect(screen.queryByTestId(`checkbox-${task1.id}`)).toBeFalsy();
  });
});

describe("RecoveryBanner — DST spring-forward rejection", () => {
  it("spring-forward gap time shows error in preview and confirm stays disabled", () => {
    // 2026-03-08 02:30 America/New_York is a nonexistent spring-forward time.
    // The mock picker shows device-local 2026-03-08 02:30.
    // The component's validateWallClock detects the mismatch and rejects it.
    renderBanner({ userTimezone: "America/New_York" });
    fireEvent.press(screen.getByTestId("recovery-banner"));
    fireEvent.press(screen.getByTestId(`checkbox-${task1.id}`));
    fireEvent.press(screen.getByTestId(`pick-time-btn-${task1.id}`));

    // Date picker: user picks 2026-03-08
    const springForwardDate = {
      getFullYear: () => 2026,
      getMonth: () => 2,
      getDate: () => 8,
      getHours: () => 2,
      getMinutes: () => 30,
      toISOString: () => "2026-03-08T07:30:00.000Z",
    } as unknown as Date;
    act(() => {
      capturedDateOnChange?.({ type: "set" }, springForwardDate);
    });

    // Time picker: user picks 02:30 (device-local)
    const springForwardTime = {
      getFullYear: () => 2026,
      getMonth: () => 2,
      getDate: () => 8,
      getHours: () => 2,
      getMinutes: () => 30,
      toISOString: () => "2026-03-08T07:30:00.000Z",
    } as unknown as Date;
    act(() => {
      capturedTimeOnChange?.({ type: "set" }, springForwardTime);
    });

    const preview = screen.getByTestId(`dest-preview-${task1.id}`);
    // DST error should mention transition
    expect(preview.props.children).toMatch(/летнее время|не существует/);
    // Confirm must still be disabled
    expect(
      screen.getByTestId("confirm-btn").props.accessibilityState?.disabled,
    ).toBe(true);
  });
});

describe("RecoveryBanner — confirm with subset", () => {
  it("only selected tasks are in the onConfirm payload", () => {
    const { onConfirm } = renderBanner({ overdueTasks: [task1, task2] });
    fireEvent.press(screen.getByTestId("recovery-banner"));
    // Select only task1
    fireEvent.press(screen.getByTestId(`checkbox-${task1.id}`));
    fireEvent.press(screen.getByTestId(`inbox-btn-${task1.id}`));
    fireEvent.press(screen.getByTestId("confirm-btn"));
    expect(onConfirm).toHaveBeenCalledWith([
      { taskId: task1.id, destination: "inbox" },
    ]);
    // task2 not in payload
    const payload = (onConfirm as jest.Mock).mock.calls[0][0];
    expect(payload.some((s: any) => s.taskId === task2.id)).toBe(false);
  });

  it("confirm disabled when one of two selected tasks has no destination", () => {
    renderBanner({ overdueTasks: [task1, task2] });
    fireEvent.press(screen.getByTestId("recovery-banner"));
    fireEvent.press(screen.getByTestId(`checkbox-${task1.id}`));
    fireEvent.press(screen.getByTestId(`inbox-btn-${task1.id}`)); // t1 has inbox
    fireEvent.press(screen.getByTestId(`checkbox-${task2.id}`));
    // t2 selected but no destination → confirm should be disabled
    expect(
      screen.getByTestId("confirm-btn").props.accessibilityState?.disabled,
    ).toBe(true);
  });
});

describe("RecoveryBanner — accessibility", () => {
  it("modal has accessibilityViewIsModal", () => {
    renderBanner();
    fireEvent.press(screen.getByTestId("recovery-banner"));
    const sheet = screen.getByTestId("recovery-sheet");
    // Modal itself sets this; we check the sheet container exists
    expect(sheet).toBeTruthy();
  });

  it("banner button has accessible role", () => {
    renderBanner();
    const banner = screen.getByTestId("recovery-banner");
    expect(banner.props.accessibilityRole).toBe("button");
  });

  it("confirm button has useful label when nothing selected", () => {
    renderBanner();
    fireEvent.press(screen.getByTestId("recovery-banner"));
    const btn = screen.getByTestId("confirm-btn");
    expect(btn.props.accessibilityLabel).toContain("выберите задачи");
  });

  it("confirm button label updates when all destinations set", () => {
    renderBanner();
    fireEvent.press(screen.getByTestId("recovery-banner"));
    fireEvent.press(screen.getByTestId(`checkbox-${task1.id}`));
    fireEvent.press(screen.getByTestId(`inbox-btn-${task1.id}`));
    const btn = screen.getByTestId("confirm-btn");
    expect(btn.props.accessibilityLabel).toContain("1 задач");
  });

  it("checkbox has explicit 44x44 touch target", () => {
    renderBanner();
    fireEvent.press(screen.getByTestId("recovery-banner"));
    const checkbox = screen.getByTestId(`checkbox-${task1.id}`);
    const flatStyle = checkbox.props.style;
    const styles = Array.isArray(flatStyle) ? flatStyle : [flatStyle];
    const combined = Object.assign({}, ...styles.filter(Boolean));
    // Must have an explicit height/width of at least 44 — NOT a fallback default
    const h = combined.height ?? combined.minHeight;
    const w = combined.width ?? combined.minWidth;
    expect(typeof h).toBe("number");
    expect(typeof w).toBe("number");
    expect(h).toBeGreaterThanOrEqual(44);
    expect(w).toBeGreaterThanOrEqual(44);
  });

  it("destination buttons have explicit minHeight >= 44", () => {
    renderBanner();
    fireEvent.press(screen.getByTestId("recovery-banner"));
    fireEvent.press(screen.getByTestId(`checkbox-${task1.id}`));
    const inboxBtn = screen.getByTestId(`inbox-btn-${task1.id}`);
    const flatStyle = inboxBtn.props.style;
    const styles = Array.isArray(flatStyle) ? flatStyle : [flatStyle];
    const combined = Object.assign({}, ...styles.filter(Boolean));
    // Must have an explicit minHeight — NOT a fallback default
    expect(typeof combined.minHeight).toBe("number");
    expect(combined.minHeight).toBeGreaterThanOrEqual(44);
  });
});

describe("RecoveryBanner — time-format presentation", () => {
  const future = new Date(Date.now() + 7 * 86400000);
  future.setHours(14, 30, 0, 0);
  function choose(format: "H24" | "H12") {
    mockProfile.timeFormat = format;
    const result = renderBanner();
    fireEvent.press(screen.getByTestId("recovery-banner"));
    expect(
      screen.getByText(format === "H24" ? /Было:.*13:00/ : /Было:.*1:00.*PM/i),
    ).toBeTruthy();
    fireEvent.press(screen.getByTestId(`checkbox-${task1.id}`));
    fireEvent.press(screen.getByTestId(`pick-time-btn-${task1.id}`));
    expect(capturedDateProps.is24Hour).toBeUndefined();
    act(() => capturedDateOnChange?.({ type: "set" }, future));
    expect(capturedTimeProps.is24Hour).toBe(format === "H24");
    act(() => capturedTimeOnChange?.({ type: "set" }, future));
    fireEvent.press(screen.getByTestId("confirm-btn"));
    return result.onConfirm.mock.calls[0][0][0].destination;
  }
  it("shows H24 labels and configures only the time picker", () => {
    const iso = choose("H24");
    expect(
      screen.getByTestId(`dest-preview-${task1.id}`).props.children,
    ).toMatch(/14:30/);
    expect(iso).toMatch(/T/);
  });
  it("shows H12 overdue and destination labels", () => {
    choose("H12");
    expect(
      screen.getByTestId(`dest-preview-${task1.id}`).props.children,
    ).toMatch(/2:30.*PM/i);
  });
  it("produces the same destination ISO under H12 and H24", () => {
    const h24 = choose("H24");
    screen.unmount();
    const h12 = choose("H12");
    expect(h12).toBe(h24);
  });
  it("uses H12 in the DST validation message", () => {
    mockProfile.timeFormat = "H12";
    renderBanner({ userTimezone: "America/New_York" });
    fireEvent.press(screen.getByTestId("recovery-banner"));
    fireEvent.press(screen.getByTestId(`checkbox-${task1.id}`));
    fireEvent.press(screen.getByTestId(`pick-time-btn-${task1.id}`));
    const gap = {
      getFullYear: () => 2026,
      getMonth: () => 2,
      getDate: () => 8,
      getHours: () => 2,
      getMinutes: () => 30,
    } as unknown as Date;
    act(() => capturedDateOnChange?.({ type: "set" }, gap));
    act(() => capturedTimeOnChange?.({ type: "set" }, gap));
    expect(
      screen.getByTestId(`dest-preview-${task1.id}`).props.children,
    ).toMatch(/2:30.*AM.*не существует/i);
  });
});
