// Overpass API — OpenStreetMap query for nearby POIs
// No API key, GDPR-friendly, used as a real footfall proxy.

export interface POIData {
  total: number;            // total POIs within radius
  cafes: number;
  restaurants: number;
  shops: number;
  events_venues: number;
}

const OVERPASS_URL = process.env.OVERPASS_URL ?? 'https://overpass-api.de/api/interpreter';

const EMPTY: POIData = { total: 0, cafes: 0, restaurants: 0, shops: 0, events_venues: 0 };

export async function getNearbyPOIs(lat: number, lng: number, radiusM = 500): Promise<POIData> {
  const query = `
    [out:json][timeout:8];
    (
      node["amenity"="cafe"](around:${radiusM},${lat},${lng});
      node["amenity"="restaurant"](around:${radiusM},${lat},${lng});
      node["amenity"="bar"](around:${radiusM},${lat},${lng});
      node["shop"](around:${radiusM},${lat},${lng});
      node["amenity"="theatre"](around:${radiusM},${lat},${lng});
      node["amenity"="cinema"](around:${radiusM},${lat},${lng});
    );
    out body;
  `;
  try {
    const res = await fetch(OVERPASS_URL, {
      method: 'POST',
      body: `data=${encodeURIComponent(query)}`,
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      signal: AbortSignal.timeout(7000),
    });
    if (!res.ok) return EMPTY;
    const data = await res.json() as any;
    const elements = (data.elements ?? []) as any[];

    let cafes = 0, restaurants = 0, shops = 0, venues = 0;
    for (const el of elements) {
      const t = el.tags ?? {};
      if (t.amenity === 'cafe') cafes++;
      else if (t.amenity === 'restaurant' || t.amenity === 'bar') restaurants++;
      else if (t.amenity === 'theatre' || t.amenity === 'cinema') venues++;
      else if (t.shop) shops++;
    }
    return {
      total: elements.length,
      cafes, restaurants, shops, events_venues: venues,
    };
  } catch (e) {
    console.warn('[overpass] failed:', (e as Error).message);
    return EMPTY;
  }
}
