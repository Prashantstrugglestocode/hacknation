import React, { useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { MotiView } from 'moti';
import { LinearGradient } from 'expo-linear-gradient';
import { WidgetSpecType } from '../widget-spec';
import { entryTransition, pressTransition } from '../mood';
import i18n from '../../i18n';

interface Props {
  spec: WidgetSpecType;
  offerId?: string;
  onAccept: () => void;
  onDecline: () => void;
}

// Discreet, factual layout. Boarding-pass / credit-card density —
// wide horizontal card that intentionally sits short on the screen.
export default function CompactLayout({ spec, onAccept, onDecline }: Props) {
  const { palette, mood, headline, subline, cta, signal_chips, discount, merchant, pressure } = spec;
  const [pressed, setPressed] = useState(false);

  const distance = merchant.distance_m < 1000
    ? `${Math.round(merchant.distance_m)} m`
    : `${(merchant.distance_m / 1000).toFixed(1).replace('.', ',')} km`;

  const discountText =
    discount.kind === 'pct' ? `−${discount.value} %` :
    discount.kind === 'eur' ? `−${discount.value.toFixed(2).replace('.', ',')} €` :
    discount.constraint ?? cta;

  return (
    <View style={{ flex: 1, justifyContent: 'flex-start', paddingTop: 8 }}>
      <MotiView
        from={{ opacity: 0, translateY: 8 }}
        animate={{ opacity: 1, translateY: 0 }}
        transition={entryTransition(mood)}
        style={{
          flexDirection: 'row',
          minHeight: 168,
          borderRadius: 18,
          overflow: 'hidden',
          backgroundColor: palette.bg,
          shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 14, shadowOffset: { width: 0, height: 6 },
          elevation: 4,
        }}
      >
        {/* Left accent strip */}
        <LinearGradient
          colors={[palette.accent, palette.accent + 'DD'] as any}
          start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }}
          style={{ width: 86, alignItems: 'center', justifyContent: 'space-between', paddingVertical: 16 }}
        >
          <Text style={{ fontSize: 36 }}>{spec.hero.value.length <= 2 ? spec.hero.value : '🏪'}</Text>
          <View style={{
            backgroundColor: '#FFFFFF22', borderRadius: 999,
            paddingHorizontal: 8, paddingVertical: 3,
          }}>
            <Text style={{ color: palette.bg, fontSize: 11, fontWeight: '900', letterSpacing: 0.4 }}>
              {discountText}
            </Text>
          </View>
        </LinearGradient>

        {/* Right info column */}
        <View style={{ flex: 1, padding: 14, justifyContent: 'space-between' }}>
          <View style={{ gap: 4 }}>
            <Text
              style={{ color: palette.fg, fontSize: 16, fontWeight: '800', lineHeight: 20, letterSpacing: -0.2 }}
              numberOfLines={2}
            >
              {headline}
            </Text>
            <Text
              style={{ color: palette.fg + 'B0', fontSize: 12, lineHeight: 16 }}
              numberOfLines={2}
            >
              {subline}
            </Text>
          </View>

          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 4 }}>
            {signal_chips.slice(0, 3).map((chip, i) => (
              <View
                key={i}
                style={{
                  backgroundColor: palette.fg + '14',
                  borderRadius: 7, paddingHorizontal: 7, paddingVertical: 2,
                }}
              >
                <Text style={{ color: palette.fg, fontSize: 10, fontWeight: '700' }}>{chip}</Text>
              </View>
            ))}
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 6 }}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: palette.fg + '88', fontSize: 11, fontWeight: '700' }} numberOfLines={1}>
                📍 {merchant.name} · {distance}
              </Text>
              {pressure ? (
                <Text style={{ color: palette.accent, fontSize: 11, fontWeight: '800', marginTop: 1 }}>
                  {pressure.kind === 'time' ? '⏱ ' : '📦 '}{pressure.value}
                </Text>
              ) : null}
            </View>
            <MotiView
              animate={{ scale: pressed ? 0.94 : 1 }}
              transition={pressTransition(mood)}
            >
              <Pressable
                onPressIn={() => setPressed(true)}
                onPressOut={() => setPressed(false)}
                onPress={onAccept}
                style={{
                  backgroundColor: palette.accent,
                  borderRadius: 11, paddingHorizontal: 16, paddingVertical: 9,
                }}
              >
                <Text style={{ color: palette.bg, fontSize: 13, fontWeight: '900', letterSpacing: 0.3 }}>
                  {cta}
                </Text>
              </Pressable>
            </MotiView>
          </View>
        </View>
      </MotiView>

      <Pressable onPress={onDecline} style={{ alignSelf: 'center', marginTop: 12 }} hitSlop={10}>
        <Text style={{ color: palette.fg + '55', fontSize: 13, fontWeight: '600' }}>{i18n.t('customer.decline')}</Text>
      </Pressable>
    </View>
  );
}
