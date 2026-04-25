import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { MotiView } from 'moti';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { theme } from '../theme';

interface Props {
  active: 'customer' | 'merchant';
}

// Segmented Kunde / Händler control — required by brief.
// Tap switches role + persists preference + routes (state in AsyncStorage survives).
export default function RoleSwitch({ active }: Props) {
  const switchTo = async (role: 'customer' | 'merchant') => {
    if (role === active) return;
    await Haptics.selectionAsync();
    await AsyncStorage.setItem('cw_preferred_role', role);
    if (role === 'customer') {
      router.replace('/(customer)/home');
    } else {
      const id = await AsyncStorage.getItem('merchant_id');
      router.replace(id ? '/(merchant)/dashboard' : '/(merchant)/setup');
    }
  };

  return (
    <View style={{
      flexDirection: 'row', alignSelf: 'center',
      backgroundColor: theme.bgMuted,
      borderRadius: 999,
      padding: 4,
      borderWidth: 1, borderColor: theme.border,
    }}>
      {(['customer', 'merchant'] as const).map(r => {
        const isActive = active === r;
        return (
          <Pressable
            key={r}
            onPress={() => switchTo(r)}
            hitSlop={6}
            style={{ borderRadius: 999, overflow: 'hidden' }}
          >
            <MotiView
              animate={{ backgroundColor: isActive ? theme.primary : 'transparent' }}
              transition={{ type: 'timing', duration: 180 }}
              style={{
                paddingHorizontal: 18, paddingVertical: 8,
                flexDirection: 'row', alignItems: 'center', gap: 6,
                borderRadius: 999,
              }}
            >
              <Text style={{ fontSize: 13 }}>{r === 'customer' ? '🛍️' : '🏪'}</Text>
              <Text style={{
                color: isActive ? theme.textOnPrimary : theme.text,
                fontSize: 13, fontWeight: isActive ? '800' : '700',
                letterSpacing: 0.3,
              }}>
                {r === 'customer' ? 'Kunde' : 'Händler'}
              </Text>
            </MotiView>
          </Pressable>
        );
      })}
    </View>
  );
}
