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
