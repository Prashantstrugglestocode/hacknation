import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Dimensions, PanResponder, Animated } from 'react-native';
import { router } from 'expo-router';
import { MotiView } from 'moti';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import Constants from 'expo-constants';
import { theme } from '../lib/theme';

const { height } = Dimensions.get('window');
const SWIPE_THRESHOLD = 90;

const ROLE_KEY = 'cw_preferred_role';
const MERCHANT_KEY = 'merchant_id';
const API = Constants.expoConfig?.extra?.apiUrl as string;

// Anon-device-hash boot (no login wall — brief anti-pattern).
// The landing screen now stays until the user explicitly swipes up so the
// brand moment isn't a 450ms blip. Routes after swipe:
//   has merchant_id    → /(merchant)/dashboard
//   role=customer      → /(customer)/home
//   role=merchant      → /(merchant)/setup
//   no choice yet      → /role
async function decideDestination(): Promise<string> {
  const [merchantId, role] = await Promise.all([
    AsyncStorage.getItem(MERCHANT_KEY),
    AsyncStorage.getItem(ROLE_KEY),
  ]);
  if (merchantId) return '/(merchant)/dashboard';
  if (role === 'customer') return '/(customer)/home';
  if (role === 'merchant') return '/(merchant)/setup';
  return '/role';
}

export default function Index() {
  const translateY = useRef(new Animated.Value(0)).current;
  const [leaving, setLeaving] = useState(false);

  // Fire-and-forget LLM warmup so by the time the user swipes up and
  // reaches /home, the model has had a head start.
  useEffect(() => {
    if (API) fetch(`${API}/api/warm`, { method: 'POST' }).catch(() => {});
  }, []);

  const exitTo = async () => {
    if (leaving) return;
    setLeaving(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    // Slide the whole screen up off the top edge as we route.
    Animated.timing(translateY, {
      toValue: -height,
      duration: 320,
      useNativeDriver: true,
    }).start(async () => {
      const dest = await decideDestination();
      router.replace(dest as any);
    });
  };

  const responder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_e, g) => Math.abs(g.dy) > 6 || Math.abs(g.dx) > 6,
      onPanResponderMove: (_e, g) => {
        // Only follow upward drags; resist downward / side drags.
        const dy = Math.min(0, g.dy);
        translateY.setValue(dy);
      },
      onPanResponderRelease: (_e, g) => {
        const tappedFlick = g.dy < -20 && g.vy < -0.5;
        if (g.dy <= -SWIPE_THRESHOLD || tappedFlick) {
          exitTo();
        } else {
          Animated.spring(translateY, {
            toValue: 0, useNativeDriver: true, damping: 16, stiffness: 220,
          }).start();
        }
      },
    }),
  ).current;

  const hintOpacity = translateY.interpolate({
    inputRange: [-SWIPE_THRESHOLD, 0],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });

  return (
    <Animated.View
      {...responder.panHandlers}
      style={{
        flex: 1, backgroundColor: theme.bg,
        alignItems: 'center', justifyContent: 'center', padding: 32,
        transform: [{ translateY }],
      }}
    >
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
      </MotiView>

      {/* Swipe-up affordance — pulses to telegraph the gesture, fades while
          the user is mid-drag so it doesn't compete with the motion. */}
      <Animated.View style={{
        position: 'absolute',
        bottom: 96,
        alignItems: 'center', gap: 8,
        opacity: hintOpacity,
      }}>
        <MotiView
          from={{ translateY: 0, opacity: 0.4 }}
          animate={{ translateY: -8, opacity: 1 }}
          transition={{ type: 'timing', duration: 1100, loop: true, repeatReverse: true }}
        >
          <Text style={{ color: theme.primary, fontSize: 26, fontWeight: '900' }}>↑</Text>
        </MotiView>
        <Text style={{
          color: theme.textMuted, fontSize: 12, fontWeight: '800',
          letterSpacing: 1.4,
        }}>
          SWIPE UP
        </Text>
      </Animated.View>

      {/* Footer brand line */}
      <View style={{ position: 'absolute', bottom: 36, alignItems: 'center', gap: 4 }}>
        <Text style={{ color: theme.textMuted, fontSize: 11, fontWeight: '700', letterSpacing: 1.4 }}>
          POWERED BY
        </Text>
        <Text style={{ color: theme.text, fontSize: 13, fontWeight: '800' }}>
          DSV Gruppe · Sparkassen
        </Text>
      </View>
    </Animated.View>
  );
}
