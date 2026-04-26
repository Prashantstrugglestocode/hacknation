import { Hono } from 'hono';
import { createClient } from '@supabase/supabase-js';
import { SignJWT } from 'jose';
import { getWeather } from '../lib/weather.ts';
import { getNearbyEvents } from '../lib/events.ts';
import { getPayoneDensity, getMerchantPayoneSignal } from '../lib/payone-mock.ts';
import { getNearbyPOIs } from '../lib/pois.ts';
import { center, neighbors, distanceMeters } from '../lib/geohash.ts';
import { firedTriggers, scoreMerchant, footTrafficFromPOI } from '../lib/composite.ts';
import { generateOffer, explainBestOffer } from '../lib/openai.ts';
import { getFlash, listFlash } from '../lib/flash.ts';
import { listCombos } from '../lib/combos.ts';

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
  const { data: allNearby } = await supabase
    .from('merchants')
    .select('*')
    .in('geohash6', geohashes);

  if (!allNearby || allNearby.length === 0) {
    return c.json({ reason: 'no_nearby_merchant' }, 204);
  }

  // Once-per-day claim rule (mirrors /feed): exclude merchants the customer
  // has already claimed today (accepted / scan_pending / redeemed).
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const { data: claimedToday } = await supabase
    .from('offers').select('merchant_id, status')
    .eq('customer_device_hash', device_hash)
    .gte('generated_at', startOfToday.toISOString())
    .in('status', ['accepted', 'scan_pending', 'redeemed']);
  const claimedSet = new Set((claimedToday ?? []).map(r => r.merchant_id));
  const merchantRows = allNearby.filter(m => !claimedSet.has(m.id));
  if (merchantRows.length === 0) {
    return c.json({ reason: 'all_claimed_today' }, 204);
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

  // Score each merchant. Per-merchant Payone density is the DSV-asset signal:
  // two cafés on the same street can have different transaction load right
  // now, and the system surfaces an offer for the QUIET one (matching the
  // "fill quiet hours" goal in the brief).
  const scored = merchantRows.map(m => {
    const dist = distanceMeters(lat, lng, m.lat, m.lng);
    const merchantPayone = getMerchantPayoneSignal(m.id, m.type, hour);
    const triggers = firedTriggers(
      {
        temp_c: contextState.weather.temp_c,
        condition: contextState.weather.condition,
        hour,
        events,
        payone_density: merchantPayone.density,
        foot_traffic: footTrafficFromPOI(pois.total),
        intent: { browsing: intent.browsing ?? false },
      },
      m.type,
      m.inventory_tags ?? []
    );
    const lastSeen = recentMap.get(m.id) ?? 999;
    const score = scoreMerchant({ distance_m: dist, triggers, lastSeenMinutesAgo: lastSeen });
    return { merchant: m, dist, score, triggers, payone: merchantPayone };
  });

  scored.sort((a, b) => b.score - a.score);
  const best = scored[0];
  if (!best || best.score < -0.3) {
    return c.json({ reason: 'no_suitable_merchant' }, 204);
  }

  // Persist the triggers that fired so the why-screen can visualize them.
  contextState.fired_triggers = best.triggers;
  // Surface the per-merchant Payone signal in the context state so the
  // why-screen and merchant dashboard can show "your shop is quiet right now"
  // alongside the global area density.
  contextState.merchant_payone = best.payone;

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

  // Fetch the merchant's actual menu_items — the LLM uses these to ground
  // headline copy in real products instead of generic merchant.inventory_tags.
  const { data: menuItemRows } = await supabase
    .from('menu_items')
    .select('id, name, price_cents, category, tags')
    .eq('merchant_id', best.merchant.id)
    .eq('active', true);
  const menuItems = menuItemRows ?? [];
  if (menuItems.length > 0) {
    contextState.menu_items = menuItems;
  }

  // Active flash-sale (merchant-managed boost). Resolve the menu_item_ids to
  // full item rows so the LLM can name them by name in the headline.
  const flash = getFlash(best.merchant.id);
  if (flash) {
    const flashItems = menuItems.filter(it => flash.menu_item_ids.includes(it.id));
    contextState.flash_sale = {
      items: flashItems,
      menu_item_ids: flash.menu_item_ids,
      pct: flash.pct,
      minutes_left: Math.max(0, Math.round((flash.until - Date.now()) / 60000)),
    };
  }

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
        flash_sale: contextState.flash_sale,
        menu_items: contextState.menu_items,
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

  // Write offer_item_links so insights can attribute performance back to
  // specific menu_items. Only insert ids that actually exist in this
  // merchant's menu (the model occasionally hallucinates UUIDs).
  const featuredIds: string[] = Array.isArray(widgetSpec.featured_item_ids) ? widgetSpec.featured_item_ids : [];
  const validIds = featuredIds.filter(id => menuItems.some(it => it.id === id));
  if (validIds.length > 0) {
    await supabase
      .from('offer_item_links')
      .insert(validIds.map(menu_item_id => ({ offer_id: offerRow.id, menu_item_id })))
      .then(() => {})
      .catch(() => {}); // best-effort; never block the response
  }

  // Broadcast to merchant realtime channel
  await supabase.channel(`merchant:${best.merchant.id}`).send({
    type: 'broadcast',
    event: 'offer.shown',
    payload: { type: 'offer.shown', offer_id: offerRow.id, ts: new Date().toISOString() },
  });

  return c.json({ id: offerRow.id, widget_spec: widgetSpec }, 200);
});

