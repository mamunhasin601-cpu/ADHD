import { Tabs } from 'expo-router';
import { Text } from 'react-native';

function TabIcon({ label, color, size }: { label: string; color: string; size: number }) {
  return <Text style={{ color, fontSize: size }}>{label}</Text>;
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: '#6B5BFC',
        tabBarInactiveTintColor: '#9CA3AF',
        headerShown: false,
      }}
    >
      <Tabs.Screen
        name="today"
        options={{
          title: 'Сегодня',
          tabBarIcon: ({ color, size }) => (
            <TabIcon label="□" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="inbox"
        options={{
          title: 'Мысли',
          tabBarIcon: ({ color, size }) => (
            <TabIcon label="≡" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="focus"
        options={{
          title: 'Фокус',
          tabBarIcon: ({ color, size }) => (
            <TabIcon label="○" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Настройки',
          tabBarIcon: ({ color, size }) => (
            <TabIcon label="⚙" size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
