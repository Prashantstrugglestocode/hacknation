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

async function tryGenerate(client: OpenAI, model: string, userMessage: string): Promise<any> {
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

  const parsed = JSON.parse(raw);

  // Validate with Zod — throws if schema doesn't match
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

  // Try Ollama (gemma3:4b) first — local, free, no API key
  try {
    return await tryGenerate(ollamaClient, LOCAL_MODEL, userMessage);
  } catch (e) {
    console.warn(`[offer-engine] Ollama (${LOCAL_MODEL}) failed:`, (e as Error).message);
  }

  // Fallback: OpenAI API if key is set
  if (openaiClient) {
    try {
      return await tryGenerate(openaiClient, 'gpt-4o-mini', userMessage);
    } catch (e) {
      console.warn('[offer-engine] OpenAI gpt-4o-mini failed:', (e as Error).message);
      return await tryGenerate(openaiClient, 'gpt-4o', userMessage);
    }
  }

  throw new Error('No AI backend available — Ollama not running and no OPENAI_API_KEY set');
}
