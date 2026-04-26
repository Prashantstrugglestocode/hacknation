import { Stack } from 'expo-router';

export default function CustomerLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="home" />
      <Stack.Screen name="walkthrough" options={{ presentation: 'fullScreenModal', animation: 'slide_from_right' }} />
      <Stack.Screen name="redeem/[id]" options={{ presentation: 'fullScreenModal', animation: 'fade' }} />
      {/* Payone payment screen — shown after the merchant scans the QR.
          fullScreenModal + slide-from-bottom so it feels like a real
          payment sheet, not just another tab. */}
      <Stack.Screen name="pay/[id]" options={{ presentation: 'fullScreenModal', animation: 'slide_from_bottom' }} />
      <Stack.Screen name="why/[id]" options={{ presentation: 'modal' }} />
      <Stack.Screen name="inside" options={{ presentation: 'modal' }} />
      <Stack.Screen name="history" options={{ presentation: 'modal' }} />
      <Stack.Screen name="map" options={{ presentation: 'modal' }} />
      <Stack.Screen name="menu/[merchantId]" options={{ presentation: 'modal' }} />
    </Stack>
  );
}
