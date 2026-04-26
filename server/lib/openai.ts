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
- Palette: 3 #RRGGBB colors harmonizing with mood; fg on bg must pass WCAG AA.
- Copy: concrete, no marketing fluff, no emojis unless mood=playful. Headline <8 words. Subline <14 words. CTA <4 words.
- discount.value must not exceed merchant.max_discount_pct.
- validity_minutes: 15-90 (shorter for urgent, longer for cozy).
- All user-facing strings in context.locale (de/en).
- signal_chips: 2-4 short labels showing actual context signals (in user locale).
- reasoning: one plain sentence why this offer at this moment.

MENU ITEMS (context.menu_items, when provided)
- Array of { id, name, price_cents, category, tags } from the merchant's real menu.
- Strongly prefer naming a specific real item in the headline. Pick an item suited to the time-of-day rules.
- featured_item_ids MUST be UUIDs from context.menu_items (never invented). Usually 1, max 3.

FLASH-SALE OVERRIDE (highest priority — context.flash_sale)
- Build the offer around flash_sale.items[0]: headline names it.
- discount.kind="pct", value=flash_sale.pct (do not change).
- mood="urgent", layout="fullbleed" or "split", short factual CTA.
- pressure={kind:"time", value:"Noch <minutes_left> Min"} from flash_sale.minutes_left.
- signal_chips must include "🔥 Flash" + item name.
- featured_item_ids must include the flash item ids.

TIME-OF-DAY (context.hour) — wrong-time items break the demo
- 06-10 breakfast: coffee, croissant. NO cake/alcohol/ice cream.
- 11-14 lunch: sandwich, salad, soup, lunch menu, coffee. NO cake-as-primary, NO alcohol (unless bar/restaurant).
- 14-17 afternoon: coffee, cake, tea. NO hard alcohol.
- 17-21 dinner: full meals, wine, beer; dessert AFTER. Coffee secondary.
- 21-23 late: drinks/snacks (bar/restaurant only). NO breakfast pastries, NO fresh-baked.
- 23-06 night: bar/restaurant only or skip.
- Bakery >19h → take-home items, not fresh pastries. Café >20h → tea/decaf, not espresso.

WEATHER
- Cold/rain → hot drinks, soup, indoor warmth.
- Hot/sunny → iced drinks, salads, terrace.
- Snow → hot chocolate, indoor.

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
  p.locale = p.locale === 'en' ? 'en' : locale === 'en' ? 'en' : 'de';

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
  p.palette.bg = normalizeHex(p.palette.bg, '#1A1A2E');
  p.palette.fg = normalizeHex(p.palette.fg, '#FFFFFF');
  p.palette.accent = normalizeHex(p.palette.accent, '#E11D48');
  // Merchant-specific fallbacks so a deterministic offer (when LLM is down)
  // still names the shop and reads as plausibly real.
  const isEN = locale === 'en';
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

  // Auto-fill a hero image URL by querying loremflickr with merchant tags
  if (!p.hero_image_url) {
    const tags = (merchant.inventory_tags ?? []) as string[];
    const tag = (tags[0] ?? merchant.type ?? 'cafe').toLowerCase().replace(/[^a-z0-9]+/g, '');
    const type = (merchant.type ?? 'cafe').toLowerCase().replace(/[^a-z0-9]+/g, '');
    // Loremflickr: free, key-less, supports comma-tagged queries, deterministic by lock
    p.hero_image_url = `https://loremflickr.com/800/480/${tag},${type}/all?lock=${(merchant.id ?? '').slice(0, 6)}`;
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
