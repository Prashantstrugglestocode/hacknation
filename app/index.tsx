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
    <View style={{ flex: 1, backgroundColor: theme.bg, alignItems: 'center', justifyContent: 'center', padding: 32 }}>
      <MotiView
        from={{ opacity: 0, scale: 0.82 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ type: 'spring', damping: 13, stiffness: 180 }}
        style={{ alignItems: 'center', gap: 22 }}
      >
        {/* Logo mark */}
        <MotiView
          from={{ scale: 1, rotate: '-2deg' }}
          animate={{ scale: 1.04, rotate: '2deg' }}
          transition={{ type: 'timing', duration: 1400, loop: true }}
          style={{
            width: 104, height: 104, borderRadius: 30,
            backgroundColor: theme.primary,
            alignItems: 'center', justifyContent: 'center',
            shadowColor: theme.primary, shadowOpacity: 0.4, shadowRadius: 22, shadowOffset: { width: 0, height: 12 },
          }}
        >
          <Text style={{ fontSize: 52 }}>💳</Text>
        </MotiView>

        {/* Wordmark */}
        <View style={{ alignItems: 'center', gap: 6 }}>
          <Text style={{
            fontSize: 36, fontWeight: '900', color: theme.text,
            letterSpacing: -1.2,
          }}>
            City Wallet
          </Text>
          <Text style={{
            color: theme.textMuted, fontSize: 14, fontWeight: '700',
            letterSpacing: 0.4, textAlign: 'center',
          }}>
            Hyperlokal · Echtzeit · KI-komponiert
          </Text>
        </View>

        {/* Loading dots */}
        <View style={{ flexDirection: 'row', gap: 6, marginTop: 8 }}>
          {[0, 1, 2].map(i => (
            <MotiView
              key={i}
              from={{ opacity: 0.25, scale: 0.7 }}
              animate={{ opacity: 1, scale: 1.2 }}
              transition={{ type: 'timing', duration: 650, loop: true, delay: i * 180 }}
              style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: theme.primary }}
            />
          ))}
        </View>
      </MotiView>

      {/* Footer brand line */}
      <View style={{ position: 'absolute', bottom: 36, alignItems: 'center', gap: 4 }}>
        <Text style={{ color: theme.textMuted, fontSize: 11, fontWeight: '700', letterSpacing: 1.4 }}>
          POWERED BY
        </Text>
        <Text style={{ color: theme.text, fontSize: 13, fontWeight: '800' }}>
          DSV Gruppe · Sparkassen
        </Text>
      </View>
    </View>
  );
}
