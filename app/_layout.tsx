import React, { useEffect, useState } from 'react';
import { View, TouchableOpacity, Text } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { Stack, router, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as Notifications from 'expo-notifications';
import { setupNotificationHandler, requestNotificationPermissions } from '../lib/notifications';
import { isDemoMode } from '../lib/context/demo-mode';
import i18n from '../lib/i18n';
import { theme } from '../lib/theme';

setupNotificationHandler();

export default function RootLayout() {
  const segments = useSegments();
  const [demo, setDemo] = useState(false);

  useEffect(() => {
    isDemoMode().then(setDemo);
    requestNotificationPermissions();
    
    const subscription = Notifications.addNotificationResponseReceivedListener(response => {
      // Navigate to customer home on tap
      router.push('/(customer)/home');
    });
    
    return () => subscription.remove();
  }, []);

  const role: 'customer' | 'merchant' | null =
    segments[0] === '(customer)' ? 'customer' :
    segments[0] === '(merchant)' ? 'merchant' : null;

  const switchRole = (r: 'customer' | 'merchant') => {
    if (r === 'customer') router.replace('/(customer)/home');
    else router.replace('/(merchant)/dashboard');
  };

  return (
    <SafeAreaProvider>
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.bg }} edges={['top']}>
        <StatusBar style="dark" />

        {role && (
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <View style={{
              flex: 1,
              flexDirection: 'row',
              backgroundColor: theme.bgMuted,
              marginHorizontal: 12, marginTop: 8, borderRadius: 14, padding: 3,
              borderWidth: 1, borderColor: theme.border,
            }}>
              {(['customer', 'merchant'] as const).map((r) => (
                <TouchableOpacity
                  key={r}
                  onPress={() => switchRole(r)}
                  style={{
                    flex: 1, paddingVertical: 9, borderRadius: 11, alignItems: 'center',
                    backgroundColor: role === r ? theme.primary : 'transparent',
                  }}
                >
                  <Text style={{
                    color: role === r ? theme.textOnPrimary : theme.text,
                    fontWeight: role === r ? '800' : '600',
                    fontSize: 14,
                    letterSpacing: 0.2,
                  }}>
                    {r === 'customer' ? i18n.t('role_picker.customer') : i18n.t('role_picker.merchant')}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            {demo && (
              <View style={{
                backgroundColor: theme.primaryWash, paddingHorizontal: 8, paddingVertical: 4, 
                borderRadius: 8, marginTop: 8, marginRight: 12, borderWidth: 1, borderColor: theme.primary
              }}>
                <Text style={{ color: theme.primary, fontSize: 10, fontWeight: '800' }}>🎯 DEMO</Text>
              </View>
            )}
          </View>
        )}

        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: theme.bg } }} />

      </SafeAreaView>
    </SafeAreaProvider>
  );
}
