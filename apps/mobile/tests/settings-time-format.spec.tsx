import React from "react";
import {
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react-native";
import { StyleSheet } from "react-native";
import SettingsScreen from "../app/(tabs)/settings";
import { apiClient } from "../lib/api-client";
import { ORBITS_THEMES, OrbitsThemeProvider, type OrbitsThemeName } from "../theme/orbits";

const mockSetUser = jest.fn();
const mockLogout = jest.fn();
const mockSelectTheme = jest.fn();
let mockUser: any;
let mockThemeName: 'warm' | 'dark' = 'warm';
let mockThemeSaving = false;
let mockThemeError: string | null = null;
let mockPlanInfo: any;
let mockPlanLoading = false;
jest.mock("../stores/auth.store", () => ({
  useAuthStore: (selector: any) =>
    selector({ user: mockUser, setUser: mockSetUser, logout: mockLogout }),
}));
jest.mock("../lib/api-client", () => ({ apiClient: { patch: jest.fn() } }));
jest.mock("../stores/orbits-theme.store", () => ({
  useOrbitsThemeStore: (selector: any) => selector({
    themeName: mockThemeName,
    saving: mockThemeSaving,
    saveError: mockThemeError,
    selectTheme: mockSelectTheme,
  }),
}));
jest.mock("../lib/api/plan", () => ({
  usePlanInfo: () => ({
    data: mockPlanInfo,
    isLoading: mockPlanLoading,
  }),
}));
const mockRequestPermission = jest.fn();
const mockOpenSettings = jest.fn();
let mockNotificationPermission: "not-asked" | "granted" | "denied" = "not-asked";
let mockNotificationBusy = false;
let mockNotificationError: string | null = null;
jest.mock("../lib/notification-lifecycle", () => ({ useNotificationLifecycle: () => ({ permission: mockNotificationPermission, invitation: "deferred", busy: mockNotificationBusy, error: mockNotificationError, requestPermission: mockRequestPermission, deferInvitation: jest.fn(), openSettings: mockOpenSettings }) }));
jest.mock("expo-router", () => ({ useRouter: () => ({ push: jest.fn() }) }));
jest.mock("expo-status-bar", () => ({
  StatusBar: (props: any) => require("react").createElement("StatusBar", { testID: "settings-status-bar", ...props }),
}));
jest.mock("react-native-safe-area-context", () => {
  const { View } = require("react-native");
  return { SafeAreaView: View };

});

function themedSettings(theme: OrbitsThemeName) {
  return (
    <OrbitsThemeProvider theme={theme}>
      <SettingsScreen />
    </OrbitsThemeProvider>
  );
}

function styleOf(testID: string) {
  return StyleSheet.flatten(screen.getByTestId(testID).props.style);
}

function expandTheme() {
  fireEvent.press(screen.getByTestId('settings-theme-disclosure'));
}

function expandTimeFormat() {
  fireEvent.press(screen.getByTestId('settings-time-format-disclosure'));
}

describe("settings time format", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockNotificationPermission = "not-asked";
    mockNotificationBusy = false;
    mockNotificationError = null;
    mockThemeName = "warm";
    mockThemeSaving = false;
    mockThemeError = null;
    mockSelectTheme.mockResolvedValue(true);
    mockPlanInfo = { isPro: false, usage: { activeTasks: 1 } };
    mockPlanLoading = false;
    mockUser = { id: "u", email: "user@example.com", timezone: "Europe/Moscow", timeFormat: "SYSTEM" };
  });
  it("requires explicit confirmation before logging out", () => {
    render(<SettingsScreen />);
    fireEvent.press(screen.getByText("Выйти из аккаунта"));
    expect(screen.getByText("Выйти из аккаунта?")).toBeTruthy();
    fireEvent.press(screen.getByRole("button", { name: "Отмена" }));
    expect(mockLogout).not.toHaveBeenCalled();

    fireEvent.press(screen.getByText("Выйти из аккаунта"));
    fireEvent.press(screen.getByRole("button", { name: "Выйти" }));
    expect(mockLogout).toHaveBeenCalledTimes(1);
  });
  it("keeps the device-local theme selection when logging out", () => {
    mockThemeName = "dark";
    render(themedSettings("dark"));

    fireEvent.press(screen.getByText("Выйти из аккаунта"));
    fireEvent.press(screen.getByRole("button", { name: "Выйти" }));

    expect(mockLogout).toHaveBeenCalledTimes(1);
    expect(mockSelectTheme).not.toHaveBeenCalled();
    expect(screen.getByTestId("settings-theme-current").props.children).toBe("Тёмная тема");
  });
  it("shows a real SYSTEM clock example", () => {
    render(<SettingsScreen />);
    expandTimeFormat();
    expect(screen.getByLabelText(/Как в системе.*например.*:/i)).toBeTruthy();
  });
  it('keeps Appearance and Time Format compact, accessible, and collapses after a successful choice', async () => {
    (apiClient.patch as jest.Mock).mockResolvedValue({ data: { ...mockUser, timeFormat: 'H24' } });
    render(<SettingsScreen />);

    expect(screen.getByTestId('settings-theme-disclosure').props.accessibilityState.expanded).toBe(false);
    expect(screen.getByTestId('settings-time-format-disclosure').props.accessibilityState.expanded).toBe(false);
    expect(screen.getByTestId('settings-theme-current').props.children).toBe('Светлая тема');
    expect(screen.getByTestId('settings-time-format-current').props.children).toBe('Как в системе');
    expect(screen.queryByTestId('orbits-theme-dark')).toBeNull();
    expect(screen.queryByTestId('time-format-H24')).toBeNull();

    expandTheme();
    expect(screen.getByTestId('settings-theme-disclosure').props.accessibilityState.expanded).toBe(true);
    fireEvent.press(screen.getByTestId('orbits-theme-dark'));
    await waitFor(() => expect(screen.getByTestId('settings-theme-disclosure').props.accessibilityState.expanded).toBe(false));

    expandTimeFormat();
    fireEvent.press(screen.getByTestId('time-format-H24'));
    await waitFor(() => expect(screen.getByTestId('settings-time-format-disclosure').props.accessibilityState.expanded).toBe(false));
  });
  it.each(["SYSTEM", "H24", "H12"] as const)(
    "shows %s as selected",
    (value) => {
      mockUser.timeFormat = value;
      render(<SettingsScreen />);
      expandTimeFormat();
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
    expandTimeFormat();
    fireEvent.press(screen.getByTestId("time-format-H12"));
    await waitFor(() => expect(mockSetUser).toHaveBeenCalledWith(updated));
    expect(apiClient.patch).toHaveBeenCalledWith("/users/me", {
      timeFormat: "H12",
    });
  });
  it("uses a synchronous guard to prevent duplicate submissions before rerender", () => {
    (apiClient.patch as jest.Mock).mockReturnValue(new Promise(() => {}));
    render(<SettingsScreen />);
    expandTimeFormat();
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
    expandTimeFormat();
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
    expect(StyleSheet.flatten(enable.props.style).opacity).toBe(0.55);
    expect(screen.getByRole("alert").props.children).toContain("Не удалось");
    expandTimeFormat();
    expect(screen.getByTestId("time-format-H24").props.accessibilityState.disabled).toBe(false);
  });

  it("shows the approved warm and dark choices with radio semantics", () => {
    mockThemeName = "dark";
    render(<SettingsScreen />);
    expandTheme();
    expect(screen.getByTestId("orbits-theme-warm").props.accessibilityRole).toBe("radio");
    expect(screen.getByTestId("orbits-theme-warm").props.accessibilityState.selected).toBe(false);
    expect(screen.getByTestId("orbits-theme-dark").props.accessibilityState.selected).toBe(true);
    expect(screen.queryByTestId("orbits-theme-gray")).toBeNull();
    expect(screen.getByText("Светлая тема")).toBeTruthy();
    expect(screen.queryByText("Серая")).toBeNull();
    expect(screen.getAllByText("Тёмная тема")).toHaveLength(2);
  });

  it("changes only the local theme preference", async () => {
    render(<SettingsScreen />);
    expandTheme();
    fireEvent.press(screen.getByTestId("orbits-theme-dark"));
    await waitFor(() => expect(mockSelectTheme).toHaveBeenCalledWith("dark"));
    expect(apiClient.patch).not.toHaveBeenCalled();
  });

  it("exposes theme busy and sanitized error states", () => {
    mockThemeSaving = true;
    mockThemeError = "Не удалось сохранить оформление. Попробуйте ещё раз.";
    render(<SettingsScreen />);
    expect(screen.getByTestId("settings-theme-disclosure").props.accessibilityState).toEqual({ expanded: false, disabled: true });
    expect(screen.queryByTestId("orbits-theme-dark")).toBeNull();
    expect(screen.getByText(mockThemeError).props.accessibilityRole).toBe("alert");
  });

  describe("Orbits theme application", () => {
    it.each(["warm", "dark"] as const)(
      "uses %s tokens across profile content while preserving preview palettes",
      (name) => {
        mockThemeName = name;
        mockThemeError = "Не удалось сохранить оформление. Попробуйте ещё раз.";
        mockNotificationError = "Не удалось настроить напоминания. Попробуйте ещё раз.";
        const theme = ORBITS_THEMES[name];

        render(themedSettings(name));
        expandTheme();
        expandTimeFormat();

        expect(styleOf("settings-screen").backgroundColor).toBe(theme.background);
        expect(screen.getByTestId("settings-status-bar").props.style).toBe(name === "dark" ? "light" : "dark");
        for (const card of [
          "settings-profile-card",
          "settings-theme-card",
          "settings-reminders-card",
          "settings-time-format-card",
          "settings-billing-card",
          "settings-account-card",
        ]) {
          expect(styleOf(card)).toMatchObject({
            backgroundColor: theme.surfacePrimary,
            borderColor: theme.borderSubtle,
          });
        }

        expect(StyleSheet.flatten(screen.getByText("Профиль").props.style).color).toBe(theme.textSecondary);
        expect(styleOf("settings-account-value").color).toBe(theme.brand);
        expect(styleOf("settings-timezone-row").borderBottomColor).toBe(theme.borderSubtle);
        expect(styleOf(`orbits-theme-${name}`)).toMatchObject({
          backgroundColor: theme.activeSurface,
          borderColor: theme.activeBorder,
        });
        const selectedThemeLabels = screen.getAllByText(name === "warm" ? "Светлая тема" : "Тёмная тема");
        expect(StyleSheet.flatten(selectedThemeLabels[selectedThemeLabels.length - 1].props.style).color).toBe(theme.activeSurfaceText);
        expect(styleOf("time-format-SYSTEM")).toMatchObject({
          backgroundColor: theme.activeSurface,
          borderColor: theme.activeBorder,
        });
        const systemLabels = screen.getAllByText("Как в системе");
        expect(StyleSheet.flatten(systemLabels[systemLabels.length - 1].props.style).color).toBe(theme.activeSurfaceText);
        expect(styleOf("settings-reminder-status").color).toBe(theme.textPrimary);
        expect(StyleSheet.flatten(screen.getByText("Включить напоминания").props.style).color).toBe(theme.brand);
        expect(styleOf("settings-plan-badge").backgroundColor).toBe(theme.surfaceMuted);
        expect(styleOf("settings-upgrade").backgroundColor).toBe(theme.brand);
        expect(StyleSheet.flatten(screen.getByText("Улучшить →").props.style).color).toBe(theme.retryText);
        expect(styleOf("settings-usage-track").backgroundColor).toBe(theme.surfaceMuted);
        expect(styleOf("settings-usage-fill").backgroundColor).toBe(theme.brand);
        expect(styleOf("settings-danger-text").color).toBe(theme.errorPrimary);
        expect(styleOf("settings-theme-error").color).toBe(theme.errorPrimary);
        expect(styleOf("settings-notification-error").color).toBe(theme.errorPrimary);

        expect(styleOf("orbits-theme-preview-warm")).toMatchObject({
          backgroundColor: ORBITS_THEMES.warm.background,
          borderColor: ORBITS_THEMES.warm.borderSubtle,
        });
        expect(styleOf("orbits-theme-preview-dark")).toMatchObject({
          backgroundColor: ORBITS_THEMES.dark.background,
          borderColor: ORBITS_THEMES.dark.borderSubtle,
        });
        const previewLabels = screen.getAllByText("Aa");
        expect(StyleSheet.flatten(previewLabels[0].props.style).color).toBe(ORBITS_THEMES.warm.textPrimary);
        expect(StyleSheet.flatten(previewLabels[1].props.style).color).toBe(ORBITS_THEMES.dark.textPrimary);
      },
    );

    it("switches warm to dark without remounting or losing selected values and accessibility", async () => {
      mockThemeName = "warm";
      const view = render(themedSettings("warm"));
      expandTheme();
      expandTimeFormat();

      expect(styleOf("settings-screen").backgroundColor).toBe(ORBITS_THEMES.warm.background);
      expect(screen.getByTestId("orbits-theme-warm").props.accessibilityState.selected).toBe(true);
      expect(screen.getByTestId("time-format-SYSTEM").props.accessibilityState.selected).toBe(true);

      mockThemeName = "dark";
      view.rerender(themedSettings("dark"));

      expect(styleOf("settings-screen").backgroundColor).toBe(ORBITS_THEMES.dark.background);
      expect(styleOf("settings-profile-card").backgroundColor).toBe(ORBITS_THEMES.dark.surfacePrimary);
      expect(screen.getByTestId("orbits-theme-warm").props.accessibilityState.selected).toBe(false);
      expect(screen.getByTestId("orbits-theme-dark").props.accessibilityState.selected).toBe(true);
      expect(screen.getByTestId("time-format-SYSTEM").props.accessibilityState.selected).toBe(true);
      expect(screen.getByTestId("settings-account-value").props.children).toBe("user@example.com");
      expect(screen.getByText("Europe/Moscow")).toBeTruthy();
      expect(styleOf("orbits-theme-preview-warm").backgroundColor).toBe(ORBITS_THEMES.warm.background);
      expect(styleOf("orbits-theme-preview-dark").backgroundColor).toBe(ORBITS_THEMES.dark.background);

      fireEvent.press(screen.getByTestId("orbits-theme-warm"));
      await waitFor(() => expect(mockSelectTheme).toHaveBeenCalledWith("warm"));
    });
  });

});
