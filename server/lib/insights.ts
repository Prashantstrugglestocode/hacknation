import OpenAI from 'openai';

const ollama = new OpenAI({
  baseURL: 'http://localhost:11434/v1',
  apiKey: 'ollama',
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

const TEXT_MODEL = process.env.OLLAMA_MODEL ?? 'gemma3:4b';
const MISTRAL_MODEL = process.env.MISTRAL_MODEL ?? 'mistral-small-latest';

interface ItemPerf {
  item_id: string;
  name: string;
  category: string;
  price_eur: number | null;
  shown: number;
  accepted: number;
  redeemed: number;
  accept_rate: number;
}

export interface Insight {
  item_id: string;
  observation: string;
  suggestion: string;
  confidence: 'low' | 'medium' | 'high';
}

const SYS = `You are a café/restaurant analyst for Stadtpuls. Input: one merchant and 7-day performance data per menu item.

You receive two lists:
- low_performers: items shown ≥3 times with a low accept rate.
- never_featured: items in the menu that were NEVER used in an offer over the last 7 days.

Rules:
- Output ONLY JSON: {"insights":[{"item_id":"...","observation":"...","suggestion":"...","confidence":"low|medium|high"}]}
- observation: one factual sentence in plain English, max 20 words.
- suggestion: a concrete action (e.g. "Flash sale 20% in the afternoon", "pair with coffee", "shift the time window", "deactivate", "add to a flash sale manually").
- Cover BOTH categories: include at least one insight for a never_featured item when available — the AI has never picked it; explain the likely reason (time of day, weather, missing tags) and suggest a concrete action.
- Max 4 insights, sorted by impact.
- No preamble, no markdown, JSON only.`;

export async function generateInsights(merchant: any, items: ItemPerf[]): Promise<Insight[]> {
  const lowPerformers = items
    .filter(i => i.shown >= 3 && i.accept_rate < 0.5)
    .sort((a, b) => a.accept_rate - b.accept_rate)
    .slice(0, 6);
  const neverFeatured = items
    .filter(i => i.shown === 0)
    .slice(0, 6);

  if (lowPerformers.length === 0 && neverFeatured.length === 0) return [];

  const userMessage = JSON.stringify({
    merchant: { name: merchant.name, type: merchant.type, goal: merchant.goal, max_discount_pct: merchant.max_discount_pct },
    low_performers: lowPerformers,
    never_featured: neverFeatured,
    window_days: 7,
    current_hour: new Date().getHours(),
  });

  const tryRun = async (client: OpenAI, model: string): Promise<Insight[]> => {
    const res = await client.chat.completions.create({
      model,
      temperature: 0.4,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: SYS },
        { role: 'user', content: userMessage },
      ],
    });
    const raw = res.choices[0]?.message?.content ?? '{}';
    const cleaned = raw.replace(/```json\s*|```\s*/g, '').trim();
    const parsed = JSON.parse(cleaned);
    const list = Array.isArray(parsed.insights) ? parsed.insights : [];
    return list.slice(0, 4).map((i: any) => ({
      item_id: String(i.item_id ?? ''),
      observation: String(i.observation ?? ''),
      suggestion: String(i.suggestion ?? ''),
      confidence: ['low', 'medium', 'high'].includes(i.confidence) ? i.confidence : 'medium',
    }));
  };

  // Tier 1: Mistral cloud.
  if (mistralClient) {
    try { return await tryRun(mistralClient, MISTRAL_MODEL); } catch (e) {
      console.warn('[insights] Mistral failed:', (e as Error).message);
    }
  }
  // Tier 2: on-device SLM fallback.
  try { return await tryRun(ollama, TEXT_MODEL); } catch (e) {
    console.warn(`[insights] On-device SLM (${TEXT_MODEL}) failed:`, (e as Error).message);
  }
  // Deterministic fallback — surface low performers + at least one never-featured.
  const out: Insight[] = [];
  for (const i of lowPerformers.slice(0, 2)) {
    out.push({
      item_id: i.item_id,
      observation: `${i.name}: shown ${i.shown}×, accepted ${Math.round(i.accept_rate * 100)}%.`,
      suggestion: i.accept_rate < 0.2 ? 'Try a deeper discount or a different time window.' : 'Pair it with a popular item.',
      confidence: 'low',
    });
  }
  for (const i of neverFeatured.slice(0, 2)) {
    out.push({
      item_id: i.item_id,
      observation: `${i.name} was never featured in the last 7 days.`,
      suggestion: 'Add to a flash sale or check the time-of-day fit.',
      confidence: 'low',
    });
  }
  return out;
}
