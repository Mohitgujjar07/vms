/**
 * VMS Directory Service — College, Branch, Host, Profile management
 * Role hierarchy (Strict 3-Role Architecture):
 *   1. super_admin       → Platform Controller (Vidyavahini Group) - monitors everything
 *   2. branch_principal  → Branch Principal / Campus Administrator
 *   3. receptionist      → Front Desk Gate Staff (Visitor check-in/out & pass issuance)
 */

import { College, Branch, Host, Profile, CollegeProvisioningResult, ProvisionedCredential } from '../types';
import { supabase, isCloudReady, safeQuery, safeMutation } from './api/supabaseApi';
import { localDb } from '../offline/db';
import { auditService } from './auditService';
import { authService } from './authService';
import { eventBus } from './eventBus';
import { INITIAL_COLLEGES, INITIAL_BRANCHES, INITIAL_HOSTS } from './mockData';

class DirectoryService {
  private colleges: College[] = [...INITIAL_COLLEGES];
  private branches: Branch[] = [...INITIAL_BRANCHES];
  private hosts: Host[] = [...INITIAL_HOSTS];

  constructor() {
    this.setupRealtime();
  }

  private setupRealtime(): void {
    if (isCloudReady() && supabase) {
      try {
        supabase
          .channel('vms-realtime-directory')
          .on('postgres_changes', { event: '*', schema: 'public', table: 'hosts' }, () => {
            eventBus.emit('host:added');
            eventBus.emit('data:changed');
          })
          .on('postgres_changes', { event: '*', schema: 'public', table: 'branches' }, () => {
            eventBus.emit('branch:updated');
            eventBus.emit('data:changed');
          })
          .on('postgres_changes', { event: '*', schema: 'public', table: 'colleges' }, () => {
            eventBus.emit('college:updated');
            eventBus.emit('data:changed');
          })
          .subscribe();
      } catch (e) {
        console.warn('Supabase realtime directory subscription notice:', e);
      }
    }
  }

  // ─── COLLEGES ────────────────────────────────────────────────

  async getColleges(): Promise<College[]> {
    if (isCloudReady() && supabase) {
      try {
        const { data, error } = await supabase.from('colleges').select('*').order('name');
        if (data && !error && data.length > 0) {
          this.colleges = data as College[];
          try {
            await localDb.local_colleges.bulkPut(this.colleges);
          } catch (e) { /* silent */ }
          return this.colleges;
        }
      } catch (e) {
        console.warn('Supabase getColleges fallback:', e);
      }
    }
    return this.colleges;
  }

  async getCollegeById(id: string): Promise<College | undefined> {
    const local = this.colleges.find(c => c.id === id);
    if (local) return local;
    if (isCloudReady() && supabase) {
      try {
        const { data } = await supabase.from('colleges').select('*').eq('id', id).single();
        if (data) return data as College;
      } catch (e) { /* silent */ }
    }
    return undefined;
  }

