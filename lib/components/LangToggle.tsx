import React, { useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { MotiView } from 'moti';
import * as Haptics from 'expo-haptics';
import { setLocale, getLocale } from '../i18n';
import { theme } from '../theme';

interface Props {
  // Light variant for use over dark backgrounds (e.g. merchant dashboard hero).
  variant?: 'light' | 'dark';
}

// DE/EN toggle pill — only used inside Settings now.
// Switching locale persists the choice and notifies subscribed components
// (via the `setLocale` listener pub/sub in `lib/i18n`) so any visible
// i18n.t() text re-renders. We deliberately do NOT navigate anywhere on
// toggle: previous versions dismissed the modal or routed through the
// splash, which forced the user to keep re-opening Settings to verify
// the change — that's what felt like an "infinite loop".
export default function LangToggle({ variant = 'dark' }: Props) {
  const [locale, setLocaleState] = useState<'de' | 'en'>(getLocale());

  const switchTo = async (l: 'de' | 'en') => {
    if (l === locale) return;
    Haptics.selectionAsync().catch(() => {});
    await setLocale(l);
    setLocaleState(l);
  };

  const isLight = variant === 'light';
  const trackBg = isLight ? '#FFFFFF22' : theme.bgMuted;
  const border = isLight ? '#FFFFFF33' : theme.border;

  return (
    <View style={{ alignItems: 'flex-start', gap: 8 }}>
      <View style={{
        flexDirection: 'row', alignSelf: 'flex-start',
        backgroundColor: trackBg, borderRadius: 999,
        padding: 4, borderWidth: 1, borderColor: border,
      }}>
        {(['de', 'en'] as const).map(l => {
          const isActive = locale === l;
          const activeBg = isLight ? '#FFFFFF' : theme.primary;
          const activeFg = isLight ? theme.primary : theme.textOnPrimary;
          const restingFg = isLight ? '#FFFFFFCC' : theme.text;
          const flag = l === 'de' ? '🇩🇪' : '🇬🇧';
          return (
            <Pressable key={l} onPress={() => switchTo(l)} hitSlop={8}>
              <View style={{
                backgroundColor: isActive ? activeBg : 'transparent',
                paddingHorizontal: 14, paddingVertical: 7,
                borderRadius: 999,
                flexDirection: 'row', alignItems: 'center', gap: 5,
              }}>
                <Text style={{ fontSize: 13 }}>{flag}</Text>
                <Text style={{
                  color: isActive ? activeFg : restingFg,
                  fontSize: 12, fontWeight: '900', letterSpacing: 0.6,
                }}>
                  {l.toUpperCase()}
                </Text>
              </View>
            </Pressable>
          );
        })}
      </View>
      {/* Live confirmation so the user can SEE the change took. */}
      <MotiView
        key={locale}
        from={{ opacity: 0, translateY: -2 }}
        animate={{ opacity: 1, translateY: 0 }}
        transition={{ type: 'timing', duration: 220 }}
      >
        <Text style={{
          color: isLight ? '#FFFFFFCC' : theme.textMuted,
          fontSize: 11, fontWeight: '700', letterSpacing: 0.4,
        }}>
          {locale === 'de' ? 'Aktiv: Deutsch ✓' : 'Active: English ✓'}
        </Text>
      </MotiView>
    </View>
  );
}
