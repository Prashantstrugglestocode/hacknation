import { Hono } from 'hono';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

const merchant = new Hono();

merchant.post('/', async (c) => {
  const body = await c.req.json();
  const { data, error } = await supabase
    .from('merchants')
    .insert({
      owner_device_id: body.owner_device_id,
      name: body.name,
      type: body.type,
      lat: body.lat,
      lng: body.lng,
      geohash6: body.geohash6,
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

  return c.json({ generated, accepted, redeemed, declined, accept_rate, eur_moved });
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
