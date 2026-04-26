export const theme = {
  // Surfaces
  bg: '#FFFFFF',
  bgMuted: '#FFF1F2',     // rose-50
  surface: '#FFFFFF',
  surfaceAlt: '#FEE2E2',  // rose-100
  border: '#FECACA',      // rose-200

  // Text
  text: '#1F1F23',
  textMuted: '#71717A',
  textOnPrimary: '#FFFFFF',

  // Brand
  primary: '#E11D48',     // rose-600
  primaryDark: '#9F1239', // rose-800
  primaryLight: '#FB7185',// rose-400
  primaryWash: '#FFE4E6', // rose-100

  // Semantic
  success: '#16A34A',
  warn: '#F59E0B',
  danger: '#DC2626',

  // Accents (for confetti / chips)
  accents: ['#E11D48', '#FB7185', '#FFFFFF', '#1F1F23', '#FECACA', '#9F1239'],
} as const;

// 8pt spacing grid — use these everywhere instead of arbitrary numbers.
export const space = {
  xs: 4, sm: 8, md: 12, lg: 16, xl: 20, '2xl': 24, '3xl': 32, '4xl': 40,
} as const;

// Radius scale — pin to a few sizes; avoid arbitrary 11/13/17 values.
export const radius = {
  sm: 8, md: 12, lg: 16, xl: 22, pill: 999,
} as const;

// Type scale — pin font sizes to one of these. Weights are 600/700/800/900.
export const type = {
  micro: 10,   // tiny labels / source pills
  caption: 11, // overline labels
  small: 12,   // helper text
  body: 14,    // default body
  bodyL: 16,   // primary body
  title: 20,   // section title
  display: 28, // big numbers
  hero: 40,    // hero numbers
} as const;
