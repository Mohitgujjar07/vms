-- ====================================================================
-- CENTRALIZED VISITOR MANAGEMENT SYSTEM (VMS) - SUPABASE POSTGRES SCHEMA
-- Production-Ready Production Schema for Multi-Tenant College Setup
-- ====================================================================

-- Enable required Postgres extensions
create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

-- --------------------------------------------------------------------
-- 1. COLLEGES TABLE (Tenants)
-- --------------------------------------------------------------------
create table if not exists colleges (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  display_name text not null,
  tagline text default 'VIDYAVAHINI GROUP',
  logo_url text,
  status text not null default 'active' check (status in ('active', 'suspended')),
  address text,
  contact_phone text,
  contact_email text,
  affiliations text[] default array[]::text[],
  -- White-label branding & packaging
  primary_color text default '#5B2C82',
  secondary_color text default '#8E44AD',
  package_id text,
  app_build_status text default 'pending' check (app_build_status in ('pending', 'building', 'built', 'failed')),
  created_at timestamptz default now()
);

-- Migration note: branding columns added post-v1 (used by visitor passes, report
-- headers and per-tenant APK packaging). Safe for pre-existing deployments.
alter table colleges add column if not exists primary_color text;
alter table colleges add column if not exists secondary_color text;
alter table colleges add column if not exists package_id text;
alter table colleges add column if not exists app_build_status text;

-- --------------------------------------------------------------------
-- 2. BRANCHES TABLE (Campuses)
-- --------------------------------------------------------------------
create table if not exists branches (
  id uuid primary key default gen_random_uuid(),
  college_id uuid not null references colleges(id) on delete cascade,
  name text not null,
  address text not null,
  timezone text not null default 'Asia/Kolkata',
  max_visitors_inside int default 100,
  created_at timestamptz default now()
);
create index if not exists idx_branches_college_id on branches(college_id);

-- --------------------------------------------------------------------
-- 3. PROFILES TABLE (User Profiles linked to Supabase Auth)
-- --------------------------------------------------------------------
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  login_id text unique not null,
  full_name text not null,
  role text not null check (role in ('super_admin', 'branch_principal', 'receptionist')),
  college_id uuid references colleges(id) on delete set null,
  branch_id uuid references branches(id) on delete set null,
  is_active boolean not null default true,
  must_change_password boolean not null default true,
  created_at timestamptz default now()
);
create index if not exists idx_profiles_login_id on profiles(login_id);
create index if not exists idx_profiles_college_branch on profiles(college_id, branch_id);

-- --------------------------------------------------------------------
-- 4. HOSTS TABLE (Staff & Student Directory)
-- --------------------------------------------------------------------
create table if not exists hosts (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid not null references branches(id) on delete cascade,
  name text not null,
  type text not null check (type in ('staff', 'student')),
  department_or_class text not null,
  created_at timestamptz default now()
);
create index if not exists idx_hosts_branch_id on hosts(branch_id);
create index if not exists idx_hosts_type on hosts(type);

-- --------------------------------------------------------------------
-- 5. VISITORS TABLE (Global & Local Visitors)
-- --------------------------------------------------------------------
create table if not exists visitors (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text not null,
  photo_url text,
  created_at timestamptz default now()
);
create index if not exists idx_visitors_phone on visitors(phone);

-- --------------------------------------------------------------------
-- 6. VISITS TABLE (Visit Records & Pre-Registrations)
-- --------------------------------------------------------------------
create table if not exists visits (
  id uuid primary key default gen_random_uuid(),
  visitor_id uuid not null references visitors(id) on delete restrict,
  branch_id uuid not null references branches(id) on delete cascade,
  host_id uuid references hosts(id) on delete restrict,
  purpose text not null,
  category text default 'General',
  status text not null check (status in ('inside', 'checked_out')) default 'inside',
  qr_token text unique not null,
  qr_expires_at timestamptz not null,
  qr_used boolean not null default false,
  check_in_time timestamptz not null default now(),
  check_out_time timestamptz,
  is_pre_registered boolean default false,
  expected_arrival_time timestamptz,
  created_by uuid references profiles(id) on delete set null,
  rating int check (rating >= 1 and rating <= 5),
  feedback_comment text,
  synced_at timestamptz default now(),
  created_at timestamptz default now()
);
-- Migration note: host selection removed from check-in flow — visits may now
-- be recorded without a host. Safe for pre-existing deployments.
alter table visits alter column host_id drop not null;

create index if not exists idx_visits_branch_status on visits(branch_id, status);
create index if not exists idx_visits_qr_token on visits(qr_token);
create index if not exists idx_visits_check_in_time on visits(check_in_time desc);
create index if not exists idx_visits_visitor_id on visits(visitor_id);
create unique index if not exists idx_unique_active_visit on visits(branch_id, visitor_id) where status = 'inside';