  /**
   * Auto-Provisioning Flow — Atomically creates:
   * 1. College record
   * 2. Default branch
   * 3. Two accounts: Branch Principal and Receptionist
   * Returns all generated credentials for the Super Admin to hand off.
   */
  async onboardNewCollege(data: {
    collegeName: string;
    displayName: string;
    tagline?: string;
    logoUrl?: string;
    branchName: string;
    branchAddress: string;
    address?: string;
    contactPhone?: string;
    contactEmail?: string;
    principalPassword?: string;
    receptionistPassword?: string;
  }): Promise<CollegeProvisioningResult> {
    const collegeId = `col-${Date.now()}`;
    const branchId = `br-${Date.now()}`;
    const code = data.displayName.toLowerCase().replace(/[^a-z0-9]/g, '');
    const defaultPassword = `${data.displayName}@2026`;

    const college: College = {
      id: collegeId,
      name: data.collegeName,
      display_name: data.displayName,
      tagline: data.tagline || 'VIDYAVAHINI GROUP',
      logo_url: data.logoUrl || undefined,
      status: 'active',
      created_at: new Date().toISOString(),
      address: data.address || data.branchAddress,
      contact_phone: data.contactPhone,
      contact_email: data.contactEmail
    };

    const branch: Branch = {
      id: branchId,
      college_id: collegeId,
      name: data.branchName,
      address: data.branchAddress,
      timezone: 'Asia/Kolkata',
      max_visitors_inside: 100,
      created_at: new Date().toISOString()
    };

    // Auto-generate 2 accounts with custom or default passwords
    const accountDefs: { role: Profile['role']; loginId: string; fullName: string; branchId: string | null; tempPw: string }[] = [
      {
        role: 'branch_principal',
        loginId: `${code}.principal`,
        fullName: `${data.displayName} Branch Principal`,
        branchId: branchId,
        tempPw: data.principalPassword?.trim() || defaultPassword
      },
      {
        role: 'receptionist',
        loginId: `${code}.reception1`,
        fullName: `${data.displayName} Front Desk`,
        branchId: branchId,
        tempPw: data.receptionistPassword?.trim() || defaultPassword
      }
    ];

    const credentials: ProvisionedCredential[] = [];
    const profiles: Profile[] = [];

    for (const acct of accountDefs) {
      let profileId = crypto.randomUUID();

      if (isCloudReady() && supabase) {
        try {
          const email = `${acct.loginId.toLowerCase()}@vms.internal`;
          const { data: signUpData } = await supabase.auth.signUp({
            email,
            password: acct.tempPw,
            options: {
              data: {
                full_name: acct.fullName,
                role: acct.role,
                college_id: collegeId,
                branch_id: acct.branchId
              }
            }
          });
          if (signUpData?.user?.id) {
            profileId = signUpData.user.id;
          }
        } catch (err) {
          console.warn('Supabase signUp during provisioning notice:', err);
        }
      }

      const profile: Profile = {
        id: profileId,
        login_id: acct.loginId,
        full_name: acct.fullName,
        role: acct.role,
        college_id: collegeId,
        branch_id: acct.branchId,
        is_active: true,
        must_change_password: true,
        created_at: new Date().toISOString()
      };
      profiles.push(profile);
      credentials.push({
        role: acct.role,
        login_id: acct.loginId,
        temp_password: acct.tempPw,
        full_name: acct.fullName
      });

      // Merge profile with temp password into authService & localStorage
      authService.mergeProfile(profile, acct.tempPw);
    }

    // Store locally
    this.colleges.push(college);
    this.branches.push(branch);

    // Persist to local IndexedDB
    try {
      await localDb.local_colleges.put(college);
      await localDb.local_branches.put(branch);
    } catch (e) { /* silent */ }

    // Persist to Supabase Cloud Database if connected
    if (isCloudReady() && supabase) {
      await safeMutation(
        () => supabase!.from('colleges').insert({
          id: college.id,
          name: college.name,
          display_name: college.display_name,
          tagline: college.tagline,
          logo_url: college.logo_url,
          status: college.status,
          address: college.address,
          contact_phone: college.contact_phone,
          contact_email: college.contact_email,
          created_at: college.created_at
        }),
        'insert college tenant'
      );

      await safeMutation(
        () => supabase!.from('branches').insert({
          id: branch.id,
          college_id: branch.college_id,
          name: branch.name,
          address: branch.address,
          timezone: branch.timezone,
          max_visitors_inside: branch.max_visitors_inside,
          created_at: branch.created_at
        }),
        'insert branch'
      );

      for (const p of profiles) {
        await safeMutation(
          () => supabase!.from('profiles').upsert({
            id: p.id,
            login_id: p.login_id,
            full_name: p.full_name,
            role: p.role,
            college_id: p.college_id,
            branch_id: p.branch_id,
            is_active: p.is_active,
            must_change_password: p.must_change_password,
            created_at: p.created_at
          }),
          `upsert ${p.role} profile`
        );
      }
    }

    await auditService.logAudit(
      'super-admin', 'Super Admin', 'onboard_college', 'platform',
      { college_name: data.collegeName, accounts_created: credentials.map(c => c.login_id) }
    );
    eventBus.emit('college:updated', { action: 'onboard', collegeId });

    return { college, branch, credentials };
  }

