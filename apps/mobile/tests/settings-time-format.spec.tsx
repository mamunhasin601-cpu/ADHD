import React from "react";
import {
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react-native";
import SettingsScreen from "../app/(tabs)/settings";
import { apiClient } from "../lib/api-client";

const mockSetUser = jest.fn();
let mockUser: any;
jest.mock("../stores/auth.store", () => ({
  useAuthStore: (selector: any) =>
    selector({ user: mockUser, setUser: mockSetUser, logout: jest.fn() }),
}));
jest.mock("../lib/api-client", () => ({ apiClient: { patch: jest.fn() } }));
jest.mock("../lib/api/plan", () => ({
  usePlanInfo: () => ({
    data: { isPro: false, usage: { activeTasks: 0 } },
    isLoading: false,
  }),
}));
const mockRequestPermission = jest.fn();
const mockOpenSettings = jest.fn();
let mockNotificationPermission: "not-asked" | "granted" | "denied" = "not-asked";
let mockNotificationBusy = false;
let mockNotificationError: string | null = null;
jest.mock("../lib/notification-lifecycle", () => ({ useNotificationLifecycle: () => ({ permission: mockNotificationPermission, invitation: "deferred", busy: mockNotificationBusy, error: mockNotificationError, requestPermission: mockRequestPermission, deferInvitation: jest.fn(), openSettings: mockOpenSettings }) }));
jest.mock("expo-router", () => ({ useRouter: () => ({ push: jest.fn() }) }));
jest.mock("react-native-safe-area-context", () => {
  const { View } = require("react-native");
  return { SafeAreaView: View };

});

describe("settings time format", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockNotificationPermission = "not-asked";
    mockNotificationBusy = false;
    mockNotificationError = null;
    mockUser = { id: "u", timezone: "Europe/Moscow", timeFormat: "SYSTEM" };
  });
  it("shows a real SYSTEM clock example", () => {
    render(<SettingsScreen />);
    expect(screen.getByLabelText(/Как в системе.*например.*:/i)).toBeTruthy();
  });
  it.each(["SYSTEM", "H24", "H12"] as const)(
    "shows %s as selected",
    (value) => {
      mockUser.timeFormat = value;
      render(<SettingsScreen />);
      expect(
        screen.getByTestId(`time-format-${value}`).props.accessibilityState
          .selected,
      ).toBe(true);
    },
  );
  it("sends only timeFormat and updates store after success", async () => {
    const updated = { ...mockUser, timeFormat: "H12" };
    (apiClient.patch as jest.Mock).mockResolvedValue({ data: updated });
    render(<SettingsScreen />);
    fireEvent.press(screen.getByTestId("time-format-H12"));
    await waitFor(() => expect(mockSetUser).toHaveBeenCalledWith(updated));
    expect(apiClient.patch).toHaveBeenCalledWith("/users/me", {
      timeFormat: "H12",
    });
  });
  it("uses a synchronous guard to prevent duplicate submissions before rerender", () => {
    (apiClient.patch as jest.Mock).mockReturnValue(new Promise(() => {}));
    render(<SettingsScreen />);
    const choice = screen.getByTestId("time-format-H24");
    fireEvent.press(choice);
    fireEvent.press(choice);
    expect(apiClient.patch).toHaveBeenCalledTimes(1);
    expect(
      screen.getByTestId("time-format-H12").props.accessibilityState.disabled,
    ).toBe(true);
  });
  it("keeps local user and gives actionable error after failure", async () => {
    (apiClient.patch as jest.Mock).mockRejectedValue(new Error("offline"));
    render(<SettingsScreen />);
    fireEvent.press(screen.getByTestId("time-format-H24"));
    expect((await screen.findByRole("alert")).props.children).toContain(
      "Проверьте соединение",
    );
    expect(mockSetUser).not.toHaveBeenCalled();
  });
  it.each([
    ["not-asked", "Не настроены", "Включить напоминания"],
    ["granted", "Включены", "Открыть настройки"],
    ["denied", "Выключены", "Открыть настройки"],
  ] as const)("shows notification state %s", (state, status, action) => {
    mockNotificationPermission = state;
    render(<SettingsScreen />);
    expect(screen.getByText(status)).toBeTruthy();
    fireEvent.press(screen.getByText(action));
    expect(state === "not-asked" ? mockRequestPermission : mockOpenSettings).toHaveBeenCalledTimes(1);
  });

  it("keeps deferred permission not configured and uses the shared explicit path", () => {
    render(<SettingsScreen />);
    expect(screen.getByText("Не настроены")).toBeTruthy();
    fireEvent.press(screen.getByText("Включить напоминания"));
    expect(mockRequestPermission).toHaveBeenCalledTimes(1);
  });

  it("exposes busy and alert accessibility without breaking time format controls", () => {
    mockNotificationBusy = true;
    mockNotificationError = "Не удалось настроить напоминания. Попробуйте ещё раз.";
    render(<SettingsScreen />);
    const enable = screen.getByRole("button", { name: "Включить напоминания" });
    expect(enable.props.accessibilityState).toEqual({ disabled: true, busy: true });
    expect(screen.getByRole("alert").props.children).toContain("Не удалось");
    expect(screen.getByTestId("time-format-H24").props.accessibilityState.disabled).toBe(false);
  });

});
