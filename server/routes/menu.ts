import { Hono } from 'hono';
import { createClient } from '@supabase/supabase-js';
import { extractMenu } from '../lib/vision.ts';
import { generateInsights } from '../lib/insights.ts';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

const menu = new Hono();

// POST /api/merchant/:id/menu/scan  body: { photo_data_url: 'data:image/jpeg;base64,...' }
menu.post('/:id/menu/scan', async (c) => {
  const merchantId = c.req.param('id');
  const body = await c.req.json() as { photo_data_url?: string };
  if (!body.photo_data_url) return c.json({ error: 'photo_data_url required' }, 400);

  const items = await extractMenu(body.photo_data_url);
  if (items.length === 0) return c.json({ items: [] });

  const rows = items.map(i => ({
    merchant_id: merchantId,
    name: i.name,
    price_cents: i.price_eur != null ? Math.round(i.price_eur * 100) : null,
    category: i.category ?? 'food',
    tags: i.tags ?? [],
    raw_extract: i,
  }));

  const { data, error } = await supabase
    .from('menu_items')
    .insert(rows)
    .select('*');

  if (error) return c.json({ error: error.message }, 500);
  return c.json({ items: data ?? [] }, 201);
});

// POST /api/merchant/:id/menu
menu.post('/:id/menu', async (c) => {
  const merchantId = c.req.param('id');
  const body = await c.req.json() as { name: string; price_cents: number | null; category: string; tags: string[] };
  
  if (!body.name) return c.json({ error: 'name required' }, 400);

  const { data, error } = await supabase
    .from('menu_items')
    .insert([{
      merchant_id: merchantId,
      name: body.name,
      price_cents: body.price_cents,
      category: body.category ?? 'food',
      tags: body.tags ?? [],
    }])
    .select()
    .single();

  if (error) return c.json({ error: error.message }, 500);
  return c.json(data, 201);
});

// GET /api/merchant/:id/menu
menu.get('/:id/menu', async (c) => {
  const merchantId = c.req.param('id');
  const { data, error } = await supabase
    .from('menu_items')
    .select('*')
    .eq('merchant_id', merchantId)
    .order('created_at', { ascending: false });
  if (error) return c.json({ error: error.message }, 500);
  return c.json(data ?? []);
});

// PATCH /api/merchant/:id/menu/:itemId
menu.patch('/:id/menu/:itemId', async (c) => {
  const itemId = c.req.param('itemId');
  const body = await c.req.json();
  const allowed = ['name', 'price_cents', 'category', 'tags', 'active'];
  const update: Record<string, any> = {};
  for (const k of allowed) if (body[k] !== undefined) update[k] = body[k];
  const { data, error } = await supabase
    .from('menu_items')
    .update(update)
    .eq('id', itemId)
    .select()
    .single();
  if (error) return c.json({ error: error.message }, 500);
  return c.json(data);
});

// DELETE /api/merchant/:id/menu/:itemId
menu.delete('/:id/menu/:itemId', async (c) => {
  const itemId = c.req.param('itemId');
  const { error } = await supabase.from('menu_items').delete().eq('id', itemId);
  if (error) return c.json({ error: error.message }, 500);
  return c.json({ ok: true });
});

// GET /api/merchant/:id/insights — analyzes 7d performance + LLM suggestions
menu.get('/:id/insights', async (c) => {
  const merchantId = c.req.param('id');
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const [{ data: merchant }, { data: items }, { data: links }] = await Promise.all([
    supabase.from('merchants').select('*').eq('id', merchantId).single(),
    supabase.from('menu_items').select('*').eq('merchant_id', merchantId).eq('active', true),
    supabase
      .from('offer_item_links')
      .select('menu_item_id, offer_id, offers!inner(status, generated_at, merchant_id)')
      .eq('offers.merchant_id', merchantId)
      .gte('offers.generated_at', sevenDaysAgo),
  ]);

  if (!merchant) return c.json({ error: 'merchant not found' }, 404);

  const perfMap = new Map<string, { shown: number; accepted: number; redeemed: number }>();
  for (const link of (links ?? []) as any[]) {
    const id = link.menu_item_id;
    const cur = perfMap.get(id) ?? { shown: 0, accepted: 0, redeemed: 0 };
    cur.shown += 1;
    const status = link.offers?.status;
    if (status === 'accepted' || status === 'redeemed') cur.accepted += 1;
    if (status === 'redeemed') cur.redeemed += 1;
    perfMap.set(id, cur);
  }

  const items_perf = (items ?? []).map(i => {
    const p = perfMap.get(i.id) ?? { shown: 0, accepted: 0, redeemed: 0 };
    return {
      item_id: i.id,
      name: i.name,
      category: i.category ?? 'food',
      price_eur: i.price_cents != null ? i.price_cents / 100 : null,
      shown: p.shown,
      accepted: p.accepted,
      redeemed: p.redeemed,
      accept_rate: p.shown > 0 ? p.accepted / p.shown : 0,
    };
  });

  const insights = await generateInsights(merchant, items_perf);
  return c.json({ items_perf, insights });
});

export default menu;