  async toggleCollegeStatus(collegeId: string, status: 'active' | 'suspended'): Promise<void> {
    const col = this.colleges.find(c => c.id === collegeId);
    if (col) {
      col.status = status;
      if (isCloudReady() && supabase) {
        await safeMutation(
          () => supabase!.from('colleges').update({ status }).eq('id', collegeId),
          'update college status'
        );
      }
      await auditService.logAudit(
        'super-admin', 'Super Admin',
        status === 'suspended' ? 'suspend_college' : 'reactivate_college',
        'platform', { college_id: collegeId }
      );
      eventBus.emit('college:updated', { action: status, collegeId });
    }
  }

  async updateCollegeLogo(collegeId: string, logoUrl: string): Promise<void> {
    const col = this.colleges.find(c => c.id === collegeId);
    if (col) {
      col.logo_url = logoUrl;
      try {
        await localDb.local_colleges.put(col);
      } catch (e) { /* silent */ }

      if (isCloudReady() && supabase) {
        await safeMutation(
          () => supabase!.from('colleges').update({ logo_url: logoUrl }).eq('id', collegeId),
          'update college logo'
        );
      }

      await auditService.logAudit(
        'super-admin', 'Super Admin',
        `Updated logo for college ${col.display_name}`, 'platform',
        { college_id: collegeId }
      );
      eventBus.emit('college:updated', { action: 'logo_update', collegeId });
    }
  }

  /**
   * Soft-delete college — sets status to 'suspended', never hard-deletes.
   * Historical visits, audit logs, and staff profiles remain intact and attributable.
   */
  async deleteCollege(collegeId: string): Promise<boolean> {
    const col = this.colleges.find(c => c.id === collegeId);
    if (col) {
      col.status = 'suspended';
      if (isCloudReady() && supabase) {
        await safeMutation(
          () => supabase!.from('colleges').update({ status: 'suspended' }).eq('id', collegeId),
          'soft-delete college tenant'
        );
      }
      await auditService.logAudit(
        'super-admin', 'Super Admin',
        `Suspended college tenant ${col.display_name}`, 'platform',
        { college_id: collegeId }
      );
      eventBus.emit('college:updated', { action: 'suspended', collegeId });
      return true;
    }
    return false;
  }

  async updateCollege(collegeId: string, updates: Partial<College>): Promise<College> {
    const col = this.colleges.find(c => c.id === collegeId);
    if (!col) throw new Error('College not found');

    Object.assign(col, updates);
    try {
      await localDb.local_colleges.put(col);
    } catch (e) { /* silent */ }

    if (isCloudReady() && supabase) {
      await safeMutation(
        () => supabase!.from('colleges').update({
          name: col.name,
          display_name: col.display_name,
          tagline: col.tagline,
          logo_url: col.logo_url,
          status: col.status,
          address: col.address,
          contact_phone: col.contact_phone,
          contact_email: col.contact_email
        }).eq('id', collegeId),
        'update college tenant details'
      );
    }

    await auditService.logAudit('super-admin', 'Super Admin', `Updated college details for ${col.display_name}`, 'platform', { college_id: collegeId, updates });
    eventBus.emit('college:updated', { action: 'update', collegeId });
    return col;
  }

  // ─── BRANCHES ────────────────────────────────────────────────

