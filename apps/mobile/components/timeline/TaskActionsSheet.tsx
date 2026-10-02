import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Modal,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { Task } from '@focus/shared-types';
import { useOrbitsTheme } from '../../theme/orbits';

interface Props {
  task: Task | null;
  visible: boolean;
  onClose: () => void;
  onReschedule: (task: Task) => void;
  onMoveToThoughts: (task: Task) => Promise<void>;
  onDelete: (task: Task) => Promise<void>;
}

export function shouldDismissTaskActionsSheet(dy: number, velocityY: number): boolean {
  return dy > 88 || velocityY > 0.8;
}

export function TaskActionsSheet({
  task,
  visible,
  onClose,
  onReschedule,
  onMoveToThoughts,
  onDelete,
}: Props) {
  const theme = useOrbitsTheme();
  const translateY = useRef(new Animated.Value(28)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const [moving, setMoving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const busy = moving || deleting;
  const busyRef = useRef(busy);
  const onCloseRef = useRef(onClose);
  const dismissingRef = useRef(false);

  busyRef.current = busy;
  onCloseRef.current = onClose;

  useEffect(() => {
    translateY.stopAnimation();
    opacity.stopAnimation();
    dismissingRef.current = false;

    if (!visible) {
      translateY.setValue(28);
      opacity.setValue(0);
      setMoving(false);
      setDeleting(false);
      setConfirmingDelete(false);
      setError(null);
      return;
    }

    Animated.parallel([
      Animated.spring(translateY, {
        toValue: 0,
        damping: 20,
        stiffness: 210,
        mass: 0.8,
        useNativeDriver: false,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: 180,
        useNativeDriver: false,
      }),
    ]).start();
  }, [opacity, translateY, visible]);

  const panResponder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => !busyRef.current,
    onStartShouldSetPanResponderCapture: () => !busyRef.current,
    onMoveShouldSetPanResponder: () => !busyRef.current,
    onPanResponderGrant: () => {
      translateY.stopAnimation();
    },
    onPanResponderMove: (_event, gesture) => {
      translateY.setValue(Math.max(0, gesture.dy));
    },
    onPanResponderRelease: (_event, gesture) => {
      if (shouldDismissTaskActionsSheet(gesture.dy, gesture.vy)) {
        dismissingRef.current = true;
        Animated.parallel([
          Animated.timing(translateY, { toValue: 520, duration: 180, useNativeDriver: false }),
          Animated.timing(opacity, { toValue: 0, duration: 150, useNativeDriver: false }),
        ]).start(() => {
          if (dismissingRef.current) onCloseRef.current();
        });
        return;
      }
      Animated.spring(translateY, {
        toValue: 0,
        damping: 20,
        stiffness: 230,
        useNativeDriver: false,
      }).start();
    },
    onPanResponderTerminate: () => {
      if (dismissingRef.current) return;
      Animated.spring(translateY, {
        toValue: 0,
        damping: 20,
        stiffness: 230,
        useNativeDriver: false,
      }).start();
    },
    onPanResponderTerminationRequest: () => false,
    onShouldBlockNativeResponder: () => true,
  }), [opacity, translateY]);

  if (!task) return null;

  async function moveToThoughts() {
    if (busy) return;
    setMoving(true);
    setError(null);
    try {
      await onMoveToThoughts(task!);
      onClose();
    } catch {
      setError('Не удалось перенести задачу. Проверьте соединение и попробуйте снова.');
    } finally {
      setMoving(false);
    }
  }

  async function deleteTask() {
    if (busy) return;
    setDeleting(true);
    setError(null);
    try {
      await onDelete(task!);
      onClose();
    } catch {
      setError('Не удалось удалить задачу. Проверьте соединение и попробуйте снова.');
    } finally {
      setDeleting(false);
    }
  }

  function confirmDelete() {
    if (busy) return;
    setError(null);
    setConfirmingDelete(true);
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={() => {
        if (confirmingDelete && !busy) {
          setConfirmingDelete(false);
          return;
        }
        onClose();
      }}
    >
      <View style={styles.backdrop}>
        <View
          testID="task-actions-scrim"
          pointerEvents="none"
          style={[styles.scrim, { backgroundColor: theme.elevationShadow }]}
        />
        <Pressable
          testID="task-actions-backdrop"
          accessibilityRole="button"
          accessibilityLabel="Закрыть действия с задачей"
          onPress={onClose}
          style={StyleSheet.absoluteFill}
        />
        <SafeAreaView edges={['bottom']} style={styles.safeArea}>
          <Animated.View
            testID="task-actions-sheet"
            accessibilityViewIsModal
            accessibilityLabel={`Действия с задачей ${task.title}`}
            style={[
              styles.sheet,
              {
                backgroundColor: theme.surfacePrimary,
                borderColor: theme.borderSubtle,
                shadowColor: theme.elevationShadow,
                opacity,
                transform: [{ translateY }],
              },
            ]}
          >
            <View
              testID="task-actions-drag-handle"
              accessibilityLabel="Потяните вниз, чтобы закрыть действия с задачей"
              collapsable={false}
              hitSlop={{ top: 10, bottom: 10 }}
              {...panResponder.panHandlers}
              style={styles.dragArea}
            >
              <View style={[styles.handle, { backgroundColor: theme.timelineNeutral }]} />
            </View>

            {confirmingDelete ? (
              <View testID="task-delete-confirmation" style={styles.confirmation}>
                <View style={[styles.confirmationIcon, { backgroundColor: theme.errorSoft }]}>
                  <Text style={[styles.confirmationIconText, { color: theme.errorPrimary }]}>×</Text>
                </View>
                <Text style={[styles.confirmationTitle, { color: theme.textPrimary }]}>Удалить задачу?</Text>
                <Text style={[styles.confirmationTask, { color: theme.textPrimary }]} numberOfLines={2}>{task.title}</Text>
                <Text style={[styles.confirmationHint, { color: theme.textSecondary }]}>
                  {task.seriesId || task.isRecurring
                    ? 'Будет удалён весь повтор. Это действие нельзя отменить.'
                    : 'Задача исчезнет из плана. Это действие нельзя отменить.'}
                </Text>

                {error ? <Text accessibilityRole="alert" style={[styles.confirmationError, { color: theme.errorPrimary }]}>{error}</Text> : null}

                <Pressable
                  testID="task-delete-confirm"
                  accessibilityRole="button"
                  accessibilityLabel={`Подтвердить удаление задачи ${task.title}`}
                  accessibilityState={{ disabled: busy, busy: deleting }}
                  disabled={busy}
                  onPress={() => { void deleteTask(); }}
                  style={({ pressed }) => [
                    styles.confirmationButton,
                    { backgroundColor: theme.errorSoft, borderColor: theme.errorPrimary },
                    pressed && styles.buttonPressed,
                  ]}
                >
                  {deleting
                    ? <ActivityIndicator size="small" color={theme.errorPrimary} />
                    : <Text style={[styles.confirmationDeleteText, { color: theme.errorPrimary }]}>Удалить</Text>}
                </Pressable>

                <Pressable
                  testID="task-delete-cancel"
                  accessibilityRole="button"
                  accessibilityLabel="Отменить удаление задачи"
                  accessibilityState={{ disabled: busy }}
                  disabled={busy}
                  onPress={() => setConfirmingDelete(false)}
                  style={({ pressed }) => [
                    styles.confirmationButton,
                    { backgroundColor: theme.surfaceMuted, borderColor: theme.borderSubtle },
                    pressed && styles.buttonPressed,
                  ]}
                >
                  <Text style={[styles.confirmationCancelText, { color: theme.textPrimary }]}>Отмена</Text>
                </Pressable>
              </View>
            ) : (
              <>
            <Text style={[styles.eyebrow, { color: theme.activeBorder }]}>Действия с задачей</Text>
            <Text style={[styles.title, { color: theme.textPrimary }]} numberOfLines={2}>{task.title}</Text>

            <Pressable
              testID="task-action-reschedule"
              accessibilityRole="button"
              accessibilityLabel={`Перенести задачу ${task.title}`}
              accessibilityState={{ disabled: busy }}
              disabled={busy}
              onPress={() => {
                onClose();
                onReschedule(task);
              }}
              style={({ pressed }) => [
                styles.action,
                { borderColor: theme.borderSubtle, backgroundColor: pressed ? theme.surfaceMuted : theme.surfacePrimary },
              ]}
            >
              <View style={[styles.actionIcon, { backgroundColor: theme.activeSurface }]}>
                <Text style={[styles.actionIconText, { color: theme.activeBorder }]}>↗</Text>
              </View>
              <View style={styles.actionCopy}>
                <Text style={[styles.actionTitle, { color: theme.textPrimary }]}>Перенести</Text>
                <Text style={[styles.actionHint, { color: theme.textSecondary }]}>Выбрать другую дату или время</Text>
              </View>
            </Pressable>

            <Pressable
              testID="task-action-thoughts"
              accessibilityRole="button"
              accessibilityLabel={`Перенести задачу ${task.title} в Мысли`}
              accessibilityState={{ disabled: busy, busy: moving }}
              disabled={busy}
              onPress={() => {
                void moveToThoughts();
              }}
              style={({ pressed }) => [
                styles.action,
                {
                  borderColor: theme.borderSubtle,
                  backgroundColor: pressed ? theme.surfaceMuted : theme.surfacePrimary,
                },
              ]}
            >
              <View style={[styles.actionIcon, { backgroundColor: theme.rewardSoft }]}>
                {moving
                  ? <ActivityIndicator size="small" color={theme.rewardPrimary} />
                  : <Text style={[styles.actionIconText, { color: theme.rewardPrimary }]}>✦</Text>}
              </View>
              <View style={styles.actionCopy}>
                <Text style={[styles.actionTitle, { color: theme.textPrimary }]}>В «Мысли»</Text>
                <Text style={[styles.actionHint, { color: theme.textSecondary }]}>Убрать время, но сохранить задачу</Text>
              </View>
            </Pressable>

            <Pressable
              testID="task-action-delete"
              accessibilityRole="button"
              accessibilityLabel={`Удалить задачу ${task.title}`}
              accessibilityState={{ disabled: busy, busy: deleting }}
              disabled={busy}
              onPress={confirmDelete}
              style={({ pressed }) => [
                styles.action,
                { borderColor: theme.errorPrimary, backgroundColor: pressed ? theme.errorSoft : theme.surfacePrimary },
              ]}
            >
              <View style={[styles.actionIcon, { backgroundColor: theme.errorSoft }]}>
                {deleting
                  ? <ActivityIndicator size="small" color={theme.errorPrimary} />
                  : <Text style={[styles.actionIconText, { color: theme.errorPrimary }]}>×</Text>}
              </View>
              <View style={styles.actionCopy}>
                <Text style={[styles.actionTitle, { color: theme.errorPrimary }]}>Удалить</Text>
                <Text style={[styles.actionHint, { color: theme.textSecondary }]}>Удалить задачу из плана</Text>
              </View>
            </Pressable>

            {error ? <Text accessibilityRole="alert" style={[styles.error, { color: theme.errorPrimary }]}>{error}</Text> : null}

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Закрыть"
              disabled={busy}
              onPress={onClose}
              style={({ pressed }) => [styles.close, pressed && styles.closePressed]}
            >
              <Text style={[styles.closeText, { color: theme.textSecondary }]}>Закрыть</Text>
            </Pressable>
              </>
            )}
          </Animated.View>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  scrim: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.6,
  },
  safeArea: {
    width: '100%',
  },
  sheet: {
    marginHorizontal: 10,
    marginBottom: 8,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 14,
    borderRadius: 24,
    borderWidth: 1,
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.2,
    shadowRadius: 18,
    elevation: 12,
  },
  dragArea: {
    height: 30,
    marginHorizontal: -16,
    marginTop: -10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  handle: {
    width: 42,
    height: 4,
    borderRadius: 2,
  },
  confirmation: {
    alignItems: 'center',
    paddingHorizontal: 4,
    paddingTop: 8,
    paddingBottom: 4,
  },
  confirmationIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmationIconText: {
    fontSize: 30,
    lineHeight: 34,
    fontWeight: '700',
  },
  confirmationTitle: {
    marginTop: 14,
    fontSize: 23,
    lineHeight: 29,
    fontWeight: '800',
    textAlign: 'center',
  },
  confirmationTask: {
    marginTop: 7,
    fontSize: 17,
    lineHeight: 23,
    fontWeight: '700',
    textAlign: 'center',
  },
  confirmationHint: {
    marginTop: 8,
    marginBottom: 20,
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
  confirmationError: {
    marginBottom: 12,
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
  },
  confirmationButton: {
    width: '100%',
    minHeight: 52,
    borderRadius: 17,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  confirmationDeleteText: {
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '800',
  },
  confirmationCancelText: {
    fontSize: 16,
    lineHeight: 21,
    fontWeight: '700',
  },
  buttonPressed: {
    opacity: 0.72,
  },
  eyebrow: {
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  title: {
    marginTop: 3,
    marginBottom: 14,
    fontSize: 19,
    lineHeight: 25,
    fontWeight: '700',
  },
  action: {
    minHeight: 70,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderWidth: 1,
    borderRadius: 17,
    marginBottom: 9,
  },
  actionIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionIconText: {
    fontSize: 22,
    lineHeight: 25,
    fontWeight: '700',
  },
  actionCopy: {
    flex: 1,
  },
  actionTitle: {
    fontSize: 16,
    lineHeight: 21,
    fontWeight: '700',
  },
  actionHint: {
    marginTop: 2,
    fontSize: 12,
    lineHeight: 17,
  },
  error: {
    marginHorizontal: 4,
    marginTop: 8,
    fontSize: 13,
    lineHeight: 18,
  },
  close: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 3,
  },
  closePressed: {
    opacity: 0.65,
  },
  closeText: {
    fontSize: 15,
    fontWeight: '600',
  },
});
