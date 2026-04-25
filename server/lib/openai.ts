import OpenAI from 'openai';
import { z } from 'zod';
import { WidgetSpec } from './widget-spec.ts';

// Ollama runs locally on port 11434 with an OpenAI-compatible API
// Falls back to OpenAI API if OPENAI_API_KEY is set and Ollama fails
const ollamaClient = new OpenAI({
  baseURL: 'http://localhost:11434/v1',
  apiKey: 'ollama', // required by SDK but ignored by Ollama
});

const openaiClient = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

const LOCAL_MODEL = process.env.OLLAMA_MODEL ?? 'gemma3:4b';

const SYSTEM_PROMPT = `You are City Wallet's hyperlocal offer generator for the DSV Gruppe / Sparkassen network. Given a merchant and the current real-world context, produce a single offer as a JSON object. Rules:

- Match mood to context. Cold and drizzle and quiet = cozy. Sunny and crowded with event nearby = energetic. Closing in under 30 minutes with stock = urgent. Lunchtime quiet café = cozy or discreet.
- Pick layout to fit mood. Cozy or playful favors hero or sticker. Factual or discreet favors compact. Energetic favors split. Urgent favors fullbleed.
- If context.previous_layout is provided, DO NOT pick the same layout again. Choose a visibly distinct one so pull-to-refresh feels different.
- Palette: 3 hex colors (#RRGGBB) that harmonize with the mood and pass WCAG AA contrast for fg-on-bg.
- signal_chips: array of 2-4 short strings showing actual context signals. Use the locale language.
- Copy is concrete, never marketing fluff. No emojis unless mood is playful.
- Headline under 8 words. Subline under 14 words. CTA under 4 words.
- Discount value must not exceed merchant max_discount_pct.
- reasoning: one plain-language sentence explaining why this offer right now.
- validity_minutes: integer 15-90. Shorter for urgent, longer for cozy.
- Write all user-facing strings in the given locale (de = German, en = English).

TIME APPROPRIATENESS (hard rules — violating these is wrong):
- Use context.hour (0-23) and context.time_bucket to pick what makes sense:
  * 06-10: breakfast (coffee, croissant, frühstück, eggs). NEVER cake, NEVER alcohol, NEVER ice cream.
  * 11-14: lunch (sandwich, salad, soup, hot meals, lunch menu). Coffee OK. NEVER cake as primary, NEVER alcohol unless merchant_type=bar/restaurant with lunch wine.
  * 14-17: afternoon (coffee, cake, kaffee und kuchen, tea). Light food OK. NEVER hard alcohol.
  * 17-21: dinner (full meals, wine, beer, desserts AFTER dinner). Coffee acceptable but secondary.
  * 21-23: late evening (drinks, snacks, dessert ONLY if merchant is bar/restaurant). NEVER breakfast pastries, NEVER cake-as-snack alone, NEVER fresh-baked items (bakeries closed).
  * 23-06: night (only bars/restaurants if open; otherwise NO offer).
- If the suggested item violates time-appropriateness, pick a different inventory_tag from merchant.inventory_tags or use merchant.type generically. Never force a wrong-time item.
- If merchant_type is bakery and hour > 19, the offer should reference packaged/take-home items, not fresh pastries.
- If merchant_type is café and hour > 20, lean tea/herbal/decaf, not espresso.

WEATHER + ITEM:
- Cold/rain → hot drinks, soup, indoor warmth language.
- Hot/sunny → iced drinks, salads, terrace language.
- Snow → cozy hot chocolate, indoor pastries (during day only).

Return ONLY valid JSON matching this exact structure, no prose, no markdown:
{
  "layout": "hero"|"compact"|"split"|"fullbleed"|"sticker",
  "palette": { "bg": "#RRGGBB", "fg": "#RRGGBB", "accent": "#RRGGBB" },
  "mood": "cozy"|"energetic"|"urgent"|"playful"|"discreet",
  "hero": { "type": "icon"|"gradient"|"pattern", "value": "<emoji or description>" },
  "headline": "<string>",
  "subline": "<string>",
  "cta": "<string>",
  "signal_chips": ["<string>", "<string>"],
  "pressure": null | { "kind": "time"|"stock", "value": "<string>" },
  "reasoning": "<string>",
  "merchant": { "id": "<id>", "name": "<name>", "distance_m": <number> },
  "discount": { "kind": "pct"|"eur"|"item", "value": <number>, "constraint": null|"<string>" },
  "validity_minutes": <integer>,
  "locale": "de"|"en"
}`;

const LAYOUTS = ['hero', 'compact', 'split', 'fullbleed', 'sticker'];
const MOODS = ['cozy', 'energetic', 'urgent', 'playful', 'discreet'];
const HERO_TYPES = ['icon', 'gradient', 'pattern'];

function pickFirstValid(...candidates: any[]): string | undefined {
  for (const c of candidates) {
    if (typeof c === 'string') return c;
  }
  return undefined;
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
  p.palette = p.palette ?? { bg: '#1A1A2E', fg: '#FFFFFF', accent: '#E11D48' };
  if (!p.palette.bg) p.palette.bg = '#1A1A2E';
  if (!p.palette.fg) p.palette.fg = '#FFFFFF';
  if (!p.palette.accent) p.palette.accent = '#E11D48';
  p.headline = p.headline ?? 'Angebot in der Nähe';
  p.subline = p.subline ?? 'Schau vorbei.';
  p.cta = p.cta ?? 'Akzeptieren';
  if (!Array.isArray(p.signal_chips) || p.signal_chips.length < 2) {
    p.signal_chips = ['Live', `${Math.round(distance_m)} m`];
  }
  p.pressure = p.pressure ?? null;
  p.reasoning = p.reasoning ?? 'Passend zu deinem aktuellen Kontext.';
  p.merchant = p.merchant ?? {};
  p.merchant.id = p.merchant.id ?? merchant.id;
  p.merchant.name = p.merchant.name ?? merchant.name;
  p.merchant.distance_m = typeof p.merchant.distance_m === 'number' ? p.merchant.distance_m : Math.round(distance_m);
  p.discount = p.discount ?? { kind: 'pct', value: Math.min(15, merchant.max_discount_pct ?? 15), constraint: null };
  if (typeof p.discount.value !== 'number') p.discount.value = 10;
  if (!p.discount.kind) p.discount.kind = 'pct';
  if (p.discount.constraint === undefined) p.discount.constraint = null;
  p.validity_minutes = typeof p.validity_minutes === 'number' ? p.validity_minutes : 30;

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
  const userMessage = JSON.stringify({
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
  });

  const m = params.merchant;
  const d = params.distance_m;

  // Try Ollama (gemma3:4b) first — retry up to 2x because small models occasionally under-fill JSON
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      return await tryGenerate(ollamaClient, LOCAL_MODEL, userMessage, params.locale, m, d);
    } catch (e) {
      console.warn(`[offer-engine] Ollama (${LOCAL_MODEL}) attempt ${attempt} failed:`, (e as Error).message);
    }
  }

  // Fallback: OpenAI API if key is set
  if (openaiClient) {
    try {
      return await tryGenerate(openaiClient, 'gpt-4o-mini', userMessage, params.locale, m, d);
    } catch (e) {
      console.warn('[offer-engine] OpenAI gpt-4o-mini failed:', (e as Error).message);
      return await tryGenerate(openaiClient, 'gpt-4o', userMessage, params.locale, m, d);
    }
  }

  // Last-resort: synthesize a deterministic offer so demo never breaks
  console.warn('[offer-engine] All AI backends failed, returning deterministic fallback');
  return fillDefaults({}, params.locale, m, d);
}
