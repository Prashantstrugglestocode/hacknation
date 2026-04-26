import { Hono } from 'hono';
import { createClient } from '@supabase/supabase-js';
import { extractMenu } from '../lib/vision.ts';
import { generateInsights } from '../lib/insights.ts';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

const menu = new Hono();

// POST /api/merchant/:id/menu/scan
// body: { photo_data_url: 'data:image/jpeg;base64,...', dry_run?: boolean }
// dry_run=true → return extracted items WITHOUT persisting (so the merchant
//   can edit/delete on the review screen before committing). The client then
//   calls /menu/bulk with the cleaned-up list.
menu.post('/:id/menu/scan', async (c) => {
  const merchantId = c.req.param('id');
  const body = await c.req.json() as { photo_data_url?: string; dry_run?: boolean };
  if (!body.photo_data_url) return c.json({ error: 'photo_data_url required' }, 400);

  let items: Awaited<ReturnType<typeof extractMenu>>;
  try {
    items = await extractMenu(body.photo_data_url);
  } catch (e) {
    // All vision tiers failed — surface a clear error to the client so the
    // user sees "OCR unavailable, try again" instead of canned demo data.
    return c.json({
      error: 'OCR backends unavailable. Check MISTRAL_API_KEY (free-tier may be rate-limited) or pull `ollama pull llava:7b` for the on-device fallback.',
      code: (e as Error).message ?? 'OCR_FAILED',
      items: [],
    }, 503);
  }
  if (items.length === 0) return c.json({ items: [] });

  // dry_run: return the OCR result without writing — the client review screen
  // lets the merchant edit/delete before bulk-saving via /menu/bulk.
  if (body.dry_run) {
    return c.json({
      items: items.map(i => ({
        name: i.name,
        price_cents: i.price_eur != null ? Math.round(i.price_eur * 100) : null,
        category: i.category ?? 'food',
        tags: i.tags ?? [],
      })),
    });
  }

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

// POST /api/merchant/:id/menu/bulk  body: { items: [{ name, price_cents?, category?, tags? }] }
// Bulk-save items from the scan-review screen after the merchant has edited
// the OCR output.
menu.post('/:id/menu/bulk', async (c) => {
  const merchantId = c.req.param('id');
  const body = await c.req.json() as { items?: Array<{ name?: string; price_cents?: number | null; category?: string; tags?: string[] }> };
  if (!Array.isArray(body.items) || body.items.length === 0) {
    return c.json({ error: 'items required' }, 400);
  }
  const rows = body.items
    .map(i => ({
      merchant_id: merchantId,
      name: typeof i.name === 'string' ? i.name.trim() : '',
      price_cents: typeof i.price_cents === 'number' ? Math.round(i.price_cents) : null,
      category: typeof i.category === 'string' ? i.category : 'food',
      tags: Array.isArray(i.tags) ? i.tags : [],
    }))
    .filter(r => r.name.length > 0);
  if (rows.length === 0) return c.json({ error: 'no valid items' }, 400);
  const { data, error } = await supabase
    .from('menu_items')
    .insert(rows)
    .select('*');
  if (error) return c.json({ error: error.message }, 500);
  return c.json({ items: data ?? [] }, 201);
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

// POST /api/merchant/:id/menu  body: { name, price_cents?, category?, tags? }
// Manual add (no camera scan).
menu.post('/:id/menu', async (c) => {
  const merchantId = c.req.param('id');
  const body = await c.req.json();
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  if (!name) return c.json({ error: 'name required' }, 400);
  const row = {
    merchant_id: merchantId,
    name,
    price_cents: typeof body.price_cents === 'number' ? Math.round(body.price_cents) : null,
    category: typeof body.category === 'string' ? body.category : 'food',
    tags: Array.isArray(body.tags) ? body.tags : [],
  };
  const { data, error } = await supabase
    .from('menu_items')
    .insert(row)
    .select()
    .single();
  if (error) return c.json({ error: error.message }, 500);
  return c.json(data, 201);
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

// DELETE /api/merchant/:id/menu — wipe all menu_items for merchant.
menu.delete('/:id/menu', async (c) => {
  const merchantId = c.req.param('id');
  const { error } = await supabase.from('menu_items').delete().eq('merchant_id', merchantId);
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
