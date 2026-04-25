import { Hono } from 'hono';
import { createClient } from '@supabase/supabase-js';
import ngeohash from 'ngeohash';
import { generateOffer } from '../lib/openai.ts';
import { getWeather } from '../lib/weather.ts';
import { getPayoneDensity } from '../lib/payone-mock.ts';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

const merchant = new Hono();

merchant.post('/', async (c) => {
  const body = await c.req.json();
  const geohash6 = body.geohash6 ?? ngeohash.encode(body.lat, body.lng, 6);
  const { data, error } = await supabase
    .from('merchants')
    .insert({
      owner_device_id: body.owner_device_id,
      name: body.name,
      type: body.type,
      lat: body.lat,
      lng: body.lng,
      geohash6,
      goal: body.goal,
      max_discount_pct: body.max_discount_pct,
      time_windows: body.time_windows,
      inventory_tags: body.inventory_tags,
      locale: body.locale ?? 'de',
    })
    .select()
    .single();

  if (error) return c.json({ error: error.message }, 500);
  return c.json(data, 201);
});

merchant.post('/seed-demo', async (c) => {
  const body = await c.req.json();
  const { lat, lng, owner_device_id } = body;
  if (typeof lat !== 'number' || typeof lng !== 'number') {
    return c.json({ error: 'lat,lng required' }, 400);
  }
  const geohash6 = ngeohash.encode(lat, lng, 6);
  const SEEDS = [
    { name: 'Café Anatolia', type: 'café', goal: 'fill_quiet_hours', max_discount_pct: 20, time_windows: ['lunch','afternoon'], inventory_tags: ['cappuccino','sandwich','croissant','latte'] },
    { name: 'Bäckerei Sonne', type: 'bakery', goal: 'move_slow_stock', max_discount_pct: 25, time_windows: ['afternoon','evening'], inventory_tags: ['brezel','kuchen','vollkornbrot'] },
    { name: 'Buchladen Lena', type: 'bookstore', goal: 'fill_quiet_hours', max_discount_pct: 15, time_windows: ['afternoon'], inventory_tags: ['krimi','sachbuch','kinderbuch'] },
  ];
  const seed = SEEDS[Math.floor(Math.random() * SEEDS.length)];
  const { data, error } = await supabase
    .from('merchants')
    .insert({
      owner_device_id: owner_device_id ?? `seed-${Date.now()}`,
      name: seed.name,
      type: seed.type,
      lat, lng, geohash6,
      goal: seed.goal,
      max_discount_pct: seed.max_discount_pct,
      time_windows: seed.time_windows,
      inventory_tags: seed.inventory_tags,
      locale: 'de',
    })
    .select()
    .single();

  if (error) return c.json({ error: error.message }, 500);
  return c.json(data, 201);
});

merchant.get('/:id', async (c) => {
  const { data, error } = await supabase
    .from('merchants')
    .select('*')
    .eq('id', c.req.param('id'))
    .single();

  if (error) return c.json({ error: 'Not found' }, 404);
  return c.json(data);
});

merchant.patch('/:id', async (c) => {
  const body = await c.req.json();
  const allowed = ['goal', 'max_discount_pct', 'time_windows', 'inventory_tags'];
  const update: Record<string, any> = {};
  for (const key of allowed) {
    if (body[key] !== undefined) update[key] = body[key];
  }

  const { data, error } = await supabase
    .from('merchants')
    .update(update)
    .eq('id', c.req.param('id'))
    .select()
    .single();

  if (error) return c.json({ error: error.message }, 500);
  return c.json(data);
});

// Generate a preview offer for the merchant without persisting — used by
// the "Vorschau" button on the dashboard so merchants see what customers see.
merchant.get('/:id/preview', async (c) => {
  const id = c.req.param('id');
  const { data: m, error } = await supabase
    .from('merchants').select('*').eq('id', id).single();
  if (error || !m) return c.json({ error: 'merchant not found' }, 404);

  const [weather, payone] = await Promise.all([
    getWeather(m.lat, m.lng),
    Promise.resolve(getPayoneDensity()),
  ]);
  const hour = new Date().getHours();
  const context = {
    weather, payone, hour,
    intent: { browsing: false, hungry_likely: hour >= 11 && hour <= 14, cold: weather.temp_c < 14, rainy: ['rain', 'drizzle'].includes(weather.condition.toLowerCase()) },
    distance_m: 50,
  };
  const widgetSpec = await generateOffer({
    merchant: m,
    context,
    locale: m.locale ?? 'de',
    distance_m: 50,
  });
  return c.json({ widget_spec: widgetSpec, generated_at: new Date().toISOString() });
});

merchant.get('/:id/stats', async (c) => {
  const id = c.req.param('id');
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const { data: offers } = await supabase
    .from('offers')
    .select('status, discount_amount_cents')
    .eq('merchant_id', id)
    .gte('generated_at', today.toISOString());

  const rows = offers ?? [];
  const generated = rows.length;
  const accepted = rows.filter(o => ['accepted','redeemed'].includes(o.status)).length;
  const redeemed = rows.filter(o => o.status === 'redeemed').length;
  const declined = rows.filter(o => o.status === 'declined').length;
  const accept_rate = generated > 0 ? accepted / generated : 0;
  const eur_moved = rows
    .filter(o => o.status === 'redeemed')
    .reduce((sum, o) => sum + (o.discount_amount_cents ?? 0), 0);

  // 7-day daily breakdown for sparkline
  const sevenDays = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const { data: weekRows } = await supabase
    .from('offers')
    .select('status, generated_at')
    .eq('merchant_id', id)
    .gte('generated_at', sevenDays);
  const buckets: Array<{ day: string; generated: number; accepted: number; rate: number }> = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
    d.setHours(0, 0, 0, 0);
    const next = new Date(d.getTime() + 24 * 60 * 60 * 1000);
    const inDay = (weekRows ?? []).filter(r => {
      const ts = new Date(r.generated_at).getTime();
      return ts >= d.getTime() && ts < next.getTime();
    });
    const g = inDay.length;
    const a = inDay.filter(r => ['accepted','redeemed'].includes(r.status)).length;
    buckets.push({
      day: d.toISOString().slice(0, 10),
      generated: g,
      accepted: a,
      rate: g > 0 ? a / g : 0,
    });
  }

  return c.json({ generated, accepted, redeemed, declined, accept_rate, eur_moved, weekly: buckets });
});

merchant.get('s/nearby', async (c) => {
  const geohash6 = c.req.query('geohash6');
  if (!geohash6) return c.json({ error: 'geohash6 required' }, 400);

  const ngeohash = await import('ngeohash');
  const neighbors = [geohash6, ...ngeohash.default.neighbors(geohash6)];

  const { data, error } = await supabase
    .from('merchants')
    .select('*')
    .in('geohash6', neighbors);

  if (error) return c.json({ error: error.message }, 500);
  return c.json(data ?? []);
});

export default merchant;
