import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Alert,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
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

export default function SettingsScreen() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const setUser = useAuthStore((s) => s.setUser);
  const [savingFormat, setSavingFormat] = useState(false);
  const savingFormatRef = useRef(false);
  const [formatError, setFormatError] = useState<string | null>(null);
  const { data: planInfo, isLoading: planLoading } = usePlanInfo();
  const notifications = useNotificationLifecycle();

  const isPro = planInfo?.isPro ?? false;
  const activeTasks = planInfo?.usage.activeTasks ?? 0;
  const limit = FREE_TIER_LIMITS.maxActiveTasks;
  const usagePercent = Math.min((activeTasks / limit) * 100, 100);

  async function selectTimeFormat(timeFormat: TimeFormat) {
    if (
      savingFormatRef.current ||
      timeFormat === (user?.timeFormat ?? "SYSTEM")
    )
      return;
    savingFormatRef.current = true;
    setSavingFormat(true);
    setFormatError(null);
    try {
      const { data } = await apiClient.patch<User>("/users/me", { timeFormat });
      setUser(data);
    } catch {
      setFormatError(
        "Не удалось сохранить формат времени. Проверьте соединение и попробуйте снова.",
      );
    } finally {
      savingFormatRef.current = false;
      setSavingFormat(false);
    }
  }

  function handleLogout() {
    Alert.alert("Выйти из аккаунта?", undefined, [
      { text: "Отмена", style: "cancel" },
      {
        text: "Выйти",
        style: "destructive",
        onPress: async () => {
          await logout();
        },
      },
    ]);
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        {/* Профиль */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Профиль</Text>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Аккаунт</Text>
            <Text style={styles.rowValue} numberOfLines={1}>
              {user?.email ?? user?.phone ?? "—"}
            </Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Часовой пояс</Text>
            <Text style={styles.rowValue}>{user?.timezone ?? "—"}</Text>
          </View>
        </View>

        <View style={styles.section} accessibilityLabel="Напоминания">
          <Text style={styles.sectionTitle}>Напоминания</Text>
          <Text accessibilityLabel={`Статус напоминаний: ${notifications.permission === 'granted' ? 'Включены' : notifications.permission === 'denied' ? 'Выключены' : 'Не настроены'}`} style={styles.reminderStatus}>
            {notifications.permission === 'granted' ? 'Включены' : notifications.permission === 'denied' ? 'Выключены' : 'Не настроены'}
          </Text>
          {notifications.error && <Text accessibilityRole="alert" style={styles.formatError}>{notifications.error}</Text>}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={notifications.permission === 'granted' || notifications.permission === 'denied' ? 'Открыть настройки' : 'Включить напоминания'}
            accessibilityState={{ disabled: notifications.busy, busy: notifications.busy }}
            disabled={notifications.busy}
            onPress={notifications.permission === 'granted' || notifications.permission === 'denied' ? notifications.openSettings : notifications.requestPermission}
            style={[styles.reminderAction, notifications.busy && styles.formatChoiceDisabled]}
          >
            {notifications.busy ? <ActivityIndicator color="#6B5BFC" /> : <Text style={styles.reminderActionText}>{notifications.permission === 'granted' || notifications.permission === 'denied' ? 'Открыть настройки' : 'Включить напоминания'}</Text>}
          </Pressable>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Формат времени</Text>
          {(
            [
              [
                "SYSTEM",
                "Как в системе",
                `По настройке устройства — например, ${formatWallClock(14, 30, "SYSTEM")}`,
              ],
              ["H24", "24-часовой", "Например, 14:30"],
              ["H12", "12-часовой", "Например, 2:30 PM"],
            ] as const
          ).map(([value, label, example]) => {
            const selected = (user?.timeFormat ?? "SYSTEM") === value;
            return (
              <Pressable
                key={value}
                testID={`time-format-${value}`}
                accessibilityRole="radio"
                accessibilityLabel={`${label}. ${example}`}
                accessibilityState={{ selected, disabled: savingFormat }}
                disabled={savingFormat}
                onPress={() => selectTimeFormat(value)}
                style={[
                  styles.formatChoice,
                  selected && styles.formatChoiceSelected,
                  savingFormat && styles.formatChoiceDisabled,
                ]}
              >
                <Text style={styles.formatRadio}>{selected ? "●" : "○"}</Text>
                <View>
                  <Text style={styles.formatLabel}>{label}</Text>
                  <Text style={styles.formatExample}>{example}</Text>
                </View>
              </Pressable>
            );
          })}
          {savingFormat && (
            <ActivityIndicator testID="time-format-saving" color="#6B5BFC" />
          )}
          {formatError && (
            <Text accessibilityRole="alert" style={styles.formatError}>
              {formatError}
            </Text>
          )}
        </View>

        {/* Подписка */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Подписка</Text>
          {planLoading ? (
            <ActivityIndicator color="#6B5BFC" style={{ marginVertical: 12 }} />
          ) : (
            <>
              <View style={styles.planBadgeRow}>
                <View style={[styles.planBadge, isPro && styles.planBadgePro]}>
                  <Text
                    style={[
                      styles.planBadgeText,
                      isPro && styles.planBadgeTextPro,
                    ]}
                  >
                    {isPro ? "⚡ Pro" : "Free"}
                  </Text>
                </View>
                {!isPro && (
                  <Pressable
                    style={styles.upgradeButton}
                    onPress={() => router.push("/paywall")}
                  >
                    <Text style={styles.upgradeButtonText}>Улучшить →</Text>
                  </Pressable>
                )}
              </View>

              {!isPro && (
                <View style={styles.usageBlock}>
                  <View style={styles.usageHeader}>
                    <Text style={styles.usageLabel}>Активные задачи</Text>
                    <Text style={styles.usageCount}>
                      {activeTasks} / {limit}
                    </Text>
                  </View>
                  <View style={styles.usageBar}>
                    <View
                      style={[
                        styles.usageFill,
                        { width: `${usagePercent}%` as any },
                usagePercent >= 90 && styles.usageFillDanger,
                      ]}
                    />
                  </View>
                </View>
              )}

              {isPro && planInfo?.proExpiresAt && (
                <Text style={styles.proExpiry}>
                  Подписка активна до{" "}
                  {new Date(planInfo.proExpiresAt).toLocaleDateString("ru-RU", {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })}
                </Text>
              )}

              {isPro && !planInfo?.proExpiresAt && (
                <Text style={styles.proExpiry}>Подписка бессрочная✓</Text>
              )}
            </>
          )}
        </View>

        {/* Аккаунт */}
        <View style={styles.section}>
          <Pressable style={styles.dangerRow} onPress={handleLogout}>
            <Text style={styles.dangerText}>Выйти из аккаунта</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  content: { padding: 20, paddingBottom: 48 },

  section: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6B7280',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 12,
  },

  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  rowLabel: { fontSize: 14, color: '#374151' },
  rowValue: { fontSize: 14, color: '#6B5BFC', fontWeight: '600', maxWidth: '60%' },

  formatChoice: { flexDirection: 'row', gap: 12, alignItems: 'center', paddingVertical: 10, paddingHorizontal: 8, borderRadius: 10 },
  formatChoiceSelected: { backgroundColor: '#F3F1FF' },
  formatChoiceDisabled: { opacity: 0.55 },
  formatRadio: { fontSize: 20, color: '#6B5BFC' },
  formatLabel: { fontSize: 15, fontWeight: '600', color: '#211D2E' },
  formatExample: { fontSize: 13, color: '#6B7280', marginTop: 2 },
  formatError: { color: '#9B3A3A', marginTop: 8, lineHeight: 19 },
  reminderStatus: { fontSize: 15, color: '#374151', marginBottom: 10 },
  reminderAction: { minHeight: 44, justifyContent: 'center', alignItems: 'flex-start' },
  reminderActionText: { color: '#6B5BFC', fontSize: 15, fontWeight: '600' },

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
    backgroundColor: '#F3F4F6',
},
  planBadgePro: { backgroundColor: '#6B5BFC' },
  planBadgeText: { fontSize: 14, fontWeight: '700', color: '#374151' },
  planBadgeTextPro: { color: '#FFFFFF' },

  upgradeButton: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#EDE9FE',
  },
  upgradeButtonText: { fontSize: 14, fontWeight: '600', color: '#6B5BFC' },

  usageBlock: { marginTop: 4 },
  usageHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  usageLabel: { fontSize: 13, color: '#6B7280' },
  usageCount: { fontSize: 13, fontWeight: '600', color: '#374151' },
  usageBar: {
    height: 6,
    backgroundColor: '#E5E7EB',
    borderRadius: 3,
    overflow: 'hidden',
  },
  usageFill: {
    height: '100%',
    backgroundColor: '#6B5BFC',
    borderRadius: 3,
  },
  usageFillDanger: { backgroundColor: '#EF4444' },

  proExpiry: { fontSize: 13, color: '#6B7280', marginTop: 4 },

  dangerRow: { paddingVertical: 8, alignItems: 'center' },
  dangerText: { color: '#EF4444', fontSize: 15, fontWeight: '600' },
});
