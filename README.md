ViaToAnima — Prototype

This repository contains a minimal Node.js + React prototype to:
- Upload audio files
- Analyze audio (Gemini placeholder)
- Generate image prompts and produce images (Shedevrum placeholder)

Quick start

1) Install dependencies for server and client

```bash
cd src/server
npm install
cd ../client
npm install
```

2) Run server and client in separate terminals

Server:

```bash
cd src/server
npm run start
```

Client (now located inside `src/client`):

```bash
cd src/client
npm run dev
```

3) Open the client (Vite will show the URL, usually http://localhost:5173)

API keys

 - Gemini: create an account at Google Cloud / Google AI (Gemini) and obtain an API key or service account as per their docs. Place it in `src/server/.env` as `GEMINI_API_KEY`.
 - Shedevrum: sign up for Shedevrum (or the image-generation provider you choose) and copy the API key into `src/server/.env` as `SHEDEVRUM_API_KEY`.

See `src/server/.env.example` for the variable names.

Next steps

- Replace the mocked endpoints in `server/routes/api.js` with real network calls to Gemini and Shedevrum, using `axios` and the API keys from the environment.
- Add rate-limit handling and usage monitors to stay within free-tier limits.
- Optional: add user accounts and persisted storage if you need history.

Single-process deployment (serve built SPA from Express)

1. Build the client (now in `src/client`):

```bash
cd src/client
npm run build
```

2. Start the server which will serve the built files and the API:

```bash
cd src/server
npm run start
```

Now open http://localhost:4000 to access the app (server serves the SPA and API).
