import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import { MotiView } from 'moti';
import * as Haptics from 'expo-haptics';
import { signOut, useSession, setPreferredRole } from '../lib/auth';
import { theme } from '../lib/theme';
import i18n from '../lib/i18n';

export default function RolePicker() {
  const session = useSession();

  const goCustomer = async () => {
    if (session?.user) await setPreferredRole(session.user.id, 'customer');
    Haptics.selectionAsync();
    router.replace('/(customer)/home');
  };
  const goMerchant = async () => {
    if (session?.user) await setPreferredRole(session.user.id, 'merchant');
    Haptics.selectionAsync();
    router.replace('/(merchant)/setup');
  };
  const handleSignOut = async () => {
    await signOut();
    router.replace('/(auth)/login');
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 }}>
      <View style={{ position: 'absolute', top: 12, right: 16 }}>
        <TouchableOpacity onPress={handleSignOut} hitSlop={10}>
          <Text style={{ color: theme.textMuted, fontSize: 13, fontWeight: '700' }}>Abmelden</Text>
        </TouchableOpacity>
      </View>

      <MotiView
        from={{ opacity: 0, translateY: -20 }}
        animate={{ opacity: 1, translateY: 0 }}
        transition={{ type: 'timing', duration: 700 }}
        style={{ alignItems: 'center', marginBottom: 50 }}
      >
        <View style={{
          width: 76, height: 76, borderRadius: 22,
          backgroundColor: theme.primary,
          alignItems: 'center', justifyContent: 'center',
          marginBottom: 16,
          shadowColor: theme.primary, shadowOpacity: 0.35, shadowRadius: 16, shadowOffset: { width: 0, height: 8 },
        }}>
          <Text style={{ fontSize: 40 }}>💳</Text>
        </View>
        <Text style={{ fontSize: 36, fontWeight: '900', color: theme.text, letterSpacing: -1 }}>
          {i18n.t('role_picker.title')}
        </Text>
        <Text style={{ fontSize: 15, color: theme.textMuted, marginTop: 6, fontWeight: '500' }}>
          Wer bist du heute?
        </Text>
      </MotiView>

      <MotiView
        from={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ type: 'spring', delay: 200, stiffness: 180, damping: 20 }}
        style={{ width: '100%', gap: 14 }}
      >
        <TouchableOpacity
          onPress={goCustomer}
          style={{
            backgroundColor: theme.primary,
            borderRadius: 18, paddingVertical: 22,
            alignItems: 'center',
            shadowColor: theme.primary, shadowOpacity: 0.3, shadowRadius: 14, shadowOffset: { width: 0, height: 6 },
          }}
        >
          <Text style={{ fontSize: 28, marginBottom: 4 }}>🛍️</Text>
          <Text style={{ color: theme.textOnPrimary, fontSize: 20, fontWeight: '800', letterSpacing: 0.3 }}>
            {i18n.t('role_picker.customer')}
          </Text>
          <Text style={{ color: '#FFFFFFCC', fontSize: 13, marginTop: 3, fontWeight: '600' }}>
            Angebote entdecken
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={goMerchant}
          style={{
            backgroundColor: theme.surface,
            borderRadius: 18, paddingVertical: 22,
            alignItems: 'center',
            borderWidth: 2, borderColor: theme.primary,
          }}
        >
          <Text style={{ fontSize: 28, marginBottom: 4 }}>🏪</Text>
          <Text style={{ color: theme.primary, fontSize: 20, fontWeight: '800', letterSpacing: 0.3 }}>
            {i18n.t('role_picker.merchant')}
          </Text>
          <Text style={{ color: theme.textMuted, fontSize: 13, marginTop: 3, fontWeight: '600' }}>
            Geschäft einrichten · 30 Sek.
          </Text>
        </TouchableOpacity>
      </MotiView>

      {session?.user?.email && (
        <Text style={{ color: theme.textMuted, fontSize: 11, marginTop: 24 }}>
          Angemeldet als {session.user.email}
        </Text>
      )}
    </View>
  );
}
