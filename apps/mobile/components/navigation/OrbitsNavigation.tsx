import React from 'react';
import { Image, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
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
  recoveryCount?: number;
  bottomInset?: number;
};

const items: ReadonlyArray<{ key: OrbitsAssetKey; destination?: OrbitsDestination; label: string }> = [
  { key: 'today', destination: 'today', label: 'Сегодня' },
  { key: 'plan', destination: 'plan', label: 'План' },
  { key: 'add', label: 'Добавить' },
  { key: 'progress', destination: 'progress', label: 'Успех' },
  { key: 'profile', destination: 'profile', label: 'Профиль' },
];

export function orbitsLabelScalePolicy(width: number, fontScale: number): {
  maximum: number;
  fit: boolean;
} {
  const extreme = width <= 360 && fontScale >= 1.8;
  return { maximum: extreme ? 1.2 : 1.6, fit: extreme };
}

export function OrbitsNavigation(props: Props) {
  const { fontScale, width } = useWindowDimensions();
  const contextTheme = useOrbitsTheme();
  const theme = typeof props.theme === 'string' ? ORBITS_THEMES[props.theme] : props.theme ?? contextTheme;
  const addUnavailable = Boolean(props.addDisabled || props.addBusy);
  const largeTextExtra = Math.max(0, Math.min(fontScale, 2.5) - 1) * 18;
  const labelScale = orbitsLabelScalePolicy(width, fontScale);

  return (
    <View testID="orbits-navigation" accessibilityRole="tablist" style={[styles.navigation, { backgroundColor: theme.background, borderTopColor: theme.borderSubtle, paddingBottom: 6 + (props.bottomInset ?? 0) }]}>
      {items.map((item) => {
        const isAdd = item.key === 'add';
        const selected = item.destination === props.activeDestination;
        const recoveryCount = item.key === 'plan' ? (props.recoveryCount ?? 0) : 0;
        return (
          <Pressable
            key={item.key}
            testID={`orbits-${item.key}`}
            accessibilityRole={isAdd ? 'button' : 'tab'}
            accessibilityLabel={recoveryCount > 0 ? `План, ${recoveryCount} задач, к которым можно вернуться` : isAdd ? 'Добавить запись' : item.label}
            accessibilityState={isAdd ? { disabled: addUnavailable, busy: Boolean(props.addBusy) } : { selected }}
            disabled={isAdd && addUnavailable}
            onPress={isAdd ? props.onAdd : () => props.onSelect(item.destination!)}
            style={[styles.target, { minHeight: 64 + largeTextExtra }, isAdd && [styles.addTarget, { minHeight: 76 + largeTextExtra }], selected && { backgroundColor: theme.activeSurface, borderColor: theme.activeBorder, borderWidth: 1 }]}
          >
            <Image
              testID={`orbits-${item.key}-artwork`}
              source={ORBITS_NAVIGATION_ASSETS[item.key]}
              accessible={false}
              importantForAccessibility="no"
              style={isAdd ? styles.addIcon : styles.icon}
            />
            <Text
              numberOfLines={1}
              maxFontSizeMultiplier={labelScale.maximum}
              adjustsFontSizeToFit={labelScale.fit}
              minimumFontScale={labelScale.fit ? 0.9 : undefined}
              android_hyphenationFrequency="none"
              textBreakStrategy="simple"
              style={[styles.label, { color: theme.navigationLabel }, selected && styles.selectedLabel]}
            >
              {item.label}
            </Text>
            {recoveryCount > 0 && (
              <View testID="orbits-plan-recovery-badge" pointerEvents="none" accessible={false} importantForAccessibility="no-hide-descendants"
                style={[styles.recoveryBadge, { backgroundColor: theme.rewardSoft, borderColor: theme.rewardPrimary }]}>
                <Text style={[styles.recoveryBadgeText, { color: theme.rewardPrimary }]}>{recoveryCount > 9 ? '9+' : recoveryCount}</Text>
              </View>
            )}
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
  label: { fontSize: 11, lineHeight: 16, fontWeight: '500', textAlign: 'center' },
  selectedLabel: { fontWeight: '700' },
  recoveryBadge: { position: 'absolute', top: 0, left: '50%', marginLeft: 9, minWidth: 20, minHeight: 20, paddingHorizontal: 4, paddingVertical: 1, borderRadius: 12, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  recoveryBadgeText: { fontSize: 11, lineHeight: 15, fontWeight: '700' },
});
