import React, { useState } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import { MotiView } from 'moti';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { theme } from '../lib/theme';
import i18n, { setLocale, getLocale } from '../lib/i18n';

const ROLE_KEY = 'cw_preferred_role';

export default function RolePicker() {
  const [locale, setLocaleState] = useState<'de' | 'en'>(getLocale());

  const switchLocale = async (l: 'de' | 'en') => {
    await setLocale(l);
    setLocaleState(l);
    Haptics.selectionAsync();
  };

  const goCustomer = async () => {
    await AsyncStorage.setItem(ROLE_KEY, 'customer');
    Haptics.selectionAsync();
    router.replace('/(customer)/home');
  };
  const goMerchant = async () => {
    await AsyncStorage.setItem(ROLE_KEY, 'merchant');
    Haptics.selectionAsync();
    const existing = await AsyncStorage.getItem('merchant_id');
    router.replace(existing ? '/(merchant)/dashboard' : '/(merchant)/setup');
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

      {/* Language switcher */}
      <View style={{
        flexDirection: 'row', alignItems: 'center', gap: 8,
        backgroundColor: theme.bgMuted, borderRadius: 14, padding: 4,
        borderWidth: 1, borderColor: theme.border,
        alignSelf: 'center',
      }}>
        {(['de', 'en'] as const).map(l => {
          const active = locale === l;
          return (
            <TouchableOpacity
              key={l}
              onPress={() => switchLocale(l)}
              style={{
                paddingHorizontal: 18, paddingVertical: 8, borderRadius: 10,
                backgroundColor: active ? theme.primary : 'transparent',
              }}
            >
              <Text style={{
                color: active ? theme.textOnPrimary : theme.text,
                fontSize: 13, fontWeight: '800', letterSpacing: 0.4,
              }}>
                {l === 'de' ? '🇩🇪 Deutsch' : '🇬🇧 English'}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Anonymity hint replaces sign-out card */}
      <Text style={{ color: theme.textMuted, fontSize: 12, textAlign: 'center', fontWeight: '600' }}>
        🔒 Anonymes Gerät · keine Anmeldung nötig
      </Text>
    </View>
  );
}
