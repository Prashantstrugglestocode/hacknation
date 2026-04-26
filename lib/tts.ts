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
    const prefs = getCachedPrefs();
    if (!(prefs as any).tts) return;
  }
  const m = ensureMod();
  if (!m) return;
  try {
    m.stop();
    m.speak(text, {
      language: getLocale() === 'en' ? 'en-US' : 'de-DE',
      pitch: 1.0,
      rate: 1.0,
    });
  } catch {}
}

export async function stop() {
  const m = ensureMod();
  if (!m) return;
  try { m.stop(); } catch {}
}
