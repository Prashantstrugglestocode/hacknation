import React, { useState } from 'react';
import { View, Text, Pressable, Share } from 'react-native';
import { MotiView } from 'moti';
import { WidgetSpecType } from '../widget-spec';
import { entryTransition, chipDelay, pressTransition, ctaPulseConfig } from '../mood';
import HeroVisual from './HeroVisual';
import SaveHeart from '../../components/SaveHeart';
import i18n from '../../i18n';
import { space, radius, type as typo } from '../../theme';

interface Props {
  spec: WidgetSpecType;
  offerId?: string;
  onAccept: () => void;
  onDecline: () => void;
}

export default function HeroLayout({ spec, offerId, onAccept, onDecline }: Props) {
  const { palette, mood, headline, subline, cta, signal_chips, pressure, discount, merchant } = spec;
  const [pressed, setPressed] = useState(false);
  const ctaPulse = ctaPulseConfig(mood);

  const distance =
    merchant.distance_m < 1000
      ? `${Math.round(merchant.distance_m)} m`
      : `${(merchant.distance_m / 1000).toFixed(1).replace('.', ',')} km`;

  const formattedDiscount =
    discount.kind === 'pct' ? `${discount.value} % Rabatt` :
    discount.kind === 'eur' ? `${discount.value.toFixed(2).replace('.', ',')} € Rabatt` :
    discount.constraint ?? cta;

  return (
    <MotiView
      from={{ opacity: 0, translateY: 24, scale: 0.985 }}
      animate={{ opacity: 1, translateY: 0, scale: 1 }}
      transition={entryTransition(mood)}
      style={{
        flex: 1,
        borderRadius: radius.xl,
        overflow: 'hidden',
        backgroundColor: palette.bg,
        shadowColor: palette.accent,
        shadowOpacity: 0.18,
        shadowRadius: 20,
        shadowOffset: { width: 0, height: 10 },
      }}
    >
      <HeroVisual spec={spec} height="60%">
        {offerId && (
          <View style={{
            position: 'absolute', top: space.md, right: space.md, zIndex: 2,
            flexDirection: 'row', gap: space.xs,
          }}>
            <Pressable
              onPress={async () => {
                try {
                  await Share.share({
                    message: `${headline} bei ${merchant.name} — ${discount.kind === 'pct' ? `${discount.value} % Rabatt` : 'spar dir was'} · Stadtpuls\ncitywallet://offer/${offerId}`,
                  });
                } catch {}
              }}
              hitSlop={8}
              style={{
                width: 40, height: 40, borderRadius: 20,
                backgroundColor: '#00000044', alignItems: 'center', justifyContent: 'center',
              }}
            >
              <Text style={{ fontSize: typo.bodyL }}>↗</Text>
            </Pressable>
            <SaveHeart offerId={offerId} />
          </View>
        )}

        {/* Signal chips with smoother cascade entrance */}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: space.md, gap: space.xs }}>
          {signal_chips.map((chip, i) => (
            <MotiView
              key={i}
              from={{ scale: 0.6, opacity: 0, translateY: 6 }}
              animate={{ scale: 1, opacity: 1, translateY: 0 }}
              transition={{
                type: 'spring',
                damping: 13, stiffness: 220, mass: 0.9,
                delay: chipDelay(mood, i),
              }}
              style={{
                backgroundColor: palette.fg + '22',
                borderRadius: radius.pill,
                paddingHorizontal: space.md, paddingVertical: space.xs + 1,
                borderWidth: 1, borderColor: palette.fg + '33',
              }}
            >
              <Text style={{
                color: palette.fg, fontSize: typo.small,
                fontWeight: '700', letterSpacing: 0.3,
              }}>
                {chip}
              </Text>
            </MotiView>
          ))}
        </View>

        {/* Headline */}
        <MotiView
          from={{ opacity: 0, translateY: 8 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{ ...entryTransition(mood), delay: 80 }}
        >
          <Text style={{
            fontSize: typo.display + 2, fontWeight: '900', color: palette.fg,
            lineHeight: typo.display + 6, letterSpacing: -0.7,
          }}>
            {headline}
          </Text>
        </MotiView>
      </HeroVisual>

      <View style={{
        flex: 1,
        padding: space['2xl'],
        gap: space.lg,
        justifyContent: 'space-between',
      }}>
        <View style={{ gap: space.sm }}>
          <Text style={{
            color: palette.fg, fontSize: typo.body,
            lineHeight: typo.body + 8, opacity: 0.92,
          }}>
            {subline}
          </Text>

          {/* Discount line — bigger weight + own row */}
          <Text style={{
            color: palette.accent, fontSize: typo.bodyL + 2,
            fontWeight: '900', letterSpacing: -0.4,
          }}>
            {formattedDiscount}
            {discount.constraint && discount.kind !== 'item' ? ` · ${discount.constraint}` : ''}
          </Text>

          {/* Merchant + distance */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.xs }}>
            <Text style={{ fontSize: typo.small }}>📍</Text>
            <Text style={{
              color: palette.fg + '99', fontSize: typo.small,
              fontWeight: '600', letterSpacing: 0.1,
            }}>
              {merchant.name} · {distance}
            </Text>
          </View>

          {pressure && (
            <MotiView
              from={{ opacity: 0, scale: 0.85, translateX: -4 }}
              animate={{ opacity: 1, scale: 1, translateX: 0 }}
              transition={{ delay: 240, type: 'spring', damping: 14, stiffness: 220 }}
              style={{
                alignSelf: 'flex-start',
                flexDirection: 'row', alignItems: 'center', gap: space.xs,
                backgroundColor: palette.accent + '22',
                paddingHorizontal: space.md, paddingVertical: space.xs + 1,
                borderRadius: radius.sm,
              }}
            >
              <Text style={{ fontSize: typo.caption }}>{pressure.kind === 'time' ? '⏱' : '📦'}</Text>
              <Text style={{
                color: palette.accent, fontSize: typo.small,
                fontWeight: '800', letterSpacing: 0.2,
              }}>
                {pressure.value}
              </Text>
            </MotiView>
          )}
        </View>

        {/* CTA stack */}
        <View style={{ gap: space.sm }}>
          <MotiView
            animate={{ scale: pressed ? 0.97 : 1, ...(ctaPulse?.animate ?? {}) }}
            transition={ctaPulse?.transition ?? pressTransition(mood)}
          >
            <Pressable
              onPressIn={() => setPressed(true)}
              onPressOut={() => setPressed(false)}
              onPress={onAccept}
              style={{
                backgroundColor: palette.accent,
                borderRadius: radius.lg,
                paddingVertical: space.lg + 2,
                alignItems: 'center',
                shadowColor: palette.accent,
                shadowOpacity: 0.45,
                shadowRadius: 16,
                shadowOffset: { width: 0, height: 8 },
              }}
            >
              <Text style={{
                color: palette.bg, fontSize: typo.bodyL + 1,
                fontWeight: '900', letterSpacing: 0.4,
              }}>
                {cta}
              </Text>
            </Pressable>
          </MotiView>

          <Pressable onPress={onDecline} style={{ alignItems: 'center', paddingVertical: space.xs }}>
            <Text style={{
              color: palette.fg + '66', fontSize: typo.small,
              fontWeight: '700', letterSpacing: 0.3,
            }}>
              {i18n.t('customer.decline')}
            </Text>
          </Pressable>
        </View>
      </View>
    </MotiView>
  );
}
