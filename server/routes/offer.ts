import { Hono } from 'hono';
import { createClient } from '@supabase/supabase-js';
import { SignJWT } from 'jose';
import { getWeather } from '../lib/weather.ts';
import { getNearbyEvents } from '../lib/events.ts';
import { getPayoneDensity } from '../lib/payone-mock.ts';
import { getNearbyPOIs } from '../lib/pois.ts';
import { center, neighbors, distanceMeters } from '../lib/geohash.ts';
import { firedTriggers, scoreMerchant } from '../lib/composite.ts';
import { generateOffer } from '../lib/openai.ts';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET ?? 'dev-secret-change-me');

const offer = new Hono();

offer.post('/generate', async (c) => {
  const body = await c.req.json() as {
    geohash6: string;
    intent: Record<string, any>;
    locale: string;
    device_hash: string;
  };

  const { geohash6, intent, locale, device_hash } = body;
  const { lat, lng } = center(geohash6);
  const hour = new Date().getHours();

  // Parallel context fetch
  const [weather, events, pois, payone] = await Promise.all([
    getWeather(lat, lng),
    getNearbyEvents(lat, lng),
    getNearbyPOIs(lat, lng, 500),
    Promise.resolve(getPayoneDensity()),
  ]);

  const contextState: Record<string, any> = {
    geohash6,
    intent,
    weather,
    events: events.slice(0, 3),
    pois,
    payone,
    hour,
    locale,
    weather_source: weather.source, // 'owm' | 'dwd' — shown in transparency UI
    sent_at: new Date().toISOString(),
  };

  // Find nearby merchants
  const geohashes = neighbors(geohash6);
  const { data: merchantRows } = await supabase
    .from('merchants')
    .select('*')
    .in('geohash6', geohashes);

  if (!merchantRows || merchantRows.length === 0) {
    return c.json({ reason: 'no_nearby_merchant' }, 204);
  }

  // Freshness: which merchants shown to this device recently?
  const tenMinAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
  const { data: recentOffers } = await supabase
    .from('offers')
    .select('merchant_id, generated_at')
    .eq('customer_device_hash', device_hash)
    .gte('generated_at', tenMinAgo);

  const recentMap = new Map<string, number>();
  for (const o of (recentOffers ?? [])) {
    const minutesAgo = (Date.now() - new Date(o.generated_at).getTime()) / 60000;
    recentMap.set(o.merchant_id, Math.round(minutesAgo));
  }

  // Score each merchant
  const scored = merchantRows.map(m => {
    const dist = distanceMeters(lat, lng, m.lat, m.lng);
    const triggers = firedTriggers(
      {
        temp_c: contextState.weather.temp_c,
        condition: contextState.weather.condition,
        hour,
        events,
        payone_density: payone.density,
        intent: { browsing: intent.browsing ?? false },
      },
      m.type,
      m.inventory_tags ?? []
    );
    const lastSeen = recentMap.get(m.id) ?? 999;
    const score = scoreMerchant({ distance_m: dist, triggers, lastSeenMinutesAgo: lastSeen });
    return { merchant: m, dist, score, triggers };
  });

  scored.sort((a, b) => b.score - a.score);
  const best = scored[0];
  if (!best || best.score < -0.3) {
    return c.json({ reason: 'no_suitable_merchant' }, 204);
  }

  // Persist the triggers that fired so the why-screen can visualize them.
  contextState.fired_triggers = best.triggers;

  // Layout diversity bias: don't repeat the same layout for the same
  // device+merchant pair on consecutive refreshes — otherwise pull-to-refresh
  // can yield "different colors, same structure" which breaks the GenUI claim.
  const { data: lastOfferRow } = await supabase
    .from('offers')
    .select('widget_spec')
    .eq('customer_device_hash', device_hash)
    .eq('merchant_id', best.merchant.id)
    .order('generated_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  const previousLayout: string | undefined = lastOfferRow?.widget_spec?.layout;

  // Generate offer via OpenAI
  let widgetSpec: any;
  try {
    widgetSpec = await generateOffer({
      merchant: best.merchant,
      context: {
        ...contextState,
        distance_m: Math.round(best.dist),
        fired_triggers: best.triggers,
        previous_layout: previousLayout,
      },
      locale,
      distance_m: best.dist,
    });
    // Ensure merchant id/name/distance are set correctly
    widgetSpec.merchant = {
      id: best.merchant.id,
      name: best.merchant.name,
      distance_m: Math.round(best.dist),
    };
    // Post-process safeguard: force a different layout if model repeats.
    if (previousLayout && widgetSpec.layout === previousLayout) {
      const ALL = ['hero', 'compact', 'split', 'fullbleed', 'sticker'] as const;
      const pool = ALL.filter(l => l !== previousLayout);
      widgetSpec.layout = pool[Math.floor(Math.random() * pool.length)];
    }
  } catch {
    return c.json({ error: 'AI generation failed' }, 503);
  }

  const discountCents = widgetSpec.discount.kind === 'pct'
    ? null
    : widgetSpec.discount.kind === 'eur'
    ? Math.round(widgetSpec.discount.value * 100)
    : null;

  const expiresAt = new Date(Date.now() + widgetSpec.validity_minutes * 60 * 1000).toISOString();

  const { data: offerRow, error } = await supabase
    .from('offers')
    .insert({
      merchant_id: best.merchant.id,
      customer_device_hash: device_hash,
      widget_spec: widgetSpec,
      context_state: contextState,
      status: 'shown',
      discount_amount_cents: discountCents,
      redemption_kind: 'qr',
      expires_at: expiresAt,
    })
    .select()
    .single();

  if (error) return c.json({ error: error.message }, 500);

  // Broadcast to merchant realtime channel
  await supabase.channel(`merchant:${best.merchant.id}`).send({
    type: 'broadcast',
    event: 'offer.shown',
    payload: { type: 'offer.shown', offer_id: offerRow.id, ts: new Date().toISOString() },
  });

  return c.json({ id: offerRow.id, widget_spec: widgetSpec }, 200);
});

offer.get('/:id', async (c) => {
  const { data, error } = await supabase
    .from('offers')
    .select('*')
    .eq('id', c.req.param('id'))
    .single();
  if (error) return c.json({ error: 'Not found' }, 404);
  return c.json(data);
});

offer.post('/:id/decision', async (c) => {
  const { decision } = await c.req.json();
  const id = c.req.param('id');

  const { data, error } = await supabase
    .from('offers')
    .update({ status: decision === 'accepted' ? 'accepted' : 'declined' })
    .eq('id', id)
    .select('merchant_id, discount_amount_cents')
    .single();

  if (error) return c.json({ error: error.message }, 500);

  const eventType = decision === 'accepted' ? 'offer.accepted' : 'offer.declined';
  await supabase.channel(`merchant:${data.merchant_id}`).send({
    type: 'broadcast',
    event: eventType,
    payload: {
      type: eventType,
      offer_id: id,
      discount_amount_cents: data.discount_amount_cents,
      ts: new Date().toISOString(),
    },
  });

  return c.json({ ok: true });
});

offer.post('/:id/qr', async (c) => {
  const id = c.req.param('id');
  const jti = crypto.randomUUID();
  const token = await new SignJWT({ sub: id, jti })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('5m')
    .sign(JWT_SECRET);

  // Store QR value as "offerId|token" so scanner can extract both
  const qrValue = `${id}|${token}`;
  return c.json({ token: qrValue, expires_in: 300 });
});

offer.post('/:id/redeem-qr', async (c) => {
  const id = c.req.param('id');
  const { token } = await c.req.json();

  const parts = (token as string).split('|');
  const jwt = parts[1] ?? token;

  // Verify JWT
  try {
    const { joseVerify } = await import('jose');
    // use dynamic import workaround
  } catch {}

  const { jwtVerify } = await import('jose');
  try {
    await jwtVerify(jwt, JWT_SECRET);
  } catch {
    return c.json({ error: 'Invalid or expired token' }, 400);
  }

  // Check not already redeemed
  const { data: existing } = await supabase
    .from('redemptions')
    .select('id')
    .eq('offer_id', id)
    .single();

  if (existing) return c.json({ error: 'Already redeemed' }, 409);

  // Mark redeemed
  await supabase.from('redemptions').insert({ offer_id: id, token_jti: jwt.slice(-8) });
  const { data: offerData } = await supabase
    .from('offers')
    .update({ status: 'redeemed' })
    .eq('id', id)
    .select('merchant_id, discount_amount_cents')
    .single();

  if (offerData) {
    await supabase.channel(`merchant:${offerData.merchant_id}`).send({
      type: 'broadcast',
      event: 'offer.redeemed',
      payload: {
        type: 'offer.redeemed',
        offer_id: id,
        discount_amount_cents: offerData.discount_amount_cents,
        ts: new Date().toISOString(),
      },
    });
  }

  return c.json({ ok: true, discount_amount_cents: offerData?.discount_amount_cents });
});

offer.post('/:id/redeem-cashback', async (c) => {
  const id = c.req.param('id');

  const { data: existing } = await supabase
    .from('redemptions')
    .select('id')
    .eq('offer_id', id)
    .single();

  if (existing) return c.json({ error: 'Already redeemed' }, 409);

  await supabase.from('redemptions').insert({ offer_id: id, token_jti: 'cashback' });
  const { data: offerData } = await supabase
    .from('offers')
    .update({ status: 'redeemed', redemption_kind: 'cashback' })
    .eq('id', id)
    .select('merchant_id, discount_amount_cents')
    .single();

  if (offerData) {
    await supabase.channel(`merchant:${offerData.merchant_id}`).send({
      type: 'broadcast',
      event: 'offer.redeemed',
      payload: {
        type: 'offer.redeemed',
        offer_id: id,
        discount_amount_cents: offerData.discount_amount_cents,
        ts: new Date().toISOString(),
      },
    });
  }

  return c.json({ ok: true });
});

export default offer;
