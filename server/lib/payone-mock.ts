// Simulated Payone transaction-density feed. The brief calls this out as
// "a core DSV asset for identifying quiet periods and triggering dynamic
// offers" and explicitly asks for per-merchant density (not just a global
// time-of-day curve).
//
// Strategy:
// 1. Each merchant.type has a baseline rush profile by hour of day.
// 2. A stable hash of the merchant id shifts that profile by ±2 hours so
//    two cafés at the same hour don't read identically.
// 3. A short-window time bucket (10-min) flips a few merchants between
//    levels so the demo feels live across consecutive offer pulls.
//
// All numbers are deterministic given (merchantId, merchantType, time) —
// no DB write, no external call, no clock drift surprises during a demo.

export type Density = 'low' | 'medium' | 'high';

export interface PayoneSignal {
  density: Density;
  label: string;       // localized German label for UI
  txn_per_min: number; // headline number for the merchant dashboard tile
}

// Stable 0–1 from a string. Tiny xmur3-style hash, no crypto dep needed.
function hash01(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 1000) / 1000;
}

// Per-type rush profile: hours when this kind of shop is naturally busy.
const RUSH_HOURS: Record<string, number[]> = {
  café:       [7, 8, 9, 12, 13, 16],
  bakery:     [6, 7, 8, 9, 17],
  bookstore:  [11, 12, 14, 15, 16, 17],
  restaurant: [12, 13, 18, 19, 20, 21],
  bar:        [18, 19, 20, 21, 22, 23],
  retail:     [11, 12, 14, 15, 16, 17, 18],
  services:   [9, 10, 11, 14, 15, 16],
  other:      [12, 13, 17, 18],
};

function densityForMerchant(merchantId: string, merchantType: string, hour: number): Density {
  const profile = RUSH_HOURS[merchantType] ?? RUSH_HOURS.other;
  // Per-merchant offset: ±2 hours so two cafés don't peak at the exact same minute.
  const offset = Math.round((hash01(merchantId + ':offset') - 0.5) * 4);
  const adjustedHour = ((hour - offset) + 24) % 24;
  const isRush = profile.includes(adjustedHour);

  // 10-min bucket lets the level wobble across consecutive customer pulls
  // (so judges see different offers if they refresh — feels live).
  const bucket = Math.floor(Date.now() / (10 * 60 * 1000));
  const noise = hash01(merchantId + ':' + bucket);

  if (isRush) {
    if (noise < 0.15) return 'medium'; // rush hour but a quiet pocket
    return 'high';
  }
  // Off-rush
  if (noise < 0.20) return 'high';     // surprise peak
  if (noise < 0.55) return 'medium';
  return 'low';                         // quiet — eligible for fill-quiet-hours
}

const LABELS: Record<Density, string> = {
  low: 'Ruhig gerade (Payone)',
  medium: 'Normal (Payone)',
  high: 'Stark frequentiert (Payone)',
};

const TXN_RANGES: Record<Density, [number, number]> = {
  low: [0, 2],
  medium: [3, 7],
  high: [8, 18],
};

export function getMerchantPayoneSignal(
  merchantId: string,
  merchantType: string,
  hour: number = new Date().getHours(),
): PayoneSignal {
  const density = densityForMerchant(merchantId, merchantType, hour);
  const [lo, hi] = TXN_RANGES[density];
  // Same 10-min bucket so the headline number is stable across renders
  // within the bucket; rolls over cleanly when density flips.
  const bucket = Math.floor(Date.now() / (10 * 60 * 1000));
  const r = hash01(merchantId + ':txn:' + bucket);
  const txn_per_min = Math.round(lo + r * (hi - lo));
  return { density, label: LABELS[density], txn_per_min };
}

// Backwards-compatible global density: average across the area.
// Kept so existing call sites that just want "is the area busy" still work,
// but the per-merchant signal above is what drives offer scoring.
export function getPayoneDensity(): { density: Density; label: string } {
  const hour = new Date().getHours();
  // Coarse global curve — broadly busier midday/evening.
  if (hour >= 7 && hour < 9) return { density: 'high', label: 'Morgenrush (Payone)' };
  if (hour >= 9 && hour < 11) return { density: 'medium', label: 'Vormittag (Payone)' };
  if (hour >= 11 && hour < 14) return { density: 'high', label: 'Mittagsrush (Payone)' };
  if (hour >= 14 && hour < 17) return { density: 'low', label: 'Nachmittag ruhig (Payone)' };
  if (hour >= 17 && hour < 20) return { density: 'high', label: 'Abendrush (Payone)' };
  return { density: 'low', label: 'Außerhalb der Stoßzeiten (Payone)' };
}
