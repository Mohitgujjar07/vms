<p align="center">
  <img src="public/Screenshot 2026-07-23 121324.png" alt="Vidyavahini VMS Logo" width="120" />
</p>

<h1 align="center">🏛️ Vidyavahini Visitor Management System</h1>

<p align="center">
  <strong>Enterprise-Grade, Multi-Tenant Visitor Management Platform</strong><br/>
  Built for high-throughput institutional campus gate operations with offline-first resilience
</p>

<p align="center">
  <img src="https://img.shields.io/badge/version-1.0.0-blueviolet?style=for-the-badge" alt="Version" />
  <img src="https://img.shields.io/badge/status-Production%20Ready-brightgreen?style=for-the-badge" alt="Status" />
  <img src="https://img.shields.io/badge/TypeScript-5.5-3178C6?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/React-18.3-61DAFB?style=for-the-badge&logo=react&logoColor=black" alt="React" />
  <img src="https://img.shields.io/badge/Supabase-PostgreSQL-3FCF8E?style=for-the-badge&logo=supabase&logoColor=white" alt="Supabase" />
  <img src="https://img.shields.io/badge/Capacitor-6-119EFF?style=for-the-badge&logo=capacitor&logoColor=white" alt="Capacitor" />
  <img src="https://img.shields.io/badge/license-Proprietary-red?style=for-the-badge" alt="License" />
</p>

<p align="center">
  <a href="#-features">Features</a> •
  <a href="#-architecture">Architecture</a> •
  <a href="#-quick-start">Quick Start</a> •
  <a href="#-deployment">Deployment</a> •
  <a href="#-security">Security</a> •
  <a href="#-documentation">Documentation</a>
</p>

---

## 📋 Overview

**Vidyavahini VMS** is a production-grade, centralized visitor management platform designed for **multi-tenant institutional campuses**. It powers end-to-end visitor lifecycle management — from pre-registration and live camera photo capture to instant QR pass issuance, real-time check-out scanning, and branded PDF/Excel report generation.

> **Platform Owner**: Vidyavahini Group  
> **First Reference Tenant**: Vaisiri Institute of Management & Technology (**VIMTECH**), Tumkur  
> **Package ID**: `in.vidyavahini.vms`

### Why Vidyavahini VMS?

| Challenge | Solution |
|:---|:---|
| Network outages at remote campus gates | **Offline-First Architecture** — IndexedDB local writes + background sync queue |
| Multiple colleges under one management group | **Multi-Tenant Isolation** — Row Level Security per college/branch |
| Paper-based visitor logs are insecure & unsearchable | **Digital Visitor Records** — Searchable, exportable, with photo evidence |
| Manual checkout is error-prone | **Single-Use QR Tokens** — Scan-once checkout with tamper detection |
| No emergency communication channel | **Real-Time SOS Alerts** — Instant broadcast overlay across all terminals |
| Managing multiple APKs per college | **Single Shared APK** — One app, dynamic branding per tenant |

---

## ✨ Features

### 🖥️ Role-Based Dashboards

```
Super Admin (Platform Owner)
├── Multi-tenant overview & executive analytics
├── 1-form college onboarding wizard with auto-provisioning
├── Executive white-label branding studio
└── Global platform audit logs

College Admin (Master Admin)
├── Multi-branch comparative analytics
├── Dynamic college-wide safety density gauge
├── Branch creation & principal account management
└── College-scoped blacklist management

Branch Principal
├── Real-time campus safety density gauge
├── 7-day traffic trend charts
├── Host directory & CSV bulk import
├── Receptionist account control
└── Branch-level blacklist & reports

Receptionist (Front Desk)
├── Mobile-first check-in with live camera capture
├── QR scanner check-out terminal
├── VIP / AICTE inspector badge workflows
├── Live IST clock & status filter tabs
└── Pre-registered visitor fast-track queue
```

### 🔑 Core Capabilities

