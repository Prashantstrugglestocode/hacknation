# Stadtpuls — Generative City Wallet

> **Hyperpersonalised local offers, generated in the moment.**
> Built for the **Hacknation × MIT Club of Northern California / MIT Club of Germany** hackathon — Challenge 01 *Generative City-Wallet*, powered by **DSV Gruppe** (Deutscher Sparkassenverlag).

It's 11°C, raining, 12:40. Mia is on a 12-minute lunch break. The café 80m away has been quiet all morning. Today's apps would push her a generic "10% off, valid 30 days." Stadtpuls instead generates *this café, this cappuccino, right now* — because the moment is right, and disappears the moment it isn't.

---

## What it does

| Surface | Capability |
| --- | --- |
| **Customer** | Live home feed of context-aware offers, "Why this offer?" transparency screen, 10-minute QR voucher, in-app **Sparkasse Pay** sheet, savings tracker, history. |
| **Merchant** | Realtime dashboard (accept/redeem sparklines), QR scanner, menu manager, **flash-sale composer**, **combo builder**, daily-rules editor. |
| **Server** | Composite-trigger context engine, LLM offer generator (OpenAI + Ollama tiers + safety fallback), signed-JWT QR redemption, Supabase Realtime fanout. |

Three required modules from the brief, end-to-end:

1. **Context Sensing** — DWD Brightsky weather (no key, GDPR-friendly), Ticketmaster events, time-of-day, geocell location (1.2 km, never raw GPS), per-merchant Payone density signal, POI foot-traffic proxy.
2. **Generative Offer Engine** — merchant sets goal + guard-rails ("fill 3pm slump, max 20% off"); LLM generates headline, body, image hint, discount, and **layout choice** (Hero / Compact / Split / Fullbleed / Sticker). GenUI widgets, not template fill.
3. **Seamless Checkout** — 10-minute signed-JWT QR. Merchant scans → customer's QR card morphs into a slide-to-pay sheet via Supabase broadcast. Customer slides → receipt lands on both phones in real time.

---

## Architecture

```
┌─────────────────────────┐         ┌──────────────────────────┐
│  Expo / React Native    │  HTTPS  │  Bun + Hono server       │
│  customer + merchant    │ ──────▶ │  /api/offer  /merchant   │
│  expo-router · NativeWind│        │  /context  /menu         │
└──────────┬──────────────┘         └────────┬─────────────────┘
           │                                  │
           │ Realtime broadcast               │  ┌─────────────────────┐
           │ offer.shown · scan_pending       ├─▶│  LLM tier ladder    │
           │ offer.redeemed                   │  │  OpenAI → Ollama    │
           ▼                                  │  │  → fillDefaults     │
┌─────────────────────────┐                   │  └─────────────────────┘
│  Supabase               │                   │
│  Postgres + RLS + RT    │ ◀─────────────────┤  ┌─────────────────────┐
│  merchants · offers     │   service-role    │  │  Context signals    │
│  menu_items · events    │   writes          ├─▶│  DWD Brightsky      │
└─────────────────────────┘                   │  │  Ticketmaster       │
                                              │  │  Payone (mock)      │
                                              │  │  POI · geohash      │
                                              │  └─────────────────────┘
```

**Why this shape**
- Bun + Hono keeps the LLM-orchestrating server tiny; cold-starts fast on Render.
- Supabase Realtime is the connective tissue — the QR-to-receipt morph is one broadcast.
- GDPR-by-design: only an abstract intent + 1.2 km geocell ever leaves the device. PII scrubber on every LLM input. The on-device Ollama tier shows the no-cloud-inference path the brief encourages.

---

## Quick start

### Prereqs
- **Bun** ≥ 1.1, **Node 20+**, **Expo Go** on a phone (or simulator)
- A Supabase project (free tier)
- One LLM key: **OpenAI** *or* a local **Ollama** with `llama3.2` pulled

### 1. Clone & install
```bash
git clone https://github.com/Prashantstrugglestocode/hacknation.git
cd hacknation/city-wallet
npm install --legacy-peer-deps
cd server && bun install && cd ..
```

### 2. Supabase migrations
Run in order in the SQL editor:
```
supabase/migrations/001_initial.sql
supabase/migrations/002_menu.sql
supabase/migrations/003_auth.sql
supabase/migrations/004_address.sql
```

### 3. Configure
```bash
cp server/.env.example server/.env
# Fill in SUPABASE_URL, SUPABASE_SERVICE_KEY, OPENAI_API_KEY (or OLLAMA_MODEL),
# and a JWT_SECRET (any 32-byte hex).
```
In `app.json` → `expo.extra`, set your project's `supabaseUrl`, the **publishable** `supabaseAnonKey` (`sb_publishable_…`, not the service key), and `apiUrl` for the backend (localhost or tunnel URL).

