import React from 'react';
import { View, Text, TouchableOpacity, Dimensions } from 'react-native';
import { router } from 'expo-router';
import { MotiView } from 'moti';
import { theme } from '../lib/theme';
import i18n from '../lib/i18n';

export default function RolePicker() {
  return (
    <View style={{ flex: 1, backgroundColor: theme.bg, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 }}>
      <MotiView
        from={{ opacity: 0, translateY: -20 }}
        animate={{ opacity: 1, translateY: 0 }}
        transition={{ type: 'timing', duration: 700 }}
        style={{ alignItems: 'center', marginBottom: 60 }}
      >
        <View style={{
          width: 76, height: 76, borderRadius: 22,
          backgroundColor: theme.primary,
          alignItems: 'center', justifyContent: 'center',
          marginBottom: 18,
          shadowColor: theme.primary, shadowOpacity: 0.35, shadowRadius: 16, shadowOffset: { width: 0, height: 8 },
        }}>
          <Text style={{ fontSize: 40 }}>💳</Text>
        </View>
        <Text style={{ fontSize: 36, fontWeight: '900', color: theme.text, letterSpacing: -1 }}>
          {i18n.t('role_picker.title')}
        </Text>
        <Text style={{ fontSize: 16, color: theme.textMuted, marginTop: 6, fontWeight: '500' }}>
          {i18n.t('role_picker.subtitle')}
        </Text>
      </MotiView>

      <MotiView
        from={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ type: 'spring', delay: 200, stiffness: 180, damping: 20 }}
        style={{ width: '100%', gap: 14 }}
      >
        <TouchableOpacity
          onPress={() => router.replace('/(customer)/home')}
          style={{
            backgroundColor: theme.primary,
            borderRadius: 18, paddingVertical: 20,
            alignItems: 'center',
            shadowColor: theme.primary, shadowOpacity: 0.3, shadowRadius: 14, shadowOffset: { width: 0, height: 6 },
          }}
        >
          <Text style={{ color: theme.textOnPrimary, fontSize: 20, fontWeight: '800', letterSpacing: 0.3 }}>
            {i18n.t('role_picker.customer')}
          </Text>
          <Text style={{ color: '#FFFFFFCC', fontSize: 13, marginTop: 3, fontWeight: '600' }}>
            Angebote entdecken
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => router.replace('/(merchant)/setup')}
          style={{
            backgroundColor: theme.surface,
            borderRadius: 18, paddingVertical: 20,
            alignItems: 'center',
            borderWidth: 2, borderColor: theme.primary,
          }}
        >
          <Text style={{ color: theme.primary, fontSize: 20, fontWeight: '800', letterSpacing: 0.3 }}>
            {i18n.t('role_picker.merchant')}
          </Text>
          <Text style={{ color: theme.textMuted, fontSize: 13, marginTop: 3, fontWeight: '600' }}>
            Geschäft einrichten · 30 Sek.
          </Text>
        </TouchableOpacity>
      </MotiView>
    </View>
  );
}
