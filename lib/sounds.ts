// Defensive audio playback — falls back silently if expo-audio is unavailable
// (e.g. Expo Go SDK that doesn't bundle the native module).
import { getPrefs } from './preferences';

let mod: any = null;
let chimePlayer: any = null;
let modeConfigured = false;

function ensureMod(): any {
  if (mod !== null) return mod;
  try {
    mod = require('expo-audio');
  } catch {
    mod = false; // tried-and-failed sentinel
  }
  return mod;
}

async function ensureMode(m: any) {
  if (modeConfigured) return;
  try {
    await m.setAudioModeAsync({
      playsInSilentMode: true,
      shouldPlayInBackground: false,
      interruptionMode: 'mixWithOthers',
    });
  } catch {}
  modeConfigured = true;
}

export async function playChime() {
  const prefs = await getPrefs().catch(() => ({ sound: true } as any));
  if (!prefs.sound) return;
  const m = ensureMod();
  if (!m) return;
  await ensureMode(m);
  try {
    if (!chimePlayer) {
      chimePlayer = m.createAudioPlayer(require('../assets/chime.wav'));
    }
    chimePlayer.seekTo(0);
    chimePlayer.play();
  } catch {}
}
