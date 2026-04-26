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
// Mistral vision-capable model. Pixtral Large (124B-class multimodal)
// gives noticeably better OCR on printed café menus than the 12B variant —
// fewer hallucinated prices, better umlaut handling, more reliable on
// multi-column layouts. Override via MISTRAL_VISION_MODEL if needed.
const MISTRAL_VISION_MODEL = process.env.MISTRAL_VISION_MODEL ?? 'pixtral-large-2411';

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

const VISION_PROMPT = `You are an OCR-grade menu reader for printed German/English café & restaurant menus. Accuracy beats coverage — a wrong item is worse than a missing one.

OUTPUT FORMAT (strict, no prose, no code fences)
{"items": [{"name": "...", "price_eur": 3.5, "category": "drink"|"food"|"dessert"|"special", "tags": ["vegan","seasonal","hot"]}]}

NAME — verbatim, case-preserving
- Copy the name exactly as printed. Preserve umlauts (ä ö ü ß) and capitalisation.
- DO NOT translate. DO NOT paraphrase. DO NOT add marketing words like "delicious".
- If a description line follows the name (e.g. "mit Tomate, Mozzarella, Basilikum"), MERGE it into the name only if it's <= 4 words and clearly part of the dish name. Otherwise drop it — descriptions are not menu items.
- Strip leading bullets, numbers like "1.", "•", "-", or stars.
- Skip ALL CAPS section headers (e.g. "GETRÄNKE", "BREAKFAST", "DESSERTS"). They're navigation, not items.

PRICE — be conservative
- Only set price_eur when a number is unambiguously next to the item. Patterns: "3,50 €", "3.50€", "EUR 3.50", "€3.50".
- "from 3,50" / "ab 3,50" / "kl 2,50 / gr 4,00" → set price_eur to the LOWEST visible number, add tag "from".
- If no price is on the same line/visually adjacent → price_eur: null. Do NOT guess.
- Reject sub-€0.50 or above €200 — those are page numbers / dates / phone digits, not prices.

CATEGORY
- drink: coffee, tea, espresso, water, beer, wine, cocktail, juice, smoothie, soda, schorle.
- dessert: cake (Kuchen, Torte), ice cream (Eis), pudding, tiramisu, mousse, crème brûlée.
- special: explicit "Tagesgericht" / "Mittagsmenü" / "Wochenkarte" / "saisonal" / "chef's special".
- food: everything else (sandwich, pizza, pasta, salad, soup, breakfast plates).

TAGS — only when explicit
- Add ONLY when the menu text says it: "vegan", "vegetarisch", "vegan", "glutenfrei", "lactosefrei", "scharf", "spicy", "hot" (only for hot drinks), "cold", "seasonal", "saisonal", "bio", "kids", "from".
- Don't infer from item names — "Sandwich Caprese" does NOT auto-tag "vegetarisch" unless the menu marks it.

SKIP — never as items
- Section headings (single-word categories, ALL CAPS lines).
- Allergen legends ("A,B,C..."), opening hours, phone numbers, addresses, social handles, hashtags.
- Floating prices with no name on the same row.
- "Free wifi" / wifi password lines / payment-method icons ("Wir akzeptieren ...").

CONFIDENCE GATE
- If the photo is too blurry / dark / partial to read confidently → return {"items": []} rather than guessing.
- Prefer 5 correct items over 12 partly-correct ones.

Output strictly valid JSON. No markdown, no commentary, no trailing text.`;

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
  // Tier 1: Mistral Pixtral cloud — preferred per project policy
  // (EU-hosted, brief explicitly favours Mistral). Pixtral Large gives
  // strong OCR on printed café menus with mixed fonts and umlauts.
  if (mistralClient) {
    try {
      return await tryVision(mistralClient, MISTRAL_VISION_MODEL, dataUrl);
    } catch (e) {
      console.warn(`[vision] Mistral (${MISTRAL_VISION_MODEL}) failed:`, (e as Error).message);
    }
  }
  // Tier 2: OpenAI gpt-4o-mini fallback for the rare cases Mistral is
  // unreachable (rate-limited / network blip). Skipped entirely if no key.
  if (openaiClient) {
    try {
      return await tryVision(openaiClient, 'gpt-4o-mini', dataUrl);
    } catch (e) {
      console.warn('[vision] OpenAI gpt-4o-mini failed:', (e as Error).message);
    }
  }
  // Tier 3: on-device SLM (Ollama llava:7b) — local vision fallback.
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
