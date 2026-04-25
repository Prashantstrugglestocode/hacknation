import { Hono } from 'hono';
import { getWeather } from '../lib/weather.ts';
import { center } from '../lib/geohash.ts';

const ctx = new Hono();

// GET /api/context/live?geohash6=u0wt2z
// Lightweight summary for header pill — refreshed client-side every 30s
ctx.get('/live', async (c) => {
  const geohash6 = c.req.query('geohash6');
  if (!geohash6) return c.json({ error: 'geohash6 required' }, 400);

  const { lat, lng } = center(geohash6);
  const weather = await getWeather(lat, lng);

  // Reverse-geocode city via Nominatim (free, GDPR-friendly)
  let city: string | null = null;
  try {
    const r = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&zoom=10&accept-language=de`,
      { headers: { 'User-Agent': 'CityWallet/1.0' }, signal: AbortSignal.timeout(4000) }
    );
    if (r.ok) {
      const data = await r.json() as any;
      city = data.address?.city ?? data.address?.town ?? data.address?.village ?? data.address?.county ?? null;
    }
  } catch {}

  return c.json({
    city,
    weather: { temp_c: weather.temp_c, condition: weather.condition, source: weather.source },
    hour: new Date().getHours(),
    minute: new Date().getMinutes(),
    ts: new Date().toISOString(),
  });
});

export default ctx;
