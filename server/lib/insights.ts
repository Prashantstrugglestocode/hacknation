import OpenAI from 'openai';
import { scrubPII } from './pii-scrubber';

const mistralClient = process.env.MISTRAL_API_KEY
  ? new OpenAI({ 
      baseURL: 'https://api.mistral.ai/v1', 
      apiKey: process.env.MISTRAL_API_KEY,
    })
  : null;

if (mistralClient) console.log('[insights] Mistral client initialized');

const ollama = new OpenAI({
  baseURL: 'http://localhost:11434/v1',
  apiKey: 'ollama',
});

const openaiClient = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

const MISTRAL_MODEL = 'mistral-small-latest';
const TEXT_MODEL = process.env.OLLAMA_MODEL ?? 'gemma3:4b';

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

const SYS = `Du bist Café/Restaurant-Analyst für City Wallet. Eingabe: ein Händler und Performance-Daten der letzten 7 Tage pro Menüposten.

Regeln:
- Gib NUR JSON zurück: {"insights":[{"item_id":"...","observation":"...","suggestion":"...","confidence":"low|medium|high"}]}
- observation: ein faktischer Satz auf Deutsch, max. 18 Wörter.
- suggestion: konkrete Aktion (z.B. "20% Mittagsrabatt", "mit Kaffee koppeln", "Zeitfenster verschieben", "deaktivieren").
- Nur Items mit ≥3 shown markieren.
- Maximal 3 Insights, sortiert nach Wirkung.
- Keine Einleitung, kein Markdown, nur JSON.`;

export async function generateInsights(merchant: any, items: ItemPerf[]): Promise<Insight[]> {
  const ranked = items
    .filter(i => i.shown >= 3)
    .sort((a, b) => a.accept_rate - b.accept_rate)
    .slice(0, 8);

  if (ranked.length === 0) return [];

  const userMessage = JSON.stringify({
    merchant: { name: merchant.name, type: merchant.type, goal: merchant.goal, max_discount_pct: merchant.max_discount_pct },
    items: ranked,
    window_days: 7,
  });

  const tryRun = async (client: OpenAI, model: string): Promise<Insight[]> => {
    const sanitizedMessage = scrubPII(userMessage);
    const res = await client.chat.completions.create({
      model,
      temperature: 0.4,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: SYS },
        { role: 'user', content: sanitizedMessage },
      ],
    });
    const raw = res.choices[0]?.message?.content ?? '{}';
    const cleaned = raw.replace(/```json\s*|```\s*/g, '').trim();
    const parsed = JSON.parse(cleaned);
    const list = Array.isArray(parsed.insights) ? parsed.insights : [];
    return list.slice(0, 3).map((i: any) => ({
      item_id: String(i.item_id ?? ''),
      observation: String(i.observation ?? ''),
      suggestion: String(i.suggestion ?? ''),
      confidence: ['low', 'medium', 'high'].includes(i.confidence) ? i.confidence : 'medium',
    }));
  };

  if (mistralClient) {
    try { return await tryRun(mistralClient, MISTRAL_MODEL); } catch (e) {
      console.error('[insights] Mistral failed:', e);
    }
  }

  try { return await tryRun(ollama, TEXT_MODEL); } catch (e) {
    console.warn('[insights] Ollama failed:', (e as Error).message);
  }
  
  if (openaiClient) {
    try { return await tryRun(openaiClient, 'gpt-4o-mini'); } catch (e) {
      console.warn('[insights] OpenAI failed:', (e as Error).message);
    }
  }
  
  // Deterministic fallback
  return ranked.slice(0, 2).map(i => ({
    item_id: i.item_id,
    observation: `${i.name}: ${i.shown} angezeigt, ${Math.round(i.accept_rate * 100)} % angenommen.`,
    suggestion: i.accept_rate < 0.2 ? 'Deutlicher Rabatt oder anderes Zeitfenster.' : 'Mit beliebtem Item koppeln.',
    confidence: 'low',
  }));
}
