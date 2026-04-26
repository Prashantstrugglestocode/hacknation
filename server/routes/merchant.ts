import { Hono } from 'hono';
import { createClient } from '@supabase/supabase-js';
import ngeohash from 'ngeohash';

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

merchant.get('/:id/stats', async (c) => {
  const id = c.req.param('id');
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const { data: offers } = await supabase
    .from('offers')
    .select('status, discount_amount_cents, generated_at')
    .eq('merchant_id', id)
    .gte('generated_at', yesterday.toISOString());

  const rows = offers ?? [];
  const todayRows = rows.filter(o => new Date(o.generated_at) >= today);
  const yesterdayRows = rows.filter(o => new Date(o.generated_at) >= yesterday && new Date(o.generated_at) < today);

  const calcStats = (arr: any[]) => {
    const generated = arr.length;
    const accepted = arr.filter(o => ['accepted','redeemed'].includes(o.status)).length;
    const redeemed = arr.filter(o => o.status === 'redeemed').length;
    const declined = arr.filter(o => o.status === 'declined').length;
    const accept_rate = generated > 0 ? accepted / generated : 0;
    const eur_moved = arr
      .filter(o => o.status === 'redeemed')
      .reduce((sum, o) => sum + (o.discount_amount_cents ?? 0), 0);
    return { generated, accepted, redeemed, declined, accept_rate, eur_moved };
  };

  const todayStats = calcStats(todayRows);
  const yesterdayStats = calcStats(yesterdayRows);

  const delta = {
    generated: todayStats.generated - yesterdayStats.generated,
    accepted: todayStats.accepted - yesterdayStats.accepted,
    redeemed: todayStats.redeemed - yesterdayStats.redeemed,
    accept_rate: todayStats.accept_rate - yesterdayStats.accept_rate,
    eur_moved: todayStats.eur_moved - yesterdayStats.eur_moved,
  };

  return c.json({ ...todayStats, delta });
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
