import { Hono } from 'hono';
import { createClient } from '@supabase/supabase-js';
import ngeohash from 'ngeohash';
import { generateOffer } from '../lib/openai.ts';
import { getWeather } from '../lib/weather.ts';
import { getPayoneDensity, getMerchantPayoneSignal } from '../lib/payone-mock.ts';
import { setFlash, getFlash, clearFlash } from '../lib/flash.ts';
import { listCombos, addCombo, deleteCombo } from '../lib/combos.ts';

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
  const allowed = ['goal', 'max_discount_pct', 'time_windows', 'inventory_tags', 'name', 'lat', 'lng'];
  const update: Record<string, any> = {};
  for (const key of allowed) {
    if (body[key] !== undefined) update[key] = body[key];
  }
  // Recompute geohash6 when lat/lng change so the merchant remains findable
  // by the customer's nearby-search after relocation.
  if (typeof update.lat === 'number' && typeof update.lng === 'number') {
    update.geohash6 = ngeohash.encode(update.lat, update.lng, 6);
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

  const [weather, payone, { data: menuItemRows }] = await Promise.all([
    getWeather(m.lat, m.lng),
    Promise.resolve(getPayoneDensity()),
    supabase.from('menu_items').select('id, name, price_cents, category, tags').eq('merchant_id', id).eq('active', true),
  ]);
  const menuItems = menuItemRows ?? [];
  const hour = new Date().getHours();

  const flash = getFlash(id);
  const flashCtx = flash ? {
    items: menuItems.filter(it => flash.menu_item_ids.includes(it.id)),
    menu_item_ids: flash.menu_item_ids,
    pct: flash.pct,
    minutes_left: Math.max(0, Math.round((flash.until - Date.now()) / 60000)),
  } : undefined;

  const context = {
    weather, payone, hour,
    intent: { browsing: false, hungry_likely: hour >= 11 && hour <= 14, cold: weather.temp_c < 14, rainy: ['rain', 'drizzle'].includes(weather.condition.toLowerCase()) },
    distance_m: 50,
    menu_items: menuItems.length > 0 ? menuItems : undefined,
    flash_sale: flashCtx,
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

// Top redeemed menu items for this merchant. Reads `offer_item_links` joined
// with `offers` (status='redeemed') and aggregates by menu_item. Powers the
// "Top Item" tile on the merchant dashboard so the merchant sees what's
// actually moving — a real DB-driven insight, not a stat tile.
merchant.get('/:id/top-items', async (c) => {
  const id = c.req.param('id');
  const limit = Math.max(1, Math.min(10, parseInt(c.req.query('limit') ?? '3', 10)));

  // Pull all offer_item_links for redeemed offers from this merchant.
  // Supabase JS doesn't do GROUP BY natively; we aggregate in JS.
  const { data: links } = await supabase
    .from('offer_item_links')
    .select('menu_item_id, offers!inner(merchant_id, status), menu_items!inner(id, name, price_cents, category)')
    .eq('offers.merchant_id', id)
    .eq('offers.status', 'redeemed');

  if (!links || links.length === 0) return c.json({ items: [] });

  const counts = new Map<string, { name: string; price_cents: number | null; category: string | null; redemptions: number }>();
  for (const row of links as any[]) {
    const item = row.menu_items;
    if (!item) continue;
    const existing = counts.get(item.id);
    if (existing) {
      existing.redemptions += 1;
    } else {
      counts.set(item.id, {
        name: item.name,
        price_cents: item.price_cents,
        category: item.category,
        redemptions: 1,
      });
    }
  }

  const items = [...counts.entries()]
    .map(([id, v]) => ({ id, ...v }))
    .sort((a, b) => b.redemptions - a.redemptions)
    .slice(0, limit);

  return c.json({ items });
});

// Per-merchant Payone density signal — the DSV "core asset" called out in
// the brief. Used by the merchant dashboard to show "you're quiet right now,
// good moment for a flash" and by the why-screen on the customer side.
merchant.get('/:id/payone', async (c) => {
  const id = c.req.param('id');
  const { data: m } = await supabase
    .from('merchants').select('id, type').eq('id', id).single();
  if (!m) return c.json({ error: 'merchant not found' }, 404);
  return c.json(getMerchantPayoneSignal(m.id, m.type));
});

// Flash-sale: merchant-managed boost on specific menu_items.
// Read by /api/offer/generate so the LLM prioritizes the flagged items.
merchant.get('/:id/flash', async (c) => {
  const sale = getFlash(c.req.param('id'));
  if (!sale) return c.json({ active: false });
  const minutes_left = Math.max(0, Math.round((sale.until - Date.now()) / 60000));
  // Enrich with actual menu_item rows so the client can show names + prices.
  let items: any[] = [];
  if (sale.menu_item_ids.length > 0) {
    const { data } = await supabase
      .from('menu_items')
      .select('id, name, price_cents, category')
      .in('id', sale.menu_item_ids);
    items = data ?? [];
  }
  return c.json({
    active: true,
    menu_item_ids: sale.menu_item_ids,
    items,
    pct: sale.pct,
    minutes_left,
  });
});

merchant.post('/:id/flash', async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json();
  const menu_item_ids = Array.isArray(body.menu_item_ids)
    ? (body.menu_item_ids as string[])
    : Array.isArray(body.items) ? (body.items as string[]) : []; // back-compat
  const pct = typeof body.pct === 'number' ? body.pct : 20;
  const duration_min = typeof body.duration_min === 'number' ? body.duration_min : 60;
  if (menu_item_ids.length === 0) return c.json({ error: 'menu_item_ids required' }, 400);
  const sale = setFlash(id, menu_item_ids, pct, duration_min);
  const minutes_left = Math.max(0, Math.round((sale.until - Date.now()) / 60000));
  let items: any[] = [];
  const { data } = await supabase
    .from('menu_items')
    .select('id, name, price_cents, category')
    .in('id', sale.menu_item_ids);
  items = data ?? [];
  return c.json({
    active: true,
    menu_item_ids: sale.menu_item_ids,
    items,
    pct: sale.pct,
    minutes_left,
  });
});

merchant.delete('/:id/flash', (c) => {
  clearFlash(c.req.param('id'));
  return c.json({ active: false });
});

// Wipe ALL offers + offer_item_links for a merchant (history reset).
// Used by the merchant settings "Alle Angebote löschen" button.
merchant.delete('/:id/offers', async (c) => {
  const id = c.req.param('id');
  // offer_item_links are foreign-keyed with on-delete cascade, so deleting
  // offers takes the join rows with them.
  const { error } = await supabase.from('offers').delete().eq('merchant_id', id);
  if (error) return c.json({ error: error.message }, 500);
  return c.json({ ok: true });
});

// Owned merchants for a device — multi-merchant picker on the client.
merchant.get('s/owned', async (c) => {
  const device_id = c.req.query('device_id');
  if (!device_id) return c.json({ error: 'device_id required' }, 400);
  const { data, error } = await supabase
    .from('merchants')
    .select('id, name, type, goal, max_discount_pct, lat, lng, created_at')
    .eq('owner_device_id', device_id)
    .order('created_at', { ascending: false });
  if (error) return c.json({ error: error.message }, 500);
  return c.json(data ?? []);
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

// Combos: bundle 2-4 menu items at a fixed price below the sum of their
// individual prices. The offer engine reads active combos and the LLM is
// told to prefer pitching one when it fits the customer context.
merchant.get('/:id/combos', async (c) => {
  const id = c.req.param('id');
  const combos = listCombos(id);

  // Enrich each combo with the actual menu item rows so the client can show
  // names + prices without a second roundtrip.
  if (combos.length === 0) return c.json({ combos: [] });
  const allIds = [...new Set(combos.flatMap(co => co.menu_item_ids))];
  const { data: items } = await supabase
    .from('menu_items')
    .select('id, name, price_cents, category')
    .in('id', allIds);
  const itemMap = new Map((items ?? []).map(i => [i.id, i]));

  const enriched = combos.map(co => {
    const resolved = co.menu_item_ids.map(iid => itemMap.get(iid)).filter(Boolean) as any[];
    const baseSum = resolved.reduce((s, it) => s + (it.price_cents ?? 0), 0);
    const savings = Math.max(0, baseSum - co.combo_price_cents);
    return { ...co, items: resolved, base_total_cents: baseSum, savings_cents: savings };
  });
  return c.json({ combos: enriched });
});

merchant.post('/:id/combos', async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json() as { name: string; menu_item_ids: string[]; combo_price_cents: number };
  const combo = addCombo(id, body);
  if (!combo) return c.json({ error: 'Need at least 2 items + valid price' }, 400);
  return c.json(combo, 201);
});

merchant.delete('/:id/combos/:comboId', async (c) => {
  const ok = deleteCombo(c.req.param('id'), c.req.param('comboId'));
  if (!ok) return c.json({ error: 'Not found' }, 404);
  return c.json({ ok: true });
});

export default merchant;
