import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { useRouter } from "expo-router";
import { useAuthStore } from "../../stores/auth.store";
import { usePlanInfo } from "../../lib/api/plan";
import {
  FREE_TIER_LIMITS,
  type TimeFormat,
  type User,
} from "@focus/shared-types";
import { apiClient } from "../../lib/api-client";
import { useRef, useState } from "react";
import { formatWallClock } from "../../lib/time-format";
import { useNotificationLifecycle } from "../../lib/notification-lifecycle";
import { ORBITS_THEMES, type OrbitsThemeName, useOrbitsTheme } from "../../theme/orbits";
import { useOrbitsThemeStore } from "../../stores/orbits-theme.store";
import { FocusDialog, useFocusDialog } from "../../components/FocusDialog";

const THEME_CHOICES: ReadonlyArray<readonly [OrbitsThemeName, string, string]> = [
  ["warm", "Светлая тема", "Мягкий светлый фон"],
  ["dark", "Тёмная тема", "Тёмный фон и светлый текст"],
];

const TIME_FORMAT_CHOICES: ReadonlyArray<readonly [TimeFormat, string, string]> = [
  ["SYSTEM", "Как в системе", `По настройке устройства — например, ${formatWallClock(14, 30, "SYSTEM")}`],
  ["H24", "24-часовой", "Например, 14:30"],
  ["H12", "12-часовой", "Например, 2:30 PM"],
];