| Capability | Description |
|:---|:---|
| **📸 Live Photo Capture** | Tablet/camera photo capture during check-in with Supabase Storage upload |
| **🔲 Instant QR Pass** | Auto-generated single-use QR token per visit with expiration enforcement |
| **🌐 Offline-First Engine** | Dexie.js (IndexedDB) local writes with automatic background sync on reconnect |
| **🔒 On-Device Deduplication** | Prevents duplicate active check-ins entirely on-device without network |
| **📊 Branded Reports** | PDF & Excel exports with institutional letterhead, principal signature lines |
| **🆘 Emergency SOS** | Real-time security alert broadcast overlay with 1-click acknowledge |
| **🌍 Multilingual** | English, ಕನ್ನಡ (Kannada), हिन्दी (Hindi) language support |
| **👁️ Pre-Registration Portal** | Public-facing form for visitors to pre-register with department/host selection |
| **🖥️ Lobby Kiosk Mode** | Self-service touch kiosk with bilingual UI and selfie camera capture |
| **🎨 Branding Studio** | Logo upload, pass preview modes, color theme customization, JSON config export |
| **📋 Audit Trail** | Every action logged with actor, role, scope, and JSONB metadata |
| **👤 Soft Deactivation** | Staff & tenants are suspended, never hard-deleted — history preserved |

---

## 🏗️ Architecture

### Technology Stack

| Layer | Technology | Purpose |
|:---|:---|:---|
| **Frontend** | React 18 · TypeScript 5.5 · Tailwind CSS | Component UI with type safety |
| **Animations** | Framer Motion | Glassmorphism effects & micro-interactions |
| **Icons** | Lucide React | Consistent icon system |
| **Typography** | Google Fonts (Inter · Outfit · Playfair Display) | Premium typographic hierarchy |
| **Backend** | Supabase (PostgreSQL 15) | Managed cloud database + auth + storage |
| **Auth** | Supabase Auth | Synthetic email mapping (`loginid@vms.internal`) |
| **Realtime** | Supabase Realtime (WebSocket) | Live visit updates, SOS alert broadcast |
| **Offline Storage** | Dexie.js (IndexedDB) | Local persistence & sync queue |
| **Mobile Shell** | Capacitor 6 (Android) | Native APK wrapper with camera permissions |
| **QR Engine** | `qrcode.react` + `html5-qrcode` | Generation & camera-based scanning |
| **PDF/Excel** | jsPDF + jspdf-autotable + SheetJS (xlsx) | Branded document export |
| **Build Tool** | Vite 5 | HMR, HTTPS dev server, tree-shaking |

### Multi-Tenant Data Model

```
                    ┌─────────────────────────────────────────┐
                    │      Vidyavahini Group Platform         │
                    │           (Super Admin)                 │
                    └───────────────────┬─────────────────────┘
                                        │
             ┌──────────────────────────┴──────────────────────────┐
             ▼                                                     ▼
┌──────────────────────────┐                         ┌──────────────────────────┐
│   VIMTECH College        │                         │  Another College         │
│   (Master Admin)         │                         │  (Master Admin)          │
└────────────┬─────────────┘                         └────────────┬─────────────┘
             │                                                    │
     ┌───────┴───────┐                                            │
     ▼               ▼                                            ▼
┌─────────┐     ┌─────────┐                                  ┌─────────┐
│ Main    │     │ City    │                                  │ Branch  │
│ Campus  │     │ Campus  │                                  │ Campus  │
│(Branch) │     │(Branch) │                                  │(Branch) │
└─────────┘     └─────────┘                                  └─────────┘
```

> **Critical Rule**: Branch, not College, is the operational unit. All check-ins, receptionists, hosts, and principals are scoped to `branch_id`.

### Offline-First Sync Architecture

