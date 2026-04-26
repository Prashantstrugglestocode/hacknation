// Defensive text-to-speech wrapper. Falls back silently if expo-speech
// isn't bundled. Respects the user's TTS preference (default off so we
// don't autoplay on every offer render).
import { getCachedPrefs, getPrefs } from './preferences';
import { getLocale } from './i18n';

let mod: any = null;

function ensureMod(): any {
  if (mod !== null) return mod;
  try {
    mod = require('expo-speech');
  } catch {
    mod = false;
  }
  return mod;
}

// Warm prefs cache on import so the first call respects the stored setting.
getPrefs().catch(() => {});

export async function speak(text: string, opts: { force?: boolean } = {}) {
  if (!opts.force) {
    // Use the freshest prefs, not the possibly-empty cache.
    const prefs = await getPrefs().catch(() => ({ tts: false } as any));
    if (!prefs.tts) {
      console.log('[tts] skipped — pref off');
      return;
    }
  }
  const m = ensureMod();
  if (!m) {
    console.warn('[tts] expo-speech module not available');
    return;
  }
  try {
    m.stop();
    m.speak(text, {
      language: 'en-US',
      pitch: 1.0,
      rate: 1.0,
    });
    console.log('[tts] speaking:', text.slice(0, 60));
  } catch (e) {
    console.warn('[tts] speak failed:', (e as Error).message);
  }
}

export async function stop() {
  const m = ensureMod();
  if (!m) return;
  try { m.stop(); } catch {}
}
