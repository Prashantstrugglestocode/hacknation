// Deterministic placeholder images via loremflickr — no API key required.
// Used to give menu items + shops a "real product" look in the demo.
// Falls back gracefully if the URL fails to load (caller should handle onError).

function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, ',').replace(/(^,|,$)/g, '').slice(0, 30) || 'food';
}

function deterministicLock(s: string): string {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h).toString(36).slice(0, 6);
}

export function itemImageUrl(name: string, category?: string | null, w = 200, h = 150): string {
  const slug = slugify(name);
  const cat = category ? slugify(category) : 'food';
  return `https://loremflickr.com/${w}/${h}/${slug},${cat}/all?lock=${deterministicLock(name)}`;
}

export function shopImageUrl(name: string, type?: string | null, w = 600, h = 200): string {
  const slug = slugify(name);
  const t = type ? slugify(type) : 'shop';
  return `https://loremflickr.com/${w}/${h}/${slug},${t},storefront/all?lock=${deterministicLock(name + ':shop')}`;
}
