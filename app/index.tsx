import React, { useEffect } from 'react';
import { View, Text } from 'react-native';
import { router } from 'expo-router';
import { MotiView } from 'moti';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { theme } from '../lib/theme';

const ROLE_KEY = 'cw_preferred_role';
const MERCHANT_KEY = 'merchant_id';
const API = Constants.expoConfig?.extra?.apiUrl as string;

// Anon-device-hash boot (no login wall — brief anti-pattern).
// Routes:
//   has merchant_id    → /(merchant)/dashboard
//   role=customer      → /(customer)/home
//   role=merchant      → /(merchant)/setup
//   no choice yet      → /role
export default function Index() {
  useEffect(() => {
    let cancelled = false;
    // Fire-and-forget: get Ollama loaded before the customer reaches /home.
    if (API) fetch(`${API}/api/warm`, { method: 'POST' }).catch(() => {});

    const t = setTimeout(async () => {
      const [merchantId, role] = await Promise.all([
        AsyncStorage.getItem(MERCHANT_KEY),
        AsyncStorage.getItem(ROLE_KEY),
      ]);
      if (cancelled) return;
      if (merchantId) router.replace('/(merchant)/dashboard');
      else if (role === 'customer') router.replace('/(customer)/home');
      else if (role === 'merchant') router.replace('/(merchant)/setup');
      else router.replace('/role');
    }, 450);
    return () => { cancelled = true; clearTimeout(t); };
  }, []);

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg, alignItems: 'center', justifyContent: 'center' }}>
      <MotiView
        from={{ opacity: 0, scale: 0.85 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ type: 'spring', damping: 14, stiffness: 180 }}
        style={{ alignItems: 'center', gap: 18 }}
      >
        <MotiView
          from={{ scale: 1 }}
          animate={{ scale: 1.06 }}
          transition={{ type: 'timing', duration: 900, loop: true }}
          style={{
            width: 92, height: 92, borderRadius: 26,
            backgroundColor: theme.primary,
            alignItems: 'center', justifyContent: 'center',
            shadowColor: theme.primary, shadowOpacity: 0.35, shadowRadius: 18, shadowOffset: { width: 0, height: 10 },
          }}
        >
          <Text style={{ fontSize: 48 }}>💳</Text>
        </MotiView>
        <Text style={{ fontSize: 30, fontWeight: '900', color: theme.text, letterSpacing: -0.6 }}>
          City Wallet
        </Text>
        <View style={{ flexDirection: 'row', gap: 6, marginTop: 4 }}>
          {[0, 1, 2].map(i => (
            <MotiView
              key={i}
              from={{ opacity: 0.3, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1.15 }}
              transition={{ type: 'timing', duration: 650, loop: true, delay: i * 180 }}
              style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: theme.primary }}
            />
          ))}
        </View>
      </MotiView>
    </View>
  );
}
