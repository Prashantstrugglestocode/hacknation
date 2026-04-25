import React, { useEffect } from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { MotiView } from 'moti';
import { useSession, getProfile } from '../lib/auth';
import { theme } from '../lib/theme';

// Splash + auth gate. Routes:
//   no session       → /(auth)/login
//   first login      → /onboarding
//   completed before → /role
export default function Index() {
  const session = useSession();

  useEffect(() => {
    if (session === undefined) return; // still loading

    (async () => {
      if (!session) {
        router.replace('/(auth)/login');
        return;
      }
      const profile = await getProfile(session.user.id);
      if (!profile || !profile.first_login_completed) {
        router.replace('/onboarding');
      } else {
        router.replace('/role');
      }
    })();
  }, [session]);

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg, alignItems: 'center', justifyContent: 'center' }}>
      <MotiView
        from={{ opacity: 0, scale: 0.85 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ type: 'spring', damping: 14, stiffness: 180 }}
        style={{ alignItems: 'center', gap: 18 }}
      >
        <View style={{
          width: 92, height: 92, borderRadius: 26,
          backgroundColor: theme.primary,
          alignItems: 'center', justifyContent: 'center',
          shadowColor: theme.primary, shadowOpacity: 0.35, shadowRadius: 18, shadowOffset: { width: 0, height: 10 },
        }}>
          <Text style={{ fontSize: 48 }}>💳</Text>
        </View>
        <Text style={{ fontSize: 30, fontWeight: '900', color: theme.text, letterSpacing: -0.6 }}>
          City Wallet
        </Text>
        <ActivityIndicator color={theme.primary} style={{ marginTop: 8 }} />
      </MotiView>
    </View>
  );
}
