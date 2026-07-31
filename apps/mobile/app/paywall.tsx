import { View, Text, StyleSheet, Pressable, ScrollView, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';
import { apiClient } from '../lib/api-client';
import { useState } from 'react';

/**
 * Paywall screen — показывается когда Free пользователь
 * пытается превысить лимит задач (50 активных задач).
 */
export default function PaywallScreen() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  async function handleUpgrade() {
    setIsLoading(true);
    try {
      // TODO: интеграция с Expo IAP для реальной оплаты
      // Сейчас — dev режим, просто апгрейд без оплаты
      await apiClient.post('/plan/upgrade');
      Alert.alert(
        '🎉 Добро пожаловать в Pro!',
        'Теперь у вас безлимитное количество задач и все Pro-фичи.',
        [{ text: 'Начать', onPress: () => router.back() }],
      );
    } catch (error) {
      Alert.alert('Ошибка', 'Не удалось оформить подписку. Попробуйте ещё раз.');
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="auto" />
      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.emoji}>⚡</Text>
          <Text style={styles.title}>Focus Pro</Text>
          <Text style={styles.subtitle}>
            Вы достигли лимита бесплатного плана.
            Перейдите на Pro, чтобы продолжить.
          </Text>
        </View>

        {/* Free vs Pro comparison */}
        <View style={styles.comparison}>
          <View style={styles.plan}>
            <Text style={styles.planName}>Free</Text>
            <View style={styles.feature}>
              <Text style={styles.featureIcon}>✅</Text>
              <Text style={styles.featureText}>До 50 активных задач</Text>
            </View>
            <View style={styles.feature}>
              <Text style={styles.featureIcon}>✅</Text>
              <Text style={styles.featureText}>Таймлайн на день</Text>
            </View>
            <View style={styles.feature}>
              <Text style={styles.featureIcon}>✅</Text>
              <Text style={styles.featureText}>Базовые напоминания</Text>
            </View>
            <View style={styles.feature}>
              <Text style={styles.featureIcon}>❌</Text>
              <Text style={[styles.featureText, styles.featureDisabled]}>Недельный вид</Text>
            </View>
            <View style={styles.feature}>
              <Text style={styles.featureIcon}>❌</Text>
              <Text style={[styles.featureText, styles.featureDisabled]}>Повторяющиеся задачи</Text>
            </View>
<View style={styles.feature}>
              <Text style={styles.featureIcon}>❌</Text>
              <Text style={[styles.featureText, styles.featureDisabled]}>Синхронизация устройств</Text>
            </View>
          </View>

          <View style={[styles.plan, styles.proPlan]}>
            <View style={styles.proLabel}>
              <Text style={styles.proLabelText}>PRO</Text>
            </View>
            <Text style={[styles.planName, styles.proPlanName]}>Pro</Text>
            <View style={styles.feature}>
              <Text style={styles.featureIcon}>✅</Text>
              <Text style={[styles.featureText, styles.proFeatureText]}>Безлимитные задачи</Text>
            </View>
            <View style={styles.feature}>
              <Text style={styles.featureIcon}>✅</Text>
              <Text style={[styles.featureText, styles.proFeatureText]}>Таймлайн на день</Text>
            </View>
            <View style={styles.feature}>
              <Text style={styles.featureIcon}>✅</Text>
              <Text style={[styles.featureText, styles.proFeatureText]}>Умные напоминания</Text>
            </View>
            <View style={styles.feature}>
              <Text style={styles.featureIcon}>✅</Text>
              <Text style={[styles.featureText, styles.proFeatureText]}>Недельный вид</Text>
            </View>
            <View style={styles.feature}>
              <Text style={styles.featureIcon}>✅</Text>
              <Text style={[styles.featureText, styles.proFeatureText]}>Повторяющиеся задачи</Text>
            </View>
            <View style={styles.feature}>
              <Text style={styles.featureIcon}>✅</Text>
              <Text style={[styles.featureText, styles.proFeatureText]}>Синхронизация устройств</Text>
            </View>
          </View>
        </View>

        {/* Pricing */}
        <View style={styles.pricing}>
          <Text style={styles.price}>299₽ / месяц</Text>
          <Text style={styles.priceAlt}>или 1 990 ₽ / год (скидка 44%)</Text>
        </View>

        {/* CTA */}
        <Pressable
          style={[styles.upgradeButton, isLoading && styles.upgradeButtonDisabled]}
          onPress={handleUpgrade}
          disabled={isLoading}
        >
          <Text style={styles.upgradeButtonText}>
            {isLoading ? 'Оформляем...' : 'Попробовать Pro бесплатно 7 дней'}
          </Text>
        </Pressable>

        <Text style={styles.trialNote}>
          После пробного периода — 299 ₽/месяц. Отмена в любой момент.
        </Text>

        {/* Dismiss */}
        <Pressable style={styles.dismissButton} onPress={() => router.back()}>
          <Text style={styles.dismissButtonText}>Остаться на Free</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  scroll: {
    paddingHorizontal: 24,
    paddingVertical: 32,
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
  },
  emoji: {
    fontSize: 64,
    marginBottom: 16,
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    color: '#6B5BFC',
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
lineHeight: 24,
  },
  comparison: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 32,
  },
  plan: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  proPlan: {
    borderColor: '#6B5BFC',
    borderWidth: 2,
    position: 'relative',
  },
  proLabel: {
    position: 'absolute',
    top: -12,
    alignSelf: 'center',
    backgroundColor: '#6B5BFC',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 20,
  },
  proLabelText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
  },
  planName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 12,
    textAlign: 'center',
  },
  proPlanName: {
    color: '#6B5BFC',
  },
  feature: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 6,
  },
  featureIcon: {
    fontSize: 14,
  },
  featureText: {
    fontSize: 13,
    color: '#374151',
    flex: 1,
  },
  featureDisabled: {
    color: '#9CA3AF',
  },
  proFeatureText: {
    color: '#111827',
    fontWeight: '500',
  },
  pricing: {
    alignItems: 'center',
    marginBottom: 24,
  },
  price: {
    fontSize: 28,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
  },
  priceAlt: {
    fontSize: 14,
    color: '#6B7280',
  },
  upgradeButton: {
    backgroundColor: '#6B5BFC',
    borderRadius: 14,
    paddingVertical: 18,
    alignItems: 'center',
    marginBottom: 12,
  },
  upgradeButtonDisabled: {
    opacity: 0.6,
  },
  upgradeButtonText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '700',
  },
  trialNote: {
    fontSize: 12,
    color: '#9CA3AF',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 18,
  },
  dismissButton: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  dismissButtonText: {
    color: '#6B7280',
    fontSize: 15,
  },
});
