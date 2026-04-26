// Client-side defensive color normalizer. RN's StyleSheet throws
// "invalid colour value" if a color string isn't a recognized format.
// This belt-and-suspenders helper guarantees every color reaching
// a style is a valid #RRGGBB (or transparent), even if the server
// or a stored offer slipped through with garbage.

const SAFE_DEFAULT = '#1F1F23';

export function safeHex(c: any, fallback: string = SAFE_DEFAULT): string {
  if (typeof c !== 'string') return fallback;
  let s = c.trim();
  if (!s) return fallback;
  // Already a recognized form?
  if (/^#[0-9a-f]{6}$/i.test(s)) return s;
  if (/^#[0-9a-f]{8}$/i.test(s)) return s;
  // Add missing leading '#'
  if (!s.startsWith('#')) s = '#' + s;
  // 3-char shorthand → 6-char
  if (/^#[0-9a-f]{3}$/i.test(s)) {
    return '#' + s[1] + s[1] + s[2] + s[2] + s[3] + s[3];
  }
  if (/^#[0-9a-f]{6}$/i.test(s)) return s;
  if (/^#[0-9a-f]{8}$/i.test(s)) return s;
  return fallback;
}

// Append an alpha byte safely. `alpha` is a 2-char hex like '22', '88'.
export function withAlpha(c: any, alpha: string, fallback: string = SAFE_DEFAULT): string {
  const base = safeHex(c, fallback);
  // Strip any existing alpha first.
  const six = base.slice(0, 7);
  const a = /^[0-9a-f]{2}$/i.test(alpha) ? alpha : 'FF';
  return six + a;
}

// Normalize a palette object in one shot.
export interface SafePalette { bg: string; fg: string; accent: string }
export function safePalette(p: any, fallback: SafePalette = {
  bg: '#1A1A2E', fg: '#FFFFFF', accent: '#E11D48',
}): SafePalette {
  return {
    bg: safeHex(p?.bg, fallback.bg),
    fg: safeHex(p?.fg, fallback.fg),
    accent: safeHex(p?.accent, fallback.accent),
  };
}
