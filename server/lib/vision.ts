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
      timeout: 45000, // dense menu OCR on pixtral-12b can take 10-20s
      maxRetries: 0,
    })
  : null;

const openaiClient = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

const VISION_MODEL = process.env.OLLAMA_VISION_MODEL ?? 'llava:7b';
// Mistral vision-capable model. pixtral-12b-2409 is the safe default —
// available on the free tier, no rate-limit surprises. Pixtral Large is
// stronger but rate-limited on free plans (returns 429 silently). Set
// MISTRAL_VISION_MODEL=pixtral-large-latest to opt in.
const MISTRAL_VISION_MODEL = process.env.MISTRAL_VISION_MODEL ?? 'pixtral-12b-2409';

// Coerce price input into a number. Mistral occasionally returns strings
// like "3,50" or "3,-" instead of a JS number — without this the row is
// dropped at schema-parse time and the price silently goes missing.
const PriceCoerce = z.preprocess((v) => {
  if (v == null || v === '' || v === false) return null;
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  if (typeof v === 'string') {
    const cleaned = v
      .replace(/€|EUR|eur/gi, '')
      .replace(/[\s.](?=\d{3}(\D|$))/g, '') // thousands separator (rare)
      .replace(',', '.')                    // German decimal → JS decimal
      .replace(/[^0-9.\-]/g, '')            // strip stray chars / dot leaders
      .replace(/-+$/, '')                   // "3.-" → "3."
      .trim();
    if (cleaned === '' || cleaned === '.' || cleaned === '-') return null;
    const n = parseFloat(cleaned);
    if (!Number.isFinite(n) || n <= 0 || n > 500) return null;
    return n;
  }
  return null;
}, z.number().positive().nullable());

const MenuItem = z.object({
  name: z.string().min(1).max(80),
  price_eur: PriceCoerce.optional(),
  category: z.enum(['drink', 'food', 'dessert', 'special']).default('food'),
  tags: z.array(z.string()).default([]),
});

const MenuExtract = z.object({
  items: z.array(MenuItem).max(40),
});

export type ExtractedItem = z.infer<typeof MenuItem>;

const VISION_PROMPT = `You are an OCR-grade menu reader for printed café and restaurant menus (German + English). Extract EVERY menu item visible in the photo.

OUTPUT FORMAT (strict, no prose, no code fences)
{"items": [{"name": "...", "price_eur": 3.5, "category": "drink"|"food"|"dessert"|"special", "tags": ["vegan","seasonal","hot"]}]}

NAME — verbatim, complete
- Copy the name exactly as printed. Preserve umlauts (ä ö ü ß) and capitalisation.
- DO NOT translate. DO NOT paraphrase. DO NOT add marketing words.
- Description line that follows the dish name on a new line: drop it. The dish name itself is usually 1–4 words above the description.
- Strip leading bullets, numbers like "1.", "•", "-", "*", or stars.
- Skip section headings (single short words like "GETRÄNKE", "DRINKS", "DESSERTS", "FOOD", "STARTERS").

PRICE — capture aggressively, this is the single most important field
- On most café/restaurant menus, prices are RIGHT-ALIGNED in a column separated from the name. The price for "Cappuccino" sits at the far right of that row, possibly with leading dots, dashes, or whitespace. Scan the rightmost ~30% of each row for a number — that IS the price.
- Accept ALL of these patterns as a valid price for the item on that row:
    "3,50 €"   "3.50€"   "EUR 3.50"   "€3.50"
    "3,50"     "3.50"    "3,-"        "3 50"     (just the number is fine; assume euros)
    "3"        "3.0"     "10,-"       "10.-"
- If a row has dot leaders ("Cappuccino .......... 3,50"), the number after the dots IS the price.
- If you see two prices on one row ("Cappuccino  3,00  3,50" for small/large) — pick the FIRST one and add tag "from".
- Comma vs period: German menus use "," as decimal (3,50 = €3.50). Convert to a JS number with "." (price_eur: 3.5).
- "3,-" or "3.-" means €3.00 (whole euros). Convert to 3.0.
- Range 0.30 – 200.0 is a valid menu price. Anything outside that range is likely a phone, page number, or allergen code — set null.
- Only set price_eur: null when you are certain no number is associated with that item (e.g. "ask staff", "market price", or genuinely missing). Empty/null prices should be the EXCEPTION, not the rule.
- Better to capture an approximately-right price than to leave it null. The merchant can correct one wrong digit faster than they can type the whole price.

COVERAGE — extract everything
- Default to MORE items, not fewer. If you see 15 items on the menu, return 15.
- A typical café menu has 8–25 items; a restaurant menu often 20–40. Empty or 1–2 item results almost always mean the OCR gave up too early — try again row-by-row before returning.
- Only return {"items": []} if the photo is so blurry/dark you literally cannot make out any text.

CATEGORY
- drink: coffee, tea, espresso, water, beer, wine, cocktail, juice, smoothie, soda, schorle.
- dessert: cake (Kuchen, Torte), ice cream (Eis), pudding, tiramisu, mousse, crème brûlée.
- special: explicit "Tagesgericht" / "Mittagsmenü" / "Wochenkarte" / "saisonal" / "chef's special".
- food: everything else (sandwich, pizza, pasta, salad, soup, breakfast plates).

TAGS — only when explicit
- Add ONLY when the menu text says it: "vegan", "vegetarisch", "glutenfrei", "lactosefrei", "scharf", "spicy", "hot" (hot drinks), "cold", "seasonal", "saisonal", "bio", "kids", "from".
- Don't infer from item names alone.

SKIP — never as items
- Section headings (ALL CAPS single words).
- Allergen legends ("A,B,C..."), opening hours, phone numbers, addresses, social handles.
- Floating prices with no name on the same row.
- "Free wifi" lines, payment-method footers.

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
  const items = MenuExtract.parse(parsed).items;
  // Debug log so we can see how many items each tier returned. Without this
  // a partial-extraction is indistinguishable from a successful one in logs.
  console.log(`[vision] ${model} returned ${items.length} items: ${items.slice(0, 5).map(i => i.name).join(' | ')}${items.length > 5 ? ' …' : ''}`);
  return items;
}

export async function extractMenu(dataUrl: string): Promise<ExtractedItem[]> {
  // Tier 1: Mistral Pixtral cloud — preferred per project policy
  // (EU-hosted, brief explicitly favours Mistral). One retry with a 1.2s
  // backoff covers the most common Mistral free-tier 429 (~1 req/sec limit).
  if (mistralClient) {
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        return await tryVision(mistralClient, MISTRAL_VISION_MODEL, dataUrl);
      } catch (e) {
        const msg = (e as Error).message ?? '';
        const isRateLimit = msg.includes('429') || msg.toLowerCase().includes('rate');
        console.warn(`[vision] Mistral (${MISTRAL_VISION_MODEL}) attempt ${attempt} failed:`, msg);
        if (isRateLimit && attempt === 1) {
          await new Promise(r => setTimeout(r, 1200));
          continue;
        }
        break;
      }
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
  // No canned demo data: showing a fake menu after a real OCR failure is
  // worse than showing nothing — the merchant ends up with garbage in their
  // menu_items table and trusts the system less. Throw so the route can
  // return a visible error to the client instead.
  throw new Error('OCR_ALL_TIERS_FAILED');
}
