import React from 'react';
import { View, Text, TouchableOpacity, Dimensions, StatusBar } from 'react-native';
import { MotiView } from 'moti';
import { WidgetSpecType } from '../widget-spec';

const { height } = Dimensions.get('window');

interface Props {
  spec: WidgetSpecType;
  onAccept: () => void;
  onDecline: () => void;
}

export default function FullbleedLayout({ spec, onAccept, onDecline }: Props) {
  const { palette, headline, subline, cta, signal_chips, discount, merchant, pressure } = spec;

  return (
    <MotiView
      from={{ opacity: 0, scale: 1.04 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ type: 'spring', stiffness: 300, damping: 18 }}
      style={{ flex: 1, backgroundColor: palette.bg, borderRadius: 20, overflow: 'hidden' }}
    >
      {/* Full bleed content — centered */}
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 }}>
        <Text style={{ fontSize: 52, marginBottom: 16 }}>{spec.hero.value.length <= 2 ? spec.hero.value : '🔥'}</Text>
        <Text style={{
          fontSize: 34, fontWeight: '900', color: palette.fg,
          textAlign: 'center', lineHeight: 40, letterSpacing: -0.5
        }}>
          {headline}
        </Text>
        <Text style={{
          fontSize: 16, color: palette.fg + 'BB', textAlign: 'center',
          marginTop: 12, lineHeight: 22
        }}>
          {subline}
        </Text>

        {/* Discount + pressure — urgent, factual */}
        <View style={{
          backgroundColor: palette.accent,
          borderRadius: 16, paddingHorizontal: 24, paddingVertical: 12,
          marginTop: 20
        }}>
          <Text style={{ color: palette.bg, fontSize: 22, fontWeight: '900', textAlign: 'center' }}>
            {discount.kind === 'pct' ? `−${discount.value} %` :
             discount.kind === 'eur' ? `−${discount.value.toFixed(2).replace('.', ',')} €` : cta}
          </Text>
          {pressure && (
            <Text style={{ color: palette.bg + 'DD', fontSize: 13, textAlign: 'center', marginTop: 2 }}>
              {pressure.value}
            </Text>
          )}
        </View>

        <Text style={{ color: palette.fg + '66', fontSize: 13, marginTop: 12 }}>
          {merchant.name} · {Math.round(merchant.distance_m)} m
        </Text>

        {/* Signal chips */}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', marginTop: 16, gap: 6 }}>
          {signal_chips.map((chip, i) => (
            <View key={i} style={{ backgroundColor: palette.fg + '18', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 5 }}>
              <Text style={{ color: palette.fg, fontSize: 12, fontWeight: '600' }}>{chip}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* CTA pinned bottom */}
      <View style={{ paddingHorizontal: 24, paddingBottom: 32 }}>
        <TouchableOpacity
          onPress={onAccept}
          style={{ backgroundColor: palette.accent, borderRadius: 16, paddingVertical: 18, alignItems: 'center' }}
        >
          <Text style={{ color: palette.bg, fontSize: 18, fontWeight: '800' }}>{cta}</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={onDecline} style={{ alignItems: 'center', marginTop: 12 }}>
          <Text style={{ color: palette.fg + '66', fontSize: 14 }}>Verstanden</Text>
        </TouchableOpacity>
      </View>
    </MotiView>
  );
}
