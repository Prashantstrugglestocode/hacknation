import * as ExpoLocation from 'expo-location';
import { encodeGeohash6 } from './geohash';

export interface LocationResult {
  lat: number;
  lng: number;
  geohash6: string;
  accuracy: number | null;
}

export async function requestLocationPermission(): Promise<boolean> {
  const { status } = await ExpoLocation.requestForegroundPermissionsAsync();
  return status === 'granted';
}

export async function getCurrentLocation(): Promise<LocationResult> {
  const loc = await ExpoLocation.getCurrentPositionAsync({
    accuracy: ExpoLocation.Accuracy.Balanced,
  });
  const { latitude: lat, longitude: lng, accuracy } = loc.coords;
  return {
    lat,
    lng,
    geohash6: encodeGeohash6(lat, lng),
    accuracy,
  };
}
