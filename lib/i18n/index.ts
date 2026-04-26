import { I18n } from 'i18n-js';
import en from './en.json';

// English-only build. The German locale + runtime toggle were removed
// per product decision — keeping a single language drastically reduces
// surface area for missing-translation bugs in a hackathon demo.
const i18n = new I18n({ en });

i18n.locale = 'en';
i18n.defaultLocale = 'en';
i18n.enableFallback = true;

export default i18n;
export type Locale = 'en';

export function getLocale(): Locale {
  return 'en';
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

// Kept as a no-op so existing callers compile. With the language toggle
// removed there's nothing to re-render; the hook just returns 'en'.
export function useLocaleVersion(): 'en' {
  const [, bump] = useReducer((x: number) => x + 1, 0);
  useEffect(() => subscribeLocale(bump), []);
  return 'en';
}

// No-op kept for caller compatibility; locale is fixed to 'en'.
export async function setLocale(_locale: Locale) {
  // Intentionally empty — the app is English-only.
}
