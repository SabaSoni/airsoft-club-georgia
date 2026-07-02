# Deploy Airsoft Club Georgia — Vercel + Supabase

## Architecture

| Layer | Service |
|-------|---------|
| Frontend | Vercel (static HTML/CSS/JS) |
| API | Vercel Serverless (`/api/*`) |
| Database | Supabase Postgres |
| Auth | Supabase Auth (browser JWT) |
| Files | Supabase Storage (`event-media` bucket) |

---

## Step 1 — Supabase setup

1. Open [supabase.com](https://supabase.com) → your project
2. **SQL Editor** → paste and run `supabase/schema.sql`
3. **Storage** → create bucket `event-media` (public)
4. **Authentication → Providers → Email** → enable Email + OTP
5. **Authentication → URL Configuration**:
   - Site URL: `https://your-app.vercel.app`
   - Redirect URLs: `http://localhost:3000/**`, `https://your-app.vercel.app/**`

---

## Step 2 — Seed products

In your project folder (with `.env` filled):

```bash
node scripts/seed-supabase.js
```

This uploads the 8 shop products to Supabase.

---

## Step 3 — Vercel deploy

1. Push code to GitHub
2. [vercel.com](https://vercel.com) → **Import** your repo
3. Framework preset: **Other** (no build command needed)
4. Add **Environment Variables**:

| Variable | Value |
|----------|-------|
| `SUPABASE_URL` | From Supabase → Settings → API |
| `SUPABASE_ANON_KEY` | From Supabase → Settings → API |
| `SUPABASE_SERVICE_ROLE_KEY` | From Supabase → Settings → API (secret!) |
| `ADMIN_EMAIL` | Your admin Gmail |
| `NODE_ENV` | `production` |

5. Click **Deploy**

---

## Step 4 — Local development

Install Vercel CLI:

```bash
npm i -g vercel
```

Run locally (uses `.env`):

```bash
vercel dev
```

Open http://localhost:3000

> **Note:** `npm start` still runs the legacy Express + SQLite server for local fallback. For Vercel parity, use `vercel dev`.

---

## What changed

- **Auth** — Supabase JWT in browser (no Express sessions)
- **Cart** — `localStorage` (`cart-store.js`)
- **Shop/orders** — Supabase `products` + `orders` tables
- **API** — Vercel serverless functions in `/api`
- **Attendance** — Supabase `event_attendees`

---

## Admin panel

Admin routes that write events/media are partially migrated. Full admin CRUD on Vercel is in progress — use Supabase Dashboard for event management until admin API routes are fully ported.

---

## Custom domain

1. Vercel → Project → **Domains** → add your domain
2. Update Supabase **Site URL** and **Redirect URLs** to match

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| `503 Supabase not configured` | Add all 3 Supabase env vars in Vercel |
| Login fails | Check Site URL in Supabase Auth settings |
| Products empty | Run `node scripts/seed-supabase.js` |
| Images blocked | BigCommerce CDN is allowed; check browser console |
| Port 3000 in use | `netstat -ano \| findstr :3000` then `taskkill /PID <id> /F` |
