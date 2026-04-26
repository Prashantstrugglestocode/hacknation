# Generative City-Wallet 🏙️

*Built for the DSV-Gruppe / Sparkassen Hackathon Challenge*

The **Generative City-Wallet** is an AI-powered, context-aware local commerce platform. It bridges the gap between digital payment infrastructure and physical retail by generating hyper-personalized, ephemeral offers that match a user's exact real-world context (weather, movement, local demand) and merchant intent.

## 🚀 Features

- **Hyperlocal Context Sensing:** Evaluates live weather (Open-Meteo), user movement (Expo Location/Pedometer), and mock payment density (Payone) entirely on the client.
- **Generative Offer Engine:** Uses Mistral AI (or local Ollama) to synthesize context + merchant intent into a tailored JSON offer specification (mood, layout, copy).
- **Generative UI (GenUI):** Dynamically renders the offer using responsive `Moti` animations and dynamic styling based on the AI's design specification.
- **Privacy-First (GDPR):** Client-side context encoding. Only coarsened geohashes and intent vectors are sent to the backend. PII is scrubbed before hitting the LLM.
- **Real-time Merchant Dashboard:** WebSocket-powered (Supabase Realtime) live feed of customer interactions (Shown, Accepted, Redeemed).
- **Frictionless Redemption:** Choose between instant QR-Code generation or Cashback.

## 🛠️ Tech Stack

- **Frontend:** React Native (Expo) + Expo Router, Moti (Animations)
- **Backend:** Hono.js (Bun runtime) + Supabase (PostgreSQL & Realtime)
- **AI/LLM:** Mistral AI (`mistral-small-latest`), Ollama (`gemma3:4b` fallback)
- **Context Signals:** Open-Meteo (Weather), Expo Location

## 🏃‍♂️ Getting Started

### Prerequisites
- Node.js & npm / Bun
- Expo Go app on your physical device (iOS/Android)
- Supabase project (Free tier)
- Mistral AI API Key

### 1. Backend Setup
```bash
cd server
cp .env.example .env
# Edit .env with your SUPABASE_URL, SUPABASE_SERVICE_KEY, MISTRAL_API_KEY
bun install
bun run dev
```

### 2. Frontend Setup
Update the API URL in `app.config.js` to match your local backend IP (e.g., `http://192.168.x.x:3000`).
```bash
npm install
npx expo start --tunnel
```
*Note: For local push notifications and movement tracking to work correctly, you MUST run this on a physical device using Expo Go.*

## 🎯 Demo Mode
For the hackathon pitch, we've included a deterministic "Demo Mode". 
1. Tap "Start Demo Mode" on the initial Role Picker screen.
2. The app will force specific context signals (e.g., Rain, 8°C, Walking) and a mock merchant.
3. This guarantees a perfect end-to-end "Golden Path" presentation without relying on live GPS/weather conditions.