export default function SettingsScreen() {
  const theme = useOrbitsTheme();
  const router = useRouter();
  const { showDialog, dialogProps } = useFocusDialog();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const setUser = useAuthStore((s) => s.setUser);
  const [savingFormat, setSavingFormat] = useState(false);
  const savingFormatRef = useRef(false);
  const [formatError, setFormatError] = useState<string | null>(null);
  const [themeExpanded, setThemeExpanded] = useState(false);
  const [timeFormatExpanded, setTimeFormatExpanded] = useState(false);
  const { data: planInfo, isLoading: planLoading } = usePlanInfo();
  const notifications = useNotificationLifecycle();
  const themeName = useOrbitsThemeStore((s) => s.themeName);
  const themeSaving = useOrbitsThemeStore((s) => s.saving);
  const themeError = useOrbitsThemeStore((s) => s.saveError);
  const selectTheme = useOrbitsThemeStore((s) => s.selectTheme);

  const isPro = planInfo?.isPro ?? false;
  const activeTasks = planInfo?.usage.activeTasks ?? 0;
  const limit = FREE_TIER_LIMITS.maxActiveTasks;
  const usagePercent = Math.min((activeTasks / limit) * 100, 100);

  async function selectTimeFormat(timeFormat: TimeFormat): Promise<boolean> {
    if (
      savingFormatRef.current ||
      timeFormat === (user?.timeFormat ?? "SYSTEM")
    )
      return timeFormat === (user?.timeFormat ?? "SYSTEM");
    savingFormatRef.current = true;
    setSavingFormat(true);
    setFormatError(null);
    try {
      const { data } = await apiClient.patch<User>("/users/me", { timeFormat });
      setUser(data);
      return true;
    } catch {
      setFormatError(
        "Не удалось сохранить формат времени. Проверьте соединение и попробуйте снова.",
      );
      return false;
    } finally {
      savingFormatRef.current = false;
      setSavingFormat(false);
    }
  }

  async function chooseTheme(value: OrbitsThemeName) {
    if (value === themeName || await selectTheme(value)) setThemeExpanded(false);
  }

  async function chooseTimeFormat(value: TimeFormat) {
    if (await selectTimeFormat(value)) setTimeFormatExpanded(false);
  }

  function handleLogout() {
    showDialog({
      title: "Выйти из аккаунта?",
      actions: [
        { text: "Отмена", style: "cancel" },
        {
          text: "Выйти",
          style: "destructive",
          onPress: async () => {
            await logout();
          },
        },
      ],
    });
  }

  return (
    <>
    <SafeAreaView testID="settings-screen" style={[styles.container, { backgroundColor: theme.background }]}>
      <StatusBar style={theme.name === "dark" ? "light" : "dark"} />
      <ScrollView contentContainerStyle={styles.content}>
        {/* Профиль */}
        <View testID="settings-profile-card" style={[styles.section, { backgroundColor: theme.surfacePrimary, borderColor: theme.borderSubtle }]}>
          <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>Профиль</Text>
          <View style={[styles.row, { borderBottomColor: theme.borderSubtle }]}>
            <Text style={[styles.rowLabel, { color: theme.textPrimary }]}>Аккаунт</Text>
            <Text testID="settings-account-value" style={[styles.rowValue, { color: theme.brand }]} numberOfLines={1}>
              {user?.email ?? user?.phone ?? "—"}
            </Text>
          </View>
          <View testID="settings-timezone-row" style={[styles.row, { borderBottomColor: theme.borderSubtle }]}>
            <Text style={[styles.rowLabel, { color: theme.textPrimary }]}>Часовой пояс</Text>
            <Text style={[styles.rowValue, { color: theme.brand }]}>{user?.timezone ?? "—"}</Text>
          </View>
        </View>

        <View testID="settings-theme-card" style={[styles.section, { backgroundColor: theme.surfacePrimary, borderColor: theme.borderSubtle }]} accessibilityLabel="Оформление">
          <Pressable
            testID="settings-theme-disclosure"
            accessibilityRole="button"
            accessibilityLabel={`Оформление. ${THEME_CHOICES.find(([value]) => value === themeName)?.[1]}`}
            accessibilityState={{ expanded: themeExpanded, disabled: themeSaving }}
            disabled={themeSaving}
            onPress={() => setThemeExpanded((expanded) => !expanded)}
            style={styles.disclosureRow}
          >
            <Text style={[styles.sectionTitle, styles.disclosureTitle, { color: theme.textSecondary }]}>Оформление</Text>
            <View style={styles.disclosureValueRow}>
              <Text testID="settings-theme-current" style={[styles.disclosureValue, { color: theme.textPrimary }]}>{THEME_CHOICES.find(([value]) => value === themeName)?.[1]}</Text>
              <Text style={[styles.disclosureChevron, { color: theme.textSecondary }]}>{themeExpanded ? "⌃" : "›"}</Text>
            </View>
          </Pressable>
          {themeExpanded && THEME_CHOICES.map(([value, label, copy]) => {
            const selected = themeName === value;
            const preview = ORBITS_THEMES[value];
            return (
              <Pressable
                key={value}
                testID={`orbits-theme-${value}`}
                accessibilityRole="radio"
                accessibilityLabel={`${label}. ${copy}`}
                accessibilityState={{ selected, disabled: themeSaving, busy: themeSaving }}
                disabled={themeSaving}
                onPress={() => void chooseTheme(value)}
                style={[
                  styles.themeChoice,
                  {
                    backgroundColor: selected ? theme.activeSurface : theme.surfacePrimary,
                    borderColor: selected ? theme.activeBorder : theme.surfacePrimary,
                  },
                  themeSaving && styles.formatChoiceDisabled,
                ]}
              >
                <Text style={[styles.formatRadio, { color: selected ? theme.activeBorder : theme.brand }]}>{selected ? "●" : "○"}</Text>
                <View testID={`orbits-theme-preview-${value}`} style={[styles.themePreview, { backgroundColor: preview.background, borderColor: preview.borderSubtle }]}>
                  <Text style={{ color: preview.textPrimary, fontWeight: "700" }}>Aa</Text>
                </View>
                <View style={styles.themeCopy}>
                  <Text style={[styles.formatLabel, { color: selected ? theme.activeSurfaceText : theme.textPrimary }]}>{label}</Text>
                  <Text style={[styles.formatExample, { color: theme.textSecondary }]}>{copy}</Text>
                </View>
                {selected && <Text style={[styles.themeCheck, { color: theme.activeBorder }]}>✓</Text>}
              </Pressable>
            );
          })}
          {themeSaving && <ActivityIndicator testID="orbits-theme-saving" color={theme.brand} />}
          {themeError && <Text testID="settings-theme-error" accessibilityRole="alert" style={[styles.formatError, { color: theme.errorPrimary }]}>{themeError}</Text>}
        </View>

        <View testID="settings-reminders-card" style={[styles.section, { backgroundColor: theme.surfacePrimary, borderColor: theme.borderSubtle }]} accessibilityLabel="Напоминания">
          <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>Напоминания</Text>
          <Text testID="settings-reminder-status" accessibilityLabel={`Статус напоминаний: ${notifications.permission === 'granted' ? 'Включены' : notifications.permission === 'denied' ? 'Выключены' : 'Не настроены'}`} style={[styles.reminderStatus, { color: theme.textPrimary }]}>
            {notifications.permission === 'granted' ? 'Включены' : notifications.permission === 'denied' ? 'Выключены' : 'Не настроены'}
          </Text>
          {notifications.error && <Text testID="settings-notification-error" accessibilityRole="alert" style={[styles.formatError, { color: theme.errorPrimary }]}>{notifications.error}</Text>}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={notifications.permission === 'granted' || notifications.permission === 'denied' ? 'Открыть настройки' : 'Включить напоминания'}
            accessibilityState={{ disabled: notifications.busy, busy: notifications.busy }}
            disabled={notifications.busy}
            onPress={notifications.permission === 'granted' || notifications.permission === 'denied' ? notifications.openSettings : notifications.requestPermission}
            style={[styles.reminderAction, notifications.busy && styles.formatChoiceDisabled]}
          >
            {notifications.busy ? <ActivityIndicator color={theme.brand} /> : <Text style={[styles.reminderActionText, { color: theme.brand }]}>{notifications.permission === 'granted' || notifications.permission === 'denied' ? 'Открыть настройки' : 'Включить напоминания'}</Text>}
          </Pressable>
        </View>

        <View testID="settings-time-format-card" style={[styles.section, { backgroundColor: theme.surfacePrimary, borderColor: theme.borderSubtle }]}>
          <Pressable
            testID="settings-time-format-disclosure"
            accessibilityRole="button"
            accessibilityLabel={`Формат времени. ${TIME_FORMAT_CHOICES.find(([value]) => value === (user?.timeFormat ?? "SYSTEM"))?.[1]}`}
            accessibilityState={{ expanded: timeFormatExpanded, disabled: savingFormat }}
            disabled={savingFormat}
            onPress={() => setTimeFormatExpanded((expanded) => !expanded)}
            style={styles.disclosureRow}
          >
            <Text style={[styles.sectionTitle, styles.disclosureTitle, { color: theme.textSecondary }]}>Формат времени</Text>
            <View style={styles.disclosureValueRow}>
              <Text testID="settings-time-format-current" style={[styles.disclosureValue, { color: theme.textPrimary }]}>{TIME_FORMAT_CHOICES.find(([value]) => value === (user?.timeFormat ?? "SYSTEM"))?.[1]}</Text>
              <Text style={[styles.disclosureChevron, { color: theme.textSecondary }]}>{timeFormatExpanded ? "⌃" : "›"}</Text>
            </View>
          </Pressable>
          {timeFormatExpanded && TIME_FORMAT_CHOICES.map(([value, label, example]) => {
            const selected = (user?.timeFormat ?? "SYSTEM") === value;
            return (
              <Pressable
                key={value}
                testID={`time-format-${value}`}
                accessibilityRole="radio"
                accessibilityLabel={`${label}. ${example}`}
                accessibilityState={{ selected, disabled: savingFormat }}
                disabled={savingFormat}
                onPress={() => void chooseTimeFormat(value)}
                style={[
                  styles.formatChoice,
                  {
                    backgroundColor: selected ? theme.activeSurface : theme.surfacePrimary,
                    borderColor: selected ? theme.activeBorder : theme.surfacePrimary,
                  },
                  savingFormat && styles.formatChoiceDisabled,
                ]}
              >
                <Text style={[styles.formatRadio, { color: selected ? theme.activeBorder : theme.brand }]}>{selected ? "●" : "○"}</Text>
                <View>
                  <Text style={[styles.formatLabel, { color: selected ? theme.activeSurfaceText : theme.textPrimary }]}>{label}</Text>
                  <Text style={[styles.formatExample, { color: theme.textSecondary }]}>{example}</Text>
                </View>
              </Pressable>
            );
          })}
          {savingFormat && (
            <ActivityIndicator testID="time-format-saving" color={theme.brand} />
          )}
          {formatError && (
            <Text testID="settings-format-error" accessibilityRole="alert" style={[styles.formatError, { color: theme.errorPrimary }]}>
              {formatError}
            </Text>
          )}
        </View>

        {/* Подписка */}
        <View testID="settings-billing-card" style={[styles.section, { backgroundColor: theme.surfacePrimary, borderColor: theme.borderSubtle }]}>
          <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>Подписка</Text>
          {planLoading ? (
            <ActivityIndicator color={theme.brand} style={{ marginVertical: 12 }} />
          ) : (
            <>
              <View style={styles.planBadgeRow}>
                <View testID="settings-plan-badge" style={[styles.planBadge, { backgroundColor: isPro ? theme.brand : theme.surfaceMuted }]}>
                  <Text
                    style={[
                      styles.planBadgeText,
                      { color: isPro ? theme.retryText : theme.textPrimary },
                    ]}
                  >
                    {isPro ? "⚡ Pro" : "Free"}
                  </Text>
                </View>
                {!isPro && (
                  <Pressable
                    testID="settings-upgrade"
                    style={({ pressed }) => [styles.upgradeButton, { backgroundColor: pressed ? theme.brandPressed : theme.brand }]}
                    onPress={() => router.push("/paywall")}
                  >
                    <Text style={[styles.upgradeButtonText, { color: theme.retryText }]}>Улучшить →</Text>
                  </Pressable>
                )}
              </View>

              {!isPro && (
                <View style={styles.usageBlock}>
                  <View style={styles.usageHeader}>
                    <Text style={[styles.usageLabel, { color: theme.textSecondary }]}>Активные задачи</Text>
                    <Text style={[styles.usageCount, { color: theme.textPrimary }]}>
                      {activeTasks} / {limit}
                    </Text>
                  </View>
                  <View testID="settings-usage-track" style={[styles.usageBar, { backgroundColor: theme.surfaceMuted }]}>
                    <View
                      testID="settings-usage-fill"
                      style={[
                        styles.usageFill,
                        {
                          width: `${usagePercent}%` as any,
                          backgroundColor: usagePercent >= 90 ? theme.errorPrimary : theme.brand,
                        },
                      ]}
                    />
                  </View>
                </View>
              )}

              {isPro && planInfo?.proExpiresAt && (
                <Text style={[styles.proExpiry, { color: theme.textSecondary }]}>
                  Подписка активна до{" "}
                  {new Date(planInfo.proExpiresAt).toLocaleDateString("ru-RU", {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })}
                </Text>
              )}

              {isPro && !planInfo?.proExpiresAt && (
                <Text style={[styles.proExpiry, { color: theme.textSecondary }]}>Подписка бессрочная✓</Text>
              )}
            </>
          )}
        </View>

        {/* Аккаунт */}
        <View testID="settings-account-card" style={[styles.section, { backgroundColor: theme.surfacePrimary, borderColor: theme.borderSubtle }]}>
          <Pressable style={styles.dangerRow} onPress={handleLogout}>
            <Text testID="settings-danger-text" style={[styles.dangerText, { color: theme.errorPrimary }]}>Выйти из аккаунта</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
    <FocusDialog {...dialogProps} />
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 20, paddingBottom: 48 },

  section: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  disclosureRow: { minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  disclosureTitle: { marginBottom: 0, flexShrink: 1 },
  disclosureValueRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', flexShrink: 1, gap: 8 },
  disclosureValue: { fontSize: 15, fontWeight: '600', textAlign: 'right', flexShrink: 1 },
  disclosureChevron: { fontSize: 22, lineHeight: 24 },

  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
  },
  rowLabel: { fontSize: 14 },
  rowValue: { fontSize: 14, fontWeight: '600', maxWidth: '60%' },

  formatChoice: { flexDirection: 'row', gap: 12, alignItems: 'center', paddingVertical: 10, paddingHorizontal: 8, borderRadius: 10, borderWidth: 1 },
  formatChoiceDisabled: { opacity: 0.55 },
  themeChoice: { minHeight: 44, flexDirection: 'row', gap: 10, alignItems: 'center', paddingVertical: 8, paddingHorizontal: 8, borderRadius: 10, borderWidth: 1 },
  themePreview: { width: 38, height: 38, borderRadius: 9, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  themeCopy: { flex: 1 },
  themeCheck: { fontSize: 18, fontWeight: '700' },
  formatRadio: { fontSize: 20 },
  formatLabel: { fontSize: 15, fontWeight: '600' },
  formatExample: { fontSize: 13, marginTop: 2 },
  formatError: { marginTop: 8, lineHeight: 19 },
  reminderStatus: { fontSize: 15, marginBottom: 10 },
  reminderAction: { minHeight: 44, justifyContent: 'center', alignItems: 'flex-start' },
  reminderActionText: { fontSize: 15, fontWeight: '600' },

  planBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  planBadge: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
  },
  planBadgeText: { fontSize: 14, fontWeight: '700' },

  upgradeButton: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
  },
  upgradeButtonText: { fontSize: 14, fontWeight: '600' },

  usageBlock: { marginTop: 4 },
  usageHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  usageLabel: { fontSize: 13 },
  usageCount: { fontSize: 13, fontWeight: '600' },
  usageBar: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  usageFill: {
    height: '100%',
    borderRadius: 3,
  },

  proExpiry: { fontSize: 13, marginTop: 4 },

  dangerRow: { paddingVertical: 8, alignItems: 'center' },
  dangerText: { fontSize: 15, fontWeight: '600' },
});
