// Sparkassen-Rot brand palette. The primary is the official DSV/Sparkasse
// red (#FF0000 in their style guide); we use #E60000 on screen for slightly
// better contrast comfort while staying visually identical at thumbnail size.
export const theme = {
  // Surfaces
  bg: '#FFFFFF',
  bgMuted: '#FFF5F5',     // very light red wash
  surface: '#FFFFFF',
  surfaceAlt: '#FFE5E5',
  border: '#FFCCCC',

  // Text
  text: '#1F1F23',
  textMuted: '#666670',
  textOnPrimary: '#FFFFFF',

  // Brand — Sparkassen-Rot
  primary: '#E60000',     // Sparkasse red (#FF0000 in print, slightly toned for screen)
  primaryDark: '#A00000',
  primaryLight: '#FF4D4D',
  primaryWash: '#FFE5E5',

  // Semantic
  success: '#16A34A',
  warn: '#F59E0B',
  danger: '#DC2626',

  // Accents (for confetti / chips)
  accents: ['#E60000', '#FF4D4D', '#FFFFFF', '#1F1F23', '#FFCCCC', '#A00000'],
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
