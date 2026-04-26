import OpenAI from 'openai';
import { z } from 'zod';
import { WidgetSpec } from './widget-spec.ts';
import { scrubPII } from './pii-scrubber.ts';

// Ollama runs locally on port 11434 with an OpenAI-compatible API
// Falls back to OpenAI API if OPENAI_API_KEY is set and Ollama fails
// Per-request timeout — Ollama can wedge silently and previously hung
// the offer-generate endpoint indefinitely. After timeout the next
// retry kicks in, then Mistral fallback (if key set), then OpenAI,
// then the deterministic fillDefaults() so the customer always sees
// an offer.
const ollamaClient = new OpenAI({
  baseURL: 'http://localhost:11434/v1',
  apiKey: 'ollama', // required by SDK but ignored by Ollama
  timeout: 12000,
  maxRetries: 0,
});

const mistralClient = process.env.MISTRAL_API_KEY
  ? new OpenAI({
      baseURL: 'https://api.mistral.ai/v1',
      apiKey: process.env.MISTRAL_API_KEY,
      timeout: 20000,
      maxRetries: 0,
    })
  : null;

const openaiClient = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

const LOCAL_MODEL = process.env.OLLAMA_MODEL ?? 'gemma3:4b';
const MISTRAL_MODEL = process.env.MISTRAL_MODEL ?? 'mistral-small-latest';

