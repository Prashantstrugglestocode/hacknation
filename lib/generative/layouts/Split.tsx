import React from 'react';
import { View, Text, TouchableOpacity, Dimensions } from 'react-native';
import { MotiView } from 'moti';
import { LinearGradient } from 'expo-linear-gradient';
import { WidgetSpecType } from '../widget-spec';

const { height } = Dimensions.get('window');

interface Props {
  spec: WidgetSpecType;
  offerId?: string;
  onAccept: () => void;
  onDecline: () => void;
}

export default function SplitLayout({ spec, onAccept, onDecline }: Props) {
  const { palette, headline, subline, cta, signal_chips, discount, merchant, pressure } = spec;

  return (
    <MotiView
      from={{ opacity: 0, translateX: -30 }}
      animate={{ opacity: 1, translateX: 0 }}
      transition={{ type: 'spring', stiffness: 200, damping: 20 }}
      style={{ flex: 1, borderRadius: 20, overflow: 'hidden', flexDirection: 'row' }}
    >
      {/* Left: full bleed pattern/color */}
      <LinearGradient
        colors={[palette.accent, palette.bg]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ width: '45%', alignItems: 'center', justifyContent: 'center' }}
      >
        <Text style={{ fontSize: 56 }}>{spec.hero.value.length <= 2 ? spec.hero.value : '⚡'}</Text>
        {/* Signal chips on left panel */}
        <View style={{ marginTop: 12, alignItems: 'center', gap: 4 }}>
          {signal_chips.slice(0, 2).map((chip, i) => (
            <View key={i} style={{ backgroundColor: '#ffffff33', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3 }}>
              <Text style={{ color: palette.fg, fontSize: 11, fontWeight: '700' }}>{chip}</Text>
            </View>
          ))}
        </View>
      </LinearGradient>

      {/* Right: text + CTA */}
      <View style={{ flex: 1, backgroundColor: palette.bg, padding: 16, justifyContent: 'space-between' }}>
        <View>
          <Text style={{ color: palette.fg, fontSize: 20, fontWeight: '800', lineHeight: 26 }}>{headline}</Text>
          <Text style={{ color: palette.fg + '99', fontSize: 13, marginTop: 8, lineHeight: 18 }}>{subline}</Text>
          <Text style={{ color: palette.accent, fontSize: 16, fontWeight: '700', marginTop: 8 }}>
            {discount.kind === 'pct' ? `${discount.value} % Rabatt` : `${discount.value.toFixed(2).replace('.', ',')} €`}
          </Text>
          <Text style={{ color: palette.fg + '66', fontSize: 11, marginTop: 4 }}>
            {merchant.name} · {Math.round(merchant.distance_m)} m
          </Text>
          {pressure && (
            <Text style={{ color: palette.accent, fontSize: 12, marginTop: 4, fontWeight: '600' }}>
              {pressure.value}
            </Text>
          )}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 8, gap: 4 }}>
            {signal_chips.slice(2).map((chip, i) => (
              <View key={i} style={{ backgroundColor: palette.accent + '18', borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2 }}>
                <Text style={{ color: palette.fg, fontSize: 10 }}>{chip}</Text>
              </View>
            ))}
          </View>
        </View>

        <View>
          <TouchableOpacity
            onPress={onAccept}
            style={{ backgroundColor: palette.accent, borderRadius: 12, paddingVertical: 13, alignItems: 'center' }}
          >
            <Text style={{ color: palette.bg, fontSize: 15, fontWeight: '700' }}>{cta}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={onDecline} style={{ alignItems: 'center', marginTop: 8 }}>
            <Text style={{ color: palette.fg + '55', fontSize: 12 }}>Verstanden</Text>
          </TouchableOpacity>
        </View>
      </View>
    </MotiView>
  );
}
