-- ====================================================================
-- CENTRALIZED VISITOR MANAGEMENT SYSTEM (VMS) - VIMTECH SEED DATA
-- Official Tenant 1: Vaisiri Institute of Management & Technology (Tumkur)
-- Production Seed Script
-- ====================================================================

-- 1. INSERT REFERENCE COLLEGE: VIMTECH
insert into colleges (id, name, display_name, tagline, primary_color, secondary_color, package_id, app_build_status, status, address, contact_phone, contact_email)
values (
  '11111111-1111-1111-1111-111111111111',
  'Vaisiri Institute of Management & Technology',
  'VIMTECH',
  'VIDYAVAHINI GROUP',
  '#5B2C82',
  '#8E44AD',
  'in.vidyavahini.vimtech.vms',
  'built',
  'active',
  '2nd Stage, Sri Sharadadevi Nagar, Sai Baba Temple Road, Tumkur – 572103',
  '+918162255667',
  'info@vimtech.edu.in'
)
on conflict (id) do nothing;

-- 2. INSERT MAIN CAMPUS BRANCH
insert into branches (id, college_id, name, address, timezone, max_visitors_inside)
values (
  '22222222-2222-2222-2222-222222222222',
  '11111111-1111-1111-1111-111111111111',
  'Main Campus',
  '2nd Stage, Sri Sharadadevi Nagar, Sai Baba Temple Road, Tumkur – 572103',
  'Asia/Kolkata',
  100
)
on conflict (id) do nothing;

-- 3. AUTHENTIC HOST DIRECTORY (Staff and Students across BCA, BBA, MBA, CDC, IQAC)
insert into hosts (id, branch_id, name, type, department_or_class) values
  ('33333331-3333-3333-3333-333333333333', '22222222-2222-2222-2222-222222222222', 'Dr. Ramesh Kumar', 'staff', 'Administration - Principal Office'),
  ('33333332-3333-3333-3333-333333333333', '22222222-2222-2222-2222-222222222222', 'Dr. S. K. Murthy', 'staff', 'Director - Governing Council'),
  ('33333333-3333-3333-3333-333333333333', '22222222-2222-2222-2222-222222222222', 'Prof. Sunitha Rao', 'staff', 'BCA Department Head'),
  ('33333334-3333-3333-3333-333333333333', '22222222-2222-2222-2222-222222222222', 'Prof. Vinay Kumar', 'staff', 'BCA (AI & ML) Assistant Professor'),
  ('33333335-3333-3333-3333-333333333333', '22222222-2222-2222-2222-222222222222', 'Kavya Sharma', 'student', 'BCA (AI & ML) - 3rd Year'),
  ('33333336-3333-3333-3333-333333333333', '22222222-2222-2222-2222-222222222222', 'Prof. Rajesh Gowda', 'staff', 'BBA Department Head'),
  ('33333337-3333-3333-3333-333333333333', '22222222-2222-2222-2222-222222222222', 'Rahul Gowda', 'student', 'BBA - 2nd Year'),
  ('33333338-3333-3333-3333-333333333333', '22222222-2222-2222-2222-222222222222', 'Prof. Anand Vardhan', 'staff', 'MBA Department Head'),
  ('33333339-3333-3333-3333-333333333333', '22222222-2222-2222-2222-222222222222', 'Priya Hegde', 'student', 'MBA - 1st Year'),
  ('33333340-3333-3333-3333-333333333333', '22222222-2222-2222-2222-222222222222', 'Mr. Praveen Kumar', 'staff', 'Career Development Center (CDC) Placement Officer'),
  ('33333341-3333-3333-3333-333333333333', '22222222-2222-2222-2222-222222222222', 'Dr. Meenakshi S', 'staff', 'Internal Quality Assurance Cell (IQAC) Coordinator')
on conflict (id) do nothing;

