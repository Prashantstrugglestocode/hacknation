// Image URLs via Pollinations.ai — free text-to-image, no API key.
// Per user request, replaces the previous loremflickr stock-photo placeholders.
// URLs are deterministic (same seed → same image) so the same item/shop renders
// the same picture across the app. Pollinations returns a JPG you can load
// directly into <Image>; the FallbackImage wrapper handles slow/failed loads.

const POLL_BASE = 'https://image.pollinations.ai/prompt';

function deterministicSeed(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h) % 1_000_000;
}

function buildPollUrl(prompt: string, w: number, h: number, seedKey: string): string {
  // Pollinations: nologo strips the watermark; flux is the default high-quality
  // model; enhance lets the server inject quality terms automatically.
  const seed = deterministicSeed(seedKey);
  const params = new URLSearchParams({
    width: String(w),
    height: String(h),
    seed: String(seed),
    nologo: 'true',
    enhance: 'true',
    model: 'flux',
  });
  return `${POLL_BASE}/${encodeURIComponent(prompt)}?${params.toString()}`;
}

export function itemImageUrl(name: string, category?: string | null, w = 200, h = 150): string {
  const cat = (category ?? 'food').toLowerCase();
  const prompt = `${name}, ${cat}, professional food photography, soft natural light, marble surface, top-down`;
  return buildPollUrl(prompt, w, h, `item:${name}`);
}

export function shopImageUrl(name: string, type?: string | null, w = 600, h = 200): string {
  const t = (type ?? 'shop').toLowerCase();
  const prompt = `${name}, ${t} storefront in a cozy German old-town street, warm golden-hour light, photorealistic`;
  return buildPollUrl(prompt, w, h, `shop:${name}`);
}

// Hero image for an offer card — uses headline keywords + merchant type so
// the picture matches the actual offer copy (not just the shop).
export function offerHeroUrl(headline: string, merchantType?: string | null, w = 800, h = 480): string {
  const t = (merchantType ?? 'café').toLowerCase();
  const prompt = `${headline}, ${t}, lifestyle photography, atmospheric, soft warm light, shallow depth of field`;
  return buildPollUrl(prompt, w, h, `hero:${headline}`);
}
