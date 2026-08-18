export type UserRole = 'super_admin' | 'branch_principal' | 'receptionist';

export type CollegeStatus = 'active' | 'suspended';
export type VisitStatus = 'inside' | 'checked_out';
export type HostType = 'staff' | 'student';
export type BlacklistScope = 'branch' | 'college';
export type SyncState = 'synced' | 'pending' | 'failed';

export interface College {
  id: string;
  name: string;
  display_name: string;
  tagline?: string;
  logo_url?: string;
  status: CollegeStatus;
  created_at: string;
  
  // College identity — used in visitor passes & PDF report headers only
  address?: string;
  contact_phone?: string;
  contact_email?: string;
  affiliations?: string[];
}

export interface Branch {
  id: string;
  college_id: string;
  name: string;
  address: string;
  timezone: string;
  max_visitors_inside?: number | null;
  created_at: string;
}

export interface Profile {
  id: string;
  login_id: string;
  full_name: string;
  role: UserRole;
  college_id?: string | null;
  branch_id?: string | null;
  is_active: boolean;
  must_change_password: boolean;
  created_at: string;
}

export interface Host {
  id: string;
  branch_id: string;
  name: string;
  type: HostType;
  department_or_class: string;
  created_at: string;
}

export interface Visitor {
  id: string;
  name: string;
  phone: string;
  photo_url?: string;
  created_at: string;
}

export interface Visit {
  id: string;
  visitor_id: string;
  branch_id: string;
  host_id: string;
  purpose: string;
  status: VisitStatus;
  qr_token: string;
  qr_expires_at: string;
  qr_used: boolean;
  check_in_time: string;
  check_out_time?: string | null;
  created_by?: string;
  synced_at?: string | null;
  created_at: string;
  
  // Populated helper attributes for UI
  visitor_name?: string;
  visitor_phone?: string;
  visitor_photo_url?: string;
  host_name?: string;
  host_department?: string;
  sync_status?: SyncState;
  category?: string;
  is_pre_registered?: boolean;
  expected_arrival_time?: string;
  rating?: number | null;
  feedback_comment?: string | null;
}

export interface BlacklistEntry {
  id: string;
  scope: BlacklistScope;
  branch_id?: string | null;
  college_id?: string | null;
  visitor_phone: string;
  reason: string;
  created_by?: string;
  created_at: string;
  escalated_to_college?: boolean;
}

export interface AuditLog {
  id: string;
  actor_id?: string;
  actor_name?: string;
  action: string;
  scope: 'branch' | 'college' | 'platform';
  metadata?: Record<string, any>;
  created_at: string;
}

export interface EmergencySosAlert {
  id: string;
  branch_id: string;
  branch_name: string;
  receptionist_id: string;
  receptionist_name: string;
  message: string;
  created_at: string;
  is_active: boolean;
}

/** Result returned after atomic college auto-provisioning */
export interface ProvisionedCredential {
  role: UserRole;
  login_id: string;
  temp_password: string;
  full_name: string;
}

export interface CollegeProvisioningResult {
  college: College;
  branch: Branch;
  credentials: ProvisionedCredential[];
}
