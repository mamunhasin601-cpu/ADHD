import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useOrbitsTheme } from '../../theme/orbits';

export default function PlanScreen() {
  const theme = useOrbitsTheme();
  return (
    <SafeAreaView testID="plan-preview-screen" style={[styles.container, { backgroundColor: theme.background }]}>
      <StatusBar style={theme.name === 'dark' ? 'light' : 'dark'} />
      <View style={styles.content}>
        <Text style={[styles.eyebrow, { color: theme.activeBorder }]}>Орбита дня</Text>
        <Text style={[styles.title, { color: theme.textPrimary }]}>План</Text>
        <Text style={[styles.copy, { color: theme.textSecondary }]}>Спокойное место для обзора дня и ближайших намерений.</Text>
        <View style={[styles.preview, { backgroundColor: theme.surfacePrimary, borderColor: theme.borderSubtle }]}>
          <Text style={[styles.previewTitle, { color: theme.textPrimary }]}>Раздел уже на месте</Text>
          <Text style={[styles.previewCopy, { color: theme.textSecondary }]}>Сейчас это честный preview без выдуманных данных. Содержимое добавим следующим отдельным этапом.</Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { flex: 1, paddingHorizontal: 24, paddingTop: 32 },
  eyebrow: { fontSize: 13, lineHeight: 18, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8 },
  title: { marginTop: 8, fontSize: 34, lineHeight: 41, fontWeight: '800' },
  copy: { marginTop: 8, fontSize: 16, lineHeight: 24 },
  preview: { marginTop: 28, padding: 20, borderRadius: 18, borderWidth: 1 },
  previewTitle: { fontSize: 18, lineHeight: 24, fontWeight: '700' },
  previewCopy: { marginTop: 8, fontSize: 15, lineHeight: 22 },
});
