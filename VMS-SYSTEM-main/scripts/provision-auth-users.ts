/**
 * Provision Auth Users Script for Supabase VMS
 * Creates initial 4 auth users in Supabase Auth via Service Role API.
 * Uses synthetic email mapping ({loginId}@vimtech.in) for username-only login.
 * 
 * Usage:
 *   npx ts-node scripts/provision-auth-users.ts
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load .env file
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const serviceRoleKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!supabaseUrl || !serviceRoleKey) {
  console.error('❌ Error: VITE_SUPABASE_URL and VITE_SUPABASE_SERVICE_ROLE_KEY must be set in .env');
  console.log('Provide your Supabase Service Role Key in .env to run user provisioning.');
  process.exit(1);
}

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

interface ProvisionUser {
  loginId: string;
  fullName: string;
  role: string;
  collegeId?: string;
  branchId?: string;
}

const USERS_TO_PROVISION: ProvisionUser[] = [
  {
    loginId: 'super.admin',
    fullName: 'Platform Controller (Vidyavahini Group)',
    role: 'super_admin'
  },
  {
    loginId: 'vimtech.principal',
    fullName: 'Dr. Ramesh Kumar (Principal)',
    role: 'branch_principal',
    collegeId: '11111111-1111-1111-1111-111111111111',
    branchId: '22222222-2222-2222-2222-222222222222'
  },
  {
    loginId: 'vimtech.reception1',
    fullName: 'Meena Sharma (Front Desk)',
    role: 'receptionist',
    collegeId: '11111111-1111-1111-1111-111111111111',
    branchId: '22222222-2222-2222-2222-222222222222'
  }
];

const DEFAULT_PASSWORD = 'Vimtech@2026';

async function provisionUsers() {
  console.log('🚀 Provisioning VMS initial auth users on Supabase...');

  for (const u of USERS_TO_PROVISION) {
    const email = `${u.loginId}@vimtech.in`;
    console.log(`\nProcessing: ${u.loginId} (${email})...`);

    // Check if user already exists
    const { data: existingList } = await supabaseAdmin.auth.admin.listUsers();
    const existing = existingList?.users?.find(usr => usr.email?.toLowerCase() === email.toLowerCase());

    let userId = existing?.id;

    if (existing) {
      console.log(`  ✓ Auth user already exists with ID: ${userId}`);
    } else {
      // Create new user in auth.users
      const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
        email,
        password: DEFAULT_PASSWORD,
        email_confirm: true,
        user_metadata: {
          login_id: u.loginId,
          full_name: u.fullName,
          role: u.role
        }
      });

      if (createErr) {
        console.error(`  ❌ Failed to create auth user ${email}:`, createErr.message);
        continue;
      }

      userId = created.user.id;
      console.log(`  ✅ Created auth user with ID: ${userId}`);
    }

    // Upsert into public.profiles table
    if (userId) {
      const { error: profileErr } = await supabaseAdmin
        .from('profiles')
        .upsert({
          id: userId,
          login_id: u.loginId,
          full_name: u.fullName,
          role: u.role,
          college_id: u.collegeId || null,
          branch_id: u.branchId || null,
          is_active: true,
          must_change_password: true
        });

      if (profileErr) {
        console.error(`  ❌ Failed to upsert profile for ${u.loginId}:`, profileErr.message);
      } else {
        console.log(`  ✅ Profile upserted successfully.`);
      }
    }
  }

  console.log('\n✨ Provisioning complete! All users can log in with their Login ID and default password: Vimtech@2026');
}

provisionUsers().catch(err => {
  console.error('Fatal provisioning error:', err);
  process.exit(1);
});
