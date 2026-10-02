import { useCallback, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  findNodeHandle,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useOrbitsTheme } from '../theme/orbits';

export type FocusDialogAction = {
  text: string;
  style?: 'default' | 'cancel' | 'destructive';
  onPress?: () => void | Promise<void>;
  accessibilityLabel?: string;
  disabled?: boolean;
  busy?: boolean;
  dismissOnPress?: boolean;
};

export type FocusDialogRequest = {
  title: string;
  message?: string;
  actions?: FocusDialogAction[];
};

type FocusDialogProps = FocusDialogRequest & {
  visible: boolean;
  onDismiss: () => void;
};

const DEFAULT_ACTIONS: FocusDialogAction[] = [{ text: 'ОК' }];

export function FocusDialog({
  visible,
  title,
  message,
  actions = DEFAULT_ACTIONS,
  onDismiss,
}: FocusDialogProps) {
  const theme = useOrbitsTheme();
  const dialogRef = useRef<View>(null);
  const renderedActions = actions.length > 0 ? actions : DEFAULT_ACTIONS;

  function focusDialog() {
    const node = findNodeHandle(dialogRef.current);
    if (node) AccessibilityInfo.setAccessibilityFocus(node);
  }

  function invokeAction(action: FocusDialogAction) {
    if (action.disabled) return;
    if (action.dismissOnPress !== false) onDismiss();
    void action.onPress?.();
  }

  return (
    <Modal
      testID="focus-dialog-modal"
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onDismiss}
      onShow={focusDialog}
    >
      <View style={styles.root}>
        <View
          testID="focus-dialog-scrim"
          pointerEvents="none"
          style={[styles.scrim, { backgroundColor: theme.elevationShadow }]}
        />
        <Pressable
          testID="focus-dialog-backdrop"
          accessibilityRole="button"
          accessibilityLabel="Закрыть диалог"
          onPress={onDismiss}
          style={StyleSheet.absoluteFill}
        />
        <View
          ref={dialogRef}
          testID="focus-dialog"
          accessible
          accessibilityRole="alert"
          accessibilityViewIsModal
          accessibilityLabel={[title, message].filter(Boolean).join('. ')}
          style={[
            styles.dialog,
            {
              backgroundColor: theme.background,
              borderColor: theme.borderSubtle,
              shadowColor: theme.elevationShadow,
            },
          ]}
        >
          <Text style={[styles.title, { color: theme.textPrimary }]}>{title}</Text>
          {message ? (
            <Text style={[styles.message, { color: theme.textSecondary }]}>{message}</Text>
          ) : null}
          <View style={styles.actions}>
            {renderedActions.map((action, index) => {
              const destructive = action.style === 'destructive';
              const cancel = action.style === 'cancel';
              return (
                <Pressable
                  key={`${action.text}-${index}`}
                  testID={`focus-dialog-action-${index}`}
                  accessibilityRole="button"
                  accessibilityLabel={action.accessibilityLabel ?? action.text}
                  accessibilityState={{ disabled: Boolean(action.disabled), busy: Boolean(action.busy) }}
                  disabled={action.disabled}
                  onPress={() => invokeAction(action)}
                  style={({ pressed }) => [
                    styles.action,
                    {
                      backgroundColor: destructive
                        ? theme.errorSoft
                        : cancel
                          ? theme.surfaceMuted
                          : theme.brand,
                      borderColor: destructive
                        ? theme.errorPrimary
                        : cancel
                          ? theme.borderSubtle
                          : theme.brand,
                    },
                    pressed && styles.pressed,
                    action.disabled && styles.disabled,
                  ]}
                >
                  <Text
                    style={[
                      styles.actionText,
                      {
                        color: destructive
                          ? theme.errorPrimary
                          : cancel
                            ? theme.textPrimary
                            : theme.retryText,
                      },
                    ]}
                  >
                    {action.text}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const EMPTY_DIALOG: FocusDialogRequest = { title: '' };

export function useFocusDialog() {
  const [dialog, setDialog] = useState<FocusDialogRequest | null>(null);
  const showDialog = useCallback((request: FocusDialogRequest) => setDialog(request), []);
  const hideDialog = useCallback(() => setDialog(null), []);

  return {
    showDialog,
    hideDialog,
    dialogProps: {
      ...(dialog ?? EMPTY_DIALOG),
      visible: dialog !== null,
      onDismiss: hideDialog,
    } satisfies FocusDialogProps,
  };
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  scrim: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.62,
  },
  dialog: {
    width: '100%',
    maxWidth: 420,
    borderWidth: 1,
    borderRadius: 24,
    padding: 20,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.24,
    shadowRadius: 24,
    elevation: 16,
  },
  title: {
    fontSize: 21,
    lineHeight: 27,
    fontWeight: '800',
  },
  message: {
    marginTop: 8,
    fontSize: 15,
    lineHeight: 21,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 20,
  },
  action: {
    minHeight: 44,
    minWidth: 72,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionText: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '700',
  },
  pressed: {
    opacity: 0.72,
  },
  disabled: {
    opacity: 0.58,
  },
});
