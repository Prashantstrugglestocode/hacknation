import OpenAI from 'openai';
import { z } from 'zod';
import { WidgetSpec } from './widget-spec';
import { scrubPII } from './pii-scrubber';

// Mistral AI (Primary)
const mistralClient = process.env.MISTRAL_API_KEY
  ? new OpenAI({ 
      baseURL: 'https://api.mistral.ai/v1', 
      apiKey: process.env.MISTRAL_API_KEY,
    })
  : null;

if (mistralClient) console.log('[offer-engine] Mistral client initialized');

// Ollama (Secondary fallback, runs locally)
const ollamaClient = new OpenAI({
  baseURL: 'http://localhost:11434/v1',
  apiKey: 'ollama', // required by SDK but ignored by Ollama
});

// OpenAI (Tertiary fallback)
const openaiClient = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

const MISTRAL_MODEL = 'mistral-small-latest';
const LOCAL_MODEL = process.env.OLLAMA_MODEL ?? 'gemma3:4b';

const SYSTEM_PROMPT = `You are City Wallet's hyperlocal offer generator for the DSV Gruppe / Sparkassen network. Given a merchant and the current real-world context, produce a single offer as a JSON object. Rules:

- Match mood to context. Cold and drizzle and quiet = cozy. Sunny and crowded with event nearby = energetic. Closing in under 30 minutes with stock = urgent. Lunchtime quiet café = cozy or discreet.
- Pick layout to fit mood. Cozy or playful favors hero or sticker. Factual or discreet favors compact. Energetic favors split. Urgent favors fullbleed.
- Palette: 3 hex colors (#RRGGBB) that harmonize with the mood and pass WCAG AA contrast for fg-on-bg.
- signal_chips: array of 2-4 short strings showing actual context signals. Use the locale language.
- Copy is concrete, never marketing fluff. No emojis unless mood is playful.
- Headline under 8 words. Subline under 14 words. CTA under 4 words.
- Discount value must not exceed merchant max_discount_pct.
- reasoning: one plain-language sentence explaining why this offer right now.
- validity_minutes: integer 15-90. Shorter for urgent, longer for cozy.
- Write all user-facing strings in the given locale (de = German, en = English).

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

function fillDefaults(p: any, locale: string, merchant: any, distance_m: number): any {
  p.locale = p.locale ?? locale ?? 'de';
  p.layout = p.layout ?? 'hero';
  p.mood = p.mood ?? 'cozy';
  p.hero = p.hero ?? { type: 'gradient', value: '☕' };
  if (!p.hero.type) p.hero.type = 'gradient';
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
  const sanitizedMessage = scrubPII(userMessage);

  const response = await client.chat.completions.create({
    model,
    temperature: 0.8,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: sanitizedMessage },
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

  // Try Mistral AI first (OpenAI-compatible)
  if (mistralClient) {
    try {
      return await tryGenerate(mistralClient, MISTRAL_MODEL, userMessage, params.locale, m, d);
    } catch (e) {
      console.error('[offer-engine] Mistral AI failed:', e);
    }
  }

  // Try Ollama local
  try {
    return await tryGenerate(ollamaClient, LOCAL_MODEL, userMessage, params.locale, m, d);
  } catch (e) {
    console.warn(`[offer-engine] Ollama (${LOCAL_MODEL}) failed:`, (e as Error).message);
  }

  // Try OpenAI API
  if (openaiClient) {
    try {
      return await tryGenerate(openaiClient, 'gpt-4o-mini', userMessage, params.locale, m, d);
    } catch (e) {
      console.warn('[offer-engine] OpenAI gpt-4o-mini failed:', (e as Error).message);
      return await tryGenerate(openaiClient, 'gpt-4o', userMessage, params.locale, m, d);
    }
  }

  // Last-resort fallback
  console.warn('[offer-engine] All AI backends failed, returning deterministic fallback');
  return fillDefaults({}, params.locale, m, d);
}
