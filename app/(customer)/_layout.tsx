import { Stack } from 'expo-router';

export default function CustomerLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="home" />
      <Stack.Screen name="redeem/[id]" options={{ presentation: 'fullScreenModal' }} />
      <Stack.Screen name="why/[id]" options={{ presentation: 'modal' }} />
      <Stack.Screen name="saved" options={{ presentation: 'modal' }} />
      <Stack.Screen name="history" options={{ presentation: 'modal' }} />
      <Stack.Screen name="map" options={{ presentation: 'modal' }} />
    </Stack>
  );
}
