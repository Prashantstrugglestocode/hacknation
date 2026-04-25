import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { MotiView } from 'moti';
import { LinearGradient } from 'expo-linear-gradient';
import { WidgetSpecType } from '../widget-spec';
import { entryTransition } from '../mood';

interface Props {
  spec: WidgetSpecType;
  offerId?: string;
  onAccept: () => void;
  onDecline: () => void;
}

export default function SplitLayout({ spec, onAccept, onDecline }: Props) {
  const { palette, mood, headline, subline, cta, signal_chips, discount, merchant, pressure } = spec;

  return (
    <MotiView
      from={{ opacity: 0, translateX: -40 }}
      animate={{ opacity: 1, translateX: 0 }}
      transition={entryTransition(mood)}
      style={{
        flex: 1, borderRadius: 22, overflow: 'hidden', flexDirection: 'row',
        shadowColor: palette.accent, shadowOpacity: 0.25, shadowRadius: 16, shadowOffset: { width: 0, height: 8 },
      }}
    >
      {/* Left: full-bleed gradient with hero glyph + signal chips */}
      <LinearGradient
        colors={[palette.accent, palette.bg] as any}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ width: '45%', alignItems: 'center', justifyContent: 'center', padding: 12 }}
      >
        <MotiView
          from={{ scale: 0.7, rotate: '-8deg' }}
          animate={{ scale: 1, rotate: '0deg' }}
          transition={{ type: 'spring', delay: 120, damping: 10, stiffness: 220 }}
        >
          <Text style={{ fontSize: 64 }}>{spec.hero.value.length <= 2 ? spec.hero.value : '⚡'}</Text>
        </MotiView>
        <View style={{ marginTop: 14, alignItems: 'center', gap: 5 }}>
          {signal_chips.slice(0, 2).map((chip, i) => (
            <MotiView
              key={i}
              from={{ opacity: 0, translateY: 6 }}
              animate={{ opacity: 1, translateY: 0 }}
              transition={{ delay: 220 + i * 80, type: 'spring', damping: 14 }}
              style={{
                backgroundColor: '#FFFFFF33', borderRadius: 999,
                paddingHorizontal: 10, paddingVertical: 4,
                borderWidth: 1, borderColor: '#FFFFFF55',
              }}
            >
              <Text style={{ color: palette.fg, fontSize: 11, fontWeight: '800' }}>{chip}</Text>
            </MotiView>
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
