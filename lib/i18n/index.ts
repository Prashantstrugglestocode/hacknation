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

export async function setLocale(locale: Locale) {
  i18n.locale = locale;
  await AsyncStorage.setItem(STORAGE_KEY, locale);
}
