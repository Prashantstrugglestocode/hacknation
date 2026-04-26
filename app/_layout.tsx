import React, { useEffect } from 'react';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { theme } from '../lib/theme';
import { setupNotificationHandler, requestNotificationPermissions } from '../lib/notifications';

export default function RootLayout() {
  // Local notifications power the Apple-style sound when the merchant scans
  // the QR (slide-to-pay prompt) and when redemption commits. Permission
  // request is async-fire-and-forget; if the user denies, we still play
  // in-app haptics + chime as a fallback.
  useEffect(() => {
    setupNotificationHandler();
    requestNotificationPermissions().catch(() => {});
  }, []);

  return (
    <SafeAreaProvider>
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.bg }} edges={['top', 'bottom', 'left', 'right']}>
        <StatusBar style="dark" />
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: theme.bg } }}>
          <Stack.Screen name="settings" options={{ presentation: 'modal' }} />
        </Stack>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}
