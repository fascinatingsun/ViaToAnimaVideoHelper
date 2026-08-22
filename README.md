ViaToAnima — Prototype

This repository contains a minimal Node.js + React prototype to:
- Upload audio files
- Analyze audio (Gemini placeholder)
- Generate image prompts and produce images (Shedevrum placeholder)

Quick start

1) Install dependencies

```bash
npm install
```

2) Run the application

```bash
npm run dev
```

Open http://localhost:4000 in your browser.

API keys

 - Gemini: create an account at Google Cloud / Google AI (Gemini) and obtain an API key or service account as per their docs. Place it in `src/server/.env` as `GEMINI_API_KEY`.
 - Shedevrum: sign up for Shedevrum (or the image-generation provider you choose) and copy the API key into `src/server/.env` as `SHEDEVRUM_API_KEY`.

See `src/server/.env.example` for the variable names.

Next steps

- Replace the mocked endpoints in `server/routes/api.js` with real network calls to Gemini and Shedevrum, using `axios` and the API keys from the environment.
- Add rate-limit handling and usage monitors to stay within free-tier limits.
- Optional: add user accounts and persisted storage if you need history.

Single-process deployment (serve built SPA from Express)

1. Build the application:

```bash
npm run start
```

Now open http://localhost:4000 to access the app (server serves the SPA and API).
