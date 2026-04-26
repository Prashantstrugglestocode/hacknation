export interface EventData {
  name: string;
  distance_m: number;
  starts_in_minutes: number;
  source: 'ticketmaster' | 'osm';
}

const OVERPASS_URL = process.env.OVERPASS_URL ?? 'https://overpass-api.de/api/interpreter';

function haversine(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a = Math.sin(dLat/2)**2
    + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Real-data fallback when no Ticketmaster API key is configured: query OSM
// for nearby event venues (theatres, cinemas, concert halls, stadiums, arts
// centres, nightclubs). The EVENT_DEMAND_SPIKE trigger fires when an event
// is "within 800m starting in <120 min" — for the OSM fallback we treat any
// nearby venue as a *potential* draw with a heuristic 90-min start window.
// This way the trigger can still fire without a paid events feed, and the
// product works on day 1 with zero configuration.
async function getOSMVenues(lat: number, lng: number): Promise<EventData[]> {
  const radiusM = 1200;
  const query = `
    [out:json][timeout:6];
    (
      node["amenity"="theatre"](around:${radiusM},${lat},${lng});
      node["amenity"="cinema"](around:${radiusM},${lat},${lng});
      node["amenity"="concert_hall"](around:${radiusM},${lat},${lng});
      node["amenity"="arts_centre"](around:${radiusM},${lat},${lng});
      node["amenity"="nightclub"](around:${radiusM},${lat},${lng});
      node["leisure"="stadium"](around:${radiusM},${lat},${lng});
      node["leisure"="sports_centre"](around:${radiusM},${lat},${lng});
      way["amenity"="theatre"](around:${radiusM},${lat},${lng});
      way["amenity"="cinema"](around:${radiusM},${lat},${lng});
      way["leisure"="stadium"](around:${radiusM},${lat},${lng});
    );
    out center 8;
  `;
  try {
    const res = await fetch(OVERPASS_URL, {
      method: 'POST',
      body: `data=${encodeURIComponent(query)}`,
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) return [];
    const data = await res.json() as any;
    const elements = (data.elements ?? []) as any[];

    return elements
      .map((e): EventData | null => {
        const vlat = e.lat ?? e.center?.lat;
        const vlng = e.lon ?? e.center?.lon;
        if (typeof vlat !== 'number' || typeof vlng !== 'number') return null;
        const name = e.tags?.name
          ?? (e.tags?.amenity ? e.tags.amenity.replace(/_/g, ' ') : 'Veranstaltungsort');
        return {
          name,
          distance_m: Math.round(haversine(lat, lng, vlat, vlng)),
          starts_in_minutes: 90,
          source: 'osm',
        };
      })
      .filter((e): e is EventData => e !== null)
      .sort((a, b) => a.distance_m - b.distance_m)
      .slice(0, 3);
  } catch {
    return [];
  }
}

export async function getNearbyEvents(lat: number, lng: number): Promise<EventData[]> {
  const key = process.env.TICKETMASTER_API_KEY;

  // Tier 1: Ticketmaster Discovery API when a key is configured. Real,
  // ticketed, time-stamped events.
  if (key) {
    try {
      const url = `https://app.ticketmaster.com/discovery/v2/events.json?latlong=${lat},${lng}&radius=1&unit=km&size=3&apikey=${key}`;
      const res = await fetch(url, { signal: AbortSignal.timeout(4000) });
      if (res.ok) {
        const data = await res.json() as any;
        const events = data._embedded?.events ?? [];
        if (events.length > 0) {
          return events.slice(0, 3).map((e: any): EventData => {
            const startTime = e.dates?.start?.dateTime ? new Date(e.dates.start.dateTime) : null;
            const starts_in_minutes = startTime
              ? Math.round((startTime.getTime() - Date.now()) / 60000)
              : 999;
            const venue = e._embedded?.venues?.[0];
            const venueLat = parseFloat(venue?.location?.latitude ?? lat);
            const venueLng = parseFloat(venue?.location?.longitude ?? lng);
            return {
              name: e.name,
              distance_m: Math.round(haversine(lat, lng, venueLat, venueLng)),
              starts_in_minutes,
              source: 'ticketmaster',
            };
          });
        }
      }
    } catch {
      // fall through to OSM
    }
  }

  // Tier 2: OSM venue data via Overpass — keyless, EU-residency-friendly,
  // works on day 1 with zero configuration. Real geographic data, just
  // without ticketing schedules.
  return getOSMVenues(lat, lng);
}
