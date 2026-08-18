# VMS API Reference & Database Schema Documentation

This document describes the Supabase PostgreSQL database schema, Row Level Security (RLS) policies, domain models, and `vmsService` API methods for the Centralised Visitor Management System.

---

## 1. Database Schema (`supabase/schema.sql`)

### Role Hierarchy
```
super_admin        — Platform Owner (single account)
master_admin       — College Admin (one per college)
branch_principal   — Branch Principal (one per branch)
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
| `address` | text | NULLABLE | Campus address |
| `contact_phone` | text | NULLABLE | Contact telephone |
| `contact_email` | text | NULLABLE | Contact email |
| `affiliations` | text[] | DEFAULT array[] | Accreditation tags |
| `created_at` | timestamptz | DEFAULT now() | Creation timestamp |

#### `branches`
| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | uuid | PRIMARY KEY | Branch unique ID |
| `college_id` | uuid | FK -> colleges.id ON DELETE CASCADE | Parent college ID |
| `name` | text | NOT NULL | Branch campus name |
| `address` | text | NOT NULL | Location address |
| `timezone` | text | DEFAULT 'Asia/Kolkata' | Timezone |
| `max_visitors_inside` | int | DEFAULT 100 | Max inside capacity limit |
| `created_at` | timestamptz | DEFAULT now() | Creation timestamp |

#### `profiles`
| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | uuid | PRIMARY KEY -> auth.users.id ON DELETE CASCADE | User auth ID |
| `login_id` | text | UNIQUE, NOT NULL | Synthetic username |
| `full_name` | text | NOT NULL | Staff full name |
| `role` | text | CHECK (role IN ('super_admin', 'master_admin', 'branch_principal', 'receptionist')) | User role |
| `college_id` | uuid | FK -> colleges.id ON DELETE SET NULL | College scope |
| `branch_id` | uuid | FK -> branches.id ON DELETE SET NULL | Branch scope |
| `is_active` | boolean | DEFAULT true | Account status |
| `must_change_password` | boolean | DEFAULT true | Force password reset flag |
| `created_at` | timestamptz | DEFAULT now() | Creation timestamp |

---

## 2. Row Level Security (RLS) Summary

| Table | Policy Name | Permitted Roles / Conditions |
|---|---|---|
| `colleges` | Super Admin full access | `super_admin` |
| `colleges` | Users view own college | Own `college_id` or anon |
| `branches` | Super Admin full access | `super_admin` |
| `branches` | Master Admin view/manage college branches | `master_admin` matching `college_id` |
| `branches` | Branch level users view branch | Matching `branch_id` or anon |
| `profiles` | Super Admin manage all profiles | `super_admin` |
| `profiles` | Master Admin manage college profiles | `master_admin` matching `college_id` |
| `profiles` | Branch Principal manage receptionists | `branch_principal` matching `branch_id` & `role = 'receptionist'` |
| `hosts` | Super Admin manage hosts | `super_admin` |
| `hosts` | Master Admin manage college hosts | `master_admin` matching branches in `college_id` |
| `hosts` | Branch Principal manage branch hosts | `branch_principal` matching `branch_id` |
| `hosts` | Receptionist view branch hosts | `receptionist` matching `branch_id` |
| `visits` | Super Admin full access | `super_admin` |
| `visits` | Master Admin view/manage college visits | `master_admin` matching branches in `college_id` |
| `visits` | Branch users view/manage branch visits | Matching `branch_id` |
| `blacklist` | Super Admin full access | `super_admin` |
| `blacklist` | Master Admin full access on college blacklist | `master_admin` matching `college_id` |
| `blacklist` | Branch Principal manage branch blacklist | `branch_principal` matching `branch_id` |
| `audit_logs` | Super Admin view all audit logs | `super_admin` |
| `audit_logs` | Master Admin view college audit logs | `master_admin` with `scope = 'college'` |

---

## 3. Key `vmsService` API Methods

### Onboarding
- `onboardNewCollege(data)` — Atomically creates a college, default branch, and 3 initial user accounts (Master Admin, Branch Principal, Receptionist). Returns `CollegeProvisioningResult`.

### Directory & Management
- `getColleges()` / `getCollegeById(id)` — Fetch college records.
- `getBranches(collegeId?)` — Fetch branches.
- `createBranch(...)` / `deleteBranch(branchId)` — Manage branches.
- `deleteCollege(collegeId)` — Soft-deactivates college status to `suspended`.

### Visits & Check-In
- `createCheckIn(data)` — Performs on-device local check-in with deduplication.
- `processCheckOut(qrToken, branchId, rating?, comment?)` — Scans QR token to check out.
- `getVisits(branchId?, collegeId?)` — Returns visit logs.
