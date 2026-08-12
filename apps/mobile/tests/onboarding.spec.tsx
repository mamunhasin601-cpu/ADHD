const mockMutate = jest.fn();
let mockTimeFormat: "H24" | "H12" = "H24";

jest.mock("expo-router", () => ({}));
jest.mock("../lib/api/tasks", () => ({
  useCreateTask: jest.fn(() => ({ mutate: mockMutate, isPending: false })),
}));
jest.mock("../lib/api-client", () => ({
  apiClient: { patch: jest.fn() },
}));
jest.mock("../stores/auth.store", () => ({
  useAuthStore: jest.fn(),
}));
jest.mock("expo-status-bar", () => ({ StatusBar: () => null }));
jest.mock("react-native-safe-area-context", () => {
  const { View } = require("react-native");
  return {
    SafeAreaView: ({ children, ...props }: any) => (
      <View {...props}>{children}</View>
    ),
  };
});

import React from "react";
import { Alert } from "react-native";
import {
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react-native";
import OnboardingScreen from "../app/onboarding";
import { apiClient } from "../lib/api-client";
import { useCreateTask } from "../lib/api/tasks";
import { useAuthStore } from "../stores/auth.store";

describe("OnboardingScreen", () => {
  const setUser = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    mockTimeFormat = "H24";
    (useAuthStore as unknown as jest.Mock).mockImplementation((selector: any) =>
      selector({
        setUser,
        user: { timezone: "Europe/Moscow", timeFormat: mockTimeFormat },
      }),
    );
  });

  it("updates local user and relies on the auth guard after successful completion", async () => {
    const updatedUser = { id: "u1", hasCompletedOnboarding: true };
    (apiClient.patch as jest.Mock).mockResolvedValue({ data: updatedUser });

    render(<OnboardingScreen />);
    fireEvent.press(screen.getByText("Пропустить"));

    await waitFor(() => expect(setUser).toHaveBeenCalledWith(updatedUser));
    expect(apiClient.patch).toHaveBeenCalledWith("/users/me", {
      hasCompletedOnboarding: true,
    });
  });

  it("stays on onboarding and reports an error when completion fails", async () => {
    (apiClient.patch as jest.Mock).mockRejectedValue(new Error("network"));
    const alertSpy = jest.spyOn(Alert, "alert").mockImplementation(() => {});

    render(<OnboardingScreen />);
    fireEvent.press(screen.getByText("Пропустить"));

    await waitFor(() => expect(alertSpy).toHaveBeenCalled());
    expect(screen.getByText("Пропустить")).toBeTruthy();
    expect(setUser).not.toHaveBeenCalled();
    alertSpy.mockRestore();
  });

  it("creates a timed onboarding task in the profile timezone so Today returns it", () => {
    jest.useFakeTimers().setSystemTime(new Date("2026-08-11T12:00:00.000Z"));

    render(<OnboardingScreen />);
    fireEvent.press(screen.getByText("Начать"));
    fireEvent.changeText(
      screen.getByPlaceholderText("Например: Позвонить маме"),
      "Тестовая задача",
    );
    fireEvent.changeText(screen.getByPlaceholderText("14:00"), "14:00");
    fireEvent.press(screen.getByText("Создать"));

    expect(useCreateTask).toHaveBeenCalledWith(
      expect.any(Date),
      "Europe/Moscow",
    );
    expect(mockMutate).toHaveBeenCalledWith(
      {
        title: "Тестовая задача",
        startTime: "2026-08-11T11:00:00.000Z",
        durationMinutes: 30,
      },
      expect.objectContaining({ onSuccess: expect.any(Function) }),
    );

    jest.useRealTimers();
  });
});

describe("Onboarding time-format parsing", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(new Date("2026-08-11T12:00:00.000Z"));
  });
  afterEach(() => jest.useRealTimers());
  function renderEntry(format: "H12" | "H24") {
    mockTimeFormat = format;
    (useAuthStore as unknown as jest.Mock).mockImplementation((selector: any) =>
      selector({
        setUser: jest.fn(),
        user: { timezone: "Europe/Moscow", timeFormat: format },
      }),
    );
    render(<OnboardingScreen />);
    fireEvent.press(screen.getByText("Начать"));
    fireEvent.changeText(
      screen.getByPlaceholderText("Например: Позвонить маме"),
      "Задача",
    );
  }
  it.each([
    ["2:30 PM", "2026-08-11T11:30:00.000Z"],
    ["12:00 AM", "2026-08-10T21:00:00.000Z"],
    ["12:00 PM", "2026-08-11T09:00:00.000Z"],
  ] as const)(
    "maps H12 %s to the correct profile-timezone instant",
    (input, iso) => {
      renderEntry("H12");
      fireEvent.changeText(screen.getByPlaceholderText("2:00 PM"), input);
      fireEvent.press(screen.getByText("Создать"));
      expect(mockMutate).toHaveBeenCalledWith(
        expect.objectContaining({ startTime: iso }),
        expect.any(Object),
      );
    },
  );
  it("rejects ambiguous H12 input without AM/PM", () => {
    const alert = jest.spyOn(Alert, "alert").mockImplementation(() => {});
    renderEntry("H12");
    fireEvent.changeText(screen.getByPlaceholderText("2:00 PM"), "2:30");
    fireEvent.press(screen.getByText("Создать"));
    expect(alert).toHaveBeenCalledWith(
      "Проверьте время",
      "Введите время в формате 2:30 PM",
    );
    expect(mockMutate).not.toHaveBeenCalled();
    alert.mockRestore();
  });
  it("keeps H24 ISO behavior and format-specific placeholder", () => {
    renderEntry("H24");
    expect(screen.getByPlaceholderText("14:00")).toBeTruthy();
    fireEvent.changeText(screen.getByPlaceholderText("14:00"), "14:30");
    fireEvent.press(screen.getByText("Создать"));
    expect(mockMutate).toHaveBeenCalledWith(
      expect.objectContaining({ startTime: "2026-08-11T11:30:00.000Z" }),
      expect.any(Object),
    );
  });
  it("shows the H12 placeholder", () => {
    renderEntry("H12");
    expect(screen.getByPlaceholderText("2:00 PM")).toBeTruthy();
  });
});
