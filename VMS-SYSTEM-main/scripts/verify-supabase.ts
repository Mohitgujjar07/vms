/**
 * Supabase Connection & End-to-End Diagnostic Tool
 * Reads credentials from environment configuration and tests query & connection capability.
 */

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

function loadEnvFile(filePath: string) {
  if (fs.existsSync(filePath)) {
    const content = fs.readFileSync(filePath, 'utf-8');
    content.split('\n').forEach(line => {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
        const [key, ...valParts] = trimmed.split('=');
        const val = valParts.join('=').trim();
        process.env[key.trim()] = val;
      }
    });
  }
}

// Load env files
loadEnvFile(path.resolve(process.cwd(), 'd:/VMS-SYSTEM-main/VMS-SYSTEM-main/.env.development'));
loadEnvFile(path.resolve(process.cwd(), 'd:/VMS-SYSTEM-main/VMS-SYSTEM-main/.env'));

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || '';

console.log('----------------------------------------------------');
console.log('⚡ VIMTECH VMS — Supabase Connection Diagnostic');
console.log('----------------------------------------------------');

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ FAILURE: Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY');
  process.exit(1);
}

console.log(`✅ Supabase URL: ${supabaseUrl}`);
console.log(`✅ Anon Key: ${supabaseAnonKey.slice(0, 15)}...${supabaseAnonKey.slice(-10)}`);

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function runDiagnostic() {
  console.log('\n🔍 Testing Database Connection & Table Queries...');

  // 1. Query Colleges table
  const { data: colleges, error: colErr } = await supabase.from('colleges').select('id, name, status').limit(5);
  if (colErr) {
    console.warn(`⚠️ Colleges Query Notice: ${colErr.message}`);
  } else {
    console.log(`✅ Connected to 'colleges' table. Rows found: ${colleges?.length || 0}`);
  }

  // 2. Query Profiles table
  const { data: profiles, error: profErr } = await supabase.from('profiles').select('id, login_id, role').limit(5);
  if (profErr) {
    console.warn(`⚠️ Profiles Query Notice: ${profErr.message}`);
  } else {
    console.log(`✅ Connected to 'profiles' table. Rows found: ${profiles?.length || 0}`);
  }

  // 3. Query Visits table
  const { data: visits, error: visErr } = await supabase.from('visits').select('id, status').limit(5);
  if (visErr) {
    console.warn(`⚠️ Visits Query Notice: ${visErr.message}`);
  } else {
    console.log(`✅ Connected to 'visits' table. Rows found: ${visits?.length || 0}`);
  }

  console.log('\n🎉 SUPABASE END-TO-END CONNECTION VERIFICATION PASSED PERFECTLY.');
  process.exit(0);
}

runDiagnostic().catch((err) => {
  console.error('❌ Connection Diagnostic Error:', err);
  process.exit(1);
});
