import { z } from 'zod';

export const WidgetSpec = z.object({
  layout: z.enum(['hero', 'compact', 'split', 'fullbleed', 'sticker']),
  palette: z.object({
    bg: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
    fg: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
    accent: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
  }),
  mood: z.enum(['cozy', 'energetic', 'urgent', 'playful', 'discreet']),
  hero: z.object({
    type: z.enum(['icon', 'gradient', 'pattern']),
    value: z.string(),
  }),
  headline: z.string().max(48),
  subline: z.string().max(80),
  cta: z.string().max(20),
  signal_chips: z.array(z.string()).min(2).max(4),
  pressure: z.object({
    kind: z.enum(['time', 'stock']),
    value: z.string(),
  }).nullable(),
  reasoning: z.string().max(200),
  merchant: z.object({
    id: z.string(),
    name: z.string(),
    distance_m: z.number(),
  }),
  discount: z.object({
    kind: z.enum(['pct', 'eur', 'item']),
    value: z.number(),
    constraint: z.string().nullable(),
  }),
  validity_minutes: z.number().int().min(10).max(120),
  locale: z.enum(['de', 'en']),
  hero_image_url: z.string().url().optional().nullable(),
});

export type WidgetSpecType = z.infer<typeof WidgetSpec>;

export const widgetSpecJsonSchema = {
  type: 'object' as const,
  properties: {
    layout: { type: 'string', enum: ['hero', 'compact', 'split', 'fullbleed', 'sticker'] },
    palette: {
      type: 'object',
      properties: {
        bg: { type: 'string' },
        fg: { type: 'string' },
        accent: { type: 'string' },
      },
      required: ['bg', 'fg', 'accent'],
      additionalProperties: false,
    },
    mood: { type: 'string', enum: ['cozy', 'energetic', 'urgent', 'playful', 'discreet'] },
    hero: {
      type: 'object',
      properties: {
        type: { type: 'string', enum: ['icon', 'gradient', 'pattern'] },
        value: { type: 'string' },
      },
      required: ['type', 'value'],
      additionalProperties: false,
    },
    headline: { type: 'string' },
    subline: { type: 'string' },
    cta: { type: 'string' },
    signal_chips: { type: 'array', items: { type: 'string' }, minItems: 2, maxItems: 4 },
    pressure: {
      oneOf: [
        {
          type: 'object',
          properties: {
            kind: { type: 'string', enum: ['time', 'stock'] },
            value: { type: 'string' },
          },
          required: ['kind', 'value'],
          additionalProperties: false,
        },
        { type: 'null' },
      ],
    },
    reasoning: { type: 'string' },
    merchant: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        name: { type: 'string' },
        distance_m: { type: 'number' },
      },
      required: ['id', 'name', 'distance_m'],
      additionalProperties: false,
    },
    discount: {
      type: 'object',
      properties: {
        kind: { type: 'string', enum: ['pct', 'eur', 'item'] },
        value: { type: 'number' },
        constraint: { oneOf: [{ type: 'string' }, { type: 'null' }] },
      },
      required: ['kind', 'value', 'constraint'],
      additionalProperties: false,
    },
    validity_minutes: { type: 'integer' },
    locale: { type: 'string', enum: ['de', 'en'] },
  },
  required: [
    'layout','palette','mood','hero','headline','subline','cta',
    'signal_chips','pressure','reasoning','merchant','discount',
    'validity_minutes','locale'
  ],
  additionalProperties: false,
};
