import React, { useRef, useState } from 'react';
import { View, Text, TouchableOpacity, Dimensions, Animated, PanResponder } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { MotiView } from 'moti';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { theme, space, radius, type as typo } from '../../lib/theme';

const { width } = Dimensions.get('window');
const SWIPE_THRESHOLD = 80;

// Customer-side walkthrough — fired right after the role picker.
// Four short slides explain what the customer is about to see, so
// nobody lands on /home cold. Skip is always one tap away.
const SLIDES = [
  {
    emoji: '🌦️',
    title: 'We read the moment',
    body: 'Live weather, time of day, how busy the shops nearby are — Stadtpuls watches the signals so you don\'t have to.',
    chip: '01 · Context sensing',
  },
  {
    emoji: '✨',
    title: 'AI writes one offer',
    body: 'Mistral picks a real menu item and a fitting discount, then renders it as a card built just for this minute.',
    chip: '02 · Generative offer',
  },
  {
    emoji: '🎫',
    title: 'Tap to claim',
    body: 'One card, one accept. A 10-minute QR appears. Show it to the merchant — they scan it on their phone.',
    chip: '03 · Display + accept',
  },
  {
    emoji: '💳',
    title: 'Sparkasse Pay slides up',
    body: 'After the merchant scans, your phone pops a payment sheet. Slide to confirm — discount applies, both phones celebrate.',
    chip: '04 · Pay & redeem',
  },
];

export default function CustomerWalkthrough() {
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState(0);
  const translateX = useRef(new Animated.Value(0)).current;

  const finish = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    router.replace('/(customer)/home');
  };
  const advance = () => {
    if (step >= SLIDES.length - 1) { finish(); return; }
    Haptics.selectionAsync().catch(() => {});
    setStep(step + 1);
  };
  const back = () => {
    if (step <= 0) return;
    Haptics.selectionAsync().catch(() => {});
    setStep(step - 1);
  };

  // Horizontal swipe between slides. Left = next, right = back.
  const responder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_e, g) => Math.abs(g.dx) > Math.abs(g.dy) && Math.abs(g.dx) > 6,
      onPanResponderMove: (_e, g) => translateX.setValue(g.dx),
      onPanResponderRelease: (_e, g) => {
        if (g.dx <= -SWIPE_THRESHOLD) {
          Animated.timing(translateX, { toValue: -width, duration: 180, useNativeDriver: true }).start(() => {
            translateX.setValue(0);
            advance();
          });
        } else if (g.dx >= SWIPE_THRESHOLD) {
          Animated.timing(translateX, { toValue: width, duration: 180, useNativeDriver: true }).start(() => {
            translateX.setValue(0);
            back();
          });
        } else {
          Animated.spring(translateX, { toValue: 0, useNativeDriver: true, damping: 18, stiffness: 240 }).start();
        }
      },
    }),
  ).current;

  const slide = SLIDES[step];
  const isLast = step === SLIDES.length - 1;

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      {/* Top bar — Skip + step indicator */}
      <View style={{
        paddingTop: insets.top + 12,
        paddingHorizontal: space.lg,
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <View style={{ flexDirection: 'row', gap: 6 }}>
          {SLIDES.map((_, i) => (
            <MotiView
              key={i}
              animate={{
                width: i === step ? 24 : 8,
                backgroundColor: i === step ? theme.primary : theme.border,
              }}
              transition={{ type: 'timing', duration: 220 }}
              style={{ height: 6, borderRadius: 3 }}
            />
          ))}
        </View>
        <TouchableOpacity onPress={finish} hitSlop={12}>
          <Text style={{ color: theme.textMuted, fontSize: typo.small, fontWeight: '800' }}>
            Skip
          </Text>
        </TouchableOpacity>
      </View>

      {/* Card — swipeable */}
      <Animated.View
        {...responder.panHandlers}
        style={{
          flex: 1, padding: space.xl, justifyContent: 'center',
          transform: [{ translateX }],
        }}
      >
        <MotiView
          key={step}
          from={{ opacity: 0, translateY: 12, scale: 0.97 }}
          animate={{ opacity: 1, translateY: 0, scale: 1 }}
          transition={{ type: 'spring', damping: 16, stiffness: 220 }}
          style={{
            backgroundColor: theme.surface, borderRadius: radius.xl,
            padding: space.xl + 4,
            borderWidth: 1, borderColor: theme.border,
            shadowColor: theme.primary, shadowOpacity: 0.12,
            shadowRadius: 24, shadowOffset: { width: 0, height: 12 },
            gap: space.lg,
          }}
        >
          {/* Stage chip */}
          <View style={{
            alignSelf: 'flex-start',
            backgroundColor: theme.primaryWash,
            borderRadius: 999,
            paddingHorizontal: space.md, paddingVertical: 4,
          }}>
            <Text style={{ color: theme.primary, fontSize: 10, fontWeight: '900', letterSpacing: 1.2 }}>
              {slide.chip}
            </Text>
          </View>

          {/* Big emoji */}
          <View style={{ alignItems: 'center', paddingVertical: space.md }}>
            <MotiView
              from={{ scale: 0.6, rotate: '-8deg' }}
              animate={{ scale: 1, rotate: '0deg' }}
              transition={{ type: 'spring', damping: 10, stiffness: 180 }}
            >
              <Text style={{ fontSize: 96 }}>{slide.emoji}</Text>
            </MotiView>
          </View>

          {/* Title */}
          <Text style={{
            color: theme.text, fontSize: typo.display - 4, fontWeight: '900',
            letterSpacing: -0.6, textAlign: 'center',
          }}>
            {slide.title}
          </Text>

          {/* Body */}
          <Text style={{
            color: theme.textMuted, fontSize: typo.body, fontWeight: '600',
            textAlign: 'center', lineHeight: 22,
          }}>
            {slide.body}
          </Text>
        </MotiView>

        {/* Swipe hint */}
        <View style={{ alignItems: 'center', marginTop: space.lg }}>
          <Text style={{ color: theme.textMuted, fontSize: 11, fontWeight: '700' }}>
            Swipe → for next
          </Text>
        </View>
      </Animated.View>

      {/* Bottom CTA */}
      <View style={{
        padding: space.lg,
        paddingBottom: insets.bottom + space.lg,
      }}>
        <TouchableOpacity onPress={advance} activeOpacity={0.9}
          style={{
            borderRadius: radius.xl, overflow: 'hidden',
            shadowColor: theme.primary, shadowOpacity: 0.32,
            shadowRadius: 18, shadowOffset: { width: 0, height: 8 },
          }}
        >
          <LinearGradient
            colors={[theme.primary, theme.primaryDark] as any}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            style={{ paddingVertical: space.lg + 2, alignItems: 'center' }}
          >
            <Text style={{
              color: theme.textOnPrimary, fontSize: typo.bodyL, fontWeight: '900',
              letterSpacing: 0.4,
            }}>
              {isLast ? '🚀 Get started' : 'Next'}
            </Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </View>
  );
}
