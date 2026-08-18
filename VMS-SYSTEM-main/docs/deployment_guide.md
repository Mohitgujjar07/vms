# Production Deployment Guide

This guide covers step-by-step instructions for deploying the Centralised Visitor Management System (VMS) to production Supabase cloud database, web hosting platforms, and Android device distribution.

---

## Part 1 — Supabase Production Database Setup

1. Create a new project on [Supabase Dashboard](https://supabase.com).
2. Open the **SQL Editor** in your Supabase project.
3. Paste and execute the contents of [supabase/schema.sql](file:///c:/Users/mohit/Desktop/vms%20system/supabase/schema.sql) to create all tables, indexes, triggers, and Row Level Security (RLS) policies.
4. Paste and execute the contents of [supabase/seed.sql](file:///c:/Users/mohit/Desktop/vms%20system/supabase/seed.sql) to populate initial VIMTECH reference tenant data.
5. Copy your project URL and Anon Public Key from **Project Settings -> API**.

---

## Part 2 — Environment Variables Configuration

Create a `.env` file in the project root:

```env
VITE_SUPABASE_URL=https://your-supabase-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key-here
```

> **SECURITY NOTE**: Never commit `.env` or include the Supabase Service Role key in frontend web builds or Android app bundles.

---

## Part 3 — Web Hosting Deployment (Vercel / Netlify / Firebase)

### Deploy to Vercel
```bash
# Install Vercel CLI
npm i -g vercel

# Deploy production build
vercel --prod
```

Set Environment Variables `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in your Vercel Project Settings.

---

## Part 4 — Capacitor Android Signed Release APK

Refer to [docs/android_build_guide.md](file:///c:/Users/mohit/Desktop/vms%20system/docs/android_build_guide.md) for step-by-step keystore generation, Gradle signing, and `./gradlew assembleRelease` execution.
