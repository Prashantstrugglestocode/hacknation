import { readFileSync } from 'fs';
import { join } from 'path';

interface TriggerWhen {
  temp_c_max?: number;
  condition_in?: string[];
  merchant_quiet?: boolean;
  merchant_types?: string[];
  events_within_m?: number;
  events_starting_in_min?: number;
  hour_in?: number[];
  movement?: string;
  minutes_to_close_max?: number;
  has_inventory_tags?: boolean;
  foot_traffic?: 'low' | 'medium' | 'high';
}

interface Trigger {
  id: string;
  when: TriggerWhen;
}

interface Config {
  triggers: Trigger[];
  scoring: {
    distance_weight: number;
    context_match_weight: number;
    freshness_penalty_minutes: number;
  };
}

let config: Config | null = null;

function getConfig(): Config {
  if (config) return config;
  const path = join(process.cwd(), '..', 'config', 'default.json');
  config = JSON.parse(readFileSync(path, 'utf-8')) as Config;
  return config;
}

export interface ContextInput {
  temp_c: number;
  condition: string; // OWM-style: 'Rain', 'Clouds', 'Clear', etc.
  hour: number;
  events: Array<{ distance_m: number; starts_in_minutes: number }>;
  payone_density: 'low' | 'medium' | 'high';
  // Coarse OSM-derived foot traffic for the geohash cell. Brief calls this
  // out as a "footfall signal / route density" the system should react to.
  foot_traffic?: 'low' | 'medium' | 'high';
  intent: { browsing: boolean };
}

// Map raw OSM POI count → 3-bucket footfall density.
// Tuned for German old-town neighbourhoods: ≤3 POIs in 500m = quiet
// residential, ~4-12 = active street, 12+ = pedestrian zone.
export function footTrafficFromPOI(totalPOIs: number): 'low' | 'medium' | 'high' {
  if (totalPOIs <= 3) return 'low';
  if (totalPOIs >= 13) return 'high';
  return 'medium';
}

export function firedTriggers(ctx: ContextInput, merchantType: string, inventoryTags: string[]): string[] {
  const { triggers } = getConfig();
  const fired: string[] = [];

  for (const t of triggers) {
    const w = t.when;
    let match = true;

    if (w.temp_c_max !== undefined && ctx.temp_c > w.temp_c_max) match = false;
    if (w.condition_in && !w.condition_in.some(c => ctx.condition.toLowerCase().includes(c))) match = false;
    if (w.merchant_quiet !== undefined && w.merchant_quiet !== (ctx.payone_density === 'low')) match = false;
    if (w.merchant_types && !w.merchant_types.includes(merchantType)) match = false;
    if (w.hour_in && !w.hour_in.includes(ctx.hour)) match = false;
    if (w.movement === 'browsing' && !ctx.intent.browsing) match = false;
    if (w.events_within_m) {
      const hasEvent = ctx.events.some(e => e.distance_m <= w.events_within_m!);
      if (!hasEvent) match = false;
    }
    if (w.events_starting_in_min) {
      const soonEvent = ctx.events.some(e => e.starts_in_minutes <= w.events_starting_in_min!);
      if (!soonEvent) match = false;
    }
    if (w.has_inventory_tags && inventoryTags.length === 0) match = false;
    if (w.foot_traffic && ctx.foot_traffic !== w.foot_traffic) match = false;

    if (match) fired.push(t.id);
  }

  return fired;
}

export function scoreMerchant(params: {
  distance_m: number;
  triggers: string[];
  lastSeenMinutesAgo: number;
}): number {
  const { scoring } = getConfig();
  const distanceScore = Math.max(0, 1 - params.distance_m / 500);
  const contextScore = Math.min(1, params.triggers.length * 0.35);
  const freshnessPenalty = params.lastSeenMinutesAgo < scoring.freshness_penalty_minutes ? -0.5 : 0;

  return (
    distanceScore * scoring.distance_weight +
    contextScore * scoring.context_match_weight +
    freshnessPenalty
  );
}

// Weather-appropriateness is decided by the LLM at offer-generation time
// (see SYSTEM_PROMPT "WEATHER REASONING" section). The previous
// keyword/regex-based weatherFitPenalty was deleted — we trust the model
// to reason about what fits the current temp + condition rather than
// matching against a hardcoded vocabulary.

export function getScoringConfig() {
  return getConfig().scoring;
}
