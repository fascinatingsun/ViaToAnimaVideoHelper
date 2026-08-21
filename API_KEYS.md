API Keys — Gemini (Google) and Shedevrum

Important: copy `server/.env.example` to `server/.env` and fill keys after obtaining them.

1) Gemini (Google) — obtain credentials (free-tier/practical steps)

Prerequisites: a Google account.

Steps:
1. Open Google Cloud Console: https://console.cloud.google.com
2. Create a new Project: Console → Select a project → New Project. Give it a name and create.
3. (If you don't already) Accept billing setup: Google generally requires a billing account to enable paid APIs. New accounts usually get a free $300 credit — this lets you use Vertex/Generative APIs within free-credit limits. Follow Console → Billing to add a billing method.
4. Enable required APIs:
   - Console → APIs & Services → Library. Search for and enable:
     - "Vertex AI API" (Generative models / Gemini access)
     - "Cloud Speech-to-Text API" (if you prefer Speech-to-Text)
5. Create credentials (choose one of the two methods below):

   Option A — Service account (recommended for backend/server use):
   a. Console → IAM & Admin → Service accounts → Create Service Account.
   b. Give it a name (e.g., `via-to-anima-sa`).
   c. Grant roles: at minimum `Vertex AI User` (or similar), and `Storage Object Admin` if you upload audio to GCS. You can add more restrictive roles later.
   d. After creating, select the service account → Keys → Add Key → Create new key → JSON → Download the JSON file.
   e. Place the JSON file somewhere safe (not checked into git). On your server, set the environment variable `GOOGLE_APPLICATION_CREDENTIALS` to the path of the JSON file, or use the Google client libraries which pick up this env var.

   Option B — API key (simpler, but less recommended for server-side production):
   a. Console → APIs & Services → Credentials → Create credentials → API key.
   b. Restrict the key (HTTP referrers/IPs) under the key's settings and enable only the APIs you need (Vertex AI / Speech-to-Text).
   c. Store the API key in `server/.env` as `GEMINI_API_KEY`.

6. Verify access using the quickstart or a simple curl/node example from Google Cloud docs. For backend use and server-to-server calls, the service-account JSON method is most robust.

Notes about free tier and costs:
- Google Cloud offers a free trial credit for new accounts; after that, Vertex AI and Speech-to-Text have usage-based pricing. Monitor usage in Console → Billing → Reports and set budgets/alerts.
- Always restrict API keys and monitor quotas to avoid unexpected charges.

2) Shedevrum — obtaining an API key (general steps)

Note: If Shedevrum has an online dashboard, these steps apply. If a provider-specific flow differs, follow their dashboard's instructions.

Prerequisites: an account on the Shedevrum site.

Steps:
1. Open Shedevrum website and sign up / verify your email.
2. Log in and open the developer or API dashboard. Common locations: "API Keys", "Integrations", or "Developer" in the account menu.
3. Create a new API key / token. Give it a descriptive name (e.g., `via-to-anima-dev`).
4. Copy the API key and store it securely. Add it to your server environment in `server/.env` as `SHEDEVRUM_API_KEY`.
5. If the provider supports usage limits or free-tier tokens, check your quota in the dashboard and read the pricing page to confirm what is allowed on the free plan.
6. If Shedevrum requires any additional setup (model selection, organization ID, or project ID), note those values and add them to `server/.env` as separate variables (for example `SHEDEVRUM_PROJECT_ID`).

If you cannot find Shedevrum or prefer a known free-tier provider, consider these alternatives and register similarly:
- Hugging Face (inference API)
- Stability AI
- Replicate

3) Local setup steps (exact commands)

1. Copy `.env.example` to `.env` inside `server/`:

```bash
cd server
copy .env.example .env   # on Windows (PowerShell: cp .env.example .env)
```

2. Edit `server/.env` and set values:

- If using Google service account JSON: set `GOOGLE_APPLICATION_CREDENTIALS` on your machine (PowerShell example):

```powershell
$Env:GOOGLE_APPLICATION_CREDENTIALS = "C:\path\to\service-account.json"
```

- Or add the API keys to `server/.env`:

```
GEMINI_API_KEY=your_gemini_api_key_here
SHEDEVRUM_API_KEY=your_shedevrum_api_key_here
PORT=4000
```

3. Restart the server so the environment variables are loaded.

4) Security reminders

- Never commit `.env` or service-account JSON files to version control.
- Restrict API keys to allowed origins or IPs where possible.
- Monitor usage and set billing alerts.

5) Next steps for me (if you want):
- I can implement concrete Node.js calls for Gemini (using the service account or API key) and for Shedevrum once you confirm which authentication method you chose.
- I can also add example request code (Node + axios) and a small test script.
