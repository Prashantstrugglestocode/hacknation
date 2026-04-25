import React from 'react';
import { View, Text, TouchableOpacity, Dimensions } from 'react-native';
import { MotiView } from 'moti';
import { LinearGradient } from 'expo-linear-gradient';
import { WidgetSpecType } from '../widget-spec';

const { width } = Dimensions.get('window');

interface Props {
  spec: WidgetSpecType;
  onAccept: () => void;
  onDecline: () => void;
}

export default function HeroLayout({ spec, onAccept, onDecline }: Props) {
  const { palette, headline, subline, cta, signal_chips, pressure, discount, merchant } = spec;

  const gradientColors = spec.hero.type === 'gradient'
    ? [palette.accent, palette.bg] as const
    : [palette.bg, palette.bg] as const;

  return (
    <MotiView
      from={{ opacity: 0, translateY: 20 }}
      animate={{ opacity: 1, translateY: 0 }}
      transition={{ type: 'timing', duration: 600 }}
      style={{ flex: 1, borderRadius: 20, overflow: 'hidden', backgroundColor: palette.bg }}
    >
      {/* Hero top 60% */}
      <LinearGradient colors={gradientColors} style={{ height: '60%', justifyContent: 'flex-end', padding: 20 }}>
        <Text style={{ fontSize: 28, fontWeight: '800', color: palette.fg, lineHeight: 34 }}>
          {headline}
        </Text>
        {/* Signal chips */}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 8, gap: 6 }}>
          {signal_chips.map((chip, i) => (
            <View key={i} style={{ backgroundColor: palette.fg + '22', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4 }}>
              <Text style={{ color: palette.fg, fontSize: 12, fontWeight: '600' }}>{chip}</Text>
            </View>
          ))}
        </View>
      </LinearGradient>

      {/* Bottom section */}
      <View style={{ flex: 1, padding: 20, justifyContent: 'space-between' }}>
        <View>
          <Text style={{ color: palette.fg, fontSize: 15, lineHeight: 22 }}>{subline}</Text>
          <Text style={{ color: palette.accent, fontSize: 18, fontWeight: '700', marginTop: 8 }}>
            {discount.kind === 'pct' ? `${discount.value} % Rabatt` :
             discount.kind === 'eur' ? `${discount.value.toFixed(2).replace('.', ',')} € Rabatt` :
             discount.constraint ?? cta}
            {discount.constraint ? ` — ${discount.constraint}` : ''}
          </Text>
          <Text style={{ color: palette.fg + '88', fontSize: 12, marginTop: 4 }}>
            {merchant.name} · {merchant.distance_m < 1000
              ? `${Math.round(merchant.distance_m)} m`
              : `${(merchant.distance_m / 1000).toFixed(1).replace('.', ',')} km`}
          </Text>
          {pressure && (
            <Text style={{ color: palette.accent, fontSize: 13, marginTop: 4, fontWeight: '600' }}>
              {pressure.value}
            </Text>
          )}
        </View>

        <TouchableOpacity
          onPress={onAccept}
          style={{ backgroundColor: palette.accent, borderRadius: 14, paddingVertical: 16, alignItems: 'center' }}
        >
          <Text style={{ color: palette.bg, fontSize: 17, fontWeight: '700' }}>{cta}</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={onDecline} style={{ alignItems: 'center', marginTop: 8 }}>
          <Text style={{ color: palette.fg + '66', fontSize: 14 }}>Verstanden</Text>
        </TouchableOpacity>
      </View>
    </MotiView>
  );
}
