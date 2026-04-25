import AsyncStorage from '@react-native-async-storage/async-storage';
import { encodeGeohash6 } from '../context/geohash';

export interface IntentVector {
  rainy: boolean;
  cold: boolean;
  hungry_likely: boolean;
  browsing: boolean;
  time_bucket: 'morning' | 'lunch' | 'afternoon' | 'evening' | 'night';
}

export interface EncodedPayload {
  geohash6: string;
  intent: IntentVector;
  locale: string;
  device_hash: string;
}

const DEVICE_HASH_KEY = 'city_wallet_device_hash';

export async function getDeviceHash(): Promise<string> {
  let hash = await AsyncStorage.getItem(DEVICE_HASH_KEY);
  if (!hash) {
    hash = Math.random().toString(36).slice(2) + Date.now().toString(36);
    await AsyncStorage.setItem(DEVICE_HASH_KEY, hash);
  }
  return hash;
}

export async function forgetMe(): Promise<void> {
  // Rotate device hash, wipe stored intent history
  const newHash = Math.random().toString(36).slice(2) + Date.now().toString(36);
  await AsyncStorage.setItem(DEVICE_HASH_KEY, newHash);
  await AsyncStorage.removeItem('city_wallet_last_offers');
}

export function encodeIntent(params: {
  lat: number;
  lng: number;
  weatherCondition: string;
  tempC: number;
  locale: string;
  deviceHash: string;
}): EncodedPayload {
  const { lat, lng, weatherCondition, tempC, locale, deviceHash } = params;
  const hour = new Date().getHours();

  const rainy = ['rain', 'drizzle', 'mist', 'snow', 'thunderstorm'].includes(
    weatherCondition.toLowerCase()
  );
  const cold = tempC < 14;
  const hungry_likely = hour >= 11 && hour <= 14;
  const browsing = hour >= 15 && hour <= 18;

  let time_bucket: IntentVector['time_bucket'];
  if (hour < 10) time_bucket = 'morning';
  else if (hour < 14) time_bucket = 'lunch';
  else if (hour < 18) time_bucket = 'afternoon';
  else if (hour < 22) time_bucket = 'evening';
  else time_bucket = 'night';

  return {
    geohash6: encodeGeohash6(lat, lng),
    intent: { rainy, cold, hungry_likely, browsing, time_bucket },
    locale: locale === 'en' ? 'en' : 'de',
    device_hash: deviceHash,
  };
}
