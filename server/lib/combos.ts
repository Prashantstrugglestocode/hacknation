// In-memory combo-deal store. A merchant bundles 2-3 menu items at a fixed
// price below the sum of individual prices ("Frühstücks-Set: Cappuccino +
// Croissant für 4,50 € statt 5,80 €"). The offer engine reads active combos
// when generating, and the LLM is told to prefer pitching one when it fits
// the customer context.
//
// Hackathon scope — not persisted, not migrated. State is lost on server
// restart. Migration to Supabase is one INSERT-table away when needed.
//
// Each merchant can hold any number of combos simultaneously; the LLM picks
// the most context-appropriate one (or none) at offer-generation time.

export interface Combo {
  id: string;
  name: string;                  // "Frühstücks-Set"
  menu_item_ids: string[];       // UUIDs from menu_items
  combo_price_cents: number;     // bundle price the customer pays
  created_at: number;            // ms epoch — UI sorts by this
}

const STORE = new Map<string, Combo[]>(); // merchantId → combos

function uuid(): string {
  // Lightweight v4 — Bun has crypto.randomUUID but stay portable.
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

export function listCombos(merchantId: string): Combo[] {
  return [...(STORE.get(merchantId) ?? [])].sort((a, b) => b.created_at - a.created_at);
}

export function addCombo(
  merchantId: string,
  input: { name: string; menu_item_ids: string[]; combo_price_cents: number },
): Combo | null {
  const ids = (input.menu_item_ids ?? []).filter(s => typeof s === 'string' && s.length > 0);
  if (ids.length < 2) return null;
  const price = Math.max(50, Math.round(input.combo_price_cents));
  if (!Number.isFinite(price)) return null;
  const combo: Combo = {
    id: uuid(),
    name: (input.name ?? '').trim().slice(0, 60) || 'Combo',
    menu_item_ids: ids.slice(0, 4),
    combo_price_cents: price,
    created_at: Date.now(),
  };
  const list = STORE.get(merchantId) ?? [];
  list.push(combo);
  STORE.set(merchantId, list);
  return combo;
}

export function deleteCombo(merchantId: string, comboId: string): boolean {
  const list = STORE.get(merchantId);
  if (!list) return false;
  const next = list.filter(c => c.id !== comboId);
  if (next.length === list.length) return false;
  STORE.set(merchantId, next);
  return true;
}
