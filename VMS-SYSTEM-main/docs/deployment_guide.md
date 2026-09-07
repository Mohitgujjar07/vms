# Production Deployment Guide

This guide covers step-by-step instructions for deploying the Centralised Visitor Management System (VMS) to production Supabase cloud database, web hosting platforms, and Android device distribution.

---

## Part 1 — Supabase Production Database Setup

1. Create a new project on [Supabase Dashboard](https://supabase.com).
2. Open the **SQL Editor** in your Supabase project.
3. Paste and execute the contents of `supabase/schema.sql` — creates all tables, indexes, triggers, and Row Level Security (RLS) policies. No storage bucket is created (visitor photos are never stored — see Photo Policy below).
4. Paste and execute the contents of `supabase/seed.sql` — reference tenant data **plus 3 working login accounts** (`super.admin`, `vimtech.principal`, `vimtech.reception1`, initial password `Vimtech@2026`).
5. Copy your project URL and Anon Public Key from **Project Settings → API**.

> If your project was created before the ephemeral-photo policy and has a
> `visitor-photos` bucket, run the cleanup SQL block found at the bottom of
> `supabase/schema.sql` to remove it and its policies.

### Required Project Settings (do these BEFORE go-live)

| Setting | Where | Why |
|---|---|---|
| **Email confirmation ON** | Authentication → Providers → Email | Tenant onboarding uses client-side `signUp`; with confirmation OFF the admin's session can be swapped to the newly created account |
| **Custom SMTP** | Authentication → SMTP | Default Supabase SMTP is heavily rate-limited; staff password emails must deliver reliably |
| **Auth rate limits** | Authentication → Rate Limits | Defaults are fine for pilot; raise mail rate for large onboardings |
| **Backups / PITR** | Database → Backups | Enable daily backups at minimum; PITR if on Pro plan |
| **Rotate seeded passwords** | Via app after first login | `Vimtech@2026` appears in repo history — change all 3 accounts immediately |

---

## Part 2 — Environment Variables Configuration

Create a `.env` file in the project root (never commit it):

```env
VITE_SUPABASE_URL=https://your-supabase-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key-here

# Optional — error monitoring (free tier available). SDK lazy-loads only when set.
VITE_SENTRY_DSN=
```

> **SECURITY NOTE**: Never commit `.env` or include the Supabase Service Role key in frontend web builds or Android app bundles.

---

## Part 3 — Web Hosting Deployment (Vercel)

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy production build
vercel --prod
```

Set `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (and optionally `VITE_SENTRY_DSN`) in Vercel Project Settings → Environment Variables.

---

## Part 4 — Capacitor Android Signed Release APK

Refer to `docs/android_build_guide.md` for keystore generation, environment-variable signing config, and `assembleRelease` execution.

---

## Design Policies Affecting Deployment

- **Ephemeral visitor photos**: check-in camera photos exist only in memory for the instant printable pass. Nothing is uploaded, persisted, or cached. Zero storage cost, zero PII exposure.
- **Single shared database**: all tenants live in one Postgres instance; isolation is enforced by RLS policies scoped to each profile's `college_id`/`branch_id`. Never disable RLS on any table.
- **Soft deletion only**: accounts/tenants are suspended (`is_active=false`), preserving historical visit attributability.
