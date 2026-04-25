import React, { useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { MotiView } from 'moti';
import { LinearGradient } from 'expo-linear-gradient';
import { WidgetSpecType } from '../widget-spec';
import SaveHeart from '../../components/SaveHeart';

interface Props {
  spec: WidgetSpecType;
  offerId?: string;
  onAccept: () => void;
  onDecline: () => void;
}

export default function HeroLayout({ spec, offerId, onAccept, onDecline }: Props) {
  const { palette, headline, subline, cta, signal_chips, pressure, discount, merchant } = spec;
  const [pressed, setPressed] = useState(false);

  const gradientColors = spec.hero.type === 'gradient'
    ? [palette.accent, palette.bg] as const
    : [palette.bg, palette.bg] as const;

  const distance =
    merchant.distance_m < 1000
      ? `${Math.round(merchant.distance_m)} m`
      : `${(merchant.distance_m / 1000).toFixed(1).replace('.', ',')} km`;

  return (
    <MotiView
      from={{ opacity: 0, translateY: 20 }}
      animate={{ opacity: 1, translateY: 0 }}
      transition={{ type: 'spring', damping: 18, stiffness: 160 }}
      style={{ flex: 1, borderRadius: 22, overflow: 'hidden', backgroundColor: palette.bg }}
    >
      <LinearGradient colors={gradientColors} style={{ height: '60%', justifyContent: 'flex-end', padding: 22 }}>
        {offerId && (
          <View style={{ position: 'absolute', top: 14, right: 14, zIndex: 2 }}>
            <SaveHeart offerId={offerId} />
          </View>
        )}

        <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: 12, gap: 6 }}>
          {signal_chips.map((chip, i) => (
            <MotiView
              key={i}
              from={{ scale: 0.7, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', damping: 14, delay: 80 + i * 60 }}
              style={{
                backgroundColor: palette.fg + '22',
                borderRadius: 999,
                paddingHorizontal: 11, paddingVertical: 5,
                borderWidth: 1, borderColor: palette.fg + '33',
              }}
            >
              <Text style={{ color: palette.fg, fontSize: 12, fontWeight: '700', letterSpacing: 0.2 }}>{chip}</Text>
            </MotiView>
          ))}
        </View>

        <Text style={{ fontSize: 30, fontWeight: '900', color: palette.fg, lineHeight: 34, letterSpacing: -0.6 }}>
          {headline}
        </Text>
      </LinearGradient>

      <View style={{ flex: 1, padding: 22, justifyContent: 'space-between' }}>
        <View>
          <Text style={{ color: palette.fg, fontSize: 15, lineHeight: 22, opacity: 0.92 }}>{subline}</Text>
          <Text style={{ color: palette.accent, fontSize: 19, fontWeight: '800', marginTop: 10, letterSpacing: -0.3 }}>
            {discount.kind === 'pct' ? `${discount.value} % Rabatt` :
             discount.kind === 'eur' ? `${discount.value.toFixed(2).replace('.', ',')} € Rabatt` :
             discount.constraint ?? cta}
            {discount.constraint && discount.kind !== 'item' ? ` · ${discount.constraint}` : ''}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 }}>
            <Text style={{ fontSize: 12 }}>📍</Text>
            <Text style={{ color: palette.fg + '99', fontSize: 12, fontWeight: '600' }}>
              {merchant.name} · {distance}
            </Text>
          </View>
          {pressure && (
            <MotiView
              from={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 220, type: 'spring' }}
              style={{
                marginTop: 10,
                alignSelf: 'flex-start',
                flexDirection: 'row', alignItems: 'center', gap: 5,
                backgroundColor: palette.accent + '22',
                paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8,
              }}
            >
              <Text style={{ fontSize: 11 }}>{pressure.kind === 'time' ? '⏱' : '📦'}</Text>
              <Text style={{ color: palette.accent, fontSize: 12, fontWeight: '700' }}>{pressure.value}</Text>
            </MotiView>
          )}
        </View>

        <View>
          <MotiView
            animate={{ scale: pressed ? 0.96 : 1 }}
            transition={{ type: 'spring', damping: 14, stiffness: 320 }}
          >
            <Pressable
              onPressIn={() => setPressed(true)}
              onPressOut={() => setPressed(false)}
              onPress={onAccept}
              style={{
                backgroundColor: palette.accent,
                borderRadius: 16, paddingVertical: 17, alignItems: 'center',
                shadowColor: palette.accent, shadowOpacity: 0.4, shadowRadius: 14, shadowOffset: { width: 0, height: 6 },
              }}
            >
              <Text style={{ color: palette.bg, fontSize: 17, fontWeight: '800', letterSpacing: 0.2 }}>{cta}</Text>
            </Pressable>
          </MotiView>

          <Pressable onPress={onDecline} style={{ alignItems: 'center', marginTop: 10 }}>
            <Text style={{ color: palette.fg + '66', fontSize: 13, fontWeight: '600' }}>Verstanden</Text>
          </Pressable>
        </View>
      </View>
    </MotiView>
  );
}