// Feed endpoint: returns up to N parallel offers from the top-scored
// nearby merchants. Lets the customer home render a stack of cards rather
// than one at a time. Falls back to whatever count exists if fewer than N
// merchants are within range.
offer.post('/feed', async (c) => {
  const body = await c.req.json() as {
    geohash6: string;
    intent: Record<string, any>;
    locale: string;
    device_hash: string;
    count?: number;
  };

  const { geohash6, intent, locale, device_hash } = body;
  const count = Math.max(1, Math.min(5, body.count ?? 3));
  const { lat, lng } = center(geohash6);
  const hour = new Date().getHours();

  const [weather, events, pois, payone] = await Promise.all([
    getWeather(lat, lng),
    getNearbyEvents(lat, lng),
    getNearbyPOIs(lat, lng, 500),
    Promise.resolve(getPayoneDensity()),
  ]);

  const baseContext: Record<string, any> = {
    geohash6, intent, weather,
    events: events.slice(0, 3), pois, payone, hour, locale,
    weather_source: weather.source,
    sent_at: new Date().toISOString(),
  };

  const geohashes = neighbors(geohash6);
  let { data: allNearby } = await supabase
    .from('merchants').select('*').in('geohash6', geohashes);
  // Wider-radius fallback. geohash6 cells are ~1.2km wide, so
  // neighbors() is roughly a 3.6km box. For a two-phone demo where
  // phones may be across town, pull ALL merchants and rank by raw
  // distance up to 25km when the local search yields nothing useful.
  // Keeps proximity scoring intact (closer merchants still score higher)
  // but prevents the empty-feed footgun.
  if (!allNearby || allNearby.length < 3) {
    const { data: wider } = await supabase.from('merchants').select('*');
    if (wider && wider.length > 0) {
      const local = new Set((allNearby ?? []).map(m => m.id));
      const extra = wider.filter(m => {
        if (local.has(m.id)) return false;
        const d = distanceMeters(lat, lng, m.lat, m.lng);
        return d <= 25_000;
      });
      allNearby = [...(allNearby ?? []), ...extra];
    }
  }
  if (!allNearby || allNearby.length === 0) {
    return c.json({ offers: [] });
  }

  // Per-flash / per-combo claim rule (replaces the old per-merchant rule).
  // A customer can only claim each SPECIFIC flash or combo once per day, but
  // different flashes from the same merchant remain independently claimable.
  // Bare offers (no flash, no combo) still fall back to the per-merchant rule
  // because there's no narrower handle to dedupe on.
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const { data: claimedToday } = await supabase
    .from('offers').select('merchant_id, status, widget_spec')
    .eq('customer_device_hash', device_hash)
    .gte('generated_at', startOfToday.toISOString())
    .in('status', ['accepted', 'scan_pending', 'redeemed']);
  const claimedFlashIds = new Set<string>();
  const claimedComboIds = new Set<string>();
  const claimedBareMerchantIds = new Set<string>();
  for (const row of (claimedToday ?? [])) {
    const spec = (row as any).widget_spec ?? {};
    const fid = spec.flash_id;
    const cid = spec.combo_id;
    if (typeof fid === 'string' && fid.length > 0) claimedFlashIds.add(fid);
    if (typeof cid === 'string' && cid.length > 0) claimedComboIds.add(cid);
    if (!fid && !cid) claimedBareMerchantIds.add((row as any).merchant_id);
  }
  // No merchant-level pre-filter anymore — every merchant stays in the pool;
  // we filter at the candidate-tuple level a few lines below.
  const merchantRows = allNearby;
  if (merchantRows.length === 0) {
    return c.json({ offers: [] });
  }

  // Skip merchants whose menu was just deleted — the LLM falls back to
  // generic copy and the customer keeps seeing stale "offers" for a shop
  // with nothing to sell. BUT a merchant with active flash deals or combos
  // is still pitchable — those reference real items, even if no standalone
  // active menu_items exist. Two-phone demo footgun: phone B sets up a
  // merchant + adds a flash but hasn't toggled menu items active → phone A
  // saw nothing because the strict menu filter excluded them. Now we keep
  // any merchant with EITHER active menu items OR active flash/combo state.
  const merchantIds = merchantRows.map(m => m.id);
  const { data: menuMap } = await supabase
    .from('menu_items')
    .select('merchant_id')
    .in('merchant_id', merchantIds)
    .eq('active', true);
  const merchantsWithMenu = new Set((menuMap ?? []).map(r => r.merchant_id));
  const merchantsWithLiveOffers = merchantRows.filter(m => {
    if (merchantsWithMenu.has(m.id)) return true;
    if (listFlash(m.id).length > 0) return true;
    if (listCombos(m.id).length > 0) return true;
    return false;
  });
  const usableMerchants = merchantsWithLiveOffers;
  if (usableMerchants.length === 0) {
    return c.json({ offers: [] });
  }

  const tenMinAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
  const { data: recentOffers } = await supabase
    .from('offers').select('merchant_id, generated_at')
    .eq('customer_device_hash', device_hash)
    .gte('generated_at', tenMinAgo);
  const recentMap = new Map<string, number>();
  for (const o of (recentOffers ?? [])) {
    const minutesAgo = (Date.now() - new Date(o.generated_at).getTime()) / 60000;
    recentMap.set(o.merchant_id, Math.round(minutesAgo));
  }

  const scored = usableMerchants.map(m => {
    const dist = distanceMeters(lat, lng, m.lat, m.lng);
    const merchantPayone = getMerchantPayoneSignal(m.id, m.type, hour);
    const triggers = firedTriggers(
      {
        temp_c: baseContext.weather.temp_c,
        condition: baseContext.weather.condition,
        hour, events,
        payone_density: merchantPayone.density,
        foot_traffic: footTrafficFromPOI(pois.total),
        intent: { browsing: intent.browsing ?? false },
      },
      m.type,
      m.inventory_tags ?? []
    );
    const lastSeen = recentMap.get(m.id) ?? 999;
    const score = scoreMerchant({ distance_m: dist, triggers, lastSeenMinutesAgo: lastSeen });
    return { merchant: m, dist, score, triggers, payone: merchantPayone };
  });
  scored.sort((a, b) => b.score - a.score);
  const viable = scored.filter(s => s.score >= -0.3);

  // Per-merchant flash expansion: each active flash deal becomes its own
  // candidate card. A merchant with 3 flashes shows 3 cards, each pitched
  // around a different flash via pinned_flash_id (LLM is forced to pitch
  // that specific flash, see openai.ts prompt). Merchants with no active
  // flashes still produce 1 generic card. Hard cap: 3 flash cards per
  // merchant in a single feed so a single shop can't drown out the rest.
  const FLASH_CARDS_PER_MERCHANT = 3;
  type Candidate = typeof viable[number] & { pinnedFlashId?: string };
  const candidates: Candidate[] = [];
  for (const entry of viable) {
    const flashes = listFlash(entry.merchant.id)
      // Per-flash claim filter: skip flashes this device already claimed today.
      .filter(f => !claimedFlashIds.has(f.id))
      .slice(0, FLASH_CARDS_PER_MERCHANT);
    if (flashes.length === 0) {
      // No flashes available — emit a bare candidate UNLESS this merchant was
      // already bare-claimed today (in which case there's nothing new to show).
      if (!claimedBareMerchantIds.has(entry.merchant.id)) {
        candidates.push(entry);
      }
    } else {
      for (const f of flashes) {
        candidates.push({ ...entry, pinnedFlashId: f.id });
      }
    }
  }
  // Effective count: bump the requested count if the top merchant has
  // multiple flashes — judges expect to see all the flash variants the
  // merchant just configured, not just one.
  const effectiveCount = Math.max(count, Math.min(5, candidates.length));
  const top = candidates.slice(0, effectiveCount);

  // Diversity bias: collect items + combos this device saw in the last 30 min
  // so the LLM avoids re-pitching the same things on pull-to-refresh. The
  // dedupe is across ALL nearby merchants, not just one — the user-visible
  // problem is "I keep seeing Cappuccino", not "merchant X keeps showing X".
  const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();
  const { data: recentShownOffers } = await supabase
    .from('offers')
    .select('widget_spec')
    .eq('customer_device_hash', device_hash)
    .gte('generated_at', thirtyMinAgo)
    .limit(10);
  const recentlyShownItemNames = new Set<string>();
  const recentlyPitchedComboIds = new Set<string>();
  for (const row of (recentShownOffers ?? [])) {
    const spec = row.widget_spec as any;
    const head = (spec?.headline ?? '').trim();
    if (head) recentlyShownItemNames.add(head);
    const ids: any = spec?.featured_item_ids;
    if (Array.isArray(ids)) for (const id of ids) recentlyShownItemNames.add(String(id));
    const cid = spec?.combo_id;
    if (typeof cid === 'string' && cid.length > 0) recentlyPitchedComboIds.add(cid);
  }

  // Generate offers in parallel. Each one persists + broadcasts independently
  // so the merchant dashboard tick still fires for every visible card.
  // We also dedupe in-feed: track items featured in earlier-resolving siblings
  // and bias the next prompt against them. (Promise.all races, so this is
  // best-effort — the real guarantee is the recently_shown_item_names DB
  // query above which spans the whole 30-min window.)
  const inFeedFeaturedItemNames = new Set<string>();
  const inFeedComboIds = new Set<string>();
  const results = await Promise.all(top.map(async (entry) => {
    try {
      // Loyalty signal: how many times has THIS device redeemed at THIS merchant?
      // Drives the "3rd visit" / "Stammkunde" chip on the offer card.
      const { count: loyaltyCount } = await supabase
        .from('offers')
        .select('id', { count: 'exact', head: true })
        .eq('customer_device_hash', device_hash)
        .eq('merchant_id', entry.merchant.id)
        .eq('status', 'redeemed');

      const { data: lastOfferRow } = await supabase
        .from('offers').select('widget_spec')
        .eq('customer_device_hash', device_hash)
        .eq('merchant_id', entry.merchant.id)
        .order('generated_at', { ascending: false }).limit(1).maybeSingle();
      const previousLayout: string | undefined = lastOfferRow?.widget_spec?.layout;

      const { data: menuItemRows } = await supabase
        .from('menu_items').select('id, name, price_cents, category, tags')
        .eq('merchant_id', entry.merchant.id).eq('active', true);
      const menuItems = menuItemRows ?? [];

      // Multi-flash: gather every active flash for this merchant. Each is
      // enriched with its menu_items + combos so the LLM has enough context
      // to pick the weather/time-best fit. When this card is pinned to a
      // specific flash (entry.pinnedFlashId set), we filter down to JUST
      // that flash so the prompt has only one option to pitch.
      const allFlashesRaw = listFlash(entry.merchant.id);
      const allFlashes = entry.pinnedFlashId
        ? allFlashesRaw.filter(f => f.id === entry.pinnedFlashId)
        : allFlashesRaw;
      const enrichedFlashes = allFlashes.map(f => {
        const flashCombos = f.combo_ids.length > 0
          ? listCombos(entry.merchant.id)
              .filter(co => f.combo_ids.includes(co.id))
              .map(co => {
                const items = co.menu_item_ids
                  .map(iid => menuItems.find(it => it.id === iid))
                  .filter(Boolean) as any[];
                const baseSum = items.reduce((s, it) => s + (it?.price_cents ?? 0), 0);
                return {
                  id: co.id, name: co.name, items,
                  combo_price_cents: co.combo_price_cents,
                  base_total_cents: baseSum,
                  savings_cents: Math.max(0, baseSum - co.combo_price_cents),
                };
              })
          : [];
        return {
          id: f.id,
          items: menuItems.filter(it => f.menu_item_ids.includes(it.id)),
          menu_item_ids: f.menu_item_ids,
          combos: flashCombos,
          pct: f.pct,
          minutes_left: Math.max(0, Math.round((f.until - Date.now()) / 60000)),
        };
      });
      // Back-compat single flashCtx (for callers/prompt rules still on the
      // legacy "flash_sale" field). Picks the most-recently-created.
      const flashCtx = enrichedFlashes.length > 0 ? enrichedFlashes[0] : undefined;

      // Combos: enriched bundles the LLM can pitch as a single offer.
      // Filter out:
      //   - combos already pitched to this device in the last 30 min (diversity)
      //   - combos already CLAIMED by this device today (per-combo daily rule)
      //   - combos pitched by an earlier-resolving sibling in this same feed
      const combosForMerchant = listCombos(entry.merchant.id)
        .filter(co =>
          !recentlyPitchedComboIds.has(co.id)
          && !inFeedComboIds.has(co.id)
          && !claimedComboIds.has(co.id)
        );
      // Fallback: if dedupe wiped everything, surface the original list rather
      // than starve the LLM of combo context entirely.
      const combosPool = combosForMerchant.length > 0
        ? combosForMerchant
        : listCombos(entry.merchant.id);
      const combosCtx = combosPool.length > 0
        ? combosPool.map(co => {
            const items = co.menu_item_ids
              .map(iid => menuItems.find(it => it.id === iid))
              .filter(Boolean) as any[];
            const baseSum = items.reduce((s, it) => s + (it?.price_cents ?? 0), 0);
            return {
              id: co.id,
              name: co.name,
              items,
              combo_price_cents: co.combo_price_cents,
              base_total_cents: baseSum,
              savings_cents: Math.max(0, baseSum - co.combo_price_cents),
            };
          })
        : undefined;

      const widgetSpec: any = await generateOffer({
        merchant: entry.merchant,
        context: {
          ...baseContext,
          distance_m: Math.round(entry.dist),
          fired_triggers: entry.triggers,
          previous_layout: previousLayout,
          flash_sale: flashCtx,
          flash_sales: enrichedFlashes.length > 0 ? enrichedFlashes : undefined,
          pinned_flash_id: entry.pinnedFlashId,
          combos: combosCtx,
          menu_items: menuItems.length > 0 ? menuItems : undefined,
          // Diversity hints — see comment block above the Promise.all().
          recently_shown_item_names: [
            ...recentlyShownItemNames,
            ...inFeedFeaturedItemNames,
          ].slice(0, 12),
          recently_pitched_combo_ids: [
            ...recentlyPitchedComboIds,
            ...inFeedComboIds,
          ].slice(0, 12),
        },
        locale,
        distance_m: entry.dist,
      });
      widgetSpec.merchant = {
        id: entry.merchant.id,
        name: entry.merchant.name,
        distance_m: Math.round(entry.dist),
      };
      // Persist the pinned flash id on the spec so the daily-claim rule can
      // dedupe per-flash (not per-merchant). Without this, every flash on
      // the same shop counts as one redemption.
      if (entry.pinnedFlashId) {
        widgetSpec.flash_id = entry.pinnedFlashId;
      }
      // Track what we just pitched so other siblings in this Promise.all
      // batch can avoid duplicating it. Best-effort under parallelism.
      if (typeof widgetSpec.headline === 'string') {
        inFeedFeaturedItemNames.add(widgetSpec.headline.trim());
      }
      if (Array.isArray(widgetSpec.featured_item_ids)) {
        for (const id of widgetSpec.featured_item_ids) inFeedFeaturedItemNames.add(String(id));
      }
      // Heuristic: if the LLM pitched a combo, the headline names it; we
      // store the matching combo id so refreshes diversify.
      if (combosCtx) {
        for (const co of combosCtx) {
          if (typeof widgetSpec.headline === 'string' && widgetSpec.headline.toLowerCase().includes(co.name.toLowerCase())) {
            widgetSpec.combo_id = co.id;
            inFeedComboIds.add(co.id);
            break;
          }
        }
      }
      if (previousLayout && widgetSpec.layout === previousLayout) {
        const ALL = ['hero', 'compact', 'split', 'fullbleed', 'sticker'] as const;
        const pool = ALL.filter(l => l !== previousLayout);
        widgetSpec.layout = pool[Math.floor(Math.random() * pool.length)];
      }

      // Settle the math here, in one place, so slide-to-pay and savings tile
      // never disagree:
      //   base_amount_cents  = real menu-item price if known, else widget default
      //   discount_amount_cents = EUR (exact) | PCT (base × pct/100) | item (20%)
      //   total_amount_cents = base − discount  (computed client-side)
      const featuredId = Array.isArray(widgetSpec.featured_item_ids) ? widgetSpec.featured_item_ids[0] : undefined;
      const featuredItem = featuredId ? menuItems.find(it => it.id === featuredId) : undefined;
      if (featuredItem?.price_cents) {
        widgetSpec.base_amount_cents = featuredItem.price_cents;
      }
      const baseCents = widgetSpec.base_amount_cents ?? 1200;
      const discountCents = widgetSpec.discount.kind === 'eur'
        ? Math.round(widgetSpec.discount.value * 100)
        : widgetSpec.discount.kind === 'pct'
        ? Math.round(baseCents * (widgetSpec.discount.value / 100))
        : Math.max(50, Math.round(baseCents * 0.2));
      const expiresAt = new Date(Date.now() + widgetSpec.validity_minutes * 60 * 1000).toISOString();
      const ctxState = {
        ...baseContext,
        fired_triggers: entry.triggers,
        merchant_payone: entry.payone,
      };
      const { data: offerRow } = await supabase
        .from('offers').insert({
          merchant_id: entry.merchant.id,
          customer_device_hash: device_hash,
          widget_spec: widgetSpec,
          context_state: ctxState,
          status: 'shown',
          discount_amount_cents: discountCents,
          redemption_kind: 'qr',
          expires_at: expiresAt,
        }).select().single();

      if (offerRow) {
        await supabase.channel(`merchant:${entry.merchant.id}`).send({
          type: 'broadcast', event: 'offer.shown',
          payload: { type: 'offer.shown', offer_id: offerRow.id, ts: new Date().toISOString() },
        });
        return {
          id: offerRow.id,
          widget_spec: widgetSpec,
          your_redemptions_at_merchant: loyaltyCount ?? 0,
        };
      }
      return null;
    } catch {
      return null;
    }
  }));

  return c.json({ offers: results.filter(Boolean) });
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

// AI advisor: takes the offer feed the customer is currently looking at and
// returns one Mistral-generated sentence saying which deal saves them more
// and why. Pure copy — the math/winner is decided client-side; this just
// puts language around it. Fire-and-forget from the client so a slow LLM
// call never blocks the feed render.
offer.post('/advisor/explain', async (c) => {
  const body = await c.req.json() as {
    locale: string;
    winner_id: string;
    offers: Array<{
      id: string;
      headline: string;
      merchant_name: string;
      base_amount_cents: number;
      discount_amount_cents: number;
      pct?: number | null;
    }>;
  };
  const { locale, winner_id, offers } = body;
  if (!Array.isArray(offers) || offers.length < 2) {
    return c.json({ explanation: '' });
  }
  const winnerIndex = offers.findIndex(o => o.id === winner_id);
  if (winnerIndex < 0) return c.json({ explanation: '' });
  const explanation = await explainBestOffer({
    locale: locale === 'en' ? 'en' : 'de',
    offers: offers.map(o => ({
      headline: o.headline,
      merchant_name: o.merchant_name,
      base_amount_cents: o.base_amount_cents,
      discount_amount_cents: o.discount_amount_cents,
      pct: o.pct ?? null,
    })),
    winnerIndex,
  });
  return c.json({ explanation });
});

// Per-customer savings — sum of discount_amount_cents across all offers this
// device redeemed. Backs the "Gespart" total on the LiveHeader so the number
// reflects real DB state instead of a local AsyncStorage estimate that wipes
// on Forget Me. Tied to customer_device_hash, so each phone gets its own.
offer.get('/savings/:device_hash', async (c) => {
  const deviceHash = c.req.param('device_hash');
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const { data: redeemed } = await supabase
    .from('offers')
    .select('id, discount_amount_cents, generated_at, widget_spec')
    .eq('customer_device_hash', deviceHash)
    .eq('status', 'redeemed')
    .order('generated_at', { ascending: false });

  const list = redeemed ?? [];
  const total_cents = list.reduce((s, o) => s + (o.discount_amount_cents ?? 0), 0);
  const count_total = list.length;
  const count_this_week = list.filter(o => o.generated_at >= weekAgo).length;
  const recent = list.slice(0, 5).map(o => ({
    offer_id: o.id,
    amount_cents: o.discount_amount_cents ?? 0,
    merchant_name: (o.widget_spec as any)?.merchant?.name ?? '',
    ts: new Date(o.generated_at).getTime(),
  }));

  return c.json({
    total_eur: total_cents / 100,
    count_total,
    count_this_week,
    recent,
  });
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
    .setExpirationTime('10m')
    .sign(JWT_SECRET);

  // Store QR value as "offerId|token" so scanner can extract both
  const qrValue = `${id}|${token}`;
  return c.json({ token: qrValue, expires_in: 600 });
});

// Two-phase QR redemption (per user demand for an explicit slide-to-pay
// confirmation step):
//   /redeem-qr     → validates token, marks status='scan_pending', broadcasts
//                    offer.scan_pending so the customer's redeem screen can
//                    swap the QR for a slide-to-pay prompt.
//   /confirm-payment → customer slides → marks status='redeemed', writes the
//                    redemption row, broadcasts offer.redeemed for both phones.
offer.post('/:id/redeem-qr', async (c) => {
  const id = c.req.param('id');
  const { token } = await c.req.json();

  const parts = (token as string).split('|');
  const jwt = parts[1] ?? token;

  const { jwtVerify } = await import('jose');
  try {
    await jwtVerify(jwt, JWT_SECRET);
  } catch {
    return c.json({ error: 'Invalid or expired token' }, 400);
  }

  // Hard guard: already-redeemed offers can't be re-scanned.
  const { data: existingRedemption } = await supabase
    .from('redemptions').select('id').eq('offer_id', id).single();
  if (existingRedemption) return c.json({ error: 'Already redeemed' }, 409);

  // Look up the offer first so we can enforce the once-per-day rule
  // before we mutate it. (Otherwise a re-scan would still flip status.)
  const { data: offerLookup } = await supabase
    .from('offers')
    .select('merchant_id, customer_device_hash, discount_amount_cents, widget_spec')
    .eq('id', id)
    .single();
  if (!offerLookup) return c.json({ error: 'Offer not found' }, 404);

  // Per-flash / per-combo daily-claim rule. Different flash deals from the
  // same merchant are independently redeemable; each individual flash or
  // combo is single-use per customer per day. Bare offers (no flash/combo)
  // fall back to the per-merchant rule.
  const lookupSpec = (offerLookup.widget_spec as any) ?? {};
  const lookupFlashId: string | null = typeof lookupSpec.flash_id === 'string' ? lookupSpec.flash_id : null;
  const lookupComboId: string | null = typeof lookupSpec.combo_id === 'string' ? lookupSpec.combo_id : null;
  const startOfToday = new Date(); startOfToday.setHours(0, 0, 0, 0);
  const { data: sameDayClaims } = await supabase
    .from('offers').select('id, status, widget_spec, merchant_id')
    .eq('customer_device_hash', offerLookup.customer_device_hash)
    .gte('generated_at', startOfToday.toISOString())
    .in('status', ['scan_pending', 'redeemed'])
    .neq('id', id);
  const conflicts = (sameDayClaims ?? []).filter(r => {
    const s = (r as any).widget_spec ?? {};
    if (lookupFlashId && s.flash_id === lookupFlashId) return true;
    if (lookupComboId && s.combo_id === lookupComboId) return true;
    if (!lookupFlashId && !lookupComboId
        && !s.flash_id && !s.combo_id
        && r.merchant_id === offerLookup.merchant_id) return true;
    return false;
  });
  if (conflicts.length > 0) {
    const reason = lookupFlashId
      ? 'Diese Flash-Aktion hast du heute schon eingelöst'
      : lookupComboId
      ? 'Diese Combo hast du heute schon eingelöst'
      : 'Already claimed today at this merchant';
    return c.json({ error: reason, code: 'DAILY_LIMIT' }, 429);
  }

  const { data: offerData } = await supabase
    .from('offers')
    .update({ status: 'scan_pending' })
    .eq('id', id)
    .select('merchant_id, discount_amount_cents, widget_spec')
    .single();
  if (!offerData) return c.json({ error: 'Offer not found' }, 404);

  const baseCents = (offerData.widget_spec as any)?.base_amount_cents ?? null;
  const merchantName = (offerData.widget_spec as any)?.merchant?.name ?? null;
  const payload = {
    type: 'offer.scan_pending' as const,
    offer_id: id,
    discount_amount_cents: offerData.discount_amount_cents,
    base_amount_cents: baseCents,
    merchant_name: merchantName,
    ts: new Date().toISOString(),
  };
  await supabase.channel(`merchant:${offerData.merchant_id}`).send({
    type: 'broadcast', event: 'offer.scan_pending', payload,
  });
  await supabase.channel(`offer:${id}`).send({
    type: 'broadcast', event: 'offer.scan_pending', payload,
  });
  return c.json({
    ok: true,
    pending: true,
    discount_amount_cents: offerData.discount_amount_cents,
    base_amount_cents: baseCents,
  });
});

offer.post('/:id/confirm-payment', async (c) => {
  const id = c.req.param('id');

  const { data: existingRedemption } = await supabase
    .from('redemptions').select('id').eq('offer_id', id).single();
  if (existingRedemption) return c.json({ error: 'Already redeemed' }, 409);

  await supabase.from('redemptions').insert({ offer_id: id, token_jti: 'slide' });
  const { data: offerData } = await supabase
    .from('offers')
    .update({ status: 'redeemed' })
    .eq('id', id)
    .select('merchant_id, discount_amount_cents')
    .single();

  if (offerData) {
    const payload = {
      type: 'offer.redeemed' as const,
      offer_id: id,
      discount_amount_cents: offerData.discount_amount_cents,
      redemption_kind: 'qr' as const,
      ts: new Date().toISOString(),
    };
    // Merchant dashboard listens on this channel.
    await supabase.channel(`merchant:${offerData.merchant_id}`).send({
      type: 'broadcast', event: 'offer.redeemed', payload,
    });
    // Customer redeem screen listens on this per-offer channel so the QR
    // can morph into a payment-confirmation receipt the moment the merchant
    // scans it.
    await supabase.channel(`offer:${id}`).send({
      type: 'broadcast', event: 'offer.redeemed', payload,
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

  // Per-flash / per-combo daily guard (mirrors /redeem-qr).
  const { data: cashLookup } = await supabase
    .from('offers').select('merchant_id, customer_device_hash, widget_spec').eq('id', id).single();
  if (cashLookup) {
    const cashSpec = (cashLookup.widget_spec as any) ?? {};
    const cashFlashId: string | null = typeof cashSpec.flash_id === 'string' ? cashSpec.flash_id : null;
    const cashComboId: string | null = typeof cashSpec.combo_id === 'string' ? cashSpec.combo_id : null;
    const startOfToday = new Date(); startOfToday.setHours(0, 0, 0, 0);
    const { data: sameDayClaims } = await supabase
      .from('offers').select('id, status, widget_spec, merchant_id')
      .eq('customer_device_hash', cashLookup.customer_device_hash)
      .gte('generated_at', startOfToday.toISOString())
      .in('status', ['scan_pending', 'redeemed'])
      .neq('id', id);
    const conflicts = (sameDayClaims ?? []).filter(r => {
      const s = (r as any).widget_spec ?? {};
      if (cashFlashId && s.flash_id === cashFlashId) return true;
      if (cashComboId && s.combo_id === cashComboId) return true;
      if (!cashFlashId && !cashComboId
          && !s.flash_id && !s.combo_id
          && r.merchant_id === cashLookup.merchant_id) return true;
      return false;
    });
    if (conflicts.length > 0) {
      return c.json({ error: 'Already claimed today (this flash/combo)', code: 'DAILY_LIMIT' }, 429);
    }
  }

  await supabase.from('redemptions').insert({ offer_id: id, token_jti: 'cashback' });
  const { data: offerData } = await supabase
    .from('offers')
    .update({ status: 'redeemed', redemption_kind: 'cashback' })
    .eq('id', id)
    .select('merchant_id, discount_amount_cents')
    .single();

  if (offerData) {
    const payload = {
      type: 'offer.redeemed' as const,
      offer_id: id,
      discount_amount_cents: offerData.discount_amount_cents,
      redemption_kind: 'cashback' as const,
      ts: new Date().toISOString(),
    };
    await supabase.channel(`merchant:${offerData.merchant_id}`).send({
      type: 'broadcast', event: 'offer.redeemed', payload,
    });
    await supabase.channel(`offer:${id}`).send({
      type: 'broadcast', event: 'offer.redeemed', payload,
    });
  }

  return c.json({ ok: true, discount_amount_cents: offerData?.discount_amount_cents });
});

export default offer;
