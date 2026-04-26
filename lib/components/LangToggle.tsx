import React, { useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { setLocale, getLocale } from '../i18n';
import { theme } from '../theme';

interface Props {
  // Light variant for use over dark backgrounds (e.g. merchant dashboard hero).
  variant?: 'light' | 'dark';
}

// DE/EN toggle pill — only used inside Settings now.
// Switching locale routes through the splash so the entire navigation
// tree re-mounts and EVERY i18n.t() call re-evaluates with the new locale.
export default function LangToggle({ variant = 'dark' }: Props) {
  const [locale, setLocaleState] = useState<'de' | 'en'>(getLocale());

  const switchTo = async (l: 'de' | 'en') => {
    if (l === locale) return;
    Haptics.selectionAsync().catch(() => {});
    await setLocale(l);
    setLocaleState(l);
    // Hard-reset navigation through splash → splash routes back to the
    // user's last screen via AsyncStorage, fully re-mounting the tree so
    // every i18n.t() call evaluates against the new locale.
    router.dismissAll?.();
    router.replace('/');
  };

  const isLight = variant === 'light';
  const trackBg = isLight ? '#FFFFFF22' : theme.bgMuted;
  const border = isLight ? '#FFFFFF33' : theme.border;

  return (
    <View style={{
      flexDirection: 'row', alignSelf: 'center',
      backgroundColor: trackBg, borderRadius: 999,
      padding: 3, borderWidth: 1, borderColor: border,
    }}>
      {(['de', 'en'] as const).map(l => {
        const isActive = locale === l;
        const activeBg = isLight ? '#FFFFFF' : theme.primary;
        const activeFg = isLight ? theme.primary : theme.textOnPrimary;
        const restingFg = isLight ? '#FFFFFFCC' : theme.text;
        return (
          <Pressable key={l} onPress={() => switchTo(l)} hitSlop={4}>
            <View style={{
              backgroundColor: isActive ? activeBg : 'transparent',
              paddingHorizontal: 10, paddingVertical: 4,
              borderRadius: 999,
            }}>
              <Text style={{
                color: isActive ? activeFg : restingFg,
                fontSize: 11, fontWeight: '900', letterSpacing: 0.5,
              }}>
                {l.toUpperCase()}
              </Text>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}
