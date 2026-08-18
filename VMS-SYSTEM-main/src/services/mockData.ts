import { College, Branch, Profile, Host, Visitor, Visit, BlacklistEntry, AuditLog } from '../types';

/**
 * Initial reference state for VIMTECH multi-tenant deployment.
 * Supports out-of-the-box local login for all 4 role tiers.
 */
export const INITIAL_COLLEGES: College[] = [
  {
    id: '11111111-1111-1111-1111-111111111111',
    name: 'Vaisiri Institute of Management & Technology',
    display_name: 'VIMTECH',
    tagline: 'VIDYAVAHINI GROUP',
    primary_color: '#5B2C82',
    secondary_color: '#8E44AD',
    package_id: 'in.vidyavahini.vimtech.vms',
    app_build_status: 'built',
    status: 'active',
    address: '2nd Stage, Sri Sharadadevi Nagar, Sai Baba Temple Road, Tumkur – 572103',
    contact_phone: '+918162255667',
    contact_email: 'info@vimtech.edu.in',
    created_at: new Date('2026-01-01').toISOString()
  }
];

export const INITIAL_BRANCHES: Branch[] = [
  {
    id: '22222222-2222-2222-2222-222222222222',
    college_id: '11111111-1111-1111-1111-111111111111',
    name: 'Main Campus',
    address: '2nd Stage, Sri Sharadadevi Nagar, Sai Baba Temple Road, Tumkur – 572103',
    timezone: 'Asia/Kolkata',
    max_visitors_inside: 100,
    created_at: new Date('2026-01-01').toISOString()
  }
];

export const INITIAL_PROFILES: Profile[] = [
  {
    id: '77777777-7777-7777-7777-777777777777',
    login_id: 'super.admin',
    full_name: 'Platform Controller (Vidyavahini Group)',
    role: 'super_admin',
    college_id: null,
    branch_id: null,
    is_active: true,
    must_change_password: false,
    created_at: new Date('2026-01-01').toISOString()
  },
  {
    id: '99999999-9999-9999-9999-999999999999',
    login_id: 'vimtech.principal',
    full_name: 'VIMTECH Branch Principal',
    role: 'branch_principal',
    college_id: '11111111-1111-1111-1111-111111111111',
    branch_id: '22222222-2222-2222-2222-222222222222',
    is_active: true,
    must_change_password: false,
    created_at: new Date('2026-01-01').toISOString()
  },
  {
    id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    login_id: 'vimtech.reception1',
    full_name: 'VIMTECH Front Desk Receptionist',
    role: 'receptionist',
    college_id: '11111111-1111-1111-1111-111111111111',
    branch_id: '22222222-2222-2222-2222-222222222222',
    is_active: true,
    must_change_password: false,
    created_at: new Date('2026-01-01').toISOString()
  }
];

export const INITIAL_HOSTS: Host[] = [];
export const INITIAL_VISITORS: Visitor[] = [];
export const INITIAL_VISITS: Visit[] = [];
export const INITIAL_BLACKLIST: BlacklistEntry[] = [];
export const INITIAL_AUDIT_LOGS: AuditLog[] = [];
