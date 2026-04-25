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
  return c.redirect(`/api/merchant/nearby?geohash6=${geohash6}`);
});

const port = parseInt(process.env.PORT ?? '3000', 10);
console.log(`City Wallet server starting on port ${port}`);

export default {
  port,
  fetch: app.fetch,
};
