import { Redirect } from 'expo-router';

// Корневой маршрут — редиректим на таймлайн
export default function Index() {
  return <Redirect href="/(tabs)/today" />;
}
