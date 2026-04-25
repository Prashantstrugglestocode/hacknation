import React from 'react';
import { View, Text, TouchableOpacity, Dimensions } from 'react-native';
import { router } from 'expo-router';
import { MotiView } from 'moti';
import i18n from '../lib/i18n';

const { height } = Dimensions.get('window');

export default function RolePicker() {
  return (
    <View style={{ flex: 1, backgroundColor: '#0A0A0F', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 }}>
      <MotiView
        from={{ opacity: 0, translateY: -20 }}
        animate={{ opacity: 1, translateY: 0 }}
        transition={{ type: 'timing', duration: 700 }}
        style={{ alignItems: 'center', marginBottom: 60 }}
      >
        <Text style={{ fontSize: 42, marginBottom: 12 }}>💳</Text>
        <Text style={{ fontSize: 34, fontWeight: '900', color: '#fff', letterSpacing: -1 }}>
          {i18n.t('role_picker.title')}
        </Text>
        <Text style={{ fontSize: 16, color: '#ffffff66', marginTop: 8 }}>
          {i18n.t('role_picker.subtitle')}
        </Text>
      </MotiView>

      <MotiView
        from={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ type: 'spring', delay: 200, stiffness: 180, damping: 20 }}
        style={{ width: '100%', gap: 16 }}
      >
        <TouchableOpacity
          onPress={() => router.replace('/(customer)/home')}
          style={{
            backgroundColor: '#6C63FF',
            borderRadius: 18, paddingVertical: 20,
            alignItems: 'center',
          }}
        >
          <Text style={{ color: '#fff', fontSize: 20, fontWeight: '800' }}>
            {i18n.t('role_picker.customer')}
          </Text>
          <Text style={{ color: '#ffffff99', fontSize: 13, marginTop: 2 }}>
            Angebote entdecken
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => router.replace('/(merchant)/setup')}
          style={{
            backgroundColor: '#1A1A2E',
            borderRadius: 18, paddingVertical: 20,
            alignItems: 'center',
            borderWidth: 1.5, borderColor: '#6C63FF44',
          }}
        >
          <Text style={{ color: '#fff', fontSize: 20, fontWeight: '800' }}>
            {i18n.t('role_picker.merchant')}
          </Text>
          <Text style={{ color: '#ffffff66', fontSize: 13, marginTop: 2 }}>
            Geschäft einrichten · 30 Sek.
          </Text>
        </TouchableOpacity>
      </MotiView>
    </View>
  );
}