### 4. Run
```bash
# terminal 1 — backend
cd server && bun run dev

# terminal 2 — Expo
npx expo start
# scan the QR with Expo Go
```

### 5. Optional — on-device LLM
```bash
brew install ollama
ollama pull llama3.2
ollama serve
# the server's tier ladder picks Ollama up automatically
```

---

## Two-phone demo

Stadtpuls is meant to be shown on **two real phones** — one customer, one merchant — sharing one backend.

```bash
# expose backend so phones can reach it
cloudflared tunnel --url http://localhost:3000
# update app.json → expo.extra.apiUrl with the public URL

# expose Metro for phones off LAN
cloudflared tunnel --url http://localhost:8081
# start Expo with the proxy URL so the manifest points at the tunnel:
EXPO_PACKAGER_PROXY_URL=https://<your-metro-tunnel>.trycloudflare.com \
  npx expo start --host lan
```

Both phones scan the Expo Go QR. One picks the **customer** role on the role screen; the other picks **merchant**. Pull-to-refresh on the customer home generates a fresh offer — tap to accept, show the QR. The merchant scans, the customer slides to pay, both phones see the receipt land in real time.

---

## Repo layout

```
city-wallet/
├── app/                       # Expo Router screens
│   ├── (customer)/            # home · redeem · pay · why · map · menu · history
│   ├── (merchant)/            # dashboard · scan · menu · combos · flash-sale · rules
│   ├── role.tsx               # role picker
│   └── settings.tsx
├── lib/
│   ├── supabase/              # client + realtime channels
│   ├── generative/            # GenUI widget specs + layouts
│   ├── components/            # SlideToPay · Confetti · LiveHeader · …
│   ├── i18n/                  # de + en
│   └── privacy/               # geocell + intent encoder
├── server/                    # Bun + Hono backend
│   ├── routes/                # offer · merchant · menu · context
│   └── lib/                   # openai (tier ladder) · composite (triggers)
│                              # weather · events · payone-mock · pii-scrubber
├── supabase/migrations/       # 001 schema · 002 menu · 003 auth · 004 address
├── config/default.json        # trigger rules (no code change per city)
├── render.yaml                # one-click server deploy
└── app.json                   # Expo config
```

---

## Environment variables

`.env` files are gitignored — never commit secrets.

### Server (`server/.env`)
| Var | Purpose |
| --- | --- |
| `SUPABASE_URL` | Project URL |
| `SUPABASE_SERVICE_KEY` | **Service-role** key — server only |
| `OPENAI_API_KEY` | Primary LLM (optional if Ollama is running) |
| `OLLAMA_MODEL` | On-device tier model (e.g. `llama3.2`) |
| `OLLAMA_HOST` | Defaults to `http://localhost:11434` |
| `OPENWEATHER_API_KEY` | Optional — DWD Brightsky is the keyless default |
| `TICKETMASTER_API_KEY` | Optional — events trigger degrades gracefully |
| `JWT_SECRET` | QR-token signing secret |
| `PORT` | Defaults to 3000 |

### Client (`app.json` → `expo.extra`)
| Key | Purpose |
| --- | --- |
| `apiUrl` | Backend URL (localhost or tunnel) |
| `supabaseUrl` | Same project URL |
| `supabaseAnonKey` | **Publishable** key (`sb_publishable_…`) — RLS-protected |

---

## Privacy by design

- Location is reduced to a 6-character geohash (~1.2 km cell) before any network call (`lib/privacy/intent-encoder.ts`).
- `server/lib/pii-scrubber.ts` strips emails, phones, IBANs, and IPs from every prompt before it reaches a hosted LLM.
- Supabase RLS is enforced; the client only carries the publishable anon key — `service_role` lives in `server/.env` and is never bundled.
- The Ollama tier exists so you can demo a no-cloud-inference path: only an abstract intent leaves the device.
- The 🇪🇺 GDPR · 1,2 km trust mark is on every offer card so the privacy story is visible, not buried.

---

## Tech stack

**Mobile** Expo SDK 54 · React Native 0.81 · expo-router · NativeWind · Moti · react-native-reanimated
**Backend** Bun · Hono · Supabase (Postgres + Realtime + Auth) · jose (JWT)
**LLM** OpenAI · Ollama (`llama3.2`) · deterministic safety fallback
**Context** DWD Brightsky · Ticketmaster · ngeohash · Payone-mock

---

## Credits

Built for the DSV Gruppe / MIT Clubs Hacknation, 2026.
Challenge contact: Tim Heuschele (tim.heuschele@dsv-gruppe.de).