const SYSTEM_PROMPT = `You are Stadtpuls's hyperlocal offer generator. Produce ONE JSON offer.

GENERAL
- Match mood to context (cold+quiet=cozy, sunny+event=energetic, closing-soon+stock=urgent, lunch+quiet café=discreet).
- Layout: cozy/playful→hero or sticker; discreet/factual→compact; energetic→split; urgent→fullbleed.
- If context.previous_layout is set, pick a DIFFERENT layout (so pull-to-refresh looks different).
- Palette: 3 #RRGGBB colors harmonizing with mood; fg on bg must pass WCAG AA. Default to the Sparkassen brand family (deep red bg #A00000–#E60000, white/cream fg #FFFFFF–#FFF5F5, soft red accent #FFE5E5–#FF4D4D); shift to other warm tones only when mood strongly demands it (e.g., calm blue for rainy/discreet, amber for sunset/energetic).
- Copy: concrete, no marketing fluff, no emojis unless mood=playful. Headline <8 words. Subline <14 words. CTA <4 words.
- discount.value must not exceed merchant.max_discount_pct.
- validity_minutes: 15-90 (shorter for urgent, longer for cozy).
- All user-facing strings in context.locale (de/en).
- signal_chips: 2-4 short labels showing actual context signals (in user locale).
- reasoning: one plain sentence why this offer at this moment.

MENU ITEMS (context.menu_items, when provided — REQUIRED to use)
- Array of { id, name, price_cents, category, tags } from the merchant's real menu.
- You MUST name one specific real item from this list in the headline. No generic "Kaffee & Kuchen" — use the actual item name.
- featured_item_ids MUST contain at least one UUID from context.menu_items (never invented). Usually 1, max 3.
- If multiple items fit the time-of-day, prefer the one with the most distinctive name (it builds trust that the AI used the real menu).

COMBOS (context.combos — second-highest priority after flash_sale)
- Array of merchant-defined bundles { id, name, items[], combo_price_cents, base_total_cents, savings_cents }.
- If a combo fits the time-of-day + weather + customer context, PREFER pitching it over a single item — it's the merchant's best-margin play.
- Headline names the combo (e.g. "Frühstücks-Set: Cappuccino + Croissant"). Subline mentions the savings vs individual prices.
- Use discount.kind="eur" with value = savings_cents/100. featured_item_ids = combo.items[].id.
- signal_chips include the word "Combo" or "Set".
- If MULTIPLE combos are available, pick the one whose items best match weather + time-of-day:
  - Cold/rain → hot drinks, soup, baked goods (e.g. Frühstücks-Set with hot coffee).
  - Hot/sunny → cold drinks, salads, ice cream, light items.
  - Late evening → desserts, drinks, NOT breakfast bundles.
  Reasoning field MUST mention which combo you chose and why this weather/time made it the right pick.

DIVERSITY (context.recently_shown_item_names + context.recently_pitched_combo_ids)
- recently_shown_item_names: items featured to THIS device in the last 30 minutes.
  → Do NOT feature any item with a name on this list. Pick a different menu_item.
  → If only repeat items remain, reframe with a different angle (different time-of-day fit, different combo) — never headline an identical product.
- recently_pitched_combo_ids: combos already pitched to this device recently.
  → Avoid these combo ids; pick a different combo from context.combos if available.
  → If the only combo is on this list, pitch a single item instead.

FLASH-SALE OVERRIDE (highest priority — context.flash_sale + context.flash_sales + context.pinned_flash_id)
- If context.pinned_flash_id is set: you MUST pitch the flash entry whose id matches. Do NOT pick a different one. Each card in the customer feed is pinned to a different flash so the merchant's variations all surface — failing to honour pinned_flash_id breaks the demo.
- Else if context.flash_sales is an ARRAY with multiple entries: pick the ONE flash whose items/combos best fit the current weather + time-of-day. Apply the same weather rules as below (cold→hot, hot→cold, morning→breakfast etc.). Then proceed as if context.flash_sale was that chosen flash.
- Build the offer around the chosen flash's items[0] (or a combo — see next block): headline names it.
- discount.kind="pct", value=flash_sale.pct (do not change) — unless pitching a combo, in which case use eur=savings.
- mood="urgent", layout="fullbleed" or "split", short factual CTA.
- pressure={kind:"time", value:"Noch <minutes_left> Min"} from flash_sale.minutes_left.
- signal_chips must include "🔥 Flash" + item name.
- featured_item_ids must include the flash item ids.
- reasoning MUST mention which flash was chosen and why ("flash A picked over B because rain → hot Cappuccino fits better than iced coffee").

FLASH-SALE COMBOS (context.flash_sale.combos — even higher priority when present)
- If flash_sale.combos has >=1 entries, IGNORE flash_sale.items and pitch ONE combo.
- If MULTIPLE combos are listed, pick the single combo whose items best fit current weather + time-of-day. This is the headline "AI suggests" feature — do it well:
  - Cold (<12°C) or rain → combo with hot drinks/soup/baked goods.
  - Warm (>22°C) or sunny → combo with cold drinks/salads/ice/light items.
  - Morning (06-10) → breakfast combos (coffee + pastry).
  - Lunch (11-14) → savory combos (sandwich/soup/salad).
  - Evening (17+) → dessert/dinner/drink combos.
- Headline names the combo (e.g. "Frühstücks-Set: Cappuccino + Croissant").
- Subline mentions weather/time fit AND the EUR savings vs individual prices.
- discount.kind="eur", value = chosen combo savings_cents/100.
- featured_item_ids = chosen combo.items[].id (NOT flash_sale.menu_item_ids).
- Set top-level "combo_id" to the chosen combo's id (used for analytics/dedupe).
- pressure={kind:"time", value:"Noch <minutes_left> Min"} still applies.
- signal_chips must include "🔥 Flash" + the combo name.
- reasoning MUST explain WHY you chose this combo over the others ("rainy + cold → hot coffee combo wins") — this is the AI-suggestion proof for the merchant dashboard.

TIME-OF-DAY (context.hour) — wrong-time items break the demo
- 06-10 breakfast: coffee, croissant. NO cake/alcohol/ice cream.
- 11-14 lunch: sandwich, salad, soup, lunch menu, coffee. NO cake-as-primary, NO alcohol (unless bar/restaurant).
- 14-17 afternoon: coffee, cake, tea. NO hard alcohol.
- 17-21 dinner: full meals, wine, beer; dessert AFTER. Coffee secondary.
- 21-23 late: drinks/snacks (bar/restaurant only). NO breakfast pastries, NO fresh-baked.
- 23-06 night: bar/restaurant only or skip.
- Bakery >19h → take-home items, not fresh pastries. Café >20h → tea/decaf, not espresso.

WEATHER REASONING (use judgment, not a lookup table)
- You are given context.weather.temp_c and context.weather.condition. Reason about what a real customer in that weather actually wants right now, then pick a featured item from menu_items that fits — and frame the headline around that fit.
- Examples of the kind of reasoning you should do (NOT exhaustive rules):
  - 28 °C and sunny → people want cold, refreshing, light. Avoid pitching a hot espresso as the headline. If only hot items exist, lean on shaded/indoor framing instead of the drink itself.
  - 5 °C and rainy → people want warm, dry, comforting. Avoid pitching ice cream as the headline.
  - Borderline (15-21 °C, mixed cloud) → either direction works, lean on whatever menu item is most distinctive or fits the time of day.
- The headline should make a customer feel "yes, that's exactly what I want right now". If the offer reads as fighting the weather, you picked wrong.
- Never invent an item that isn't in menu_items. If the only available items genuinely don't fit the weather, pick the closest fit and reframe (don't lie about ice in the cup).

Return ONLY this JSON (no prose, no markdown):
{"layout":"hero|compact|split|fullbleed|sticker","palette":{"bg":"#RRGGBB","fg":"#RRGGBB","accent":"#RRGGBB"},"mood":"cozy|energetic|urgent|playful|discreet","hero":{"type":"icon|gradient|pattern","value":"<string>"},"headline":"<string>","subline":"<string>","cta":"<string>","signal_chips":["<string>",...],"pressure":null|{"kind":"time|stock","value":"<string>"},"reasoning":"<string>","merchant":{"id":"<id>","name":"<name>","distance_m":<number>},"discount":{"kind":"pct|eur|item","value":<number>,"constraint":null|"<string>"},"validity_minutes":<integer>,"locale":"de|en","featured_item_ids":["<uuid>",...]}`;

