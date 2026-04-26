import React from 'react';
import { View, Text, TouchableOpacity, Dimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { MotiView } from 'moti';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { theme, space, radius, type as typo } from '../lib/theme';
import i18n from '../lib/i18n';

const ROLE_KEY = 'cw_preferred_role';
const { height } = Dimensions.get('window');

export default function RolePicker() {
  const insets = useSafeAreaInsets();

  const goCustomer = async () => {
    await AsyncStorage.setItem(ROLE_KEY, 'customer');
    Haptics.selectionAsync().catch(() => {});
    router.replace('/(customer)/home');
  };
  const goMerchant = async () => {
    await AsyncStorage.setItem(ROLE_KEY, 'merchant');
    Haptics.selectionAsync().catch(() => {});
    const existing = await AsyncStorage.getItem('merchant_id');
    router.replace(existing ? '/(merchant)/dashboard' : '/(merchant)/setup');
  };

  return (
    <View style={{
      flex: 1, backgroundColor: theme.bg,
      paddingHorizontal: space['2xl'],
      paddingTop: insets.top + space.md,
      paddingBottom: Math.max(insets.bottom + space.md, space['3xl']),
      justifyContent: 'space-between',
    }}>
      {/* Ambient glow blob — soft brand-tinted depth, no harsh edges */}
      <View pointerEvents="none" style={{
        position: 'absolute',
        top: -height * 0.18, left: -height * 0.12,
        width: height * 0.55, height: height * 0.55,
        borderRadius: height,
        backgroundColor: theme.primary + '12',
      }} />
      <View pointerEvents="none" style={{
        position: 'absolute',
        bottom: -height * 0.18, right: -height * 0.16,
        width: height * 0.55, height: height * 0.55,
        borderRadius: height,
        backgroundColor: theme.primary + '08',
      }} />

      {/* Header */}
      <MotiView
        from={{ opacity: 0, translateY: -16 }}
        animate={{ opacity: 1, translateY: 0 }}
        transition={{ type: 'timing', duration: 600 }}
        style={{ alignItems: 'center', marginTop: space['2xl'], gap: space.sm }}
      >
        <View style={{
          width: 88, height: 88, borderRadius: 26,
          alignItems: 'center', justifyContent: 'center',
          marginBottom: space.sm,
          shadowColor: theme.primary, shadowOpacity: 0.4,
          shadowRadius: 24, shadowOffset: { width: 0, height: 12 },
        }}>
          <LinearGradient
            colors={[theme.primary, theme.primaryDark] as any}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            style={{
              position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
              borderRadius: 26,
            }}
          />
          <Text style={{ fontSize: 44 }}>💳</Text>
        </View>
        <Text style={{
          fontSize: 38, fontWeight: '900', color: theme.text,
          letterSpacing: -1.0,
        }}>
          {i18n.t('role_picker.title')}
        </Text>
        <Text style={{
          fontSize: typo.body, color: theme.textMuted,
          fontWeight: '600', textAlign: 'center',
        }}>
          {i18n.t('role_picker.subtitle')}
        </Text>
        <Text style={{
          fontSize: typo.small, color: theme.textMuted,
          fontWeight: '700', letterSpacing: 0.4,
          marginTop: space.xs,
        }}>
          {i18n.t('role_picker.who_are_you')}
        </Text>
      </MotiView>

      {/* Role buttons — primary CTA first (60/30/10: red is the 10% accent
          drawing the eye to the recommended path). */}
      <MotiView
        from={{ opacity: 0, scale: 0.94 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ type: 'spring', delay: 180, stiffness: 180, damping: 20 }}
        style={{ gap: space.md }}
      >
        <TouchableOpacity
          onPress={goCustomer}
          activeOpacity={0.92}
          style={{
            borderRadius: radius.xl,
            overflow: 'hidden',
            shadowColor: theme.primary, shadowOpacity: 0.32,
            shadowRadius: 18, shadowOffset: { width: 0, height: 8 },
          }}
        >
          <LinearGradient
            colors={[theme.primary, theme.primaryDark] as any}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            style={{ paddingVertical: space.xl + 4, alignItems: 'center', gap: 4 }}
          >
            <Text style={{ fontSize: 32, marginBottom: 2 }}>🛍️</Text>
            <Text style={{
              color: theme.textOnPrimary, fontSize: typo.title,
              fontWeight: '900', letterSpacing: 0.3,
            }}>
              {i18n.t('role_picker.customer')}
            </Text>
            <Text style={{
              color: '#FFFFFFCC', fontSize: typo.small,
              fontWeight: '700',
            }}>
              {i18n.t('role_picker.customer_sub')}
            </Text>
          </LinearGradient>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={goMerchant}
          activeOpacity={0.92}
          style={{
            backgroundColor: theme.surface,
            borderRadius: radius.xl, paddingVertical: space.xl + 4,
            alignItems: 'center', gap: 4,
            borderWidth: 1.5, borderColor: theme.primary + '55',
          }}
        >
          <Text style={{ fontSize: 32, marginBottom: 2 }}>🏪</Text>
          <Text style={{
            color: theme.primary, fontSize: typo.title,
            fontWeight: '900', letterSpacing: 0.3,
          }}>
            {i18n.t('role_picker.merchant')}
          </Text>
          <Text style={{
            color: theme.textMuted, fontSize: typo.small,
            fontWeight: '700',
          }}>
            {i18n.t('role_picker.merchant_sub')}
          </Text>
        </TouchableOpacity>
      </MotiView>

      {/* Footer: short tagline. Privacy mechanism stays in code; we
          don't surface a banner about it. */}
      <View style={{ alignItems: 'center' }}>
        <Text style={{
          color: theme.textMuted, fontSize: typo.small,
          textAlign: 'center', fontWeight: '600',
        }}>
          No sign-in needed
        </Text>
      </View>
    </View>
  );
}