```mermaid
sequenceDiagram
    autonumber
    actor R as 👤 Receptionist
    participant UI as CheckIn Modal
    participant SE as SyncEngine
    participant IDB as IndexedDB (Dexie)
    participant SB as ☁️ Supabase

    R->>UI: Enter visitor details
    UI->>SE: checkVisitorIsCurrentlyInside()
    SE->>IDB: Query local_visits (status='inside')

    alt ⛔ Already Inside
        IDB-->>SE: Active visit found
        SE-->>UI: BLOCK check-in
        UI-->>R: "Already Checked In" error
    else ✅ Clear to Enter
        IDB-->>SE: No active visit
        UI->>IDB: Save visitor + visit locally
        UI->>IDB: Enqueue in sync_queue
        UI-->>R: Display QR Pass Badge

        alt 🌐 Online
            SE->>SB: Push pending queue
            SB-->>SE: 200 OK
            SE->>IDB: Mark synced_at
        else 📴 Offline
            SE->>SE: Retain in queue (retry on reconnect)
        end
    end
```

### Database Schema (9 Core Tables)

```
colleges           ─── Tenant institutions
  └── branches     ─── Campus locations (operational unit)
       ├── profiles    ─── User accounts (auth-linked)
       ├── hosts       ─── Staff & student directory
       ├── visitors    ─── Visitor identity records
       ├── visits      ─── Check-in/out event log
       ├── blacklist   ─── Banned visitor registry
       └── emergency_sos_alerts ─── Security broadcasts

audit_logs         ─── Platform-wide action trail
```

All 9 tables have **Row Level Security (RLS)** enabled with scope-aware policies.

---

## ⚡ Quick Start

### Prerequisites

| Tool | Version | Purpose |
|:---|:---|:---|
| **Node.js** | ≥ 18.x | JavaScript runtime |
| **npm** | ≥ 9.x | Package manager |
| **Supabase Account** | Free or Pro | Cloud database & auth |
| **Android Studio** | Latest | _(Optional)_ Android APK builds |

### 1. Clone & Install

```bash
git clone https://github.com/your-org/VMS-SYSTEM.git
cd VMS-SYSTEM
npm install
```

### 2. Configure Environment

```bash
# Copy the environment template
cp .env.example .env.development

# Edit with your Supabase credentials
```

```env
# .env.development
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-public-key-here
```

### 3. Initialize Database

Apply the schema to your Supabase project:

```bash
# Option A: Via Supabase Dashboard SQL Editor
# Paste contents of supabase/schema.sql

# Option B: Via Supabase CLI
supabase db push
```

Then seed reference data:
```bash
# Paste contents of supabase/seed.sql in SQL Editor
```

### 4. Launch Development Server

```bash
npm run dev

# App runs at https://localhost:3000
# LAN access at https://192.168.x.x:3000
```

### 5. Android APK Build _(Optional)_

```bash
# Sync web build to Android project
npm run build:android

# Build signed release APK
npm run build:apk
```

---

## 📱 Deployment

### Web Deployment

| Platform | Command | Notes |
|:---|:---|:---|
| **Vercel** | `vercel --prod` | Set env vars in dashboard |
| **Netlify** | `netlify deploy --prod` | Set env vars in dashboard |
| **Custom Server** | `npm run build` → serve `dist/` | Any static file server |

### Android Deployment

```bash
# 1. Build production bundle
npm run build

# 2. Sync with Capacitor
npx cap sync android

# 3. Open in Android Studio
npx cap open android

# 4. Generate signed APK/AAB
# Android Studio → Build → Generate Signed Bundle/APK
```

> See [Android Build Guide](docs/android_build_guide.md) for keystore generation and release signing details.

---

## 🛡️ Security

### Authentication Model

- Users authenticate with a **Login ID** (e.g., `vimtech.reception1`)
- Internally mapped to `vimtech.reception1@vms.internal` for Supabase Auth compatibility
- Accounts provisioned with `must_change_password = true` for mandatory first-login password reset

### Row Level Security (RLS)

Every table enforces access policies via `get_current_profile()`:

| Role | Scope | Access Level |
|:---|:---|:---|
| `super_admin` | Platform-wide | Full CRUD on all tables |
| `master_admin` | College-scoped | Manage branches, principals |
| `branch_principal` | Branch-scoped | Manage hosts, receptionists, blacklist |
| `receptionist` | Branch-scoped | Check-in/out, view hosts |

### QR Token Security

