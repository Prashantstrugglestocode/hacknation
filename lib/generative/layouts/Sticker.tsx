import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { MotiView } from 'moti';
import { WidgetSpecType } from '../widget-spec';

interface Props {
  spec: WidgetSpecType;
  onAccept: () => void;
  onDecline: () => void;
}

export default function StickerLayout({ spec, onAccept, onDecline }: Props) {
  const { palette, headline, subline, cta, signal_chips, discount, merchant } = spec;

  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: 'transparent' }}>
      <MotiView
        from={{ opacity: 0, rotate: '0deg', scale: 0.85 }}
        animate={{ opacity: 1, rotate: '-3deg', scale: 1 }}
        transition={{ type: 'spring', stiffness: 180, damping: 12, mass: 0.8 }}
        style={{
          width: '85%',
          backgroundColor: palette.bg,
          borderRadius: 24,
          borderWidth: 4,
          borderColor: palette.accent,
          padding: 24,
          shadowColor: '#000',
          shadowOffset: { width: 4, height: 6 },
          shadowOpacity: 0.18,
          shadowRadius: 12,
          elevation: 8,
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
