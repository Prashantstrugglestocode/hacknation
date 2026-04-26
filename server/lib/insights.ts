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

const SYS = `Du bist Café/Restaurant-Analyst für Stadtpuls. Eingabe: ein Händler und Performance-Daten der letzten 7 Tage pro Menüposten.

Du erhältst zwei Listen:
- low_performers: Posten die ≥3 Mal angezeigt wurden, aber niedrige Annahmequote haben.
- never_featured: Posten in der Speisekarte, die in 7 Tagen NIE in einem Angebot verwendet wurden.

Regeln:
- Gib NUR JSON zurück: {"insights":[{"item_id":"...","observation":"...","suggestion":"...","confidence":"low|medium|high"}]}
- observation: ein faktischer Satz auf Deutsch, max. 20 Wörter.
- suggestion: konkrete Aktion (z.B. "Flash-Sale 20% nachmittags", "mit Kaffee koppeln", "Zeitfenster verschieben", "deaktivieren", "manuell in Flash-Sale aufnehmen").
- Decke BEIDE Kategorien ab: mindestens ein Insight für ein never_featured Item, falls vorhanden — die KI hat es noch nie gewählt; erkläre wahrscheinlich warum (Tageszeit, Wetter, fehlt im Profil) und schlage konkrete Aktion vor.
- Maximal 4 Insights, sortiert nach Wirkung.
- Keine Einleitung, kein Markdown, nur JSON.`;

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

  // Mistral only (per user instruction — no Ollama fallback).
  if (mistralClient) {
    try { return await tryRun(mistralClient, MISTRAL_MODEL); } catch (e) {
      console.warn('[insights] Mistral failed:', (e as Error).message);
    }
  }
  // Deterministic fallback — surface low performers + at least one never-featured.
  const out: Insight[] = [];
  for (const i of lowPerformers.slice(0, 2)) {
    out.push({
      item_id: i.item_id,
      observation: `${i.name}: ${i.shown} angezeigt, ${Math.round(i.accept_rate * 100)} % angenommen.`,
      suggestion: i.accept_rate < 0.2 ? 'Deutlicher Rabatt oder anderes Zeitfenster.' : 'Mit beliebtem Item koppeln.',
      confidence: 'low',
    });
  }
  for (const i of neverFeatured.slice(0, 2)) {
    out.push({
      item_id: i.item_id,
      observation: `${i.name} wurde in 7 Tagen nie ausgespielt.`,
      suggestion: 'In Flash-Sale aufnehmen oder Tageszeit prüfen.',
      confidence: 'low',
    });
  }
  return out;
}
