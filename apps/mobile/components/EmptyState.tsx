import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useOrbitsTheme } from '../theme/orbits';

interface Props {
  emoji: string;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  orbits?: boolean;
}

/**
 * Дружелюбное сообщение для пустых экранов.
 * Используется когда нет задач на таймлайне, в inbox, или при первом запуске.
 */
export function EmptyState({ emoji, title, description, actionLabel, onAction, orbits = false }: Props) {
  const theme = useOrbitsTheme();
  return (
    <View style={styles.container}>
      <Text style={styles.emoji}>{emoji}</Text>
      <Text style={[styles.title, orbits && { color: theme.textPrimary }]}>{title}</Text>
      <Text style={[styles.description, orbits && { color: theme.textSecondary }]}>{description}</Text>
      {actionLabel && onAction && (
        <Pressable style={[styles.button, orbits && { backgroundColor: theme.brand }]} onPress={onAction}>
          <Text style={styles.buttonText}>{actionLabel}</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    paddingVertical: 64,
  },
  emoji: {
    fontSize: 64,
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 8,
    textAlign: 'center',
  },
  description: {
    fontSize: 15,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  button: {
    backgroundColor: '#6B5BFC',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
});
