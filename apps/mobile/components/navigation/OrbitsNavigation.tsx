import React from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { ORBITS_NAVIGATION_ASSETS, OrbitsAssetKey } from './orbits-assets';
import { OrbitsThemeName, OrbitsThemeTokens, ORBITS_THEMES, useOrbitsTheme } from '../../theme/orbits';

export type OrbitsDestination = 'today' | 'plan' | 'progress' | 'profile';

type Props = {
  activeDestination: OrbitsDestination;
  onSelect: (destination: OrbitsDestination) => void;
  onAdd: () => void;
  theme?: OrbitsThemeName | OrbitsThemeTokens;
  addDisabled?: boolean;
  addBusy?: boolean;
};

const items: ReadonlyArray<{ key: OrbitsAssetKey; destination?: OrbitsDestination; label: string }> = [
  { key: 'today', destination: 'today', label: 'Сегодня' },
  { key: 'plan', destination: 'plan', label: 'План' },
  { key: 'add', label: 'Добавить' },
  { key: 'progress', destination: 'progress', label: 'Успех' },
  { key: 'profile', destination: 'profile', label: 'Профиль' },
];

export function OrbitsNavigation(props: Props) {
  const contextTheme = useOrbitsTheme();
  const theme = typeof props.theme === 'string' ? ORBITS_THEMES[props.theme] : props.theme ?? contextTheme;
  const addUnavailable = Boolean(props.addDisabled || props.addBusy);

  return (
    <View testID="orbits-navigation" accessibilityRole="tablist" style={[styles.navigation, { backgroundColor: theme.background, borderTopColor: theme.borderSubtle }]}>
      {items.map((item) => {
        const isAdd = item.key === 'add';
        const selected = item.destination === props.activeDestination;
        return (
          <Pressable
            key={item.key}
            testID={`orbits-${item.key}`}
            accessibilityRole={isAdd ? 'button' : 'tab'}
            accessibilityLabel={isAdd ? 'Добавить запись' : item.label}
            accessibilityState={isAdd ? { disabled: addUnavailable, busy: Boolean(props.addBusy) } : { selected }}
            disabled={isAdd && addUnavailable}
            onPress={isAdd ? props.onAdd : () => props.onSelect(item.destination!)}
            style={[styles.target, isAdd && styles.addTarget, selected && { backgroundColor: theme.activeSurface, borderColor: theme.activeBorder, borderWidth: 1 }]}
          >
            <Image
              testID={`orbits-${item.key}-artwork`}
              source={ORBITS_NAVIGATION_ASSETS[item.key]}
              accessible={false}
              importantForAccessibility="no"
              style={isAdd ? styles.addIcon : styles.icon}
            />
            <Text style={[styles.label, { color: theme.navigationLabel }, selected && styles.selectedLabel]}>{item.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  navigation: { flexDirection: 'row', alignItems: 'flex-end', borderTopWidth: StyleSheet.hairlineWidth, paddingHorizontal: 4, paddingBottom: 6, paddingTop: 6 },
  target: { flex: 1, minWidth: 44, minHeight: 64, borderRadius: 14, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 2 },
  addTarget: { minHeight: 76, transform: [{ translateY: -8 }] },
  icon: { width: 44, height: 44 },
  addIcon: { width: 64, height: 64 },
  label: { fontSize: 12, lineHeight: 16, fontWeight: '500', textAlign: 'center' },
  selectedLabel: { fontWeight: '700' },
});
