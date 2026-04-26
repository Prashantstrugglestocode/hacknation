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

// Apply alpha as `rgba(r, g, b, a)` — RN parses this format unconditionally,
// so it can never produce an "invalid colour value" error the way `#RRGGBB +
// 'XX'` concatenation can if the base string isn't well-formed.
// alpha01 is a 0–1 float (0.13 ≈ '22', 0.4 ≈ '66', 0.8 ≈ 'CC').
export function withAlpha(c: any, alpha01: number, fallback: string = SAFE_DEFAULT): string {
  const base = safeHex(c, fallback);
  const r = parseInt(base.slice(1, 3), 16);
  const g = parseInt(base.slice(3, 5), 16);
  const b = parseInt(base.slice(5, 7), 16);
  const a = Math.max(0, Math.min(1, alpha01));
  return `rgba(${r},${g},${b},${a})`;
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