  async getBranches(collegeId?: string): Promise<Branch[]> {
    if (isCloudReady() && supabase) {
      try {
        let query = supabase.from('branches').select('*').order('name');
        if (collegeId) {
          query = query.eq('college_id', collegeId);
        }
        const { data, error } = await query;
        if (data && !error && data.length > 0) {
          const cloudBranches = data as Branch[];
          cloudBranches.forEach(cb => {
            const idx = this.branches.findIndex(b => b.id === cb.id);
            if (idx !== -1) this.branches[idx] = cb;
            else this.branches.push(cb);
          });
          try {
            await localDb.local_branches.bulkPut(cloudBranches);
          } catch (e) { /* silent */ }
        }
      } catch (e) {
        console.warn('Supabase getBranches fallback:', e);
      }
    }
    if (!collegeId) return this.branches;
    const filtered = this.branches.filter(b => b.college_id === collegeId);
    return filtered.length > 0 ? filtered : this.branches;
  }

  async getBranchById(id: string): Promise<Branch | undefined> {
    const local = this.branches.find(b => b.id === id);
    if (local) return local;
    if (isCloudReady() && supabase) {
      try {
        const { data } = await supabase.from('branches').select('*').eq('id', id).single();
        if (data) return data as Branch;
      } catch (e) { /* silent */ }
    }
    return undefined;
  }

  async createBranch(
    collegeIdOrObj: string | { college_id?: string; collegeId?: string; name: string; address?: string; max_visitors_inside?: number; maxVisitors?: number },
    name?: string,
    address?: string,
    maxVisitors?: number
  ): Promise<Branch> {
    let collegeId = '';
    let bName = '';
    let bAddr = '';
    let bMax = 100;

    if (typeof collegeIdOrObj === 'object' && collegeIdOrObj !== null) {
      collegeId = collegeIdOrObj.college_id || collegeIdOrObj.collegeId || '';
      bName = collegeIdOrObj.name || '';
      bAddr = collegeIdOrObj.address || '';
      bMax = collegeIdOrObj.max_visitors_inside || collegeIdOrObj.maxVisitors || 100;
    } else {
      collegeId = collegeIdOrObj as string;
      bName = name || '';
      bAddr = address || '';
      bMax = maxVisitors || 100;
    }

    const branch: Branch = {
      id: `br-${Date.now()}`,
      college_id: collegeId,
      name: bName,
      address: bAddr,
      timezone: 'Asia/Kolkata',
      max_visitors_inside: bMax,
      created_at: new Date().toISOString()
    };
    this.branches.push(branch);
    await localDb.local_hosts.clear(); // trigger sync refresh

    if (isCloudReady() && supabase) {
      await safeMutation(
        () => supabase!.from('branches').insert({
          id: branch.id,
          college_id: branch.college_id,
          name: branch.name,
          address: branch.address,
          timezone: branch.timezone,
          max_visitors_inside: branch.max_visitors_inside,
          created_at: branch.created_at
        }),
        'insert branch'
      );
    }

    eventBus.emit('branch:updated', { action: 'create', branchId: branch.id });
    return branch;
  }

  async deleteBranch(branchId: string): Promise<boolean> {
    const index = this.branches.findIndex(b => b.id === branchId);
    if (index !== -1) {
      const deleted = this.branches[index];
      this.branches.splice(index, 1);

      if (isCloudReady() && supabase) {
        await safeMutation(
          () => supabase!.from('branches').delete().eq('id', branchId),
          'delete branch'
        );
      }

      await auditService.logAudit('admin', 'Admin', `Deleted branch ${deleted.name}`, 'college', { branch_id: branchId });
      eventBus.emit('branch:updated', { action: 'delete', branchId });
      return true;
    }
    return false;
  }

  // ─── HOST DIRECTORY ──────────────────────────────────────────

  async getHosts(branchId: string): Promise<Host[]> {
    if (isCloudReady() && supabase) {
      try {
        const { data, error } = await supabase.from('hosts').select('*').eq('branch_id', branchId).order('name');
        if (data && !error && data.length > 0) {
          const cloudHosts = data as Host[];
          cloudHosts.forEach(ch => {
            const idx = this.hosts.findIndex(h => h.id === ch.id);
            if (idx !== -1) this.hosts[idx] = ch;
            else this.hosts.push(ch);
          });
          try {
            await localDb.local_hosts.bulkPut(cloudHosts);
          } catch (e) { /* silent */ }
          return this.hosts.filter(h => h.branch_id === branchId);
        }
      } catch (e) {
        console.warn('Supabase getHosts fallback:', e);
      }
    }
    return this.hosts.filter(h => h.branch_id === branchId);
  }