| Property | Specification |
|:---|:---|
| **Format** | `VMS-{COLLEGE_TAG}-{4DIGIT}-{TIMESTAMP}` |
| **Usage** | Single-use — `qr_used` flag enforced on checkout |
| **Expiration** | Auto-expires at 11:59 PM on issuance day |
| **Re-scan Protection** | Already-used tokens rejected with explicit error |

### Data Protection

- **Soft Deletion**: Accounts & tenants are suspended (`is_active = false`), never hard-deleted
- **Audit Trail**: Every action logged with actor, role, scope, and JSONB metadata
- **Storage**: Visitor photos stored in Supabase Storage with bucket-level RLS
- **CSP Headers**: Content Security Policy enforced via `<meta>` tag

---

## 🔄 Disaster Recovery

### Database Backups

#### Point-in-Time Recovery (Pro/Enterprise)
```
Supabase Dashboard → Project Settings → Database → Backups → PITR
```

#### Manual CLI Backup
```bash
# Create backup
supabase db dump \
  --db-url "postgres://postgres.[REF]:[PASS]@aws-0-[REGION].pooler.supabase.com:6543/postgres" \
  -f vms_backup_$(date +%F).sql

# Restore from backup
psql "postgres://postgres.[REF]:[PASS]@aws-0-[REGION].pooler.supabase.com:6543/postgres" \
  -f vms_backup_$(date +%F).sql
```

### Android Keystore Recovery

> ⚠️ **Critical**: `vimtech-release-key.jks` must be stored in **at least 2 separate secure locations** (e.g., encrypted vault + offline cold storage).

```bash
# Verify keystore integrity
keytool -list -v -keystore path/to/vimtech-release-key.jks
# Expected alias: "vimtech" | CN=Vimtech Admin, O=Vidyavahini Group
```

See [Disaster Recovery Guide](docs/DISASTER_RECOVERY.md) for the full runbook.

---

## 📡 Operations & Monitoring

| System | Purpose | Configuration |
|:---|:---|:---|
| **UptimeRobot** | Production uptime monitoring (5-min intervals) | Monitor `https://vms.vidyavahini.in/` |
| **Sentry** | Error tracking with role/branch context | Set `VITE_SENTRY_DSN` in `.env.production` |

### Sentry Context Captured

Every error automatically includes:
- User Role (`super_admin`, `branch_principal`, `receptionist`)
- College ID & Branch ID
- Attempted Action (`check_in`, `check_out`, `sync_queue`, `auth_login`)

### Log Review Schedule

| Period | Frequency | Scope |
|:---|:---|:---|
| First 7 days post go-live | **Daily** (every 24h) | Sentry + Supabase audit logs |
| Ongoing maintenance | **Weekly** (every Monday) | Sentry + Admin telemetry panel |

---

## 📁 Project Structure

