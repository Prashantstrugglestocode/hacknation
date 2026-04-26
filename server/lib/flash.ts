// In-memory flash-sale store. Each merchant can run MULTIPLE flash sales
// concurrently (e.g. "Croissant 20% off until 14:00" AND "Mittagsmenü 30%
// off until 13:00"). The offer engine reads ALL active flashes and the LLM
// picks the one whose items/combos best fit the customer's current context
// (weather + time-of-day). Hackathon scope — not persisted across restart.

export interface FlashSale {
  id: string;
  menu_item_ids: string[]; // UUIDs from menu_items table
  combo_ids: string[];     // optional — combo bundle ids in this flash
  pct: number;             // discount % (1-50) — applies to menu_item_ids only
  until: number;           // ms epoch
  created_at: number;      // ms epoch — UI sorts by this
}

const STORE = new Map<string, FlashSale[]>(); // merchantId → flashes

function uuid(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

function pruneExpired(merchantId: string): FlashSale[] {
  const list = STORE.get(merchantId) ?? [];
  const now = Date.now();
  const live = list.filter(f => f.until > now);
  if (live.length !== list.length) STORE.set(merchantId, live);
  return live;
}

// Adds a new flash sale. Multiple may be active for the same merchant at
// once — the offer engine considers all of them and the LLM picks one.
export function addFlash(
  merchantId: string,
  menu_item_ids: string[],
  pct: number,
  durationMin: number,
  combo_ids: string[] = [],
): FlashSale {
  const sale: FlashSale = {
    id: uuid(),
    menu_item_ids: menu_item_ids
      .filter(id => typeof id === 'string' && id.length > 0)
      .map(id => id.trim()),
    combo_ids: combo_ids
      .filter(id => typeof id === 'string' && id.length > 0)
      .map(id => id.trim()),
    pct: Math.max(1, Math.min(50, Math.round(pct))),
    until: Date.now() + Math.max(5, Math.min(240, Math.round(durationMin))) * 60 * 1000,
    created_at: Date.now(),
  };
  const list = pruneExpired(merchantId);
  list.push(sale);
  STORE.set(merchantId, list);
  return sale;
}

// Backwards-compat: legacy callers that thought of "flash" as a single
// thing. Now adds a new entry rather than replacing.
export function setFlash(
  merchantId: string,
  menu_item_ids: string[],
  pct: number,
  durationMin: number,
  combo_ids: string[] = [],
): FlashSale {
  return addFlash(merchantId, menu_item_ids, pct, durationMin, combo_ids);
}

export function listFlash(merchantId: string): FlashSale[] {
  return [...pruneExpired(merchantId)].sort((a, b) => b.created_at - a.created_at);
}

// Backwards-compat: returns the most recently created active flash, or null.
// New code should use listFlash().
export function getFlash(merchantId: string): FlashSale | null {
  const list = pruneExpired(merchantId);
  if (list.length === 0) return null;
  return [...list].sort((a, b) => b.created_at - a.created_at)[0];
}

export function removeFlash(merchantId: string, flashId: string): boolean {
  const list = STORE.get(merchantId);
  if (!list) return false;
  const next = list.filter(f => f.id !== flashId);
  if (next.length === list.length) return false;
  STORE.set(merchantId, next);
  return true;
}

// Wipe all flashes for a merchant (legacy "Flash beenden" affordance).
export function clearFlash(merchantId: string): void {
  STORE.delete(merchantId);
}
