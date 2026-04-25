# City Wallet — Polish Brief

Paste this into a fresh Claude conversation to get concrete, code-level ideas for making the app look less basic and win the 3-second judge wow-test.

---

## What this app is

City Wallet — hackathon MVP for the DSV Gruppe / MIT Club brief. Hyperlocal AI-generated offers on mobile. A customer opens the app and within 4 s sees an AI-composed offer for a nearby café, accepts with one tap, gets a QR. Merchant scans → both dashboards update in real time. Privacy-first: only an abstract intent vector + coarse geohash leaves the device. Two roles, one Expo build, single segmented control.

The brief explicitly says **"this challenge is won in the interaction design, not the model architecture."** Right now the contract is met but the app **looks basic**. We need polish moves a judge feels in 3 seconds.

---

## Stack (locked, please don't suggest changes)

```
Frontend: Expo SDK 54, expo-router 6, TypeScript strict, NativeWind 4
           react-native 0.81.5, react-native-reanimated 4.1, moti 0.30
           expo-blur, expo-haptics, expo-camera, expo-location, expo-sensors
Backend:  Hono on Bun, deployed to Render
DB:       Supabase Postgres + Realtime
LLM:      Ollama (gemma3:4b text, llava:7b vision) primary, OpenAI fallback
i18n:     i18n-js, default de, fallback en
```

No paid services. No native modules requiring `expo prebuild`. Must run in Expo Go on iPhone.

---

## What's already built (component-level inventory)

### Customer flow
- **`app/index.tsx`** — Role picker. Two tappable cards (Kunde / Händler), red CTA, white bg
- **`app/(customer)/home.tsx`** — Main offer screen. States: idle/loading/location_denied/no_merchant/offer/declined/expired/error
- **`lib/components/GlassHeader.tsx`** — `expo-blur` translucent bar showing `€ saved` cumulative + 🔥 weekly streak badge + 🤍 saved-offers link
- **`lib/components/Shimmer.tsx`** — Skeleton card with horizontal sweep
- **`lib/components/Confetti.tsx`** — 28 particles burst on accept
- **`lib/components/FreshnessChip.tsx`** — Pulsing dot + "vor X Sek." live timestamp
- **`lib/components/SaveHeart.tsx`** — Heart toggle with haptic, persists to AsyncStorage
- **`lib/generative/layouts/`** — 5 layouts driven by LLM-returned `WidgetSpec`: Hero, Compact, Split, Fullbleed, Sticker
  - Hero is most-used: gradient top 60%, sequenced spring chips, headline, subline, discount line, distance pin, pressure badge, primary CTA, decline link
- **`app/(customer)/redeem/[id].tsx`** — Full-screen QR with countdown + cashback toggle
- **`app/(customer)/why/[id].tsx`** — Transparency: signal chips, AI reasoning, literal JSON sent, "Forget me" button
- **`app/(customer)/saved.tsx`** — List of hearted offers with cashback redeem button

### Merchant flow
- **`app/(merchant)/setup.tsx`** — Form: name, type chips, location auto-fill, goal cards, discount slider, time windows, inventory tags
- **`app/(merchant)/dashboard.tsx`** — 5 stat cards (Generated, Accepted, Redeemed, Accept rate, EUR moved) + Live Feed (Supabase Realtime) + sticky scan button + "Speisekarte & KI-Insights" link
- **`app/(merchant)/scan.tsx`** — `expo-camera` QR scanner with red frame guide
- **`app/(merchant)/rules.tsx`** — Goal cards + max-discount picker
- **`app/(merchant)/menu.tsx`** — Menu items list with per-item accept-rate, delete X, KI-Insights card at top
- **`app/(merchant)/menu-scan.tsx`** — Camera capture → llava-7b vision → bulk insert items

### Backend / context
- **`server/lib/weather.ts`** — DWD Brightsky primary, OWM fallback
- **`server/lib/events.ts`** — Ticketmaster (optional API key)
- **`server/lib/pois.ts`** — Overpass/OSM nearby cafés/restaurants/shops counts
- **`server/lib/payone-mock.ts`** — Hour-seeded transaction density
- **`server/lib/composite.ts`** — Config-driven named triggers (`COZY_QUIET_NEARBY`, `EVENT_DEMAND_SPIKE`, etc.) from `/config/default.json`
- **`server/lib/openai.ts`** — Ollama gemma3 → OpenAI fallback → deterministic fallback so demo never 503s
- **`server/lib/vision.ts`** — llava-7b → OpenAI gpt-4o-mini → canned demo menu
- **`server/lib/insights.ts`** — Per-item 7-day accept-rate analysis → KI-Insight suggestions

### Visual language (current)
- Primary: `#E11D48` (rose-600)
- Surface: `#FFFFFF`
- Bg-muted: `#FFF1F2` (rose-50)
- Border: `#FECACA` (rose-200)
- Text: `#1F1F23`
- All emoji icons — no SF Symbols, no custom illustration
- Default system font (San Francisco)
- 16-22pt rounded corners, 1px borders, soft shadows on red CTAs