  async addHost(
    branchIdOrObj: string | { branch_id?: string; branchId?: string; college_id?: string; name: string; type: 'staff' | 'student'; department_or_class?: string; department?: string },
    name?: string,
    type?: 'staff' | 'student',
    department?: string
  ): Promise<Host> {
    let branchId = '';
    let hName = '';
    let hType: 'staff' | 'student' = 'staff';
    let hDept = '';

    if (typeof branchIdOrObj === 'object' && branchIdOrObj !== null) {
      branchId = branchIdOrObj.branch_id || branchIdOrObj.branchId || '';
      hName = branchIdOrObj.name || '';
      hType = branchIdOrObj.type || 'staff';
      hDept = branchIdOrObj.department_or_class || branchIdOrObj.department || '';
    } else {
      branchId = branchIdOrObj as string;
      hName = name || '';
      hType = type || 'staff';
      hDept = department || '';
    }

    const newHost: Host = {
      id: `host-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      branch_id: branchId,
      name: hName,
      type: hType,
      department_or_class: hDept,
      created_at: new Date().toISOString()
    };
    this.hosts.push(newHost);
    await localDb.local_hosts.put(newHost);

    if (isCloudReady() && supabase) {
      await safeMutation(
        () => supabase!.from('hosts').insert({
          id: newHost.id,
          branch_id: newHost.branch_id,
          name: newHost.name,
          type: newHost.type,
          department_or_class: newHost.department_or_class,
          created_at: newHost.created_at
        }),
        'insert host'
      );
    }

    eventBus.emit('host:added', { hostId: newHost.id, branchId });
    return newHost;
  }

  async importHostsFromCsv(branchId: string, csvText: string): Promise<{ importedCount: number; errors: string[] }> {
    if (!csvText || csvText.length > 5 * 1024 * 1024) {
      return { importedCount: 0, errors: ['CSV file exceeds 5MB size limit.'] };
    }

    const lines = csvText.split(/\r?\n/).filter(line => line.trim().length > 0);
    if (lines.length > 5000) {
      return { importedCount: 0, errors: ['CSV batch exceeds 5,000 rows limit. Please import in smaller batches.'] };
    }

    let count = 0;
    const errors: string[] = [];

    const parseCsvLine = (text: string): string[] => {
      const result: string[] = [];
      let cur = '';
      let inQuotes = false;
      for (let i = 0; i < text.length; i++) {
        const char = text[i];
        if (char === '"' || char === "'") {
          inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
          result.push(cur.trim().replace(/^["']|["']$/g, ''));
          cur = '';
        } else {
          cur += char;
        }
      }
      if (cur.trim() || result.length > 0) {
        result.push(cur.trim().replace(/^["']|["']$/g, ''));
      }
      return result;
    };

    const startIndex = lines[0].toLowerCase().includes('name') ? 1 : 0;

    for (let i = startIndex; i < lines.length; i++) {
      const line = lines[i];
      const parts = parseCsvLine(line);
      if (parts.length >= 3 && parts[0]) {
        // Sanitize name, type, and department against script tags and formula injection
        const rawName = parts[0].replace(/^[=+@-]/, '').replace(/[<>&"'/]/g, '').trim().slice(0, 100);
        const rawType = parts[1].toLowerCase();
        const hostType: 'staff' | 'student' = rawType.includes('student') ? 'student' : 'staff';
        const dept = (parts[2] || 'General').replace(/^[=+@-]/, '').replace(/[<>&"'/]/g, '').trim().slice(0, 80);

        if (rawName.length > 0) {
          await this.addHost(branchId, rawName, hostType, dept);
          count++;
        }
      } else {
        errors.push(`Line ${i + 1}: Insufficient columns (expected: Name, Type, Department)`);
      }
    }

    await auditService.logAudit('principal', 'Branch Principal', 'csv_host_import', 'branch', { imported_count: count, branch_id: branchId });
    eventBus.emit('host:imported', { count, branchId });
    return { importedCount: count, errors };
  }

  // ─── STAFF & PROFILES ────────────────────────────────────────

  async getProfilesByCollege(collegeId: string): Promise<Profile[]> {
    return authService.getProfiles().filter(p => p.college_id === collegeId);
  }

  async getCollegeProfiles(collegeId: string): Promise<Profile[]> {
    return this.getProfilesByCollege(collegeId);
  }

  async getBranchStaff(branchId: string): Promise<Profile[]> {
    return authService.getProfiles().filter(p => p.branch_id === branchId && p.role === 'receptionist');
  }

  async createReceptionist(branchId: string, collegeId: string, loginId: string, fullName: string): Promise<Profile> {
    return this.createStaffAccount({
      login_id: loginId,
      full_name: fullName,
      role: 'receptionist',
      college_id: collegeId,
      branch_id: branchId
    });
  }

  async createBranchPrincipal(branchId: string, collegeId: string, loginId: string, fullName: string): Promise<Profile> {
    return this.createStaffAccount({
      login_id: loginId,
      full_name: fullName,
      role: 'branch_principal',
      college_id: collegeId,
      branch_id: branchId
    });
  }

  async createStaffAccount(data: {
    login_id: string;
    full_name: string;
    role: Profile['role'];
    college_id?: string;
    branch_id?: string;
    password?: string;
  }): Promise<Profile> {
    let profileId = crypto.randomUUID();
    const tempPw = data.password?.trim() || 'Vms@2026';

    if (isCloudReady() && supabase) {
      try {
        const email = `${data.login_id.toLowerCase()}@vms.internal`;
        const { data: signUpData } = await supabase.auth.signUp({
          email,
          password: tempPw,
          options: {
            data: {
              full_name: data.full_name,
              role: data.role,
              college_id: data.college_id || null,
              branch_id: data.branch_id || null
            }
          }
        });
        if (signUpData?.user?.id) {
          profileId = signUpData.user.id;
        }
      } catch (err) {
        console.warn('Supabase signUp during createStaffAccount notice:', err);
      }
    }

    const newProfile: Profile = {
      id: profileId,
      login_id: data.login_id,
      full_name: data.full_name,
      role: data.role || 'receptionist',
      college_id: data.college_id || null,
      branch_id: data.branch_id || null,
      is_active: true,
      must_change_password: true,
      created_at: new Date().toISOString()
    };
    authService.mergeProfile(newProfile, tempPw);

    if (isCloudReady() && supabase) {
      await safeMutation(
        () => supabase!.from('profiles').upsert({
          id: newProfile.id,
          login_id: newProfile.login_id,
          full_name: newProfile.full_name,
          role: newProfile.role,
          college_id: newProfile.college_id,
          branch_id: newProfile.branch_id,
          is_active: newProfile.is_active,
          must_change_password: newProfile.must_change_password,
          created_at: newProfile.created_at
        }),
        'upsert new staff profile'
      );
    }

    await auditService.logAudit(newProfile.id, data.full_name, 'account_created', data.branch_id ? 'branch' : 'college', { role: data.role, branch_id: data.branch_id });
    eventBus.emit('profile:updated', { action: 'create', profileId: newProfile.id });
    return newProfile;
  }

  async toggleAccountActive(profileId: string, isActive: boolean): Promise<void> {
    const profile = authService.getProfiles().find(p => p.id === profileId);
    if (profile) {
      profile.is_active = isActive;
      await auditService.logAudit(profile.id, profile.full_name, isActive ? 'account_activated' : 'account_deactivated', 'branch');
      eventBus.emit('profile:updated', { action: 'toggle', profileId });
    }
  }

  async toggleStaffStatus(profileId: string): Promise<Profile> {
    const profile = authService.getProfiles().find(p => p.id === profileId);
    if (!profile) throw new Error("Staff profile not found");
    profile.is_active = !profile.is_active;
    await auditService.logAudit(profile.id, profile.full_name, 'toggle_staff_status', 'branch', { profile_id: profileId, is_active: profile.is_active });
    eventBus.emit('profile:updated', { action: 'toggle', profileId });
    return profile;
  }

  async updateBranch(branchId: string, updates: Partial<Branch>): Promise<Branch> {
    const branch = this.branches.find(b => b.id === branchId);
    if (!branch) throw new Error('Branch not found');

    Object.assign(branch, updates);
    try {
      await localDb.local_branches.put(branch);
    } catch (e) { /* silent */ }

    if (isCloudReady() && supabase) {
      await safeMutation(
        () => supabase!.from('branches').update({
          name: branch.name,
          address: branch.address,
          timezone: branch.timezone,
          max_visitors_inside: branch.max_visitors_inside
        }).eq('id', branchId),
        'update branch'
      );
    }

    await auditService.logAudit('super-admin', 'Super Admin', `Updated branch ${branch.name}`, 'college', { branch_id: branchId, updates });
    eventBus.emit('branch:updated', { action: 'update', branchId });
    return branch;
  }

  /**
   * Get all user accounts associated with a college, including active passwords & branch names
   */
  async getCollegeAccountsWithCredentials(collegeId: string): Promise<Array<Profile & { password?: string; branchName?: string }>> {
    const profiles = authService.getProfiles().filter(p => p.college_id === collegeId);
    const college = this.colleges.find(c => c.id === collegeId);
    const defaultPw = college ? `${college.display_name}@2026` : 'Vimtech@2026';

    return profiles.map(p => {
      const branch = p.branch_id ? this.branches.find(b => b.id === p.branch_id) : undefined;
      const pw = authService.getPasswordForUser(p.login_id, defaultPw);
      return {
        ...p,
        password: pw,
        branchName: branch?.name || 'All Campuses / Platform'
      };
    });
  }

  /**
   * Get all user accounts across entire platform with credentials and tenant metadata
   */
  async getAllAccountsWithCredentials(): Promise<Array<Profile & { password?: string; collegeName?: string; branchName?: string }>> {
    const profiles = authService.getProfiles();

    return profiles.map(p => {
      const college = p.college_id ? this.colleges.find(c => c.id === p.college_id) : undefined;
      const branch = p.branch_id ? this.branches.find(b => b.id === p.branch_id) : undefined;
      const defaultPw = college ? `${college.display_name}@2026` : 'Vimtech@2026';
      const pw = authService.getPasswordForUser(p.login_id, defaultPw);

      return {
        ...p,
        password: pw,
        collegeName: college?.display_name || (p.role === 'super_admin' ? 'Vidyavahini Group' : 'Unassigned'),
        branchName: branch?.name || 'All Campuses / Platform'
      };
    });
  }

  /**
   * Admin sets/resets a password for any user account
   */
  async adminSetUserPassword(profileId: string, newPassword: string): Promise<boolean> {
    return authService.adminSetPassword(profileId, newPassword);
  }

  /**
   * Admin deletes a staff profile
   */
  async deleteUserAccount(profileId: string): Promise<boolean> {
    return authService.deleteProfile(profileId);
  }

  /**
   * Admin updates user account profile details
   */
  async updateUserAccount(profileId: string, updates: Partial<Profile>): Promise<Profile> {
    return authService.updateProfile(profileId, updates);
  }

  // ─── STATE ACCESS (used by other services) ───────────────────

  getBranchesArray(): Branch[] {
    return this.branches;
  }

  getHostsArray(): Host[] {
    return this.hosts;
  }

  getCollegesArray(): College[] {
    return this.colleges;
  }

  findHost(hostId: string): Host | undefined {
    return this.hosts.find(h => h.id === hostId);
  }

  findBranch(branchId: string): Branch | undefined {
    return this.branches.find(b => b.id === branchId);
  }
}

export const directoryService = new DirectoryService();
