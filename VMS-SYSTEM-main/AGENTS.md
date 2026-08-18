# AGENTS.md — Centralised Visitor Management System (VMS)

This document contains full context, technical guidelines, architectural decisions, and agent instructions for working on the Centralised VMS repository.

---

## 1. Project Overview & Tenant Model

- **Owner**: Vidyavahini Group (Platform Owner / Super Admin level).
- **First Reference Tenant**: Vaisiri Institute of Management & Technology (**VIMTECH**), Main Campus, Tumkur.
- **Core Concept**: Centralised, multi-tenant Visitor Management System serving multiple colleges using a single shared APK / web platform while enforcing 100% strict data isolation between tenants.

### 2. Operational Unit Rule (CRITICAL)
- **Branch, not College, is the operational unit.**
- All check-in/check-out events, receptionist accounts, host directories, and Branch Principal accounts are scoped to a `branch_id`.
- A single-campus college like VIMTECH is simply a college with exactly one branch row (`Main Campus`). Never hardcode assumptions that a college only has one branch.

---

## 3. Role Hierarchy & Access Scopes

```
Super Admin          — Platform-wide owner (Vidyavahini Group). Manages all colleges, global audit logs & onboarding.
   └── Branch Principal — Branch/College scope (e.g., VIMTECH Main Campus). Manages staff, CSV host import, branch blacklist & reports.
         └── Receptionist — Branch scope (Front desk). Handles fast check-in, live camera photo capture & QR check-out.
```

---

## 4. Key Engineering & Security Directives

1. **Row Level Security (RLS) is the Real Gatekeeper**:
   - Every single Supabase/PostgreSQL table has RLS enabled.
   - Access policies strictly check `get_current_profile()` role and `college_id`/`branch_id` scope. Never trust client-submitted IDs without RLS validation.

2. **Synthetic Email Authentication Mapping**:
   - Users log in with a simple `Login ID` (e.g., `vimtech.reception1`).
   - Internally mapped to `vimtech.reception1@vms.internal` for Supabase Auth compatibility.

3. **Offline-First Deduplication Rule**:
   - BEFORE any check-in is saved, `syncEngine.checkVisitorIsCurrentlyInside(branchId, visitorPhone)` checks the local IndexedDB (`local_visits`) cache.
   - If a visitor with the same phone is already marked as `inside` and not checked-out at this branch, the check-in is **BLOCKED** locally with an explicit error message.
   - This check operates **100% on-device** without any network dependency.

4. **Single-Use QR Token Security**:
   - `qr_token` generated fresh for every visit (`VMS-COLLEGE-CODE-TOKEN`).
   - Checkout scan sets `status = 'checked_out'` and `qr_used = true`.
   - Re-scanning an already-used QR code MUST be rejected immediately.

5. **Soft Deactivation over Hard Deletion**:
   - Staff accounts, branches, and colleges are soft-deactivated/suspended (`is_active = false` or `status = 'suspended'`).
   - Historical visits and audit logs remain intact and attributable.

6. **Single Shared Android APK & Generic Platform UI**:
   - Uses a single shared APK (`in.vidyavahini.vms`) and generic platform UI.
   - College branding (logo, name, address) is used exclusively for visitor pass generation and PDF report headers.

---

## 5. Repository Structure

```
vms system/
├── docs/
│   ├── android_build_guide.md   # Keystore generation & release APK build steps
│   ├── architecture.md          # System architecture & sequence specifications
│   ├── api_reference.md         # Database schema, RLS & vmsService API docs
│   ├── deployment_guide.md      # Supabase & Web deployment instructions
│   └── progress.md              # Feature completion matrix & roadmap
├── src/
│   ├── components/
│   │   ├── masteradmin/         # Platform Owner (Super Admin) dashboard & tenant onboarding
│   │   ├── principal/           # Branch Principal analytics, CSV host import, staff control
│   │   ├── reception/           # Mobile-first check-in, photo capture, QR scanner check-out
│   │   ├── reports/             # Formatted PDF & Excel report export modal
│   │   ├── sos/                 # Real-time Emergency SOS alert overlay
│   │   ├── superadmin/          # College Admin (Master Admin) multi-branch stats & management
│   │   └── Navbar.tsx           # Multi-tenant header & sync status
│   ├── lib/
│   │   └── supabaseClient.ts    # Supabase client setup with mock fallback
│   ├── offline/
│   │   ├── db.ts                # Dexie IndexedDB client schemas
│   │   └── syncEngine.ts        # Local cache deduplication & queue sync manager
│   ├── services/
│   │   ├── mockData.ts          # Reference seed dataset
│   │   └── vmsService.ts        # Unified API layer for mock & live Supabase modes
│   ├── types/
│   │   └── index.ts             # TypeScript domain interfaces
│   ├── App.tsx                  # Root state management & role routing
│   ├── index.css                # Design system tokens, glassmorphism & HSL themes
│   └── main.tsx                 # React entry point
├── supabase/
│   ├── schema.sql               # Full PostgreSQL DDL & RLS policies
│   └── seed.sql                 # Reference seed script
├── capacitor.config.ts          # Capacitor Android wrapper configuration
├── index.html                   # HTML entry point with Google Fonts (Inter/Outfit)
├── vite.config.ts               # Vite build config with host: true
├── tailwind.config.js           # Tailwind CSS configuration
└── package.json                 # Project dependencies & scripts
```
