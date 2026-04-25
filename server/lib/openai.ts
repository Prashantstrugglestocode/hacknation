import OpenAI from 'openai';
import { widgetSpecJsonSchema, WidgetSpec } from '../lib/widget-spec.ts';

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const SYSTEM_PROMPT = `You are City Wallet's hyperlocal offer generator for the DSV Gruppe / Sparkassen network. Given a merchant and the current real-world context, produce a single offer as a JSON object matching the provided schema. Rules:

- Match mood to context. Cold and drizzle and quiet = cozy. Sunny and crowded with event nearby = energetic. Closing in under 30 minutes with stock = urgent. Lunchtime quiet café = cozy or discreet.
- Pick layout to fit mood. Cozy or playful favors hero or sticker. Factual or discreet favors compact. Energetic favors split. Urgent favors fullbleed.
- Palette: 3 hex colors that harmonize with the mood and pass WCAG AA contrast for fg-on-bg.
- signal_chips: 2 to 4 short labels showing the actual context signals used. Use the user's locale.
- Copy is concrete, never marketing fluff. No "exclusive offer just for you." No emojis unless mood is playful.
- Headline under 8 words. Subline under 14 words. CTA under 4 words.
- Discount must respect merchant.max_discount_pct.
- reasoning: one sentence in plain language explaining why this offer at this moment. Used in transparency UI.
- validity_minutes: 15 to 90. Shorter for urgent, longer for cozy.
- Write all user-facing strings in the given locale.

Output the JSON object only. No prose.`;

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
      inventory_tags: params.merchant.inventory_tags,
      time_windows: params.merchant.time_windows,
    },
    context: params.context,
    locale: params.locale,
    distance_m: Math.round(params.distance_m),
  });

  const tryGenerate = async (model: string) => {
    const response = await client.chat.completions.create({
      model,
      temperature: 0.8,
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'WidgetSpec',
          strict: true,
          schema: widgetSpecJsonSchema,
        },
      },
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userMessage },
      ],
    });
    const raw = response.choices[0]?.message?.content;
    if (!raw) throw new Error('Empty response');
    return JSON.parse(raw);
  };

  try {
    return await tryGenerate('gpt-4o-mini');
  } catch {
    return await tryGenerate('gpt-4o');
  }
}