-- --------------------------------------------------------------------
-- 7. BLACKLIST TABLE
-- --------------------------------------------------------------------
create table if not exists blacklist (
  id uuid primary key default gen_random_uuid(),
  scope text not null check (scope in ('branch', 'college')),
  branch_id uuid references branches(id) on delete cascade,
  college_id uuid references colleges(id) on delete cascade,
  visitor_phone text not null,
  reason text not null,
  escalated_to_college boolean default false,
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz default now()
);
create index if not exists idx_blacklist_phone on blacklist(visitor_phone);
create index if not exists idx_blacklist_branch_college on blacklist(branch_id, college_id);

-- --------------------------------------------------------------------
-- 8. AUDIT LOGS TABLE
-- --------------------------------------------------------------------
create table if not exists audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references profiles(id) on delete set null,
  actor_name text,
  action text not null,
  scope text not null check (scope in ('branch', 'college', 'platform')),
  college_id uuid references colleges(id) on delete set null,
  branch_id uuid references branches(id) on delete set null,
  metadata jsonb,
  created_at timestamptz default now()
);
create index if not exists idx_audit_logs_actor on audit_logs(actor_id);
create index if not exists idx_audit_logs_created on audit_logs(created_at desc);
create index if not exists idx_audit_logs_college_branch on audit_logs(college_id, branch_id);

-- Migration note: tenant columns added for per-college audit views.
alter table audit_logs add column if not exists college_id uuid references colleges(id) on delete set null;
alter table audit_logs add column if not exists branch_id uuid references branches(id) on delete set null;

-- ====================================================================
-- AUTOMATIC PROFILE CREATION TRIGGER FOR SUPABASE AUTH SIGNUPS
-- ====================================================================
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, login_id, full_name, role, is_active, must_change_password)
  values (
    new.id,
    coalesce(new.email, new.raw_user_meta_data->>'login_id', new.id::text),
    coalesce(new.raw_user_meta_data->>'full_name', 'User'),
    coalesce((new.raw_user_meta_data->>'role')::text, 'receptionist'),
    true,
    true
  )
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer;

-- Trigger execution on auth.users
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ====================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ====================================================================

alter table colleges enable row level security;
alter table branches enable row level security;
alter table profiles enable row level security;
alter table hosts enable row level security;
alter table visitors enable row level security;
alter table visits enable row level security;
alter table blacklist enable row level security;
alter table emergency_sos_alerts enable row level security;
alter table audit_logs enable row level security;

-- Helper function to fetch current authenticated user profile
create or replace function get_current_profile()
returns profiles as $$
  select * from profiles where id = auth.uid();
$$ language sql security definer;

-- 1. COLLEGES
create policy "Allow all access on colleges" on colleges for all using (true) with check (true);

-- 2. BRANCHES
create policy "Allow all access on branches" on branches for all using (true) with check (true);

-- 3. PROFILES
create policy "Allow all access on profiles" on profiles for all using (true) with check (true);

-- 4. HOSTS
create policy "Allow all access on hosts" on hosts for all using (true) with check (true);

-- 5. VISITORS
create policy "Allow all access on visitors" on visitors for all using (true) with check (true);

-- 6. VISITS
create policy "Allow all access on visits" on visits for all using (true) with check (true);

-- 7. BLACKLIST
create policy "Allow all access on blacklist" on blacklist for all using (true) with check (true);

-- 8. AUDIT LOGS
create policy "Allow all access on audit_logs" on audit_logs for all using (true) with check (true);

-- ====================================================================
-- STORAGE POLICY FOR VISITOR PHOTOS
-- ====================================================================
-- PHOTO POLICY (ephemeral-by-design): visitor photos captured at check-in are
-- NEVER uploaded or stored anywhere — they live only in app memory for the
-- instant printable pass. No bucket is created; no storage policies needed.
--
-- Migration cleanup for projects created before this policy:
--   delete from storage.objects where bucket_id = 'visitor-photos';
--   delete from storage.buckets where id = 'visitor-photos';
--   drop policy if exists "Public Read Access for Visitor Photos" on storage.objects;
--   drop policy if exists "Authenticated Upload Access for Visitor Photos" on storage.objects;
--   drop policy if exists "Authenticated & Public Upload Access for Visitor Photos" on storage.objects;

-- ====================================================================
-- REALTIME SUBSCRIPTIONS PUBLICATION
-- ====================================================================
do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'visits') then
    alter publication supabase_realtime add table visits;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'hosts') then
    alter publication supabase_realtime add table hosts;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'blacklist') then
    alter publication supabase_realtime add table blacklist;
  end if;
exception when others then
  raise notice 'Supabase Realtime publication notification: %', SQLERRM;
end $$;
