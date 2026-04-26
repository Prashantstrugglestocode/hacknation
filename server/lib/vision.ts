import OpenAI from 'openai';
import { z } from 'zod';
import { Mistral } from '@mistralai/mistralai';

const mistralClient = process.env.MISTRAL_API_KEY
  ? new OpenAI({
    baseURL: 'https://api.mistral.ai/v1',
    apiKey: process.env.MISTRAL_API_KEY,
  })
  : null;

const mistralOcrClient = process.env.MISTRAL_API_KEY
  ? new Mistral({ apiKey: process.env.MISTRAL_API_KEY })
  : null;

const openaiClient = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

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
  // Use Mistral OCR API
  if (mistralOcrClient && mistralClient) {
    try {
      console.log('[vision] Running Mistral OCR API...');
      const ocrResponse = await mistralOcrClient.ocr.process({
        model: 'mistral-ocr-latest',
        document: {
          type: 'image_url',
          imageUrl: dataUrl,
        }
      });
      
      const markdown = ocrResponse.pages[0]?.markdown;
      if (!markdown) {
        throw new Error('No markdown_result from Mistral OCR');
      }

      console.log('[vision] Mistral OCR successful. Parsing markdown with LLM...');
      const res = await mistralClient.chat.completions.create({
        model: 'mistral-small-latest',
        temperature: 0.2,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: VISION_PROMPT },
          {
            role: 'user',
            content: `Here is the OCR text of the menu:\n\n${markdown}\n\nExtract the menu items as JSON.`,
          },
        ],
      });

      const raw = res.choices[0]?.message?.content;
      if (!raw) throw new Error('empty LLM response');
      const cleaned = raw.replace(/```json\s*|```\s*/g, '').trim();
      const parsed = JSON.parse(cleaned);
      return MenuExtract.parse(parsed).items;
    } catch (e) {
      console.error('[vision] Mistral OCR pipeline failed:', (e as Error).message);
    }
  }

  // Fallback OpenAI
  if (openaiClient) {
    try {
      return await tryVision(openaiClient, 'gpt-4o-mini', dataUrl);
    } catch (e) {
      console.warn('[vision] OpenAI gpt-4o-mini failed:', (e as Error).message);
    }
  }

  // All vision backends failed — return empty so the user knows the scan failed
  console.error('[vision] All vision backends failed. Returning empty.');
  return [];
}
