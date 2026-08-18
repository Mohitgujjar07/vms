import Dexie, { Table } from 'dexie';
import { College, Branch, Visit, Visitor, Host, BlacklistEntry } from '../types';

export interface PendingSyncItem {
  id: string;
  type: 'check_in' | 'check_out' | 'add_host' | 'add_blacklist' | 'add_sos';
  payload: any;
  status: 'pending' | 'synced' | 'failed';
  retry_count: number;
  error_message?: string;
  created_at: string;
}

export class VmsLocalDatabase extends Dexie {
  local_colleges!: Table<College>;
  local_branches!: Table<Branch>;
  local_visits!: Table<Visit>;
  local_visitors!: Table<Visitor>;
  local_hosts!: Table<Host>;
  local_blacklist!: Table<BlacklistEntry>;
  sync_queue!: Table<PendingSyncItem>;

  constructor() {
    super('VmsOfflineDatabase');
    
    this.version(1).stores({
      local_colleges: 'id, name, status',
      local_branches: 'id, college_id, name',
      local_visits: 'id, visitor_phone, branch_id, status, check_in_time, synced_at',
      local_visitors: 'id, phone, name',
      local_hosts: 'id, branch_id, name, type',
      local_blacklist: 'id, visitor_phone, branch_id, college_id',
      sync_queue: 'id, status, created_at'
    });
  }
}

export const localDb = new VmsLocalDatabase();
