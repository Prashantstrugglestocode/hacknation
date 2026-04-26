import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';

// Persisted user preferences. In-memory cache + AsyncStorage write-through.

const KEYS = {
  sound: 'cw_pref_sound',
  haptics: 'cw_pref_haptics',
  radius: 'cw_pref_radius_m',
  tts: 'cw_pref_tts',
} as const;

interface Prefs {
  sound: boolean;
  haptics: boolean;
  radius_m: number;
  tts: boolean;
}

const DEFAULTS: Prefs = {
  sound: true,
  haptics: true,
  radius_m: 500,
  tts: false,
};

let cache: Prefs | null = null;

async function load(): Promise<Prefs> {
  if (cache) return cache;
  const [s, h, r, t] = await Promise.all([
    AsyncStorage.getItem(KEYS.sound),
    AsyncStorage.getItem(KEYS.haptics),
    AsyncStorage.getItem(KEYS.radius),
    AsyncStorage.getItem(KEYS.tts),
  ]);
  cache = {
    sound: s === null ? DEFAULTS.sound : s === '1',
    haptics: h === null ? DEFAULTS.haptics : h === '1',
    radius_m: r ? parseInt(r, 10) || DEFAULTS.radius_m : DEFAULTS.radius_m,
    tts: t === null ? DEFAULTS.tts : t === '1',
  };
  return cache;
}

export async function getPrefs(): Promise<Prefs> {
  return load();
}

export function getCachedPrefs(): Prefs {
  return cache ?? DEFAULTS;
}

export async function setSound(on: boolean) {
  await AsyncStorage.setItem(KEYS.sound, on ? '1' : '0');
  if (cache) cache.sound = on;
}

export async function setHaptics(on: boolean) {
  await AsyncStorage.setItem(KEYS.haptics, on ? '1' : '0');
  if (cache) cache.haptics = on;
}

export async function setRadius(m: number) {
  const v = Math.max(100, Math.min(2000, Math.round(m)));
  await AsyncStorage.setItem(KEYS.radius, String(v));
  if (cache) cache.radius_m = v;
}

export async function setTts(on: boolean) {
  await AsyncStorage.setItem(KEYS.tts, on ? '1' : '0');
  if (cache) cache.tts = on;
}

// React hook with live state.
export function usePrefs() {
  const [prefs, setPrefs] = useState<Prefs>(getCachedPrefs());
  useEffect(() => { load().then(setPrefs); }, []);
  return {
    prefs,
    toggleSound: async () => { const v = !prefs.sound; await setSound(v); setPrefs({ ...prefs, sound: v }); },
    toggleHaptics: async () => { const v = !prefs.haptics; await setHaptics(v); setPrefs({ ...prefs, haptics: v }); },
    toggleTts: async () => { const v = !prefs.tts; await setTts(v); setPrefs({ ...prefs, tts: v }); },
    setRadius: async (m: number) => { await setRadius(m); setPrefs({ ...prefs, radius_m: m }); },
  };
}
