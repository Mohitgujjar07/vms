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
  created_at timestamptz default now()
);

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
  host_id uuid not null references hosts(id) on delete restrict,
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
-- 8. EMERGENCY SOS ALERTS TABLE
-- --------------------------------------------------------------------
create table if not exists emergency_sos_alerts (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid not null references branches(id) on delete cascade,
  branch_name text not null,
  receptionist_id uuid references profiles(id) on delete set null,
  receptionist_name text not null,
  message text not null,
  is_active boolean not null default true,
  created_at timestamptz default now()
);
create index if not exists idx_sos_branch_active on emergency_sos_alerts(branch_id, is_active);

-- --------------------------------------------------------------------
-- 9. AUDIT LOGS TABLE
-- --------------------------------------------------------------------
create table if not exists audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references profiles(id) on delete set null,
  actor_name text,
  action text not null,
  scope text not null check (scope in ('branch', 'college', 'platform')),
  metadata jsonb,
  created_at timestamptz default now()
);
create index if not exists idx_audit_logs_actor on audit_logs(actor_id);
create index if not exists idx_audit_logs_created on audit_logs(created_at desc);

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

-- COLLEGES POLICIES
create policy "Super Admin full access on colleges" on colleges
  for all using ((get_current_profile()).role = 'super_admin');

create policy "Users view their own college" on colleges
  for select using (id = (get_current_profile()).college_id or auth.role() = 'anon');

-- BRANCHES POLICIES
create policy "Super Admin full access on branches" on branches
  for all using ((get_current_profile()).role = 'super_admin');

create policy "Branch level users view their branch" on branches
  for select using (id = (get_current_profile()).branch_id or auth.role() = 'anon');

-- PROFILES POLICIES
create policy "Super Admin manage all profiles" on profiles
  for all using ((get_current_profile()).role = 'super_admin');

create policy "Branch Principal manage receptionist profiles" on profiles
  for all using (
    (get_current_profile()).role = 'branch_principal'
    and branch_id = (get_current_profile()).branch_id
    and role = 'receptionist'
  );

create policy "Users view own profile" on profiles
  for select using (id = auth.uid());

-- HOSTS POLICIES
create policy "Super Admin manage hosts" on hosts
  for all using ((get_current_profile()).role = 'super_admin');

create policy "Branch Principal manage branch hosts" on hosts
  for all using (
    (get_current_profile()).role = 'branch_principal'
    and branch_id = (get_current_profile()).branch_id
  );

create policy "Receptionist view branch hosts" on hosts
  for select using (
    (get_current_profile()).role = 'receptionist'
    and branch_id = (get_current_profile()).branch_id
  );

create policy "Public view hosts for pre-registration" on hosts
  for select using (true);

-- VISITORS POLICIES
create policy "Authenticated users view visitors" on visitors
  for select using (auth.role() = 'authenticated' or auth.role() = 'anon');

create policy "Receptionists and public pre-registration insert visitors" on visitors
  for insert with check (true);

create policy "Receptionists and admins update visitors" on visitors
  for update using (auth.role() = 'authenticated');

-- VISITS POLICIES
create policy "Super Admin full access on visits" on visits
  for all using ((get_current_profile()).role = 'super_admin');

create policy "Branch level users view/manage branch visits" on visits
  for all using (
    branch_id = (get_current_profile()).branch_id
  );

create policy "Public pre-registration insert visits" on visits
  for insert with check (true);

-- BLACKLIST POLICIES
create policy "Super Admin full access on blacklist" on blacklist
  for all using ((get_current_profile()).role = 'super_admin');

create policy "Branch Principal manage branch blacklist" on blacklist
  for all using (
    (get_current_profile()).role = 'branch_principal'
    and branch_id = (get_current_profile()).branch_id
  );

create policy "Receptionist view blacklist" on blacklist
  for select using (
    branch_id = (get_current_profile()).branch_id
    or college_id = (get_current_profile()).college_id
  );

-- EMERGENCY SOS ALERTS POLICIES
create policy "Authenticated users full access on SOS alerts" on emergency_sos_alerts
  for all using (auth.role() = 'authenticated');

-- AUDIT LOGS POLICIES
create policy "Super Admin view all audit logs" on audit_logs
  for select using ((get_current_profile()).role = 'super_admin');

create policy "Authenticated users insert audit logs" on audit_logs
  for insert with check (auth.role() = 'authenticated');

-- ====================================================================
-- STORAGE BUCKETS & RLS SETUP FOR VISITOR PHOTOS
-- ====================================================================
insert into storage.buckets (id, name, public)
values ('visitor-photos', 'visitor-photos', true)
on conflict (id) do nothing;

create policy "Public Read Access for Visitor Photos" on storage.objects
  for select using (bucket_id = 'visitor-photos');

create policy "Authenticated & Public Upload Access for Visitor Photos" on storage.objects
  for insert with check (bucket_id = 'visitor-photos');

-- ====================================================================
-- REALTIME SUBSCRIPTIONS PUBLICATION
-- ====================================================================
do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'visits') then
    alter publication supabase_realtime add table visits;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'emergency_sos_alerts') then
    alter publication supabase_realtime add table emergency_sos_alerts;
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
