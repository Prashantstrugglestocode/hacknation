import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Alert } from 'react-native';
import { router } from 'expo-router';
import { MotiView } from 'moti';
import * as Haptics from 'expo-haptics';
import { signOut, useSession, setPreferredRole } from '../lib/auth';
import { theme } from '../lib/theme';
import i18n from '../lib/i18n';

export default function RolePicker() {
  const session = useSession();
  const [signingOut, setSigningOut] = useState(false);

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

  const confirmSignOut = () => {
    Alert.alert('Abmelden?', 'Du wirst zur Login-Seite weitergeleitet.', [
      { text: 'Abbrechen', style: 'cancel' },
      { text: 'Abmelden', style: 'destructive', onPress: doSignOut },
    ]);
  };

  const doSignOut = async () => {
    setSigningOut(true);
    await signOut();
    router.replace('/(auth)/login');
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg, paddingHorizontal: 28, justifyContent: 'space-between', paddingTop: 24, paddingBottom: 36 }}>
      {/* Header */}
      <MotiView
        from={{ opacity: 0, translateY: -16 }}
        animate={{ opacity: 1, translateY: 0 }}
        transition={{ type: 'timing', duration: 600 }}
        style={{ alignItems: 'center', marginTop: 32 }}
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
        <Text style={{ fontSize: 32, fontWeight: '900', color: theme.text, letterSpacing: -0.8 }}>
          {i18n.t('role_picker.title')}
        </Text>
        <Text style={{ fontSize: 15, color: theme.textMuted, marginTop: 4, fontWeight: '500' }}>
          Wer bist du heute?
        </Text>
      </MotiView>

      {/* Role buttons (centered) */}
      <MotiView
        from={{ opacity: 0, scale: 0.94 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ type: 'spring', delay: 180, stiffness: 180, damping: 20 }}
        style={{ gap: 14 }}
      >
        <TouchableOpacity
          onPress={goCustomer}
          style={{
            backgroundColor: theme.primary,
            borderRadius: 18, paddingVertical: 22, alignItems: 'center',
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
            borderRadius: 18, paddingVertical: 22, alignItems: 'center',
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

      {/* Account / sign-out card */}
      <View style={{
        backgroundColor: theme.bgMuted, borderRadius: 16, padding: 16, gap: 12,
        borderWidth: 1, borderColor: theme.border,
      }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <View style={{
            width: 36, height: 36, borderRadius: 18,
            backgroundColor: theme.primary,
            alignItems: 'center', justifyContent: 'center',
          }}>
            <Text style={{ fontSize: 16 }}>👤</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: theme.textMuted, fontSize: 11, fontWeight: '800', letterSpacing: 1 }}>
              ANGEMELDET
            </Text>
            <Text style={{ color: theme.text, fontSize: 14, fontWeight: '700' }} numberOfLines={1}>
              {session?.user?.email ?? '—'}
            </Text>
          </View>
        </View>
        <TouchableOpacity
          onPress={confirmSignOut}
          disabled={signingOut}
          style={{
            backgroundColor: theme.surface, borderRadius: 12,
            paddingVertical: 12, alignItems: 'center',
            borderWidth: 1, borderColor: theme.danger + '55',
          }}
        >
          <Text style={{ color: theme.danger, fontWeight: '800', fontSize: 14 }}>
            {signingOut ? 'Abmelden…' : '🚪  Abmelden'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
