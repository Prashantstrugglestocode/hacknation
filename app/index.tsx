import React, { useEffect } from 'react';
import { View, Text, Dimensions } from 'react-native';
import { router } from 'expo-router';
import { MotiView } from 'moti';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { theme } from '../lib/theme';

const { height } = Dimensions.get('window');

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
      {/* Ambient brand glow */}
      <View pointerEvents="none" style={{
        position: 'absolute',
        top: -height * 0.18, left: -height * 0.12,
        width: height * 0.55, height: height * 0.55,
        borderRadius: height,
        backgroundColor: theme.primary + '14',
      }} />
      <View pointerEvents="none" style={{
        position: 'absolute',
        bottom: -height * 0.18, right: -height * 0.16,
        width: height * 0.55, height: height * 0.55,
        borderRadius: height,
        backgroundColor: theme.primary + '0A',
      }} />

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
            width: 112, height: 112, borderRadius: 32,
            alignItems: 'center', justifyContent: 'center',
            overflow: 'hidden',
            shadowColor: theme.primary, shadowOpacity: 0.45,
            shadowRadius: 28, shadowOffset: { width: 0, height: 14 },
          }}
        >
          <LinearGradient
            colors={[theme.primary, theme.primaryDark] as any}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
          />
          <Text style={{ fontSize: 56 }}>💳</Text>
        </MotiView>

        {/* Wordmark */}
        <View style={{ alignItems: 'center', gap: 6 }}>
          <Text style={{
            fontSize: 40, fontWeight: '900', color: theme.text,
            letterSpacing: -1.4,
          }}>
            Stadtpuls
          </Text>
          <Text style={{
            color: theme.textMuted, fontSize: 14, fontWeight: '700',
            letterSpacing: 0.4, textAlign: 'center',
          }}>
            The pulse of your city
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
