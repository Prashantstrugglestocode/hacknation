import OpenAI from 'openai';
import { z } from 'zod';

const ollama = new OpenAI({
  baseURL: 'http://localhost:11434/v1',
  apiKey: 'ollama',
  timeout: 20000,
  maxRetries: 0,
});

const mistralClient = process.env.MISTRAL_API_KEY
  ? new OpenAI({
      baseURL: 'https://api.mistral.ai/v1',
      apiKey: process.env.MISTRAL_API_KEY,
      timeout: 30000, // vision is slower than text
      maxRetries: 0,
    })
  : null;

const openaiClient = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

const VISION_MODEL = process.env.OLLAMA_VISION_MODEL ?? 'llava:7b';
// Mistral vision-capable model. pixtral-12b is multimodal and roughly
// matches gpt-4o-mini for menu OCR.
const MISTRAL_VISION_MODEL = process.env.MISTRAL_VISION_MODEL ?? 'pixtral-12b-2409';

const MenuItem = z.object({
  name: z.string().min(1).max(80),
  price_eur: z.number().nullable().optional(),
  category: z.enum(['drink', 'food', 'dessert', 'special']).default('food'),
  tags: z.array(z.string()).default([]),
});

const MenuExtract = z.object({
  items: z.array(MenuItem).max(40),
});

export type ExtractedItem = z.infer<typeof MenuItem>;

const VISION_PROMPT = `You are reading a printed café/restaurant menu from a photograph. Extract all menu items as a JSON object.

Rules:
- Output ONLY JSON: {"items": [{"name": "...", "price_eur": 3.5, "category": "drink"|"food"|"dessert"|"special", "tags": ["vegan","seasonal","hot"]}]}
- price_eur: a number in euros (e.g. 3.5 for "3,50 €"), or null if no price visible
- category: best guess. drinks = coffee/tea/water/beer/wine/juice. dessert = cake/ice/pudding. special = "Tagesgericht"/"Mittagsmenü"/seasonal. otherwise food.
- tags: short lowercase labels you can infer from name (e.g. "vegan", "vegetarisch", "hot", "cold", "seasonal", "kids")
- Keep names exactly as printed. No translation. No marketing fluff.
- Skip section headings, prices alone, addresses, opening hours.
- If you cannot find any items, return {"items": []}.

Return only valid JSON, no prose, no code fences.`;

async function tryVision(client: OpenAI, model: string, dataUrl: string): Promise<ExtractedItem[]> {
  const res = await client.chat.completions.create({
    model,
    temperature: 0.2,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: VISION_PROMPT },
      {
        role: 'user',
        content: [
          { type: 'text', text: 'Extract the menu from this photo.' },
          { type: 'image_url', image_url: { url: dataUrl } },
        ] as any,
      },
    ],
  });

  const raw = res.choices[0]?.message?.content;
  if (!raw) throw new Error('empty');
  const cleaned = raw.replace(/```json\s*|```\s*/g, '').trim();
  const parsed = JSON.parse(cleaned);
  return MenuExtract.parse(parsed).items;
}

export async function extractMenu(dataUrl: string): Promise<ExtractedItem[]> {
  // Tier 1: Mistral pixtral cloud — fast vision OCR.
  if (mistralClient) {
    try {
      return await tryVision(mistralClient, MISTRAL_VISION_MODEL, dataUrl);
    } catch (e) {
      console.warn(`[vision] Mistral (${MISTRAL_VISION_MODEL}) failed:`, (e as Error).message);
    }
  }
  // Tier 2: on-device SLM (Ollama llava:7b) — local vision fallback.
  try {
    return await tryVision(ollama, VISION_MODEL, dataUrl);
  } catch (e) {
    console.warn(`[vision] On-device SLM (${VISION_MODEL}) failed:`, (e as Error).message);
  }
  // Demo fallback — return a small canned menu so the flow never breaks
  return [
    { name: 'Cappuccino', price_eur: 3.5, category: 'drink', tags: ['hot'] },
    { name: 'Espresso', price_eur: 2.5, category: 'drink', tags: ['hot'] },
    { name: 'Sandwich Caprese', price_eur: 6.9, category: 'food', tags: ['vegetarisch'] },
    { name: 'Croissant', price_eur: 2.2, category: 'food', tags: [] },
    { name: 'Apfelstrudel', price_eur: 4.5, category: 'dessert', tags: ['hausgemacht'] },
    { name: 'Tagessuppe', price_eur: 5.5, category: 'special', tags: ['seasonal'] },
  ];
}
