import React, { useEffect } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { MotiView } from 'moti';
import * as Haptics from 'expo-haptics';
import { WidgetSpecType } from '../widget-spec';

interface Props {
  spec: WidgetSpecType;
  offerId?: string;
  onAccept: () => void;
  onDecline: () => void;
}

export default function StickerLayout({ spec, onAccept, onDecline }: Props) {
  const { palette, headline, subline, cta, signal_chips, discount, merchant } = spec;

  // Slap-down haptic on entrance — playful sticker dropping onto the page.
  useEffect(() => {
    const t = setTimeout(() => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
    }, 180);
    return () => clearTimeout(t);
  }, []);

  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: 'transparent' }}>
      <MotiView
        from={{ opacity: 0, rotate: '8deg', scale: 1.2 }}
        animate={{ opacity: 1, rotate: '-3deg', scale: 1 }}
        transition={{ type: 'spring', stiffness: 220, damping: 11, mass: 1 }}
        style={{
          width: '85%',
          backgroundColor: palette.bg,
          borderRadius: 24,
          borderWidth: 4,
          borderColor: palette.accent,
          padding: 24,
          // Paper shadow — offset more dramatically + softer feathering.
          shadowColor: '#000',
          shadowOffset: { width: 6, height: 12 },
          shadowOpacity: 0.28,
          shadowRadius: 18,
          elevation: 12,
        }}
      >
        {/* Hero glyph */}
        <Text style={{ fontSize: 48, textAlign: 'center', marginBottom: 8 }}>
          {spec.hero.value.length <= 2 ? spec.hero.value : '🎉'}
        </Text>

        <Text style={{
          fontSize: 24, fontWeight: '900', color: palette.fg,
          textAlign: 'center', lineHeight: 30, fontStyle: 'italic'
        }}>
          {headline}
        </Text>

        <Text style={{ color: palette.fg + 'AA', fontSize: 14, textAlign: 'center', marginTop: 8 }}>
          {subline}
        </Text>

        <Text style={{ color: palette.accent, fontSize: 20, fontWeight: '900', textAlign: 'center', marginTop: 10 }}>
          {discount.kind === 'pct' ? `${discount.value} %` :
           discount.kind === 'eur' ? `${discount.value.toFixed(2).replace('.', ',')} €` : ''}
          {discount.constraint ? `\n${discount.constraint}` : ''}
        </Text>

        {/* Signal chips */}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', marginTop: 12, gap: 5 }}>
          {signal_chips.map((chip, i) => (
            <View key={i} style={{
              backgroundColor: palette.accent + '25',
              borderRadius: 10, paddingHorizontal: 10, paddingVertical: 4,
              borderWidth: 1, borderColor: palette.accent + '44'
            }}>
              <Text style={{ color: palette.fg, fontSize: 11, fontWeight: '700' }}>{chip}</Text>
            </View>
          ))}
        </View>

        <Text style={{ color: palette.fg + '66', fontSize: 12, textAlign: 'center', marginTop: 8 }}>
          {merchant.name} · {Math.round(merchant.distance_m)} m
        </Text>

        <TouchableOpacity
          onPress={onAccept}
          style={{
            backgroundColor: palette.accent, borderRadius: 16,
            paddingVertical: 14, alignItems: 'center', marginTop: 16
          }}
        >
          <Text style={{ color: palette.bg, fontSize: 16, fontWeight: '800' }}>{cta}</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={onDecline} style={{ alignItems: 'center', marginTop: 8 }}>
          <Text style={{ color: palette.fg + '55', fontSize: 13 }}>Verstanden</Text>
        </TouchableOpacity>
      </MotiView>
    </View>
  );
}
