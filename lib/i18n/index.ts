import { I18n } from 'i18n-js';
import * as Localization from 'expo-localization';
import de from './de.json';
import en from './en.json';

const i18n = new I18n({ de, en });
i18n.locale = Localization.getLocales()[0]?.languageCode ?? 'de';
i18n.defaultLocale = 'de';
i18n.enableFallback = true;

export default i18n;
export type Locale = 'de' | 'en';
export function getLocale(): Locale {
  const code = Localization.getLocales()[0]?.languageCode ?? 'de';
  return code === 'en' ? 'en' : 'de';
}
