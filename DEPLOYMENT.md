# Deploying AURA TOAST

Live: **https://aura-roast-seven.vercel.app**

The app is a standard Next.js 16 project. It deploys to Vercel with zero extra
configuration (no `vercel.json` needed), and to any Node 22 host with
`npm run build && npm start`.

---

## 1. Environment variables

Set these in **Vercel → Project → Settings → Environment Variables** (tick
*Production* and *Preview*), then redeploy. Never commit `.env.local`.

| Variable | Required | What it is | Value |
|---|---|---|---|
| `DATABASE_URL` | **Yes** | Neon **pooled** connection string. Postgres is the only source of truth in production. | `postgresql://…-pooler…neon.tech/…?sslmode=require` |
| `DATABASE_URL_UNPOOLED` | For migrations/seed | Neon **direct** connection string. Only `npm run db:migrate` / `db:seed` use it. | `postgresql://…neon.tech/…?sslmode=require` |
| `AUTH_SECRET` | **Yes** (for sign-in) | Encrypts session cookies. Changing it signs everyone out. | `openssl rand -base64 32` |
| `AUTH_GOOGLE_ID` | **Yes** (for sign-in) | Google OAuth client ID | from Google Cloud Console |
| `AUTH_GOOGLE_SECRET` | **Yes** (for sign-in) | Google OAuth client secret | from Google Cloud Console |
| `ADMIN_EMAILS` | **Yes** | Comma-separated Google emails allowed into `/admin` and to verify UPI payments. **Unset = `/admin` locked for everyone.** | `you@gmail.com,manager@gmail.com` |
| `NEXT_PUBLIC_SITE_URL` | **Yes** | Public URL, used for social-card links. Baked in at build time. | `https://aura-roast-seven.vercel.app` |
| `UPI_ID` | Recommended | The UPI ID customers pay to (shown on the QR). | `yourshop@okbank` |
| `UPI_PAYEE_NAME` | Recommended | Name shown in the UPI app. | `Aura Toast Coffee` |
| `GROQ_API_KEY` | Optional | Enables the LLM Barista. Without it a local responder answers, tools still work. | Groq console |
| `GROQ_MODEL` | Optional | Defaults to `llama-3.3-70b-versatile`. | |
| `ADMIN_SECRET` | Optional | Lets scripts verify payments with `Authorization: Bearer …`. | long random string |
| `CRON_SECRET` | Optional | Protects `/api/cron/cleanup`. Cleanup also runs automatically. | long random string |
| `TRUST_PROXY_HEADERS` | Non-Vercel only | Set to `1` only behind a proxy that **overwrites** `X-Forwarded-For`. Not needed on Vercel. | `1` |

Not needed: `AUTH_URL` (the host is trusted and derived per request).

---

## 2. Google sign-in setup (Google Cloud Console)

1. **APIs & Services → Credentials →** your *OAuth 2.0 Client ID* (type: Web application).
2. **Authorized redirect URIs** — add:
   - `https://aura-roast-seven.vercel.app/api/auth/callback/google`
   - `http://localhost:3000/api/auth/callback/google` (local development)
3. **OAuth consent screen →** set *Publishing status* to **In production**. While it
   says *Testing*, only listed test users can sign in.

---

## 3. Database

- **Existing Neon database:** nothing to run — reservation slots are created by the
  app the first time each day is viewed.
- **Brand-new database:**
  ```bash
  DATABASE_URL_UNPOOLED="postgresql://…" npm run db:migrate
  DATABASE_URL_UNPOOLED="postgresql://…" npm run db:seed
  ```

---

## 4. Deploy on Vercel

1. Push to GitHub; Vercel builds `main` automatically.
2. Framework preset: **Next.js** · Node.js **22.x** (Settings → General).
3. Add the environment variables from section 1, then redeploy.

---

## 5. After deploying

| Check | Expect |
|---|---|
| `/api/health` | `{"status":"ok","backend":"postgres",…,"googleAuth":true}` |
| `/login` → *Continue with Google* | Google account chooser, then back on `/account` |
| `/admin` signed in with an `ADMIN_EMAILS` account | the dashboard (anyone else: "Staff only") |
| `/reservations` | a slot grid for today/tomorrow |

---

## 6. Troubleshooting

| Symptom | Cause → fix |
|---|---|
| Build fails with `Module not found` | A source file was not committed — run `git status`, add it, push. |
| `/admin` says **Staff only** | Your email is not in `ADMIN_EMAILS`. Add it, redeploy. |
| Google **redirect_uri_mismatch** | Add the callback URI from section 2. |
| Google **Access blocked** | Consent screen still in *Testing*. |
| *Continue with Google* disabled | `AUTH_SECRET`, `AUTH_GOOGLE_ID` or `AUTH_GOOGLE_SECRET` missing. |
| First request after idle takes ~2 s | Neon scale-to-zero waking up. |
| `/api/health` says `"backend":"in-process"` | `DATABASE_URL` not set in this environment. |
