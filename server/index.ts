import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import merchantRoutes from './routes/merchant.ts';
import offerRoutes from './routes/offer.ts';
import menuRoutes from './routes/menu.ts';

const app = new Hono();

app.use('*', cors());
app.use('*', logger());

app.get('/health', (c) => c.json({ ok: true, ts: new Date().toISOString() }));

app.route('/api/merchant', merchantRoutes);
app.route('/api/merchant', menuRoutes);
app.route('/api/offer', offerRoutes);

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
