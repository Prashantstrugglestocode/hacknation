// In-memory flash-sale store. The merchant flags inventory tags as
// "active flash sale" with a discount % and expiry; the offer engine reads
// this state when generating so the LLM prioritizes the flagged items.
// Hackathon scope — not persisted, not migrated. State is lost on restart.

export interface FlashSale {
  items: string[];      // inventory_tags marked as on-sale
  pct: number;          // discount % (1-50)
  until: number;        // ms epoch
}

const STORE = new Map<string, FlashSale>();

export function setFlash(merchantId: string, items: string[], pct: number, durationMin: number): FlashSale {
  const sale: FlashSale = {
    items: items.filter(s => s && s.trim()).map(s => s.trim().toLowerCase()),
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
