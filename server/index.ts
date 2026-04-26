import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import merchantRoutes from './routes/merchant.ts';
import offerRoutes from './routes/offer.ts';
import menuRoutes from './routes/menu.ts';
import contextRoutes from './routes/context.ts';

const app = new Hono();

app.use('*', cors());
app.use('*', logger());

app.get('/health', (c) => c.json({ ok: true, ts: new Date().toISOString() }));

// Fire-and-forget Ollama warm-up — splash hits this so the gemma3 model is
// already loaded into memory by the time the customer screen calls
// /api/offer/generate. No-ops if Ollama is unreachable.
app.post('/api/warm', async (c) => {
  const target = process.env.OLLAMA_HOST ?? 'http://localhost:11434';
  const model = process.env.OLLAMA_MODEL ?? 'gemma3:4b';
  fetch(`${target}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, prompt: 'hi', stream: false, options: { num_predict: 1 } }),
  }).catch(() => {});
  return c.json({ ok: true });
});

app.route('/api/merchant', merchantRoutes);
app.route('/api/merchant', menuRoutes);
app.route('/api/offer', offerRoutes);
app.route('/api/context', contextRoutes);

// Nearby merchants via query param
app.get('/api/merchants/nearby', async (c) => {
  const geohash6 = c.req.query('geohash6');
  if (!geohash6) return c.json({ error: 'geohash6 required' }, 400);
  const { createClient } = await import('@supabase/supabase-js');
  const ngeohash = (await import('ngeohash')).default;
  const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!);
  const neighbors = [geohash6, ...ngeohash.neighbors(geohash6)];
  const { data, error } = await supabase
    .from('merchants').select('*').in('geohash6', neighbors);
  if (error) return c.json({ error: error.message }, 500);
  return c.json(data ?? []);
});

// Owned merchants for a device — the picker hits this.
app.get('/api/merchants/owned', async (c) => {
  const device_id = c.req.query('device_id');
  if (!device_id) return c.json({ error: 'device_id required' }, 400);
  const { createClient } = await import('@supabase/supabase-js');
  const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!);
  const { data, error } = await supabase
    .from('merchants')
    .select('id, name, type, goal, max_discount_pct, lat, lng, created_at')
    .eq('owner_device_id', device_id)
    .order('created_at', { ascending: false });
  if (error) return c.json({ error: error.message }, 500);
  return c.json(data ?? []);
});

const port = parseInt(process.env.PORT ?? '3000', 10);
console.log(`Stadtpuls server starting on port ${port}`);

export default {
  port,
  fetch: app.fetch,
  // Default Bun.serve idleTimeout is 10s — too tight for LLM calls (Mistral
  // ~3-8s typical, but cold starts hit 15-25s). 60s gives us breathing room.
  idleTimeout: 60,
};
