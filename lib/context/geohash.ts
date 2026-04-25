import ngeohash from 'ngeohash';

export function encodeGeohash6(lat: number, lng: number): string {
  return ngeohash.encode(lat, lng, 6);
}

export function geohashNeighbors(geohash: string): string[] {
  return [geohash, ...ngeohash.neighbors(geohash)];
}

export function geohashCenter(geohash: string): { lat: number; lng: number } {
  const { latitude, longitude } = ngeohash.decode(geohash);
  return { lat: latitude, lng: longitude };
}

export function distanceMeters(
  lat1: number, lng1: number,
  lat2: number, lng2: number
): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
    Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