```
vms-system/
├── 📂 docs/                          # Documentation
│   ├── DISASTER_RECOVERY.md          # Backup & restore runbook
│   ├── android_build_guide.md        # Keystore & APK signing guide
│   ├── architecture.md               # System architecture specification
│   ├── api_reference.md              # Database schema & API docs
│   ├── deployment_guide.md           # Deployment instructions
│   ├── progress.md                   # Feature completion matrix
│   └── system_audit_report.md        # System audit report
│
├── 📂 src/
│   ├── 📂 components/
│   │   ├── 📂 superadmin/            # Platform owner dashboard
│   │   ├── 📂 principal/             # Branch principal analytics & host mgmt
│   │   ├── 📂 reception/             # Check-in modal, check-out scanner, dashboard
│   │   ├── 📂 reports/               # PDF & Excel export engine
│   │   ├── 📂 sos/                   # Emergency SOS broadcast system
│   │   ├── 📂 public/                # Pre-registration portal & lobby kiosk
│   │   ├── 📂 common/                # Shared UI components
│   │   ├── 📂 ui/                    # Design system primitives
│   │   ├── Navbar.tsx                # Multi-tenant header & sync status
│   │   └── VimtechLogo.tsx           # SVG logo component
│   │
│   ├── 📂 i18n/
│   │   └── translations.ts           # EN / KN / HI translation strings
│   │
│   ├── 📂 lib/
│   │   └── supabaseClient.ts         # Supabase client with mock fallback
│   │
│   ├── 📂 offline/
│   │   ├── db.ts                     # Dexie IndexedDB schema definitions
│   │   └── syncEngine.ts             # Offline sync queue & deduplication
│   │
│   ├── 📂 services/
│   │   ├── mockData.ts               # Reference seed dataset
│   │   └── vmsService.ts             # Unified API layer (mock + live Supabase)
│   │
│   ├── 📂 types/
│   │   └── index.ts                  # TypeScript domain interfaces
│   │
│   ├── 📂 utils/                     # Utility functions
│   ├── App.tsx                       # Root state management & role routing
│   ├── index.css                     # Design tokens, glassmorphism, HSL themes
│   └── main.tsx                      # React entry point
│
├── 📂 supabase/
│   ├── schema.sql                    # Full PostgreSQL DDL + RLS policies
│   └── seed.sql                      # Reference data seed script
│
├── 📂 android/                       # Capacitor Android project
├── 📂 branding/                      # Tenant branding assets
├── 📂 scripts/                       # Build & deployment scripts
├── 📂 public/                        # Static assets
│
├── capacitor.config.ts               # Android wrapper configuration
├── index.html                        # HTML entry with CSP & Google Fonts
├── vite.config.ts                    # Vite dev server & build config
├── tailwind.config.js                # Tailwind CSS configuration
├── tsconfig.json                     # TypeScript compiler options
└── package.json                      # Dependencies & npm scripts
```

---

## 🧰 NPM Scripts Reference

| Script | Command | Description |
|:---|:---|:---|
| `dev` | `vite` | Start HTTPS dev server with HMR |
| `build` | `tsc && vite build` | Type-check & production build |
| `preview` | `vite preview` | Preview production build locally |
| `build:android` | `npm run build && npx cap sync android` | Sync web build to Android |
| `build:apk` | Full pipeline | Build + sync + Gradle `assembleRelease` |
| `cap:add` | `cap add android` | Initialize Android platform |
| `cap:sync` | `cap sync android` | Sync web assets to Android |
| `cap:open` | `cap open android` | Open in Android Studio |

---

## 📖 Documentation

| Document | Description |
|:---|:---|
| [🏗️ Architecture Spec](docs/architecture.md) | Multi-tenant model, offline sync flow, QR token security |
| [🔌 API Reference](docs/api_reference.md) | Database schema, RLS policies, vmsService API |
| [📱 Android Build Guide](docs/android_build_guide.md) | Keystore generation, release APK signing |
| [🚀 Deployment Guide](docs/deployment_guide.md) | Supabase & web deployment instructions |
| [🛡️ Disaster Recovery](docs/DISASTER_RECOVERY.md) | Backup, restore, and DR test procedures |
| [📊 Progress Report](docs/progress.md) | Feature completion matrix & roadmap |
| [🔍 System Audit](docs/system_audit_report.md) | Comprehensive system audit report |

---

## 🤝 Contributing

1. **Fork** the repository
2. **Create** a feature branch (`git checkout -b feature/amazing-feature`)
3. **Commit** your changes (`git commit -m 'feat: add amazing feature'`)
4. **Push** to the branch (`git push origin feature/amazing-feature`)
5. **Open** a Pull Request

### Commit Convention

```
feat:     New feature
fix:      Bug fix
docs:     Documentation changes
style:    Formatting, missing semicolons, etc.
refactor: Code restructuring without feature change
test:     Adding or updating tests
chore:    Build process or auxiliary tool changes
```

---

## 📜 License

This project is proprietary software owned by **Vidyavahini Group of Institutions**.  
Unauthorized reproduction or distribution is prohibited.

---

<p align="center">
  <sub>Built with ❤️ by the Vidyavahini Engineering Team</sub><br/>
  <sub>© 2026 Vidyavahini Group of Institutions — All Rights Reserved</sub>
</p>
