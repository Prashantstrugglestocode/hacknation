// In-memory flash-sale store. The merchant flags specific menu_items as
// "active flash sale" with a discount % and expiry; the offer engine reads
// this state when generating so the LLM prioritizes the flagged items
// (passed to the LLM as enriched menu_item data — name, price, category).
// Hackathon scope — not persisted, not migrated. State is lost on restart.

export interface FlashSale {
  menu_item_ids: string[]; // UUIDs from menu_items table
  pct: number;             // discount % (1-50)
  until: number;           // ms epoch
}

const STORE = new Map<string, FlashSale>();

export function setFlash(merchantId: string, menu_item_ids: string[], pct: number, durationMin: number): FlashSale {
  const sale: FlashSale = {
    menu_item_ids: menu_item_ids
      .filter(id => typeof id === 'string' && id.length > 0)
      // Tolerate any string here; the offer engine will validate against menu_items.
      .map(id => id.trim()),
    pct: Math.max(1, Math.min(50, Math.round(pct))),
    until: Date.now() + Math.max(5, Math.min(240, Math.round(durationMin))) * 60 * 1000,
  };
  STORE.set(merchantId, sale);
  return sale;
}

export function getFlash(merchantId: string): FlashSale | null {
  const sale = STORE.get(merchantId);
  if (!sale) return null;
  if (sale.until < Date.now()) {
    STORE.delete(merchantId);
    return null;
  }
  return sale;
}

export function clearFlash(merchantId: string): void {
  STORE.delete(merchantId);
}
