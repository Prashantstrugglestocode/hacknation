# City Wallet — Next Improvements Plan

Snapshot: 2026-04-26 (T-minus demo). Code is feature-complete vs the brief; remaining work is polish, demo-ops resilience, and known gaps.

Order this list by your demo time budget. **P0 = before you sleep**, **P1 = morning of**, **P2 = nice-to-have**.

---

## P0 — Demo-blocking risks (2–3 h, do tonight)

| # | Item | Why it matters | Where |
|---|---|---|---|
| 1 | **Phone test the full loop on 2 devices** end-to-end with you watching: setup → preview → pull customer → accept → morph → wallet-pass → merchant scan → both tick → pull-to-refresh shows different layout → flash-sale → menu view. | Every "it doesn't work" loop wastes 10 min of trust. We've shipped in the dark; one full-loop test catches 80% of latent bugs. | n/a — manual |
| 2 | **Verify cold-open < 4 s** with Ollama warm. Time it. If > 4 s, prune the system prompt (it's ~80 lines now) or pre-fetch context in parallel. | Brief North Star #2. Judges feel this. | server warm endpoint, `openai.ts` |
| 3 | **Confirm Cloudflare tunnel survives** the demo timeframe. Have a backup: `bun run index.ts` over an ngrok tunnel ready to swap in `app.json` extra.apiUrl in 30 s. | If the tunnel dies mid-demo, every screen 502s. | `app.json`, `server/.env` |
| 4 | **Pre-create one demo merchant + scan a real menu** so the seed café exists with menu_items. Otherwise flash-sale empty-state shows on first open. | Demo must show flash flow within 3 min. | curl `/api/merchant/seed-demo` + `/api/merchant/:id/menu/scan` with a sample image |
| 5 | **Reload Expo Go** after every server restart. Stale bundle = phantom bugs. | Avoid the "but I just fixed it" loop. | shake → Reload |

## P1 — Morning-of polish (1–2 h)

| # | Item | Where |
|---|---|---|
| 6 | **Image fallback on `<Image onError>`** — loremflickr can be flaky. Render a colored emoji block when the URL 404s instead of an empty grey square. | `lib/images.ts`, callers |
| 7 | **Verify "Mia quality benchmark"** (DoD step 8): 11–14h, cool overcast → cozy widget naming a real menu item by name. Pull-to-refresh 5×, see if any look generic. If so, tweak the system prompt's MENU ITEMS section. | `server/lib/openai.ts` |
| 8 | **Dashboard tile row** — 3 tiles at narrow widths (375 px iPhone) might truncate the "Sofort-Aktion starten" sub. Either shorten the sub copy or wrap labels. | `(merchant)/dashboard.tsx` ActionTile |
| 9 | **EventBurst toast position** during scrolling — sits at `top: 64` absolute. If user scrolls the dashboard down, the toast appears far from where their eyes are. Consider sticking to the visible viewport via `SafeAreaView` `top`. | `(merchant)/dashboard.tsx` |
| 10 | **Customer accept flow on milestone** — verify the milestone modal pops cleanly after the morph and that "Continue" routes correctly to the wallet-pass with palette params. There's a code path here that's only exercised every 5 / 10 / 25 saves. | `(customer)/home.tsx` MilestoneModal onClose |

## P2 — Post-demo backlog (don't touch unless time)

- **Sound design**: install `expo-audio`, add a 50 KB `accept-chime.mp3` for ceremonial accept moment. Skipped because new dep mid-demo is risky.
- **Custom font**: load Inter or General Sans via `expo-font`. System font is fine; this is a finisher.
- **Multi-merchant analytics**: dashboard currently shows ONE shop's stats. Picker exists but stats only reflect current. Aggregate view would help chain owners.
- **Push notifications**: brief explicitly out-of-scope but architecture supports it.
- **Real Payone integration**: the `payone-mock.ts` is honestly labeled. Replacing it is post-hackathon.
- **Persistent flash-sale**: currently in-memory. Migrate to a `flash_sales` table if needed for multi-day demos.
- **Onboarding walkthrough**: deleted with the auth strip. Could re-add as opt-in tour (3-card swipe).

---

## Known fragile spots (for triage during demo if something breaks)

| Symptom | Likely cause | Fast fix |
|---|---|---|
| Dashboard stats show 0/0/0 | Bun server died | `pkill bun` then restart |
| "JSON Parse error: Unexpected character: B" | Tunnel returning HTML 502 | Same as above |
| Vorschau hangs > 20 s | Ollama slow / cold | Warm endpoint should prevent; verify gemma3 model is loaded |
| QR doesn't render | `token` is null because `/api/offer/:id/qr` failed | Check JWT_SECRET env in server/.env |
| Map empty | `tile.openstreetmap.org` blocked on hackathon WiFi | Already has retry; mention it in the demo as defensive |
| Realtime tick not landing on merchant phone | Both phones must be online + Supabase Realtime broadcast quota intact | Reload merchant phone; stats fetch on tick is a fallback |

---

## Demo script (one screen, follow this exact order)

1. **Judge A** opens app on Phone 1. Splash → role picker → Händler → setup form.
   - Name "Café Anatolia", type café, location auto, goal `fill_quiet_hours`, max 20 %, lunch window, tags `coffee, sandwich`.
   - Submit → lands in Vorschau (phone-frame mockup) → AI composes within ~10 s.
   - Tap → Dashboard.
2. **Judge B** opens app on Phone 2. Within 50 m of Phone 1.
   - Splash → role picker → Kunde → grants location → cold-open → offer card with palette + chips + headline naming a real item (after Judge A scans menu — see step 6) or generic if not.
3. **Judge B** taps "Why this offer?" → signal cards + KI reasoning + fired triggers + "Forget me".
4. **Judge B** taps Akzeptieren → confetti + morph (palette explodes fullscreen) → wallet-pass with QR + countdown + cashback stub.
5. **Judge A** taps "Kunden-QR scannen" → camera → scan → both phones show success → dashboard tile flashes green + AnimatedNumber overshoots + "+€1,80" toast slides in.
6. **Judge A** taps Karte → "+ Posten" → manual add OR 📷 Scannen → real menu items appear. Then tap Flash → select a real item → start.
7. **Judge B** pulls to refresh → new offer with same merchant but visibly different layout (server-side `previousLayout` bias) AND headline names the flash item.
8. **Judge A** changes goal in 📐 Regeln → preview shows "Neue Regeln aktiv" banner with regenerated offer.
9. **Judge B** taps 📋 Speisekarte on offer → modal shows grouped menu.
10. **Judge A** opens dashboard → 🧠 KI-Insights now suggests "X wurde nie ausgespielt — Tageszeit prüfen".

If all 10 work unaided, the build is done.
