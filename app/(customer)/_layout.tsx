import { Stack } from 'expo-router';

export default function CustomerLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#0A0A0F' } }}>
      <Stack.Screen name="home" />
      <Stack.Screen name="redeem/[id]" options={{ presentation: 'fullScreenModal' }} />
      <Stack.Screen name="why/[id]" options={{ presentation: 'modal' }} />
    </Stack>
  );
}
