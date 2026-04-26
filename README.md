# Stadtpuls — Generative City Wallet

> **Hyperpersonalized local offers, generated in the moment.**
> Built for the **Hacknation × MIT Club of Northern California / MIT Club of Germany** hackathon —
> Challenge 01: *Generative City-Wallet*, powered by **DSV Gruppe** (Deutscher Sparkassenverlag).

Mia is on a 12-minute Stuttgart lunch break. It's 11°C, the café 80m away has been quiet
all morning, and she's been browsing — not commuting. Today's apps would push her a generic
"10% off, valid for 30 days." Stadtpuls instead generates *this café, this cappuccino, right
now* — because the moment is right.

---

## What's in the box

A working end-to-end MVP with all three required modules:

1. **Context Sensing Layer** — composite triggers from weather (DWD Brightsky, GDPR-friendly),
   time-of-day, geofenced location (1.2 km cell, never raw GPS), local events
   (Ticketmaster, optional), and a simulated **Payone** transaction-density feed for
   detecting quiet hours.
2. **Generative Offer Engine** — the merchant sets a goal ("fill 3pm slump, max 20% off");
   an LLM (Mistral primary, OpenAI fallback, on-device Ollama / `gemma3:4b` as the
   privacy tier) generates the headline, body, image hint, and discount within those
   guard-rails. Streaming GenUI widgets, not template-fill.
3. **Seamless Checkout & Redemption** — dynamic 10-min QR token validated server-side.
   Customer card morphs into a payment receipt the instant the merchant scans, via a
   Supabase Realtime broadcast. Cashback fallback for the no-QR path.

Plus a merchant dashboard (live accept/decline rates, sparkline, redemption history,
menu management, flash-sale composer, combo builder).

---

## Architecture

```
┌─────────────────────────┐         ┌──────────────────────────┐
│  Expo / React Native    │  HTTPS  │  Bun + Hono server       │
│  (customer + merchant)  │ ──────▶ │  /api/offer, /merchant   │
│  expo-router, NativeWind│         │  /context, /menu         │
└──────────┬──────────────┘         └────────┬─────────────────┘
           │                                  │
           │ Realtime broadcast               │  ┌─────────────────────┐
           │ (offer.shown / accepted /        │  │  LLM tier ladder    │
           │  redeemed)                       ├─▶│  Mistral → OpenAI   │
           │                                  │  │  → Ollama (gemma3)  │
           ▼                                  │  │  → fillDefaults     │
┌─────────────────────────┐                   │  └─────────────────────┘
│  Supabase               │                   │
│  Postgres + RLS + RT    │ ◀─────────────────┤  ┌─────────────────────┐
│  (merchants, offers,    │   service-role    │  │  Context signals    │
│   menu_items, events)   │   writes          ├─▶│  DWD Brightsky      │
└─────────────────────────┘                   │  │  Ticketmaster       │
                                              │  │  Payone-mock        │
                                              │  │  POI / geohash      │
                                              │  └─────────────────────┘
```

### Why this shape
- **Bun/Hono** keeps the LLM-orchestrating server tiny and cold-starts fast on Render.
- **Supabase Realtime** is the connective tissue — the QR-to-receipt morph is one broadcast.
- **GDPR-by-design**: only an abstract intent + 1.2km geocell ever leaves the device.
  PII scrubber on every LLM input. Ollama tier means the "spirit" of on-device SLMs
  is demonstrable even though the demo runs against a hosted server.

---

## Repo layout

```
city-wallet/
├── app/                      # Expo Router screens
│   ├── (customer)/           # home, redeem, why, map, history, saved, menu
│   ├── (merchant)/           # dashboard, setup, menu, combos, flash-sale, scan, …
│   ├── role.tsx              # role picker
│   └── settings.tsx          # global settings (lang, location, logout)
├── lib/
│   ├── supabase/             # client + realtime channels
│   ├── generative/           # GenUI widget spec + layouts (Hero, etc.)
│   ├── components/           # SlideToPay, Confetti, FreshnessChip, LiveHeader, …
│   ├── i18n/                 # de + en
│   └── notifications.ts      # expo-notifications wiring
├── server/                   # Bun + Hono backend
│   ├── index.ts              # entry — `bun run dev`
│   ├── routes/               # offer, merchant, menu, context
│   └── lib/                  # openai (LLM ladder), composite (triggers),
│                             # weather, events, payone-mock, pii-scrubber, …
├── supabase/migrations/      # 001 schema, 002 menu, 003 auth
├── config/default.json       # trigger rules (no code changes per city)
├── render.yaml               # one-click server deploy on Render
├── app.json                  # Expo config (publishable Supabase key only)
└── .env.example / server/.env.example
```

---

## Quick start

### Prereqs
- **Bun** ≥ 1.1 (server) and **Node 20+** (Expo CLI)
- An **Expo Go** app on your phone (or an iOS/Android simulator)
- A Supabase project (free tier is fine)
- API keys for one of: **Mistral**, **OpenAI**. Plus optional: **OpenWeather**,
  **Ticketmaster**. Or just run **Ollama** locally with `gemma3:4b` pulled.

