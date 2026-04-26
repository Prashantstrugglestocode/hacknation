import { I18n } from 'i18n-js';
import * as Localization from 'expo-localization';
import AsyncStorage from '@react-native-async-storage/async-storage';
import de from './de.json';
import en from './en.json';

const i18n = new I18n({ de, en });

const detected = Localization.getLocales()[0]?.languageCode ?? 'de';
i18n.locale = detected === 'en' ? 'en' : 'de';
i18n.defaultLocale = 'de';
i18n.enableFallback = true;

const STORAGE_KEY = 'cw_locale_v1';

// Restore saved override on boot (fire-and-forget; first read may use detected)
AsyncStorage.getItem(STORAGE_KEY).then(v => {
  if (v === 'de' || v === 'en') i18n.locale = v;
}).catch(() => {});

export default i18n;
export type Locale = 'de' | 'en';

export function getLocale(): Locale {
  return i18n.locale === 'en' ? 'en' : 'de';
}

// Tiny pub/sub so React components can re-render when the locale flips at
// runtime. i18n-js itself has no React reactivity — `i18n.t()` evaluates
// at call time against `i18n.locale`, so we just need a re-render trigger.
import { useEffect, useReducer } from 'react';
type Listener = () => void;
const listeners = new Set<Listener>();
function subscribeLocale(fn: Listener): () => void {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

// Hook: re-renders the calling component whenever locale changes.
// Use in any component whose visible text depends on i18n.t().
export function useLocaleVersion(): 'de' | 'en' {
  const [, bump] = useReducer((x: number) => x + 1, 0);
  useEffect(() => subscribeLocale(bump), []);
  return getLocale();
}

export async function setLocale(locale: Locale) {
  i18n.locale = locale;
  await AsyncStorage.setItem(STORAGE_KEY, locale);
  listeners.forEach(l => { try { l(); } catch {} });
}