-- 4. REPEAT VISITORS DIRECTORY
insert into visitors (id, name, phone, photo_url) values
  ('44444441-4444-4444-4444-444444444444', 'Suresh Babu', '+919876543210', 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=300&q=80'),
  ('44444442-4444-4444-4444-444444444444', 'Ananya Deshmukh', '+919123456789', 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=300&q=80'),
  ('44444443-4444-4444-4444-444444444444', 'Vikram Patil', '+919988776655', 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=300&q=80')
on conflict (id) do nothing;

-- 5. SAMPLE ACTIVE & COMPLETED VISITS
insert into visits (id, visitor_id, branch_id, host_id, purpose, status, qr_token, qr_expires_at, qr_used, check_in_time, check_out_time, synced_at) values
  (
    '55555551-5555-5555-5555-555555555555',
    '44444441-4444-4444-4444-444444444444',
    '22222222-2222-2222-2222-222222222222',
    '33333331-3333-3333-3333-333333333333',
    'Admissions Enquiry: Admissions Enquiry for BCA (AI & ML)',
    'inside',
    'VMS-VIMTECH-8923-9481',
    now() + interval '12 hours',
    false,
    now() - interval '45 minutes',
    null,
    now()
  ),
  (
    '55555552-5555-5555-5555-555555555555',
    '44444442-4444-4444-4444-444444444444',
    '22222222-2222-2222-2222-222222222222',
    '33333333-3333-3333-3333-333333333333',
    'Parent Visit: Meeting with BCA HOD',
    'checked_out',
    'VMS-VIMTECH-7412-2205',
    now() - interval '1 hour',
    true,
    now() - interval '3 hours',
    now() - interval '1 hour',
    now()
  )
on conflict (id) do nothing;

-- 6. BLACKLIST ENTRIES
insert into blacklist (id, scope, branch_id, college_id, visitor_phone, reason) values
  ('66666661-6666-6666-6666-666666666666', 'branch', '22222222-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111111', '+919000000000', 'Unauthorized commercial solicitation and disturbance near library campus area')
on conflict (id) do nothing;

-- ====================================================================
-- 7. SEED AUTH USERS + PROFILES (out-of-the-box logins)
-- Synthetic email mapping: {login_id}@vms.internal
-- Default password for all three seeded accounts: Vimtech@2026
-- (bcrypt-hashed; CHANGE THESE IMMEDIATELY IN PRODUCTION via the app)
-- ====================================================================
do $$
declare
  super_uid     uuid := '77777777-7777-7777-7777-777777777777';
  super_uid_2   uuid := '19b0204b-c43d-4952-8d7a-95e3d59f3c88';
  principal_uid uuid := '99999999-9999-9999-9999-999999999999';
  reception_uid uuid := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  pw_hash       text := crypt('Vimtech@2026', gen_salt('bf'));
  pw_hash_2     text := crypt('VIMTECH@9900', gen_salt('bf'));
begin
  -- Super Admin 1 (platform-wide)
  insert into auth.users (instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, created_at, updated_at,
    raw_app_meta_data, raw_user_meta_data, confirmation_token, recovery_token)
  values ('00000000-0000-0000-0000-000000000000', super_uid, 'authenticated', 'authenticated',
    'super.admin@vms.internal', pw_hash,
    now(), now(), now(),
    '{"provider":"email","providers":["email"]}',
    '{"login_id":"super.admin","full_name":"Platform Controller (Vidyavahini Group)","role":"super_admin"}',
    '', '')
  on conflict (id) do nothing;

  -- Super Admin 2 (Pradeep Kumar N B)
  insert into auth.users (instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, created_at, updated_at,
    raw_app_meta_data, raw_user_meta_data, confirmation_token, recovery_token)
  values ('00000000-0000-0000-0000-000000000000', super_uid_2, 'authenticated', 'authenticated',
    'pradeepkumar.nb@gmail.com', pw_hash_2,
    now(), now(), now(),
    '{"provider":"email","providers":["email"]}',
    '{"login_id":"Pradeepkumar.nb@gmail.com","full_name":"Pradeep Kumar N B","role":"super_admin"}',
    '', '')
  on conflict (id) do nothing;

  -- Branch Principal (VIMTECH Main Campus)
  insert into auth.users (instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, created_at, updated_at,
    raw_app_meta_data, raw_user_meta_data, confirmation_token, recovery_token)
  values ('00000000-0000-0000-0000-000000000000', principal_uid, 'authenticated', 'authenticated',
    'vimtech.principal@vms.internal', pw_hash,
    now(), now(), now(),
    '{"provider":"email","providers":["email"]}',
    '{"login_id":"vimtech.principal","full_name":"VIMTECH Branch Principal","role":"branch_principal"}',
    '', '')
  on conflict (id) do nothing;

  -- Receptionist (VIMTECH Main Campus front desk)
  insert into auth.users (instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, created_at, updated_at,
    raw_app_meta_data, raw_user_meta_data, confirmation_token, recovery_token)
  values ('00000000-0000-0000-0000-000000000000', reception_uid, 'authenticated', 'authenticated',
    'vimtech.reception1@vms.internal', pw_hash,
    now(), now(), now(),
    '{"provider":"email","providers":["email"]}',
    '{"login_id":"vimtech.reception1","full_name":"VIMTECH Front Desk Receptionist","role":"receptionist"}',
    '', '')
  on conflict (id) do nothing;

  -- Matching profiles (RLS-scoped accounts). handle_new_user trigger may have
  -- already inserted these on auth signup — upsert keeps our tenant scoping.
  insert into profiles (id, login_id, full_name, role, college_id, branch_id, is_active, must_change_password)
  values
    (super_uid, 'super.admin', 'Platform Controller (Vidyavahini Group)', 'super_admin',
     null, null, true, false),
    (super_uid_2, 'Pradeepkumar.nb@gmail.com', 'Pradeep Kumar N B', 'super_admin',
     null, null, true, false),
    (principal_uid, 'vimtech.principal', 'VIMTECH Branch Principal', 'branch_principal',
     '11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', true, false),
    (reception_uid, 'vimtech.reception1', 'VIMTECH Front Desk Receptionist', 'receptionist',
     '11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', true, false)
  on conflict (id) do update set
    login_id = excluded.login_id,
    role = excluded.role,
    college_id = excluded.college_id,
    branch_id = excluded.branch_id,
    is_active = true;
exception
  when others then
    raise notice 'Auth user seeding notice: % (run scripts/provision-auth-users.ts as fallback)', SQLERRM;
end $$;