### 1. Clone & install
```bash
git clone https://github.com/Prashantstrugglestocode/hacknation.git
cd hacknation/city-wallet
bun install                    # or npm install
cd server && bun install && cd ..
```

### 2. Supabase
```bash
# In the Supabase SQL editor, run the three migrations in order:
#   supabase/migrations/001_initial.sql
#   supabase/migrations/002_menu.sql
#   supabase/migrations/003_auth.sql
```

### 3. Configure env
```bash
cp .env.example .env                 # client-side reference
cp server/.env.example server/.env   # server-side
# Fill in real values — see "Environment variables" below.
```

Update `app.json` → `expo.extra.supabaseUrl` and `expo.extra.supabaseAnonKey`
with **your** project's URL and the **publishable** (`sb_publishable_…`) anon key.
Never put a `service_role` key here — it goes in `server/.env` only.

### 4. Run
```bash
# Terminal 1 — backend
cd server && bun run dev

# Terminal 2 — Expo
bunx expo start
# Scan the QR with Expo Go.
```

For phone-on-LAN demos, expose the server via a tunnel and update
`app.json` → `expo.extra.apiUrl`:
```bash
cloudflared tunnel --url http://localhost:3000
```

### 5. Optional: on-device SLM tier (Ollama)
```bash
brew install ollama
ollama pull gemma3:4b
ollama serve   # listens on http://localhost:11434
# Server picks it up via OLLAMA_HOST + OLLAMA_MODEL.
```

---

## Environment variables

**Never commit `.env` files.** Both `.env` and `server/.env` are gitignored.

### Client (`.env` + `app.json`)
| Var | Purpose |
| --- | --- |
| `SUPABASE_URL` | Project URL (public) |
| `SUPABASE_ANON_KEY` | **Publishable** anon key (`sb_publishable_…`) — RLS-protected, safe in client |

### Server (`server/.env`)
| Var | Purpose |
| --- | --- |
| `SUPABASE_URL` | Same project URL |
| `SUPABASE_SERVICE_KEY` | **Service-role** key — server-only, never ship to client |
| `MISTRAL_API_KEY` | Primary LLM (preferred for EU-hosted compliance) |
| `OPENAI_API_KEY` | Fallback LLM |
| `OLLAMA_HOST` / `OLLAMA_MODEL` | On-device tier (defaults: `http://localhost:11434`, `gemma3:4b`) |
| `OPENWEATHER_API_KEY` | *Optional* — DWD Brightsky is the default and needs no key |
| `TICKETMASTER_API_KEY` | *Optional* — events trigger degrades gracefully if absent |
| `JWT_SECRET` | Signing secret for redemption tokens |
| `PORT` | Defaults to 3000 |

---

## The four UX questions, answered

- **Where?** In-app live card on the customer home tab, plus a foreground push
  notification when the composite trigger fires while the app is backgrounded.
  Lock-screen-friendly copy.
- **How does it address the user?** Emotional-situational by default
  ("Cold outside? Your cappuccino is waiting"), with a factual sub-line
  ("80m · €3.20 · 15% off until 13:30"). LLM tone is governed by the merchant goal.
- **First 3 seconds?** Hero image, one-line headline, distance + discount chip,
  and a single primary action — no scrolling required. Generative layouts
  pick a Hero variant tuned to the trigger (cozy/urgent/festive).
- **How does it end?** A countdown ring on the card; expiry fades the card and
  removes the notification. Acceptance morphs the card into a QR. Dismissal is a
  swipe — the offer is immediately re-suppressed for that trigger context for 30
  minutes so the user doesn't see it again.

---

## Privacy (GDPR)

- Location is reduced to a 6-char geohash (~1.2 km cell) before leaving the device.
- A PII scrubber runs on every prompt before it touches a hosted LLM.
- The Ollama tier exists specifically so demos can show a path where **no user
  signal leaves the device** — only an abstract intent does.
- Supabase RLS is enforced; the publishable anon key cannot read other users' data.
- The `service_role` key lives only in the server's environment; it's never bundled.

---

## Demo script

1. Open the customer app — splash warms the LLM in the background.
2. Pick a Stuttgart location on the map (or use real GPS).
3. The home tab shows a live, generated offer triggered by *current* weather +
   simulated Payone quiet-hour signal at the nearest café.
4. Tap → hero detail → "Why this offer?" explains the trigger transparently.
5. Accept → card morphs into a QR (10-min validity, signed JWT).
6. Switch to the merchant role → scan → customer card morphs into a payment
   receipt in real time. Dashboard updates the accept/redeem sparkline live.

---

## Credits

Built for the DSV Gruppe / MIT Clubs hackathon, 2026.
Challenge contact: Tim Heuschele (tim.heuschele@dsv-gruppe.de).
