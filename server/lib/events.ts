export interface EventData {
  name: string;
  distance_m: number;
  starts_in_minutes: number;
}

export async function getNearbyEvents(lat: number, lng: number): Promise<EventData[]> {
  const key = process.env.TICKETMASTER_API_KEY;
  if (!key) return [];

  try {
    const url = `https://app.ticketmaster.com/discovery/v2/events.json?latlong=${lat},${lng}&radius=1&unit=km&size=3&apikey=${key}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(4000) });
    if (!res.ok) return [];
    const data = await res.json() as any;
    const events = data._embedded?.events ?? [];

    return events.slice(0, 3).map((e: any) => {
      const startTime = e.dates?.start?.dateTime ? new Date(e.dates.start.dateTime) : null;
      const starts_in_minutes = startTime
        ? Math.round((startTime.getTime() - Date.now()) / 60000)
        : 999;
      const venue = e._embedded?.venues?.[0];
      const venueLat = parseFloat(venue?.location?.latitude ?? lat);
      const venueLng = parseFloat(venue?.location?.longitude ?? lng);
      const R = 6371000;
      const dLat = ((venueLat - lat) * Math.PI) / 180;
      const dLng = ((venueLng - lng) * Math.PI) / 180;
      const a = Math.sin(dLat/2)**2 + Math.cos(lat*Math.PI/180)*Math.cos(venueLat*Math.PI/180)*Math.sin(dLng/2)**2;
      const distance_m = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
      return { name: e.name, distance_m: Math.round(distance_m), starts_in_minutes };
    });
  } catch {
    return [];
  }
}