const LAYOUTS = ['hero', 'compact', 'split', 'fullbleed', 'sticker'];
const MOODS = ['cozy', 'energetic', 'urgent', 'playful', 'discreet'];
const HERO_TYPES = ['icon', 'gradient', 'pattern'];

function pickFirstValid(...candidates: any[]): string | undefined {
  for (const c of candidates) {
    if (typeof c === 'string') return c;
  }
  return undefined;
}

// Normalize anything the model returns into a strict #RRGGBB hex.
// Adds the leading '#', expands 3-char shorthand, falls back to a default
// if the value is unrecognizable (prevents "invalid colour value" RN crashes).
function normalizeHex(c: any, fallback: string): string {
  if (typeof c !== 'string') return fallback;
  let s = c.trim();
  if (!s.startsWith('#')) s = '#' + s;
  if (/^#[0-9a-f]{3}$/i.test(s)) {
    s = '#' + s[1] + s[1] + s[2] + s[2] + s[3] + s[3];
  }
  return /^#[0-9a-f]{6}$/i.test(s) ? s : fallback;
}

function fillDefaults(p: any, locale: string, merchant: any, distance_m: number): any {
  p.locale = 'en';

  // Self-correct: model often swaps enum fields. Detect and fix.
  const layoutCandidate = pickFirstValid(p.layout, p.mood, p.hero?.type);
  const moodCandidate = pickFirstValid(p.mood, p.layout, p.hero?.type);
  const heroTypeCandidate = pickFirstValid(p.hero?.type, p.layout, p.mood);

  p.layout = LAYOUTS.includes(p.layout) ? p.layout
    : LAYOUTS.includes(layoutCandidate as any) ? layoutCandidate
    : 'hero';
  p.mood = MOODS.includes(p.mood) ? p.mood
    : MOODS.includes(moodCandidate as any) ? moodCandidate
    : 'cozy';
  p.hero = p.hero ?? { type: 'gradient', value: '☕' };
  p.hero.type = HERO_TYPES.includes(p.hero.type) ? p.hero.type
    : HERO_TYPES.includes(heroTypeCandidate as any) ? heroTypeCandidate
    : 'gradient';
  if (!p.hero.value) p.hero.value = '☕';
  p.palette = p.palette ?? {};
  // Sparkassen brand defaults — used when the LLM omits a palette or returns
  // unparseable hex strings. Keep this in sync with `lib/theme.ts`.
  p.palette.bg = normalizeHex(p.palette.bg, '#E60000');
  p.palette.fg = normalizeHex(p.palette.fg, '#FFFFFF');
  p.palette.accent = normalizeHex(p.palette.accent, '#FFE5E5');
  // Merchant-specific fallbacks so a deterministic offer (when LLM is down)
  // still names the shop and reads as plausibly real.
  // App is English-only — locale gates kept as `isEN = true` so any future
  // re-localisation only needs to flip this back to a real check.
  const isEN = true;
  const distM = Math.round(distance_m);
  const merchantName = merchant.name ?? (isEN ? 'a nearby shop' : 'in deiner Nähe');
  const tag = (merchant.inventory_tags ?? [])[0];
  const fallbackHeadline = tag
    ? (isEN ? `${tag} at ${merchantName}` : `${tag} bei ${merchantName}`)
    : (isEN ? `Visit ${merchantName}` : `Schau bei ${merchantName} vorbei`);
  const fallbackSubline = isEN
    ? `${distM} m away · ${Math.min(15, merchant.max_discount_pct ?? 15)} % off today`
    : `${distM} m entfernt · ${Math.min(15, merchant.max_discount_pct ?? 15)} % Rabatt heute`;
  p.headline = p.headline ?? fallbackHeadline;
  p.subline = p.subline ?? fallbackSubline;
  p.cta = p.cta ?? (isEN ? 'Take it' : 'Akzeptieren');
  if (!Array.isArray(p.signal_chips) || p.signal_chips.length < 2) {
    p.signal_chips = ['Live', `${distM} m`];
  }
  p.pressure = p.pressure ?? null;
  p.reasoning = p.reasoning ?? (isEN
    ? 'Local shop near you with an active offer.'
    : 'Geschäft in deiner Nähe mit einem aktiven Angebot.');
  p.merchant = p.merchant ?? {};
  p.merchant.id = p.merchant.id ?? merchant.id;
  p.merchant.name = p.merchant.name ?? merchant.name;
  p.merchant.distance_m = typeof p.merchant.distance_m === 'number' ? p.merchant.distance_m : Math.round(distance_m);
  p.discount = p.discount ?? { kind: 'pct', value: Math.min(15, merchant.max_discount_pct ?? 15), constraint: null };
  if (typeof p.discount.value !== 'number') p.discount.value = 10;
  if (!p.discount.kind) p.discount.kind = 'pct';
  if (p.discount.constraint === undefined) p.discount.constraint = null;
  p.validity_minutes = typeof p.validity_minutes === 'number' ? p.validity_minutes : 30;

  // featured_item_ids: validate against UUID format; drop invalid ids the model invented.
  if (!Array.isArray(p.featured_item_ids)) p.featured_item_ids = [];
  p.featured_item_ids = p.featured_item_ids.filter((s: any) =>
    typeof s === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s)
  );

  // base_amount_cents: what the customer "pays" before discount. Drives the
  // slide-to-pay amount + the savings tile math. Use the featured menu item's
  // price when we have one (most accurate); fall back to a merchant-type-aware
  // baseline so the numbers don't look toy-sized.
  // Note: menu_items aren't in scope here — caller patches a real price below
  // when it knows one. These defaults ensure the field is always present.
  if (typeof p.base_amount_cents !== 'number' || p.base_amount_cents <= 0) {
    const TYPE_BASELINE: Record<string, number> = {
      café: 480, bakery: 350, bookstore: 1800, restaurant: 1900,
      bar: 850, retail: 2400, services: 3500, other: 1200,
    };
    p.base_amount_cents = TYPE_BASELINE[(merchant.type ?? 'other').toLowerCase()] ?? 1200;
  }

  // Auto-fill a hero image URL via Pollinations (free text-to-image, no key).
  // Prompt grounds in the actual headline + merchant type so the picture
  // matches the offer copy. URL is deterministic for caching; FallbackImage
  // on the client renders a tinted block + emoji if the load fails.
  if (!p.hero_image_url) {
    const head = String(p.headline ?? merchant.name ?? 'offer').slice(0, 90);
    const mtype = (merchant.type ?? 'café').toLowerCase();
    const prompt = `${head}, ${mtype}, lifestyle photography, atmospheric, soft warm light, shallow depth of field`;
    let seed = 0;
    const seedKey = `hero:${head}`;
    for (let i = 0; i < seedKey.length; i++) seed = (seed * 31 + seedKey.charCodeAt(i)) | 0;
    seed = Math.abs(seed) % 1_000_000;
    const params = new URLSearchParams({
      width: '800', height: '480',
      seed: String(seed),
      nologo: 'true', enhance: 'true', model: 'flux',
    });
    p.hero_image_url = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?${params.toString()}`;
  }
  return p;
}

async function tryGenerate(
  client: OpenAI,
  model: string,
  userMessage: string,
  locale: string,
  merchant: any,
  distance_m: number,
): Promise<any> {
  const response = await client.chat.completions.create({
    model,
    temperature: 0.8,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: userMessage },
    ],
  });

  const raw = response.choices[0]?.message?.content;
  if (!raw) throw new Error('Empty response from model');

  let parsed: any;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    const cleaned = raw.replace(/```json\s*|```\s*/g, '').trim();
    parsed = JSON.parse(cleaned);
  }

  // If the model under-fills (no headline / subline), treat as failure so we
  // can fall through to the next backend instead of silently returning a
  // generic "Angebot in der Nähe" card.
  const hasContent =
    typeof parsed.headline === 'string' && parsed.headline.trim().length > 4 &&
    typeof parsed.subline === 'string' && parsed.subline.trim().length > 4;
  if (!hasContent) {
    throw new Error(`model under-filled: headline=${JSON.stringify(parsed.headline)} subline=${JSON.stringify(parsed.subline)}`);
  }

  parsed = fillDefaults(parsed, locale, merchant, distance_m);
  return WidgetSpec.parse(parsed);
}

export async function generateOffer(params: {
  merchant: any;
  context: any;
  locale: string;
  distance_m: number;
}): Promise<any> {
  // PII-scrub the user message before it leaves our process. Strips emails,
  // phones, IBANs, IPs from anything that ends up in inventory_tags or
  // free-text context. Defense-in-depth alongside the client-side intent
  // encoder which already abstracts location to a 1.2km geohash.
  const userMessage = scrubPII(JSON.stringify({
    merchant: {
      id: params.merchant.id,
      name: params.merchant.name,
      type: params.merchant.type,
      goal: params.merchant.goal,
      max_discount_pct: params.merchant.max_discount_pct,
      inventory_tags: params.merchant.inventory_tags ?? [],
      time_windows: params.merchant.time_windows ?? [],
    },
    context: params.context,
    locale: params.locale,
    distance_m: Math.round(params.distance_m),
  }));

  const m = params.merchant;
  const d = params.distance_m;

  // Tier 1: Mistral cloud — fast, reliable, ~3-8s.
  if (mistralClient) {
    try {
      return await tryGenerate(mistralClient, MISTRAL_MODEL, userMessage, params.locale, m, d);
    } catch (e) {
      console.warn('[offer-engine] Mistral failed:', (e as Error).message);
    }
  }

  // Tier 2: on-device SLM (Ollama gemma3:4b ~4B params). This is the
  // "SLM spirit" the brief encourages — runs locally, no data leaves
  // the device for inference. Used as fallback when cloud is unreachable.
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      return await tryGenerate(ollamaClient, LOCAL_MODEL, userMessage, params.locale, m, d);
    } catch (e) {
      console.warn(`[offer-engine] On-device SLM (${LOCAL_MODEL}) attempt ${attempt} failed:`, (e as Error).message);
    }
  }

  // Tier 3: deterministic offer so the customer always sees something.
  console.warn('[offer-engine] All AI backends failed, returning deterministic fallback');
  return fillDefaults({}, params.locale, m, d);
}

// One-line natural-language explanation for which offer in a feed is the best
// deal mathematically, and why. Uses Mistral (already configured for this
// project). Falls back to a deterministic German/English string if the cloud
// call fails — never blocks the UI.
export async function explainBestOffer(params: {
  locale: string;
  offers: Array<{
    headline: string;
    merchant_name: string;
    base_amount_cents: number;
    discount_amount_cents: number;
    pct?: number | null;
  }>;
  winnerIndex: number;
}): Promise<string> {
  const { locale, offers, winnerIndex } = params;
  const isEN = true;
  const winner = offers[winnerIndex];
  const others = offers.filter((_, i) => i !== winnerIndex);
  if (!winner || others.length === 0) {
    return isEN ? 'Best deal in this feed.' : 'Bestes Angebot in dieser Liste.';
  }

  const fmtEur = (c: number) => new Intl.NumberFormat(isEN ? 'en-US' : 'de-DE',
    { style: 'currency', currency: 'EUR' }).format(c / 100);

  // Compact summary the LLM can chew on. Keep it tight to keep latency low.
  const summary = offers.map((o, i) => ({
    label: `${i + 1}`,
    is_winner: i === winnerIndex,
    merchant: o.merchant_name,
    headline: o.headline,
    base: fmtEur(o.base_amount_cents),
    saves: fmtEur(o.discount_amount_cents),
    pct: o.pct ?? null,
  }));

  const sys = isEN
    ? `You write a single sentence in plain English (max 22 words) explaining to a customer why offer "${winner.merchant_name}" saves them more than the alternatives in a list of nearby cafe/shop offers. Be concrete about the EUR amount and the reason (higher percentage, smaller base, named item). No emojis. No quotes. Output ONLY the sentence.`
    : `Du schreibst genau einen klaren deutschen Satz (max. 22 Wörter), der einem Kunden erklärt, warum das Angebot "${winner.merchant_name}" mehr spart als die anderen in einer Liste lokaler Café-/Shop-Angebote. Sei konkret mit dem EUR-Betrag und dem Grund (höherer Prozentsatz, kleinerer Grundpreis, benanntes Produkt). Keine Emojis. Keine Anführungszeichen. Nur den Satz ausgeben.`;

  const user = JSON.stringify(summary);

  // Mistral is the configured cloud model for this app. If it's unavailable,
  // return a deterministic fallback rather than blocking.
  if (!mistralClient) {
    const gap = winner.discount_amount_cents - others[0].discount_amount_cents;
    return isEN
      ? `Best pick: ${winner.merchant_name} saves ${fmtEur(gap)} more than the next-best deal nearby.`
      : `Beste Wahl: ${winner.merchant_name} spart ${fmtEur(gap)} mehr als das nächstbeste Angebot.`;
  }

  try {
    const res = await mistralClient.chat.completions.create({
      model: MISTRAL_MODEL,
      temperature: 0.4,
      max_tokens: 90,
      messages: [
        { role: 'system', content: sys },
        { role: 'user', content: user },
      ],
    });
    const text = (res.choices[0]?.message?.content ?? '').trim();
    if (text && text.length > 5) return text;
  } catch (e) {
    console.warn('[advisor] Mistral explain failed:', (e as Error).message);
  }
  const gap = winner.discount_amount_cents - others[0].discount_amount_cents;
  return isEN
    ? `Best pick: ${winner.merchant_name} saves ${fmtEur(gap)} more than the next-best deal nearby.`
    : `Beste Wahl: ${winner.merchant_name} spart ${fmtEur(gap)} mehr als das nächstbeste Angebot.`;
}
