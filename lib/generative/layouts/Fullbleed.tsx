import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { MotiView } from 'moti';
import { WidgetSpecType } from '../widget-spec';
import { entryTransition, ctaPulseConfig } from '../mood';
import i18n from '../../i18n';

interface Props {
  spec: WidgetSpecType;
  offerId?: string;
  onAccept: () => void;
  onDecline: () => void;
}

export default function FullbleedLayout({ spec, onAccept, onDecline }: Props) {
  const { palette, mood, headline, subline, cta, signal_chips, discount, merchant, pressure } = spec;
  const ctaPulse = ctaPulseConfig(mood);

  return (
    <MotiView
      from={{ opacity: 0, scale: 1.06 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={entryTransition(mood)}
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

        {/* Discount + pressure — urgent, factual; pulses on urgent mood */}
        <MotiView
          animate={mood === 'urgent' ? { scale: [1, 1.04, 1] as any } : { scale: 1 }}
          transition={mood === 'urgent'
            ? { type: 'timing', duration: 1100, loop: true }
            : { type: 'timing', duration: 0 }}
          style={{
            backgroundColor: palette.accent,
            borderRadius: 16, paddingHorizontal: 24, paddingVertical: 12,
            marginTop: 20,
            shadowColor: palette.accent, shadowOpacity: 0.5, shadowRadius: 14, shadowOffset: { width: 0, height: 6 },
          }}
        >
          <Text style={{ color: palette.bg, fontSize: 22, fontWeight: '900', textAlign: 'center' }}>
            {discount.kind === 'pct' ? `−${discount.value} %` :
             discount.kind === 'eur' ? `−${discount.value.toFixed(2).replace('.', ',')} €` : cta}
          </Text>
          {pressure && (
            <Text style={{ color: palette.bg + 'DD', fontSize: 13, textAlign: 'center', marginTop: 2 }}>
              {pressure.value}
            </Text>
          )}
        </MotiView>

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
        <MotiView
          animate={ctaPulse?.animate ?? { scale: 1 }}
          transition={ctaPulse?.transition ?? { type: 'timing', duration: 0 }}
        >
          <TouchableOpacity
            onPress={onAccept}
            style={{
              backgroundColor: palette.accent, borderRadius: 16, paddingVertical: 18, alignItems: 'center',
              shadowColor: palette.accent, shadowOpacity: 0.4, shadowRadius: 14, shadowOffset: { width: 0, height: 6 },
            }}
          >
            <Text style={{ color: palette.bg, fontSize: 18, fontWeight: '800' }}>{cta}</Text>
          </TouchableOpacity>
        </MotiView>
        <TouchableOpacity onPress={onDecline} style={{ alignItems: 'center', marginTop: 12 }}>
          <Text style={{ color: palette.fg + '66', fontSize: 14 }}>{i18n.t('customer.decline')}</Text>
        </TouchableOpacity>
      </View>
    </MotiView>
  );
}
