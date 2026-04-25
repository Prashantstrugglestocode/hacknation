import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { MotiView } from 'moti';
import { WidgetSpecType } from '../widget-spec';

interface Props {
  spec: WidgetSpecType;
  onAccept: () => void;
  onDecline: () => void;
}

export default function CompactLayout({ spec, onAccept, onDecline }: Props) {
  const { palette, headline, subline, cta, signal_chips, discount, merchant } = spec;

  return (
    <MotiView
      from={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ type: 'timing', duration: 400 }}
      style={{ borderRadius: 16, overflow: 'hidden', backgroundColor: palette.bg }}
    >
      {/* Compact horizontal row */}
      <View style={{ flexDirection: 'row', alignItems: 'center', padding: 16, height: 80 }}>
        <View style={{
          width: 48, height: 48, borderRadius: 12,
          backgroundColor: palette.accent + '22',
          alignItems: 'center', justifyContent: 'center', marginRight: 12
        }}>
          <Text style={{ fontSize: 22 }}>{spec.hero.value.length <= 2 ? spec.hero.value : '🏪'}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ color: palette.fg, fontSize: 15, fontWeight: '700' }} numberOfLines={1}>{headline}</Text>
          <Text style={{ color: palette.fg + '88', fontSize: 12 }} numberOfLines={1}>{subline}</Text>
        </View>
        <TouchableOpacity
          onPress={onAccept}
          style={{ backgroundColor: palette.accent, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8 }}
        >
          <Text style={{ color: palette.bg, fontSize: 13, fontWeight: '700' }}>{cta}</Text>
        </TouchableOpacity>
      </View>

      {/* Signal chips + discount below */}
      <View style={{ paddingHorizontal: 16, paddingBottom: 14 }}>
        <Text style={{ color: palette.accent, fontSize: 14, fontWeight: '700' }}>
          {discount.kind === 'pct' ? `−${discount.value} %` :
           discount.kind === 'eur' ? `−${discount.value.toFixed(2).replace('.', ',')} €` : ''}
          {discount.constraint ? ` · ${discount.constraint}` : ''}
          {' · '}{merchant.name} · {Math.round(merchant.distance_m)} m
        </Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 6, gap: 4 }}>
          {signal_chips.map((chip, i) => (
            <View key={i} style={{ backgroundColor: palette.accent + '18', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 }}>
              <Text style={{ color: palette.fg, fontSize: 11 }}>{chip}</Text>
            </View>
          ))}
        </View>
        <TouchableOpacity onPress={onDecline} style={{ marginTop: 8 }}>
          <Text style={{ color: palette.fg + '55', fontSize: 12 }}>Verstanden</Text>
        </TouchableOpacity>
      </View>
    </MotiView>
  );
}
