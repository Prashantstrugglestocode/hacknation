import { Stack } from 'expo-router';

export default function MerchantLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="setup" />
      <Stack.Screen name="dashboard" />
      <Stack.Screen name="scan" options={{ presentation: 'fullScreenModal' }} />
      <Stack.Screen name="rules" options={{ presentation: 'modal' }} />
      <Stack.Screen name="menu" />
      <Stack.Screen name="menu-scan" options={{ presentation: 'fullScreenModal' }} />
      <Stack.Screen name="preview" options={{ presentation: 'modal' }} />
    </Stack>
  );
}
