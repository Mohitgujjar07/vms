# VMS API Reference & Database Schema Documentation

This document describes the Supabase PostgreSQL database schema, Row Level Security (RLS) policies, domain models, and `vmsService` API methods for the Centralised Visitor Management System.

> **Reconciled with implementation (2026-08-22).** The system implements a
> **3-role hierarchy**. A `master_admin` college-admin tier was previously
> documented here but has never existed in schema or code; all references
> have been removed.

---

## 1. Database Schema (`supabase/schema.sql`)

### Role Hierarchy (3 roles)
```
super_admin        — Platform Owner (Vidyavahini Group; single account)
branch_principal   — Branch Principal (one per branch; highest college-level tier)
receptionist       — Front Desk Operator (one or more per branch)
```

### Table Definitions

#### `colleges`
| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | uuid | PRIMARY KEY | College unique ID |
| `name` | text | NOT NULL | Official full name |
| `display_name` | text | NOT NULL | Short code (e.g. VIMTECH) |
| `tagline` | text | DEFAULT 'VIDYAVAHINI GROUP' | Sub-header text |
| `logo_url` | text | NULLABLE | Logo URL for passes/reports |
| `status` | text | DEFAULT 'active' ('active', 'suspended') | Tenant operational status |
| `address` / `contact_phone` / `contact_email` | text | NULLABLE | Identity used on passes & report headers |
| `affiliations` | text[] | DEFAULT array[] | Accreditation tags shown on passes |
| `primary_color` / `secondary_color` | text | NULLABLE | White-label branding colors |
| `package_id` | text | NULLABLE | Per-tenant Android package id |
| `app_build_status` | text | ('pending','building','built','failed') | Tenant APK build state |
| `created_at` | timestamptz | DEFAULT now() | Creation timestamp |

#### `branches`
| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | uuid | PRIMARY KEY | Branch unique ID |
| `college_id` | uuid | FK -> colleges.id ON DELETE CASCADE | Parent college ID |
| `name` / `address` | text | NOT NULL | Campus identity |
| `timezone` | text | DEFAULT 'Asia/Kolkata' | Timezone |
| `max_visitors_inside` | int | DEFAULT 100 | Max inside capacity limit |
| `created_at` | timestamptz | DEFAULT now() | Creation timestamp |

#### `profiles`
| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | uuid | PRIMARY KEY -> auth.users.id ON DELETE CASCADE | User auth ID |
| `login_id` | text | UNIQUE, NOT NULL | Synthetic username |
| `full_name` | text | NOT NULL | Staff full name |
| `role` | text | CHECK IN ('super_admin', 'branch_principal', 'receptionist') | User role |
| `college_id` | uuid | FK -> colleges.id ON DELETE SET NULL | College scope |
| `branch_id` | uuid | FK -> branches.id ON DELETE SET NULL | Branch scope |
| `is_active` | boolean | DEFAULT true | Account status (soft deactivation) |
| `must_change_password` | boolean | DEFAULT true | Force password reset flag |
| `created_at` | timestamptz | DEFAULT now() | Creation timestamp |

#### Other tables (summary)
- **`hosts`** — branch-scoped staff/student directory (`type`, `department_or_class`).
- **`visitors`** — GLOBAL visitor directory shared across tenants by design (phone lookups at any front desk).
- **`visits`** — visit lifecycle records; partial unique index `(branch_id, visitor_id) WHERE status='inside'` prevents duplicate active visits at the DB level.
- **`blacklist`** — `scope` = branch/college entries keyed by `visitor_phone`.
- **`emergency_sos_alerts`** — branch-scoped emergency broadcasts.
- **`audit_logs`** — action trail with `college_id`/`branch_id` tenant columns + free-form jsonb `metadata`.

---

## 2. Row Level Security (RLS) Summary

| Table | Policy | Permitted Roles / Conditions |
|---|---|---|
| `colleges` | Super Admin full access | `super_admin` |
| `colleges` | Users view own college | Own `college_id` or anon |
| `branches` | Super Admin full access | `super_admin` |
| `branches` | Branch level users view their branch | Matching `branch_id` or anon |
| `profiles` | Super Admin manage all profiles | `super_admin` |
| `profiles` | Branch Principal manage receptionists | Same branch & target `role='receptionist'` |
| `profiles` | Users view own profile | `id = auth.uid()` |
| `hosts` | Super Admin / Branch Principal manage | Platform or same-branch |
| `hosts` | Receptionist view branch hosts | Same branch |
| `visitors` | Staff & public view | authenticated or anon |
| `visitors` | Insert | open (visitor self-registration) |
| `visitors` | Update | active authenticated staff only |
| `visits` | Super Admin full access | `super_admin` |
| `visits` | Branch users view/manage branch visits | Matching `branch_id` |
| `visits` | Public inserts removed with the pre-registration portal | staff-only |
| `blacklist` | Super Admin / Branch Principal manage | Platform or same-branch |
| `blacklist` | Receptionist view | Same branch or college |
| `emergency_sos_alerts` | Super Admin full access | `super_admin` |
| `emergency_sos_alerts` | Branch staff manage own alerts | principal/receptionist of same branch |
| `audit_logs` | Super Admin view all | `super_admin` |
| `audit_logs` | Branch Principal view own-college logs | matching `college_id`/`branch_id` |
| `audit_logs` | Authenticated insert | any staff |

---

## 3. Key `vmsService` API Methods

### Onboarding
- `onboardNewCollege(data)` — Atomically creates a college, default branch, and 2 initial user accounts (Branch Principal, Receptionist) via Supabase Auth signup with synthetic emails (`{loginId}@vms.internal`). Returns `CollegeProvisioningResult`.

### Directory & Management
- `getColleges()` / `getCollegeById(id)` — Fetch college records.
- `getBranches(collegeId?)` — Fetch branches.
- `createBranch(...)` / `deleteBranch(branchId)` — Manage branches.
- `deleteCollege(collegeId)` — Soft-deactivates college status to `suspended`.
- `getHosts(branchId)` / `addHost(...)` / `importHostsFromCsv(branchId, csvText)` — Host directory management.
- `createStaffAccount(data)` / `toggleStaffStatus(id)` / `resetStaffPassword(id)` — Staff administration.

### Visits & Check-In
- `createCheckIn(data)` — On-device check-in: blacklist gate → dedup lock → QR token generation → offline queue.
- `processCheckOut(qrToken, branchId, rating?, comment?)` — Token-scoped checkout; rejects reused tokens and cross-branch passes.
- `manualCheckOut(visitId, rating?, comment?)` — Directory-based checkout fallback.
- `getVisits(branchId?, collegeId?)` — Visit logs (cloud-first merge with unsynced local edits preserved).

### Security
- `checkBlacklist(phone, branchId, collegeId?)` — Gatekeeper check (rehydrated from local cache + cloud on boot).
- `getBlacklist(...)` / `addToBlacklist(entry)` / `removeFromBlacklist(id)` / `escalateBlacklistEntry(id)`.
- `raiseSosAlert(branchId, receptionistId, name, message, branchName)` / `getActiveSosAlerts(branchId?)` / `dismissSosAlert(id)`.

### System
- `logAudit(actorId?, name?, action, scope, metadata?)` / `getAuditLogs(collegeId?, branchId?)`.
- `getSystemHealthMetrics()` — cloud latency, stuck syncs, failed logins (24h), active SOS count.
- `subscribe(listener)` — eventBus subscription for real-time UI refresh.
