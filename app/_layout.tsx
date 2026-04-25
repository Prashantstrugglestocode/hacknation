import React, { useState } from 'react';
import { View, TouchableOpacity, Text, SafeAreaView } from 'react-native';
import { Stack, router, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import i18n from '../lib/i18n';

export default function RootLayout() {
  const [role, setRole] = useState<'customer' | 'merchant' | null>(null);
  const segments = useSegments();

  const handleRoleSwitch = (newRole: 'customer' | 'merchant') => {
    setRole(newRole);
    if (newRole === 'customer') router.replace('/(customer)/home');
    else router.replace('/(merchant)/dashboard');
  };

  const inApp = segments.length > 0 && segments[0] !== undefined;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#0A0A0F' }}>
      <StatusBar style="light" />

      {/* Role segmented control — shown after role is selected */}
      {inApp && role && (
        <View style={{
          flexDirection: 'row', backgroundColor: '#1A1A2E',
          margin: 12, borderRadius: 12, padding: 3
        }}>
          {(['customer', 'merchant'] as const).map((r) => (
            <TouchableOpacity
              key={r}
              onPress={() => handleRoleSwitch(r)}
              style={{
                flex: 1, paddingVertical: 8, borderRadius: 10, alignItems: 'center',
                backgroundColor: role === r ? '#6C63FF' : 'transparent',
              }}
            >
              <Text style={{ color: '#fff', fontWeight: role === r ? '700' : '400', fontSize: 14 }}>
                {r === 'customer' ? i18n.t('role_picker.customer') : i18n.t('role_picker.merchant')}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#0A0A0F' } }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="(customer)" />
        <Stack.Screen name="(merchant)" />
      </Stack>
    </SafeAreaView>
  );
}
