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
jest.mock("expo-router", () => ({ useRouter: () => ({ push: jest.fn() }) }));
jest.mock("react-native-safe-area-context", () => {
  const { View } = require("react-native");
  return { SafeAreaView: View };
});

describe("settings time format", () => {
  beforeEach(() => {
    jest.clearAllMocks();
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
});