---

## Demo flow (≤3 minutes total)

1. Judge A taps Händler → setup form, fills name + chips + slider → submit (under 30 s)
2. Judge B opens app → sees AI-generated offer card for Judge A's shop within 4 s
3. Judge B taps "Why this offer?" → sees signal chips + reasoning + JSON
4. Judge B taps Akzeptieren → confetti + spring → QR fills screen with countdown
5. Judge A taps "Kunden-QR scannen" → both dashboards tick instantly via Realtime
6. Judge B pulls to refresh → visibly different layout (different mood, different palette, same merchant)
7. Judge A drags goal slider, saves → next refresh produces different copy
8. Bonus: Judge A taps "Speisekarte" → photographs printed menu → 6 items extracted → KI-Insights card surfaces "Item X: 0% accept — try 20% Mittagsrabatt"

---

## Where the app feels basic right now

Be specific — these are concrete observations, not vague.

1. **Header is flat** — just text + a small badge. No life. No weather, no time, no city name. Could feel like an Apple Wallet card edge.
2. **Skeleton is just three rectangles** — doesn't hint at the rich card that's coming.
3. **Confetti is a single burst** — 28 particles, all the same shape (rounded rectangles), one curve. Feels generic.
4. **Empty states are an emoji + text** — no animated illustration, no parallax, no character.
5. **Stat cards on merchant dashboard are static numbers** — no spark-line trend, no animated number counter, no comparison to yesterday.
6. **Live feed is a vertical list of pills** — utilitarian. Could feel like a transit ticker, or a Slack-style activity feed with avatars.
7. **5 widget layouts work but feel templated** — same gradient direction, same chip style, same CTA shape. The "5 distinct layouts" claim is met technically; visual distinctness is moderate.
8. **No transitions between screens** — push/modal stock animations. No shared-element morph from card → QR.
9. **No iconography system** — emoji everywhere. Looks like a prototype.
10. **No data visualization** — accept-rate is shown as text "73%". Could be a ring, a bar, a sparkline.
11. **No sound design** — only haptics. Subtle scan beep, accept chime, swoosh on refresh would help.
12. **Streak badge is a static pill** — no flame animation, no progress ring toward next milestone.
13. **No social proof / liveness** — "3 people just accepted offers near you" never appears.
14. **QR redeem screen is a centered code + countdown** — could feel ceremonial. Wallet-app pass-style with merchant name above the QR, brand color top edge, etc.
15. **Why-screen JSON dump is dev-y** — should be a beautiful breakdown with icons per signal type, weight bars, source labels (DWD, OSM, Payone Sim).
16. **Menu items are flat rows** — could be card stack with item photos pulled from Overpass `image=*` tag or unsplash query.
17. **No first-launch onboarding** — drops user on role picker with no story, no "what is City Wallet" 3-card swipe.
18. **No live signals on header** — current weather + temp + city name would prove the system is real every second the screen is open.
19. **Decline is a tiny text link** — no swipe gesture, no tilt-to-dismiss, no "show me later" option.
20. **Cashback fallback feels like a tab toggle** — no visual story about why it exists.

---

## Constraints

- Keep the demo loop under 3 minutes total
- No App Store submission, no native module additions that require `expo prebuild`
- All effects must work offline-first (the Ollama backend may be slow; no API-key-only paid services)
- Add weight where weight wins — don't gild what already works
- Honor the brief's anti-patterns (no feeds, no notifications in v1, no spinners as primary loading state, no marketing copy, no SaaS blue)
- Keep customer copy in German default, English fallback

---

## What I want from you

Give me **10 concrete polish moves** that meaningfully raise the app's perceived quality in the 3-second judge test. For each:

1. **What** — one-sentence description of the move
2. **Why it wins** — the moment it pays off in the demo
3. **Code-level approach** — specific component(s) to touch, libraries already in stack, rough lines-of-code budget
4. **Risk** — what could break or distract from the demo
5. **Priority** — must / nice / risky

Bias toward:
- Live, real-time-feeling signals (header pulse, weather widget, sparkline)
- Microinteractions on the offer card (long-press preview, tilt parallax, haptic-rich accept)
- Better skeleton → reveal choreography
- Custom illustrations / SVG instead of emoji
- Wallet-pass-style redeem screen
- Animated number counters
- Ambient/haptic-led decline
- Sound design (one ~50KB asset max per sound)
- Visualization in the why-screen and menu insights
- Onboarding magic the first time

Avoid:
- Suggestions requiring `expo prebuild` or paid SaaS
- Generic "add gradient" / "add shadow" advice — be specific to this codebase
- Anything that adds >2 minutes to the demo loop
- Touching the AI prompt or offer-engine architecture (that's stable)

End with one **showstopper move** — the single biggest thing that, if I built only one polish, would make a judge involuntarily lean forward. Justify it.
