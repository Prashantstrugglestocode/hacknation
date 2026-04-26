import React, { useState } from 'react';
import { View, Text, Alert, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { MotiView, AnimatePresence } from 'moti';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import Constants from 'expo-constants';
import SlideToPay from '../../../lib/components/SlideToPay';
import { theme, space, radius, type as typo } from '../../../lib/theme';

const API = Constants.expoConfig?.extra?.apiUrl as string;

// Dedicated Payone payment sheet shown after the merchant scans the
// customer's QR. Full-screen modal so it reads as a real payment flow,
// not just another card swap. On confirm → POST /confirm-payment, show
// the brief success state, then dismiss back to the redeem screen which
// receives offer.redeemed via realtime and renders the receipt.
export default function PayScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{
    id: string;
    base?: string;
    discount?: string;
    merchant?: string;
  }>();
  const offerId = params.id;
  const baseCents = params.base ? parseInt(params.base, 10) : 0;
  const discountCents = params.discount ? parseInt(params.discount, 10) : 0;
  const totalCents = Math.max(0, baseCents - discountCents);
  const merchantName = params.merchant ?? 'Merchant';

  const [phase, setPhase] = useState<'idle' | 'success'>('idle');

  const fmtEur = (cents: number) =>
    new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'EUR' }).format(cents / 100);

  const onConfirm = async () => {
    try {
      const r = await fetch(`${API}/api/offer/${offerId}/confirm-payment`, { method: 'POST' });
      if (!r.ok) {
        const err = await r.json().catch(() => ({}));
        Alert.alert('Payment failed', err.error ?? 'Please try again.');
        throw new Error('confirm failed');
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      setPhase('success');
      // Dismiss back to redeem after a brief celebration so the merchant
      // sees the receipt arrive on the customer phone in real time.
      setTimeout(() => {
        router.back();
      }, 1400);
    } catch (e) {
      // Re-throw so SlideToPay resets the slider — gives the user a chance
      // to try again instead of being stuck at the snapped-to-end position.
      throw e;
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      {/* Payone-branded header — Sparkasse red gradient bar */}
      <LinearGradient
        colors={[theme.primary, theme.primaryDark] as any}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        style={{
          paddingTop: insets.top + 12,
          paddingHorizontal: space.lg,
          paddingBottom: space.lg,
          borderBottomLeftRadius: 24,
          borderBottomRightRadius: 24,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Pressable onPress={() => router.back()} hitSlop={12}
            style={{
              paddingHorizontal: 14, paddingVertical: 8,
              borderRadius: 999,
              backgroundColor: '#FFFFFF22',
            }}>
            <Text style={{ color: '#FFF', fontSize: 13, fontWeight: '700' }}>Cancel</Text>
          </Pressable>
          <View style={{
            flexDirection: 'row', alignItems: 'center', gap: 6,
            backgroundColor: '#FFFFFF22', borderRadius: 999,
            paddingHorizontal: 12, paddingVertical: 6,
          }}>
            <Text style={{ fontSize: 12 }}>🔒</Text>
            <Text style={{
              color: '#FFF', fontSize: 11, fontWeight: '900', letterSpacing: 1.2,
            }}>
              PAYONE
            </Text>
          </View>
        </View>

        <Text style={{
          color: '#FFFFFFCC', fontSize: 11, fontWeight: '900', letterSpacing: 1.4,
          marginTop: space.xl,
        }}>
          PAYING
        </Text>
        <Text style={{
          color: '#FFF', fontSize: typo.title, fontWeight: '900', letterSpacing: -0.4,
          marginTop: 2,
        }}
        numberOfLines={1}>
          {merchantName}
        </Text>
      </LinearGradient>

      {/* Body */}
      <View style={{ flex: 1, padding: space.xl, gap: space.xl, justifyContent: 'space-between' }}>
        {/* Amount breakdown */}
        <View style={{
          backgroundColor: theme.surface, borderRadius: radius.xl, padding: space.xl,
          borderWidth: 1, borderColor: theme.border,
          shadowColor: '#000', shadowOpacity: 0.05,
          shadowRadius: 12, shadowOffset: { width: 0, height: 4 },
          gap: space.md,
        }}>
          <Row label="Base" value={baseCents > 0 ? fmtEur(baseCents) : '—'} muted />
          {discountCents > 0 && (
            <Row label="Stadtpuls discount" value={`− ${fmtEur(discountCents)}`} accent />
          )}
          <View style={{ height: 1, backgroundColor: theme.border, marginVertical: 2 }} />
          <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' }}>
            <Text style={{ color: theme.textMuted, fontSize: 12, fontWeight: '900', letterSpacing: 1 }}>
              YOU PAY
            </Text>
            <Text style={{
              color: theme.text, fontSize: 36, fontWeight: '900',
              letterSpacing: -1.2, fontVariant: ['tabular-nums'],
            }}>
              {fmtEur(totalCents)}
            </Text>
          </View>
        </View>

        <AnimatePresence>
          {phase === 'success' ? (
            <MotiView
              key="success"
              from={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={{ type: 'spring', damping: 14, stiffness: 220 }}
              style={{ alignItems: 'center', gap: space.md, paddingVertical: space.lg }}
            >
              <View style={{
                width: 76, height: 76, borderRadius: 38,
                backgroundColor: theme.success + '18',
                alignItems: 'center', justifyContent: 'center',
                borderWidth: 2, borderColor: theme.success + '55',
              }}>
                <Text style={{ fontSize: 40 }}>✓</Text>
              </View>
              <Text style={{
                color: theme.success, fontSize: typo.title, fontWeight: '900',
                letterSpacing: -0.3,
              }}>
                Payment confirmed
              </Text>
              <Text style={{
                color: theme.textMuted, fontSize: typo.small, fontWeight: '700',
                textAlign: 'center', maxWidth: 280,
              }}>
                Discount applied. Your receipt is on the way.
              </Text>
            </MotiView>
          ) : (
            <MotiView
              key="slide"
              from={{ opacity: 0, translateY: 8 }}
              animate={{ opacity: 1, translateY: 0 }}
              exit={{ opacity: 0 }}
              transition={{ type: 'timing', duration: 280 }}
              style={{ gap: space.md }}
            >
              <SlideToPay
                amountCents={totalCents}
                label="Slide to pay"
                processingLabel="Processing…"
                confirmedLabel="Done"
                accent={theme.primary}
                onConfirm={onConfirm}
              />
              <Text style={{
                color: theme.textMuted, fontSize: 11, fontWeight: '700',
                textAlign: 'center', lineHeight: 16,
              }}>
                Powered by Payone · Sparkassen-Konto secured & encrypted
              </Text>
            </MotiView>
          )}
        </AnimatePresence>
      </View>
    </View>
  );
}

// Compact name/value row used in the amount-breakdown card.
function Row({ label, value, muted, accent }: {
  label: string; value: string; muted?: boolean; accent?: boolean;
}) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' }}>
      <Text style={{
        color: muted ? theme.textMuted : theme.text,
        fontSize: typo.small, fontWeight: '700',
      }}>
        {label}
      </Text>
      <Text style={{
        color: accent ? theme.success : theme.text,
        fontSize: typo.body, fontWeight: '900',
        fontVariant: ['tabular-nums'],
      }}>
        {value}
      </Text>
    </View>
  );
}
