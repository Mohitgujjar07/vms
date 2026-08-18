import React, { useState, useEffect, useRef } from 'react';
import { Profile, College, Branch, AuditLog, Visit, CollegeProvisioningResult } from '../../types';
import { vmsService } from '../../services/vmsService';
import { VimtechLogo } from '../VimtechLogo';
import { ReportExporter } from '../reports/ReportExporter';
import { compressImageDataUrl } from '../../utils/imageCompressor';
import {
  Globe, Building2, Plus, ArrowRight, CheckCircle2, History, BarChart3, Shield,
  RefreshCw, Trash2, ChevronDown, ChevronUp, MapPin, Clock, FileText, Users,
  Activity, TrendingUp, Award, Trophy, Flame, Copy, Eye, EyeOff, Star, MessageSquare,
  ShieldAlert, Key, Lock, Unlock, Edit3, UserPlus, Download, Check, AlertCircle, X, Search,
  Camera, Upload, Image as ImageIcon, Phone, Mail, Sparkles, Loader2, Info
} from 'lucide-react';

interface SuperAdminDashboardProps {
  profile: Profile;
  college?: College;
}

export const SuperAdminDashboard: React.FC<SuperAdminDashboardProps> = ({ profile, college: initialCollege }) => {
  const [activeTab, setActiveTab] = useState<'colleges' | 'credentials' | 'ranking' | 'onboard' | 'audit' | 'feedback'>('colleges');
  const [colleges, setColleges] = useState<College[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [allVisits, setAllVisits] = useState<Visit[]>([]);
  const [expandedCollegeId, setExpandedCollegeId] = useState<string | null>(null);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [healthMetrics, setHealthMetrics] = useState<{
    stuckSyncCount: number;
    failedLogins24h: number;
    activeSosCount: number;
    cloudLatencyMs: number;
    cloudStatus: 'healthy' | 'degraded' | 'offline';
  }>({
    stuckSyncCount: 0,
    failedLogins24h: 0,
    activeSosCount: 0,
    cloudLatencyMs: 0,
    cloudStatus: 'healthy'
  });

  // All Accounts State with Credentials
  const [allAccounts, setAllAccounts] = useState<Array<Profile & { password?: string; collegeName?: string; branchName?: string }>>([]);

  // College Photo / Logo Management State
  const [photoModalCollege, setPhotoModalCollege] = useState<College | null>(null);
  const [photoModalPreview, setPhotoModalPreview] = useState<string>('');
  const [photoModalUrlInput, setPhotoModalUrlInput] = useState<string>('');
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [uploadSuccessMessage, setUploadSuccessMessage] = useState<string | null>(null);

  // College Credentials Modal State
  const [selectedCollegeForCredentials, setSelectedCollegeForCredentials] = useState<College | null>(null);
  const [collegeAccounts, setCollegeAccounts] = useState<Array<Profile & { password?: string; branchName?: string }>>([]);
  const [showPasswordMap, setShowPasswordMap] = useState<Record<string, boolean>>({});
  const [editingPasswordUserId, setEditingPasswordUserId] = useState<string | null>(null);
  const [newPasswordInput, setNewPasswordInput] = useState('');
  const [passwordSuccessUserId, setPasswordSuccessUserId] = useState<string | null>(null);

  // Add Staff Modal State (within College)
  const [isAddStaffOpen, setIsAddStaffOpen] = useState(false);
  const [newStaffForm, setNewStaffForm] = useState({
    login_id: '',
    full_name: '',
    role: 'receptionist' as 'branch_principal' | 'receptionist',
    branch_id: '',
    password: ''
  });
  const [staffCreateError, setStaffCreateError] = useState<string | null>(null);

  // Edit College Modal State
  const [editingCollege, setEditingCollege] = useState<College | null>(null);
  const [isSavingEditCollege, setIsSavingEditCollege] = useState(false);
  const [editCollegeForm, setEditCollegeForm] = useState({
    name: '',
    display_name: '',
    tagline: '',
    address: '',
    contact_phone: '',
    contact_email: '',
    logo_url: '',
    status: 'active' as 'active' | 'suspended'
  });

  // Add Branch Modal State
  const [addBranchCollege, setAddBranchCollege] = useState<College | null>(null);
  const [addBranchForm, setAddBranchForm] = useState({
    name: '',
    address: '',
    max_visitors_inside: 100
  });

  // Credentials Search & Filters
  const [credSearchTerm, setCredSearchTerm] = useState('');
  const [credCollegeFilter, setCredCollegeFilter] = useState('all');
  const [credRoleFilter, setCredRoleFilter] = useState('all');

  // Multi-Tenant Isolation Filters
  const [auditCollegeFilter, setAuditCollegeFilter] = useState<string>('all');
  const [feedbackCollegeFilter, setFeedbackCollegeFilter] = useState<string>('all');

  // Onboard Form State (2-Account Provisioning: Principal & Receptionist)
  const [collegeName, setCollegeName] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [tagline, setTagline] = useState('VIDYAVAHINI GROUP');
  const [logoUrl, setLogoUrl] = useState('');
  const [branchName, setBranchName] = useState('Main Campus');
  const [branchAddress, setBranchAddress] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [principalPassword, setPrincipalPassword] = useState('');
  const [receptionistPassword, setReceptionistPassword] = useState('');
  const [onboardResult, setOnboardResult] = useState<CollegeProvisioningResult | null>(null);
  const [onboardError, setOnboardError] = useState<string | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [isOnboardingLoading, setIsOnboardingLoading] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const fetchedColleges = await vmsService.getColleges();
    const fetchedBranches = await vmsService.getBranches();
    const fetchedLogs = await vmsService.getAuditLogs();
    const fetchedVisits = await vmsService.getVisits();
    const fetchedHealth = await vmsService.getSystemHealthMetrics();
    const fetchedAccounts = await vmsService.getAllAccountsWithCredentials();

    setColleges(fetchedColleges);
    setBranches(fetchedBranches);
    setAuditLogs(fetchedLogs);
    setAllVisits(fetchedVisits);
    setHealthMetrics(fetchedHealth);
    setAllAccounts(fetchedAccounts);

    // If modal is open, refresh modal accounts too
    if (selectedCollegeForCredentials) {
      const modalAccs = await vmsService.getCollegeAccountsWithCredentials(selectedCollegeForCredentials.id);
      setCollegeAccounts(modalAccs);
    }
  };

  const openCollegeCredentialsModal = async (col: College) => {
    setSelectedCollegeForCredentials(col);
    const accs = await vmsService.getCollegeAccountsWithCredentials(col.id);
    setCollegeAccounts(accs);
    setEditingPasswordUserId(null);
    setNewPasswordInput('');
    setIsAddStaffOpen(false);
    // Auto-generate suggested login ID for next staff
    const code = col.display_name.toLowerCase().replace(/[^a-z0-9]/g, '');
    const colBranches = branches.filter(b => b.college_id === col.id);
    setNewStaffForm({
      login_id: `${code}.reception${accs.filter(a => a.role === 'receptionist').length + 1}`,
      full_name: '',
      role: 'receptionist',
      branch_id: colBranches[0]?.id || '',
      password: `${col.display_name}@2026`
    });
  };

  const handleTogglePasswordVisibility = (userId: string) => {
    setShowPasswordMap(prev => ({
      ...prev,
      [userId]: !prev[userId]
    }));
  };

  const handleAdminChangePassword = async (profileId: string) => {
    if (!newPasswordInput.trim()) {
      alert('Please enter a valid password.');
      return;
    }
    const success = await vmsService.adminSetUserPassword(profileId, newPasswordInput.trim());
    if (success) {
      setPasswordSuccessUserId(profileId);
      setTimeout(() => setPasswordSuccessUserId(null), 2500);
      setEditingPasswordUserId(null);
      setNewPasswordInput('');
      await loadData();
    } else {
      alert('Failed to update password.');
    }
  };

  const handleToggleStaffStatus = async (profileId: string) => {
    await vmsService.toggleStaffStatus(profileId);
    await loadData();
  };

  const handleDeleteStaffAccount = async (profileId: string, name: string) => {
    if (window.confirm(`Are you sure you want to permanently delete account for "${name}"?`)) {
      await vmsService.deleteUserAccount(profileId);
      await loadData();
    }
  };

  const handleCreateStaffSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCollegeForCredentials) return;
    setStaffCreateError(null);

    try {
      await vmsService.createStaffAccount({
        login_id: newStaffForm.login_id.trim(),
        full_name: newStaffForm.full_name.trim(),
        role: newStaffForm.role,
        college_id: selectedCollegeForCredentials.id,
        branch_id: newStaffForm.branch_id || undefined,
        password: newStaffForm.password.trim() || undefined
      });

      setIsAddStaffOpen(false);
      await loadData();
    } catch (err: any) {
      setStaffCreateError(err?.message || 'Failed to create staff account');
    }
  };

  const handleOpenPhotoModal = (col: College) => {
    setPhotoModalCollege(col);
    setPhotoModalPreview(col.logo_url || '');
    setPhotoModalUrlInput(col.logo_url || '');
  };

  const handleSavePhotoModal = async (customUrl?: string) => {
    if (!photoModalCollege) return;
    setIsUploadingPhoto(true);
    try {
      const finalUrl = customUrl !== undefined ? customUrl : photoModalPreview;
      await vmsService.updateCollegeLogo(photoModalCollege.id, finalUrl);
      setUploadSuccessMessage(`Logo updated for ${photoModalCollege.display_name}!`);
      setTimeout(() => setUploadSuccessMessage(null), 3000);
      setPhotoModalCollege(null);
      await loadData();
    } catch (err: any) {
      alert(err?.message || 'Failed to update college photo/logo');
    } finally {
      setIsUploadingPhoto(false);
    }
  };

  const handleDirectCardLogoUpload = async (collegeId: string, file: File) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      alert('Please upload a valid image file (PNG, JPG, JPEG, WEBP, SVG).');
      return;
    }
    setIsUploadingPhoto(true);
    try {
      const reader = new FileReader();
      reader.onload = async (evt) => {
        if (evt.target?.result) {
          const rawDataUrl = evt.target.result as string;
          // Automatically compress high-res photo to max 600x600 px high-quality web-ready JPEG
          const compressed = await compressImageDataUrl(rawDataUrl, 600, 600, 0.88);
          await vmsService.updateCollegeLogo(collegeId, compressed);
          setUploadSuccessMessage('College photo/logo updated successfully!');
          setTimeout(() => setUploadSuccessMessage(null), 3000);
          await loadData();
        }
        setIsUploadingPhoto(false);
      };
      reader.readAsDataURL(file);
    } catch (err: any) {
      console.error('Photo upload error:', err);
      alert('Failed to process image file.');
      setIsUploadingPhoto(false);
    }
  };

  const handleOpenEditCollege = (col: College) => {
    setEditingCollege(col);
    setEditCollegeForm({
      name: col.name,
      display_name: col.display_name,
      tagline: col.tagline || 'VIDYAVAHINI GROUP',
      address: col.address || '',
      contact_phone: col.contact_phone || '',
      contact_email: col.contact_email || '',
      logo_url: col.logo_url || '',
      status: col.status
    });
  };

  const handleEditCollegePhotoUpload = async (file: File) => {
    if (!file || !file.type.startsWith('image/')) {
      alert('Please choose a valid image file.');
      return;
    }
    setIsUploadingPhoto(true);
    try {
      const reader = new FileReader();
      reader.onload = async (evt) => {
        if (evt.target?.result) {
          const compressed = await compressImageDataUrl(evt.target.result as string, 600, 600, 0.88);
          setEditCollegeForm(prev => ({ ...prev, logo_url: compressed }));
        }
        setIsUploadingPhoto(false);
      };
      reader.readAsDataURL(file);
    } catch (err: any) {
      alert('Failed to process image.');
      setIsUploadingPhoto(false);
    }
  };

  const handleSaveEditCollege = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCollege) return;
    setIsSavingEditCollege(true);
    try {
      await vmsService.updateCollege(editingCollege.id, {
        name: editCollegeForm.name.trim(),
        display_name: editCollegeForm.display_name.trim(),
        tagline: editCollegeForm.tagline.trim(),
        address: editCollegeForm.address.trim(),
        contact_phone: editCollegeForm.contact_phone.trim(),
        contact_email: editCollegeForm.contact_email.trim(),
        logo_url: editCollegeForm.logo_url,
        status: editCollegeForm.status
      });
      setUploadSuccessMessage(`Changes saved for ${editCollegeForm.display_name}!`);
      setTimeout(() => setUploadSuccessMessage(null), 3000);
      setEditingCollege(null);
      await loadData();
    } catch (err: any) {
      alert(err?.message || 'Failed to update college');
    } finally {
      setIsSavingEditCollege(false);
    }
  };

  const handleOpenAddBranch = (col: College) => {
    setAddBranchCollege(col);
    setAddBranchForm({
      name: '',
      address: '',
      max_visitors_inside: 100
    });
  };

  const handleSaveAddBranch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addBranchCollege || !addBranchForm.name.trim()) return;
    try {
      await vmsService.createBranch({
        college_id: addBranchCollege.id,
        name: addBranchForm.name.trim(),
        address: addBranchForm.address.trim(),
        max_visitors_inside: Number(addBranchForm.max_visitors_inside) || 100
      });
      setAddBranchCollege(null);
      await loadData();
    } catch (err: any) {
      alert(err?.message || 'Failed to create branch');
    }
  };

  const handleLogoFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      alert('Please choose a valid image file.');
      return;
    }
    setIsUploadingPhoto(true);
    try {
      const reader = new FileReader();
      reader.onload = async (evt) => {
        if (evt.target?.result) {
          const compressed = await compressImageDataUrl(evt.target.result as string, 600, 600, 0.88);
          setLogoUrl(compressed);
        }
        setIsUploadingPhoto(false);
      };
      reader.readAsDataURL(file);
    } catch (err: any) {
      alert('Failed to process image');
      setIsUploadingPhoto(false);
    }
  };

  const handleOnboardSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setOnboardError(null);
    setIsOnboardingLoading(true);
    try {
      const result = await vmsService.onboardNewCollege({
        collegeName,
        displayName,
        tagline,
        logoUrl: logoUrl || undefined,
        branchName,
        branchAddress,
        contactPhone,
        contactEmail,
        principalPassword: principalPassword || undefined,
        receptionistPassword: receptionistPassword || undefined
      });
      setOnboardResult(result);
      setCollegeName(''); setDisplayName(''); setBranchAddress(''); setContactPhone(''); setContactEmail(''); setLogoUrl(''); setPrincipalPassword(''); setReceptionistPassword('');
      loadData();
    } catch (err: any) {
      setOnboardError(err?.message || 'Onboarding failed');
    } finally {
      setIsOnboardingLoading(false);
    }
  };

  const handleDeleteCollege = async (collegeId: string, collegeName: string) => {
    if (window.confirm(`Are you sure you want to SUSPEND tenant "${collegeName}"? The college will be deactivated but all historical records preserved.`)) {
      await vmsService.deleteCollege(collegeId);
      loadData();
    }
  };

  const handleDeleteBranch = async (branchId: string, branchName: string, totalCollegeBranches: number) => {
    if (totalCollegeBranches <= 1) {
      alert(`Cannot remove "${branchName}". Each college must retain at least one primary campus branch.`);
      return;
    }
    if (window.confirm(`Are you sure you want to remove branch "${branchName}"?`)) {
      await vmsService.deleteBranch(branchId);
      loadData();
    }
  };

  const handleToggleStatus = async (collegeId: string, currentStatus: string) => {
    await vmsService.toggleCollegeStatus(collegeId, currentStatus === 'active' ? 'suspended' : 'active');
    loadData();
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(label);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const exportCollegeCredentialsFile = (colName: string, accounts: Array<Profile & { password?: string; branchName?: string }>) => {
    const lines = [
      `============================================================`,
      `  VIDYAVAHINI GROUP VMS — CREDENTIALS DOSSIER`,
      `  COLLEGE: ${colName.toUpperCase()}`,
      `  GENERATED: ${new Date().toLocaleString()}`,
      `============================================================`,
      ``,
      `--- ASSIGNED USER ACCOUNTS & PASSWORDS ---`,
      ``,
      ...accounts.map((acct, idx) => [
        `[#${idx + 1}] ${acct.full_name.toUpperCase()}`,
        `  Role:        ${acct.role.replace('_', ' ').toUpperCase()}`,
        `  Campus:      ${acct.branchName || 'Main Campus'}`,
        `  Login ID:    ${acct.login_id}`,
        `  Password:    ${acct.password || 'Vimtech@2026'}`,
        `  Status:      ${acct.is_active ? 'ACTIVE' : 'SUSPENDED'}`,
        `  Login URL:   https://localhost:3000/`,
        ``
      ].join('\n')),
      `------------------------------------------------------------`,
      `⚠ SECURITY NOTICE:`,
      `All users can log in using their Login ID and provided password.`,
      `Passcodes should be stored securely by authorized administration.`,
      `============================================================`
    ];

    const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${colName.toLowerCase().replace(/[^a-z0-9]/g, '_')}_credentials.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const copyAllCollegeCredentialsText = (colName: string, accounts: Array<Profile & { password?: string; branchName?: string }>) => {
    const formatted = accounts.map(a =>
      `• ${a.full_name} (${a.role.replace('_', ' ').toUpperCase()})\n  Login ID: ${a.login_id}\n  Password: ${a.password || 'Vimtech@2026'}\n  Campus: ${a.branchName || 'Main Campus'}`
    ).join('\n\n');
    copyToClipboard(`Credentials for ${colName}:\n\n${formatted}`, 'all_college_creds');
  };

  const exportAllCredentialsFile = () => {
    const lines = [
      `============================================================`,
      `  VIDYAVAHINI GROUP VMS — PLATFORM CREDENTIALS DIRECTORY`,
      `  TOTAL ACCOUNTS: ${allAccounts.length}`,
      `  GENERATED: ${new Date().toLocaleString()}`,
      `============================================================`,
      ``,
      ...allAccounts.map((acct, idx) => [
        `[#${idx + 1}] ${acct.full_name} (${acct.collegeName || 'Vidyavahini'})`,
        `  Role:        ${acct.role.replace('_', ' ').toUpperCase()}`,
        `  Campus:      ${acct.branchName || 'All Campuses'}`,
        `  Login ID:    ${acct.login_id}`,
        `  Password:    ${acct.password || 'Vimtech@2026'}`,
        `  Status:      ${acct.is_active ? 'ACTIVE' : 'SUSPENDED'}`,
        ``
      ].join('\n')),
      `============================================================`
    ];

    const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `vms_credentials_directory_${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const filteredAccounts = allAccounts.filter(acc => {
    const matchSearch = credSearchTerm === '' ||
      acc.full_name.toLowerCase().includes(credSearchTerm.toLowerCase()) ||
      acc.login_id.toLowerCase().includes(credSearchTerm.toLowerCase()) ||
      (acc.collegeName && acc.collegeName.toLowerCase().includes(credSearchTerm.toLowerCase()));

    const matchCollege = credCollegeFilter === 'all' ||
      (credCollegeFilter === 'super' && acc.role === 'super_admin') ||
      acc.college_id === credCollegeFilter;

    const matchRole = credRoleFilter === 'all' || acc.role === credRoleFilter;

    return matchSearch && matchCollege && matchRole;
  });

  return (
    <div className="space-y-6 pb-12 animate-fadeIn">
      {/* Executive Header Banner */}
      <div className="vms-header-hero p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <VimtechLogo size="md" showSubtitle={true} />
          <div className="h-8 w-px bg-slate-200 hidden sm:block" />
          <div className="space-y-0.5">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-900 border border-amber-200">
                <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                Super Admin — Platform Owner
              </span>
            </div>
            <p className="text-xs text-slate-500 font-medium">
              Administrator: <strong className="text-slate-900 font-semibold">{profile.full_name}</strong>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <button
            onClick={() => setActiveTab('credentials')}
            className="px-4 py-2.5 rounded-xl font-bold text-xs flex items-center gap-2 bg-gradient-to-r from-purple-900 to-indigo-900 hover:from-purple-950 hover:to-indigo-950 text-white shadow-sm transition-all"
          >
            <Key className="w-4 h-4 text-amber-300" /> Platform Logins & Passwords
          </button>
          <button
            onClick={() => setIsReportModalOpen(true)}
            className="px-4 py-2.5 rounded-xl font-bold text-xs flex items-center gap-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 shadow-sm transition-all"
          >
            <FileText className="w-4 h-4 text-purple-700" /> Platform Report
          </button>
          <button
            onClick={() => setActiveTab('onboard')}
            className="px-4 py-2.5 rounded-xl font-bold text-xs flex items-center gap-2 shrink-0 bg-[#731A73] hover:bg-[#5b125b] text-white shadow-sm transition-all"
          >
            <Plus className="w-4 h-4" /> Onboard New College
          </button>
        </div>
      </div>

      {/* Navigation Tabs (3-Role System: Super Admin, Branch Principal, Receptionist) */}
      <div className="flex bg-white p-1.5 rounded-2xl shadow-sm border border-purple-100 gap-1 overflow-x-auto text-xs font-bold">
        {[
          { id: 'colleges', label: `🏛️ College Tenants (${colleges.length})` },
          { id: 'credentials', label: `🔑 Logins & Passwords Directory (${allAccounts.length})` },
          { id: 'ranking', label: '📊 Campus Traffic Ranking' },
          { id: 'onboard', label: '➕ Onboard New Tenant' },
          { id: 'audit', label: `📋 Global Audit & Telemetry (${auditLogs.length})` },
          { id: 'feedback', label: `⭐ Visitor Feedback Logs (${allVisits.filter(v => v.rating || v.feedback_comment).length})` }
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`px-4 py-2.5 rounded-xl transition-all whitespace-nowrap ${
              activeTab === tab.id
                ? 'bg-[#731A73] text-white shadow-md font-extrabold'
                : 'text-gray-600 hover:text-gray-900 hover:bg-purple-50/50'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* 1. College Tenants Tab */}
      {activeTab === 'colleges' && (
        <div className="space-y-6">
          {/* Toast / Status Feedback */}
          {uploadSuccessMessage && (
            <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-2xl text-emerald-900 font-bold text-xs flex items-center justify-between shadow-xs animate-fadeIn">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{uploadSuccessMessage}</span>
              </div>
              <button onClick={() => setUploadSuccessMessage(null)} className="text-emerald-700 hover:text-emerald-900">
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {isUploadingPhoto && (
            <div className="p-3.5 bg-purple-50 border border-purple-200 rounded-2xl text-purple-900 font-bold text-xs flex items-center gap-2.5 shadow-xs animate-fadeIn">
              <Loader2 className="w-4 h-4 text-purple-700 animate-spin shrink-0" />
              <span>Optimizing and compressing college photo/logo... Please wait.</span>
            </div>
          )}

          {/* Top Platform Metrics */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="vms-metric-premium vms-card-shine">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] text-gray-500 font-black uppercase tracking-wider">Active Colleges</span>
                <div className="w-8 h-8 rounded-xl bg-purple-50 text-[#800080] flex items-center justify-center font-bold">
                  <Building2 className="w-4 h-4" />
                </div>
              </div>
              <p className="text-3xl font-extrabold text-[#800080] font-heading">{colleges.length}</p>
              <p className="text-[11px] text-gray-400 mt-1 font-medium">Platform Tenants</p>
            </div>

            <div className="vms-metric-premium accent-blue vms-card-shine">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] text-gray-500 font-black uppercase tracking-wider">Total Campus Branches</span>
                <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                  <MapPin className="w-4 h-4" />
                </div>
              </div>
              <p className="text-3xl font-extrabold text-blue-600 font-heading">{branches.length}</p>
              <p className="text-[11px] text-gray-400 mt-1 font-medium">Operational Campuses</p>
            </div>

            <div className="vms-metric-premium accent-green vms-card-shine">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] text-gray-500 font-black uppercase tracking-wider">Total User Accounts</span>
                <div className="w-8 h-8 rounded-xl bg-green-50 text-green-600 flex items-center justify-center font-bold">
                  <Key className="w-4 h-4" />
                </div>
              </div>
              <p className="text-3xl font-extrabold text-green-600 font-heading">{allAccounts.length}</p>
              <p className="text-[11px] text-gray-400 mt-1 font-medium">Principals & Receptionists</p>
            </div>

            <div className="vms-metric-premium accent-amber vms-card-shine">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] text-gray-500 font-black uppercase tracking-wider">Currently Inside</span>
                <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
                  <span className="vms-dot-live" />
                </div>
              </div>
              <p className="text-3xl font-extrabold text-amber-600 font-heading">{allVisits.filter(v => v.status === 'inside').length}</p>
              <p className="text-[11px] text-gray-400 mt-1 font-medium">Live On-Campus Visitors</p>
            </div>
          </div>

          {/* College Tenants Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-stretch">
            {colleges.map(c => {
              const cb = branches.filter(b => b.college_id === c.id);
              const cv = allVisits.filter(v => cb.some(b => b.id === v.branch_id)).length;
              const ca = allAccounts.filter(a => a.college_id === c.id);
              const isExpanded = expandedCollegeId === c.id;

              return (
                <div key={c.id} className="vms-card p-6 flex flex-col justify-between space-y-4 shadow-sm border border-purple-100/90 hover:shadow-md hover:border-purple-200 transition-all relative overflow-hidden bg-white">
                  <div className="space-y-4">
                    {/* Top Identity Header */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3.5 min-w-0">
                        {/* Avatar with Camera Button & Direct File Upload */}
                        <div className="relative shrink-0">
                          <div className="w-16 h-16 rounded-2xl bg-white border-2 border-purple-100 p-1 flex items-center justify-center shadow-xs overflow-hidden">
                            {c.logo_url ? (
                              <img src={c.logo_url} alt={c.name} className="max-w-full max-h-full object-contain" />
                            ) : (
                              <VimtechLogo size="sm" showSubtitle={false} />
                            )}
                          </div>
                          <button
                            onClick={() => handleOpenPhotoModal(c)}
                            className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-[#731A73] hover:bg-[#5b125b] text-white flex items-center justify-center shadow-md transition-transform hover:scale-110 border-2 border-white"
                            title="Upload / Change Photo or Logo"
                          >
                            <Camera className="w-3 h-3 text-amber-300" />
                          </button>
                        </div>

                        {/* Title & Badge */}
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-heading font-extrabold text-base text-gray-900 truncate" title={c.display_name}>
                              {c.display_name}
                            </h3>
                            <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ${
                              c.status === 'active'
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : 'bg-red-50 text-red-700 border border-red-200'
                            }`}>
                              ● {c.status}
                            </span>
                          </div>
                          <p className="text-xs text-gray-500 font-medium line-clamp-1 mt-0.5" title={c.name}>
                            {c.name}
                          </p>
                          <p className="text-[10px] text-purple-700 font-bold uppercase tracking-wider mt-0.5">
                            {c.tagline || 'VIDYAVAHINI GROUP'}
                          </p>
                        </div>
                      </div>

                      {/* Top Action Quick Buttons */}
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => handleOpenPhotoModal(c)}
                          className="p-2 text-purple-700 hover:bg-purple-50 rounded-xl transition-colors"
                          title="Manage Photo / Logo"
                        >
                          <ImageIcon className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleOpenEditCollege(c)}
                          className="p-2 text-gray-500 hover:text-purple-800 hover:bg-purple-50 rounded-xl transition-colors"
                          title="Edit College Details"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {/* Contact & Location Strip */}
                    {(c.address || c.contact_phone || c.contact_email) && (
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-gray-600 bg-gray-50/80 px-3 py-2 rounded-xl border border-gray-100 font-medium">
                        {c.address && (
                          <span className="flex items-center gap-1 truncate max-w-[200px]" title={c.address}>
                            <MapPin className="w-3 h-3 text-purple-700 shrink-0" />
                            <span className="truncate">{c.address}</span>
                          </span>
                        )}
                        {c.contact_phone && (
                          <span className="flex items-center gap-1">
                            <Phone className="w-3 h-3 text-emerald-600 shrink-0" />
                            <span>{c.contact_phone}</span>
                          </span>
                        )}
                        {c.contact_email && (
                          <span className="flex items-center gap-1 truncate max-w-[180px]" title={c.contact_email}>
                            <Mail className="w-3 h-3 text-blue-600 shrink-0" />
                            <span className="truncate">{c.contact_email}</span>
                          </span>
                        )}
                      </div>
                    )}

                    {/* Stats strip */}
                    <div className="grid grid-cols-3 gap-2 text-xs bg-purple-50/50 p-3 rounded-2xl border border-purple-100/70 font-medium">
                      <div className="space-y-0.5">
                        <span className="text-[10px] text-gray-500 uppercase font-extrabold flex items-center gap-1">
                          <Building2 className="w-3 h-3 text-purple-600" /> Campuses
                        </span>
                        <p className="font-extrabold text-gray-900 text-sm">{cb.length} Branches</p>
                      </div>
                      <div className="space-y-0.5">
                        <span className="text-[10px] text-gray-500 uppercase font-extrabold flex items-center gap-1">
                          <Users className="w-3 h-3 text-purple-600" /> Accounts
                        </span>
                        <p className="font-extrabold text-purple-900 text-sm">{ca.length} Staff</p>
                      </div>
                      <div className="space-y-0.5">
                        <span className="text-[10px] text-gray-500 uppercase font-extrabold flex items-center gap-1">
                          <Activity className="w-3 h-3 text-purple-600" /> Traffic
                        </span>
                        <p className="font-extrabold text-[#731A73] text-sm">{cv} Visits</p>
                      </div>
                    </div>

                    {/* Highlighted Action: Manage Credentials & Accounts */}
                    <div className="p-3 bg-gradient-to-r from-purple-50 via-indigo-50 to-amber-50 rounded-2xl border border-purple-200/80 flex items-center justify-between gap-3 shadow-2xs">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-8 h-8 rounded-xl bg-[#731A73] text-amber-300 flex items-center justify-center shadow-xs shrink-0 font-bold">
                          <Key className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-extrabold text-gray-900 truncate">Tenant Logins & Passwords</p>
                          <p className="text-[10px] text-gray-500 truncate">{ca.length} active credentials (Principal & Receptionist)</p>
                        </div>
                      </div>
                      <button
                        onClick={() => openCollegeCredentialsModal(c)}
                        className="px-3 py-1.5 bg-[#731A73] hover:bg-[#5b125b] text-white rounded-xl text-xs font-extrabold shadow-xs transition-all flex items-center gap-1.5 shrink-0"
                      >
                        <Eye className="w-3.5 h-3.5 text-amber-300" /> Manage Staff
                      </button>
                    </div>

                    {/* Expandable Branches Sub-List */}
                    <div className="pt-1 border-t border-gray-100">
                      <div className="flex items-center justify-between py-1">
                        <button
                          onClick={() => setExpandedCollegeId(isExpanded ? null : c.id)}
                          className="flex items-center gap-1.5 text-xs font-bold text-gray-700 hover:text-[#731A73] transition-colors"
                        >
                          <MapPin className="w-3.5 h-3.5 text-purple-700" />
                          <span>Campus Branches ({cb.length})</span>
                          {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </button>
                        <button
                          onClick={() => handleOpenAddBranch(c)}
                          className="text-[11px] font-bold text-purple-700 hover:text-purple-900 flex items-center gap-1 px-2.5 py-1 rounded-lg bg-purple-50 hover:bg-purple-100 transition-colors"
                        >
                          <Plus className="w-3 h-3" /> Add Branch
                        </button>
                      </div>

                      {isExpanded && (
                        <div className="mt-2 space-y-2 animate-fadeIn text-xs">
                          {cb.map((b) => (
                            <div key={b.id} className="p-2.5 bg-gray-50/90 rounded-xl border border-gray-200/80 flex items-center justify-between gap-2">
                              <div className="min-w-0">
                                <p className="font-bold text-gray-800 truncate">{b.name}</p>
                                <p className="text-[10px] text-gray-500 truncate">{b.address || 'Primary Campus Location'}</p>
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
                                <span className="text-[10px] font-mono text-purple-700 bg-purple-50 px-2 py-0.5 rounded-lg border border-purple-100 font-bold">
                                  Max {b.max_visitors_inside || 100}
                                </span>
                                <button
                                  onClick={() => handleDeleteBranch(b.id, b.name, cb.length)}
                                  disabled={cb.length <= 1}
                                  className={`p-1.5 rounded-lg hover:bg-red-50 text-red-600 transition-colors ${cb.length <= 1 ? 'opacity-30 cursor-not-allowed' : ''}`}
                                  title={cb.length <= 1 ? 'Primary branch required' : 'Remove branch'}
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Bottom Action Strip */}
                  <div className="pt-3 flex items-center justify-between gap-2 border-t border-gray-100 text-xs">
                    <button
                      onClick={() => handleToggleStatus(c.id, c.status)}
                      className={`px-3 py-1.5 rounded-xl font-bold transition-all border text-[11px] ${
                        c.status === 'active'
                          ? 'bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100'
                          : 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100'
                      }`}
                    >
                      {c.status === 'active' ? 'Suspend Tenant' : 'Reactivate Tenant'}
                    </button>

                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => handleOpenEditCollege(c)}
                        className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-xl font-bold text-[11px] transition-colors flex items-center gap-1"
                      >
                        <Edit3 className="w-3.5 h-3.5" /> Edit
                      </button>
                      <button
                        onClick={() => handleDeleteCollege(c.id, c.name)}
                        className="px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 rounded-xl font-bold text-[11px] transition-all flex items-center gap-1"
                        title="Deactivate and archive tenant"
                      >
                        <Trash2 className="w-3.5 h-3.5" /> Deactivate
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 2. PLATFORM LOGINS & PASSWORDS DIRECTORY TAB */}
      {activeTab === 'credentials' && (
        <div className="space-y-6 animate-fadeIn">
          <div className="p-6 bg-white rounded-3xl border border-purple-100 shadow-sm space-y-5">
            {/* Header & Export Actions */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-100 pb-5">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-[#731A73] text-amber-300 flex items-center justify-center font-bold shadow-xs">
                    <Key className="w-4 h-4" />
                  </div>
                  <h3 className="font-heading font-extrabold text-xl text-gray-900">Platform Logins & Passwords Directory</h3>
                </div>
                <p className="text-xs text-gray-500 font-medium">
                  Centralized list of all authorized users (Super Admin, Branch Principals, Front Desk Receptionists) across all college tenants.
                </p>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <button
                  onClick={exportAllCredentialsFile}
                  className="px-4 py-2 bg-purple-50 hover:bg-purple-100 text-purple-900 rounded-xl text-xs font-bold border border-purple-200 flex items-center gap-1.5 transition-colors"
                >
                  <Download className="w-3.5 h-3.5" /> Export All (.txt)
                </button>
                <button
                  onClick={() => copyToClipboard(
                    allAccounts.map(a => `${a.full_name} (${a.role.replace('_', ' ').toUpperCase()}) | ID: ${a.login_id} | PW: ${a.password || 'Vimtech@2026'} | College: ${a.collegeName}`).join('\n'),
                    'platform_copy_all'
                  )}
                  className="px-4 py-2 bg-[#731A73] hover:bg-[#5b125b] text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs transition-all"
                >
                  <Copy className="w-3.5 h-3.5 text-amber-300" />
                  {copiedField === 'platform_copy_all' ? '✓ Copied All!' : 'Copy All Text'}
                </button>
              </div>
            </div>

            {/* Filter Bar */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="relative">
                <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search by name, login ID, or college..."
                  value={credSearchTerm}
                  onChange={(e) => setCredSearchTerm(e.target.value)}
                  className="w-full text-xs pl-9 pr-3 py-2.5 rounded-xl border border-gray-300 font-medium focus:ring-2 focus:ring-purple-500 focus:outline-none"
                />
              </div>

              <select
                value={credCollegeFilter}
                onChange={(e) => setCredCollegeFilter(e.target.value)}
                className="text-xs p-2.5 rounded-xl border border-gray-300 font-semibold focus:ring-2 focus:ring-purple-500 focus:outline-none text-gray-700"
              >
                <option value="all">🏢 All College Tenants</option>
                <option value="super">👑 Platform Super Admin</option>
                {colleges.map(c => (
                  <option key={c.id} value={c.id}>{c.display_name} — {c.name}</option>
                ))}
              </select>

              <select
                value={credRoleFilter}
                onChange={(e) => setCredRoleFilter(e.target.value)}
                className="text-xs p-2.5 rounded-xl border border-gray-300 font-semibold focus:ring-2 focus:ring-purple-500 focus:outline-none text-gray-700"
              >
                <option value="all">👥 All Roles (3 Roles)</option>
                <option value="super_admin">Super Admin (Platform Owner)</option>
                <option value="branch_principal">Branch Principal</option>
                <option value="receptionist">Front Desk Receptionist</option>
              </select>
            </div>

            {/* Credentials Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-gray-200 text-gray-500 font-extrabold uppercase text-[10px] bg-gray-50">
                    <th className="py-3 px-4">User & Role</th>
                    <th className="py-3 px-4">College / Campus</th>
                    <th className="py-3 px-4">Login ID</th>
                    <th className="py-3 px-4">Active Password</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredAccounts.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-gray-400 font-medium">
                        No user accounts match the search or filter criteria.
                      </td>
                    </tr>
                  ) : (
                    filteredAccounts.map((acct) => {
                      const isPwShown = !!showPasswordMap[acct.id];
                      const isEditingPw = editingPasswordUserId === acct.id;
                      const isPwUpdated = passwordSuccessUserId === acct.id;

                      return (
                        <tr key={acct.id} className="hover:bg-purple-50/40 transition-colors">
                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-2.5">
                              <div className="w-8 h-8 rounded-xl bg-purple-100 text-[#731A73] flex items-center justify-center font-bold text-xs uppercase shrink-0">
                                {acct.full_name.charAt(0)}
                              </div>
                              <div>
                                <p className="font-extrabold text-gray-900">{acct.full_name}</p>
                                <span className={`inline-block mt-0.5 px-2 py-0.5 rounded text-[9px] font-black uppercase ${
                                  acct.role === 'super_admin'
                                    ? 'bg-amber-100 text-amber-900 border border-amber-200'
                                    : acct.role === 'branch_principal'
                                    ? 'bg-blue-100 text-blue-900 border border-blue-200'
                                    : 'bg-purple-100 text-purple-900 border border-purple-200'
                                }`}>
                                  {acct.role.replace('_', ' ')}
                                </span>
                              </div>
                            </div>
                          </td>

                          <td className="py-3.5 px-4 font-medium">
                            <p className="font-bold text-gray-900">{acct.collegeName}</p>
                            <p className="text-[10px] text-gray-500">{acct.branchName}</p>
                          </td>

                          <td className="py-3.5 px-4 font-mono font-bold text-purple-950">
                            <div className="flex items-center gap-1.5">
                              <span>{acct.login_id}</span>
                              <button
                                onClick={() => copyToClipboard(acct.login_id, `login_${acct.id}`)}
                                className="p-1 text-gray-400 hover:text-purple-800 hover:bg-purple-100 rounded transition-colors"
                                title="Copy Login ID"
                              >
                                {copiedField === `login_${acct.id}` ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                              </button>
                            </div>
                          </td>

                          <td className="py-3.5 px-4 font-mono">
                            {isEditingPw ? (
                              <div className="flex items-center gap-1.5">
                                <input
                                  type="text"
                                  placeholder="New password..."
                                  value={newPasswordInput}
                                  onChange={(e) => setNewPasswordInput(e.target.value)}
                                  className="w-36 text-[11px] p-1.5 rounded-lg border border-purple-300 font-mono focus:ring-1 focus:ring-purple-500 focus:outline-none"
                                />
                                <button
                                  onClick={() => handleAdminChangePassword(acct.id)}
                                  className="px-2 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[10px] font-bold"
                                >
                                  Save
                                </button>
                                <button
                                  onClick={() => { setEditingPasswordUserId(null); setNewPasswordInput(''); }}
                                  className="p-1 text-gray-400 hover:text-gray-600 text-[10px]"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            ) : (
                              <div className="flex items-center gap-1.5">
                                <span className="bg-gray-100 text-gray-800 px-2 py-1 rounded-md text-[11px] font-bold border border-gray-200 min-w-[90px] text-center inline-block">
                                  {isPwShown ? (acct.password || 'Vimtech@2026') : '••••••••••••'}
                                </span>
                                <button
                                  onClick={() => handleTogglePasswordVisibility(acct.id)}
                                  className="p-1 text-gray-400 hover:text-purple-800 hover:bg-purple-100 rounded transition-colors"
                                  title={isPwShown ? 'Hide Password' : 'Show Password'}
                                >
                                  {isPwShown ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                                </button>
                                <button
                                  onClick={() => copyToClipboard(acct.password || 'Vimtech@2026', `pw_${acct.id}`)}
                                  className="p-1 text-gray-400 hover:text-purple-800 hover:bg-purple-100 rounded transition-colors"
                                  title="Copy Password"
                                >
                                  {copiedField === `pw_${acct.id}` ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                                </button>
                                {isPwUpdated && (
                                  <span className="text-[10px] text-emerald-600 font-bold flex items-center gap-0.5">
                                    <Check className="w-3 h-3" /> Updated
                                  </span>
                                )}
                              </div>
                            )}
                          </td>

                          <td className="py-3.5 px-4">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${acct.is_active ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
                              {acct.is_active ? 'Active' : 'Suspended'}
                            </span>
                          </td>

                          <td className="py-3.5 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {!isEditingPw && (
                                <button
                                  onClick={() => {
                                    setEditingPasswordUserId(acct.id);
                                    setNewPasswordInput(acct.password || 'Vimtech@2026');
                                  }}
                                  className="px-2.5 py-1 bg-purple-50 hover:bg-purple-100 text-purple-900 border border-purple-200 rounded-lg font-bold text-[10px] transition-colors"
                                >
                                  Reset PW
                                </button>
                              )}
                              {acct.role !== 'super_admin' && (
                                <button
                                  onClick={() => handleToggleStaffStatus(acct.id)}
                                  className={`px-2 py-1 rounded-lg font-bold text-[10px] border transition-colors ${acct.is_active ? 'bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100' : 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100'}`}
                                >
                                  {acct.is_active ? 'Suspend' : 'Activate'}
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 3. Campus Traffic Ranking Leaderboard */}
      {activeTab === 'ranking' && (() => {
        const branchRankings = branches.map(b => {
          const bVisits = allVisits.filter(v => v.branch_id === b.id);
          const activeVisits = bVisits.filter(v => v.status === 'inside');
          const col = colleges.find(c => c.id === b.college_id);
          return {
            branch: b,
            collegeName: col?.display_name || col?.name || 'Vidyavahini',
            totalVisits: bVisits.length,
            activeCount: activeVisits.length,
            completedCount: bVisits.length - activeVisits.length
          };
        }).sort((a, b) => b.totalVisits - a.totalVisits);

        return (
          <div className="space-y-6 animate-fadeIn">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {branchRankings.slice(0, 3).map((item, idx) => (
                <div
                  key={item.branch.id}
                  className={`p-6 rounded-3xl border shadow-xl relative overflow-hidden ${
                    idx === 0
                      ? 'bg-gradient-to-br from-amber-500 via-amber-600 to-amber-700 text-white border-amber-300'
                      : idx === 1
                      ? 'bg-gradient-to-br from-slate-700 via-slate-800 to-slate-900 text-white border-slate-600'
                      : 'bg-gradient-to-br from-amber-900 via-purple-950 to-slate-900 text-white border-amber-800/60'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="px-3 py-1 bg-white/20 backdrop-blur-md rounded-full text-xs font-black uppercase tracking-wider flex items-center gap-1">
                      {idx === 0 ? <Trophy className="w-4 h-4 text-amber-200" /> : idx === 1 ? <Award className="w-4 h-4 text-slate-200" /> : <Flame className="w-4 h-4 text-amber-400" />}
                      RANK #{idx + 1} CAMPUS
                    </span>
                    <span className="text-3xl font-black font-mono opacity-40">#{idx + 1}</span>
                  </div>

                  <div className="mt-4">
                    <h3 className="font-heading font-extrabold text-xl">{item.branch.name}</h3>
                    <p className="text-xs opacity-80 font-medium">{item.collegeName}</p>
                  </div>

                  <div className="mt-4 pt-4 border-t border-white/20 grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-[10px] uppercase opacity-70 block font-bold">Total Check-Ins</span>
                      <strong className="text-xl font-black font-mono">{item.totalVisits}</strong>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase opacity-70 block font-bold">Currently Inside</span>
                      <strong className="text-xl font-black font-mono">{item.activeCount}</strong>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Complete Ranking Table */}
            <div className="p-6 bg-white rounded-3xl border border-purple-100 shadow-sm space-y-4">
              <h3 className="font-heading font-bold text-lg text-gray-900">Campus Visitor Traffic Leaderboard</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-gray-200 text-gray-500 font-extrabold uppercase text-[10px] bg-gray-50">
                      <th className="py-3 px-4">Rank</th>
                      <th className="py-3 px-4">Campus Branch</th>
                      <th className="py-3 px-4">Institution</th>
                      <th className="py-3 px-4">Total Visitors</th>
                      <th className="py-3 px-4">Live Inside</th>
                      <th className="py-3 px-4">Completed</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {branchRankings.map((item, idx) => (
                      <tr key={item.branch.id} className="hover:bg-purple-50/40 transition-colors">
                        <td className="py-3 px-4 font-mono font-bold text-purple-800">#{idx + 1}</td>
                        <td className="py-3 px-4 font-bold text-gray-900">{item.branch.name}</td>
                        <td className="py-3 px-4 text-gray-500 font-medium">{item.collegeName}</td>
                        <td className="py-3 px-4 font-black font-mono text-[#731A73]">{item.totalVisits}</td>
                        <td className="py-3 px-4 font-bold text-amber-600">{item.activeCount}</td>
                        <td className="py-3 px-4 text-gray-600">{item.completedCount}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        );
      })()}

      {/* 4. Onboard New Tenant Tab */}
      {activeTab === 'onboard' && (
        <div className="max-w-2xl mx-auto space-y-6 animate-fadeIn">
          {onboardResult && (
            <div className="p-6 bg-emerald-50/60 border border-emerald-200 rounded-3xl space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-emerald-100 text-emerald-800 flex items-center justify-center shrink-0">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-heading font-extrabold text-base text-emerald-950">Tenant Successfully Provisioned!</h4>
                  <p className="text-xs text-emerald-800 font-medium">
                    {onboardResult.college.name} ({onboardResult.college.display_name}) is now live.
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-[10px] font-extrabold text-emerald-900 uppercase tracking-wider">Initial Account Credentials (Principal & Receptionist)</p>
                  <button
                    onClick={() => exportCollegeCredentialsFile(onboardResult.college.display_name, onboardResult.credentials.map(c => ({
                      ...c,
                      id: c.login_id,
                      is_active: true,
                      must_change_password: true,
                      created_at: new Date().toISOString(),
                      password: c.temp_password,
                      branchName: onboardResult.branch.name
                    })))}
                    className="text-xs text-emerald-800 hover:text-emerald-950 font-bold underline flex items-center gap-1"
                  >
                    <Download className="w-3.5 h-3.5" /> Download Dossier (.txt)
                  </button>
                </div>

                {onboardResult.credentials.map((cred) => (
                  <div key={cred.login_id} className="p-3 bg-white/80 rounded-xl border border-emerald-200/60 flex items-center justify-between text-xs">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-extrabold text-gray-900">{cred.full_name}</span>
                        <span className="px-2 py-0.5 rounded text-[9px] font-black uppercase bg-emerald-100 text-emerald-800 border border-emerald-200">
                          {cred.role.replace('_', ' ')}
                        </span>
                      </div>
                      <p className="text-emerald-900 font-mono font-bold mt-0.5">Login ID: {cred.login_id}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-gray-800 bg-emerald-50 px-2 py-1 rounded border border-emerald-200 font-bold">Password: {cred.temp_password}</span>
                      <button
                        onClick={() => copyToClipboard(`ID: ${cred.login_id}\nPW: ${cred.temp_password}`, cred.login_id)}
                        className="px-2 py-1 bg-white hover:bg-emerald-100 text-emerald-800 rounded border border-emerald-300 font-bold"
                      >
                        {copiedField === cred.login_id ? '✓ Copied' : 'Copy'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  onClick={() => openCollegeCredentialsModal(onboardResult.college)}
                  className="flex-1 py-2.5 text-xs font-bold text-white bg-[#731A73] hover:bg-[#5b125b] rounded-xl shadow-xs transition-all text-center flex items-center justify-center gap-1.5"
                >
                  <Key className="w-3.5 h-3.5 text-amber-300" /> Manage in Credentials Hub
                </button>
                <button
                  onClick={() => setOnboardResult(null)}
                  className="py-2.5 px-4 text-xs font-bold text-gray-500 hover:text-gray-700 bg-white hover:bg-gray-100 rounded-xl border border-gray-200 transition-colors"
                >
                  Dismiss
                </button>
              </div>
            </div>
          )}

          {!onboardResult && (
            <div className="p-6 md:p-8 space-y-6 bg-white rounded-3xl shadow-sm border border-purple-100/90">
              <div className="text-center space-y-1.5 pb-2 border-b border-gray-100">
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-purple-50 text-[#731A73] mb-1">
                  <Building2 className="w-6 h-6" />
                </div>
                <h3 className="font-heading font-extrabold text-xl text-gray-900">Onboard New College Tenant</h3>
                <p className="text-xs text-gray-500 max-w-md mx-auto font-medium">
                  Auto-provisions a college entity, primary campus branch, and 2 default user accounts (Principal & Receptionist).
                </p>
              </div>

              {onboardError && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-2xl text-red-800 text-xs font-bold text-center flex items-center justify-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{onboardError}</span>
                </div>
              )}

              <form onSubmit={handleOnboardSubmit} className="space-y-5 text-xs">
                {/* 1. College Identity */}
                <div className="space-y-3 bg-purple-50/40 p-4 rounded-2xl border border-purple-100/70">
                  <p className="font-extrabold text-purple-950 uppercase tracking-wider text-[10px] flex items-center gap-1.5">
                    <Building2 className="w-3.5 h-3.5 text-[#731A73]" /> 1. College Identity & Brand
                  </p>

                  <div className="space-y-1">
                    <label className="block font-bold text-gray-700 text-[10px]">Official College Name *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Vaisiri Institute of Management & Technology"
                      value={collegeName}
                      onChange={(e) => setCollegeName(e.target.value)}
                      className="w-full text-xs p-3 rounded-xl border border-gray-300 font-medium focus:ring-2 focus:ring-purple-500 focus:outline-none bg-white"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="block font-bold text-gray-700 text-[10px]">Short Code / Abbreviation *</label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. VIMTECH"
                        value={displayName}
                        onChange={(e) => setDisplayName(e.target.value)}
                        className="w-full text-xs p-2.5 rounded-xl border border-gray-300 font-bold focus:ring-2 focus:ring-purple-500 focus:outline-none bg-white"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="block font-bold text-gray-700 text-[10px]">Group / Tagline</label>
                      <input
                        type="text"
                        placeholder="e.g. VIDYAVAHINI GROUP"
                        value={tagline}
                        onChange={(e) => setTagline(e.target.value)}
                        className="w-full text-xs p-2.5 rounded-xl border border-gray-300 font-medium focus:ring-2 focus:ring-purple-500 focus:outline-none bg-white"
                      />
                    </div>
                  </div>

                  {/* College Photo / Logo Upload Box */}
                  <div className="space-y-2 pt-1">
                    <div className="flex items-center justify-between">
                      <label className="block font-bold text-gray-700 text-[10px]">
                        College Logo / Photo (Used on Visitor Passes & PDF Headers)
                      </label>
                      {logoUrl && (
                        <button
                          type="button"
                          onClick={() => setLogoUrl('')}
                          className="text-[10px] text-red-600 hover:text-red-800 font-bold underline"
                        >
                          Remove Photo
                        </button>
                      )}
                    </div>

                    <div className="flex flex-col sm:flex-row items-center gap-3 p-3 bg-white rounded-xl border border-purple-200">
                      <div className="w-16 h-16 rounded-xl bg-purple-50/50 border border-purple-100 p-1 flex items-center justify-center shrink-0 shadow-xs">
                        {logoUrl ? (
                          <img src={logoUrl} alt="Preview" className="max-w-full max-h-full object-contain rounded-lg" />
                        ) : (
                          <span className="text-[10px] text-purple-400 font-bold text-center">No Photo</span>
                        )}
                      </div>

                      <div className="flex-1 space-y-2 w-full">
                        <div className="flex items-center gap-2">
                          <label
                            htmlFor="onboard-logo-file-input"
                            className="py-2 px-3.5 bg-[#731A73] hover:bg-[#5b125b] text-white rounded-xl text-xs font-bold shadow-xs cursor-pointer inline-flex items-center gap-1.5 transition-all"
                          >
                            <Upload className="w-3.5 h-3.5 text-amber-300" />
                            <span>Browse Photo File</span>
                          </label>
                          <input
                            id="onboard-logo-file-input"
                            type="file"
                            accept="image/*"
                            onChange={handleLogoFileUpload}
                            className="hidden"
                          />
                          <span className="text-[10px] text-gray-400 font-medium">PNG, JPG, WEBP, SVG</span>
                        </div>
                        <input
                          type="text"
                          placeholder="...or paste image URL directly"
                          value={logoUrl}
                          onChange={(e) => setLogoUrl(e.target.value)}
                          className="w-full text-xs p-2 rounded-lg border border-gray-200 font-mono text-gray-700 bg-gray-50/50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-purple-500"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* 2. Primary Campus Branch */}
                <div className="space-y-3 bg-gray-50/70 p-4 rounded-2xl border border-gray-200/80">
                  <p className="text-[10px] font-extrabold text-gray-800 uppercase tracking-wider flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-purple-700" /> 2. Primary Campus Branch
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="block font-bold text-gray-600 text-[10px]">Branch Name *</label>
                      <input
                        type="text"
                        required
                        placeholder="Main Campus"
                        value={branchName}
                        onChange={(e) => setBranchName(e.target.value)}
                        className="w-full text-xs p-2.5 rounded-xl border border-gray-300 font-medium focus:ring-2 focus:ring-purple-500 focus:outline-none bg-white"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="block font-bold text-gray-600 text-[10px]">Campus Address / Location</label>
                      <input
                        type="text"
                        placeholder="e.g. NH-206, B.H. Road"
                        value={branchAddress}
                        onChange={(e) => setBranchAddress(e.target.value)}
                        className="w-full text-xs p-2.5 rounded-xl border border-gray-300 font-medium focus:ring-2 focus:ring-purple-500 focus:outline-none bg-white"
                      />
                    </div>
                  </div>
                </div>

                {/* 3. Contact Info */}
                <div className="space-y-3 bg-gray-50/70 p-4 rounded-2xl border border-gray-200/80">
                  <p className="text-[10px] font-extrabold text-gray-800 uppercase tracking-wider flex items-center gap-1.5">
                    <Phone className="w-3.5 h-3.5 text-emerald-600" /> 3. Official Contact Channels
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="block font-bold text-gray-600 text-[10px]">Contact Phone</label>
                      <input
                        type="text"
                        placeholder="+91 XXXXX XXXXX"
                        value={contactPhone}
                        onChange={(e) => setContactPhone(e.target.value)}
                        className="w-full text-xs p-2.5 rounded-xl border border-gray-300 font-medium focus:ring-2 focus:ring-purple-500 focus:outline-none bg-white"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="block font-bold text-gray-600 text-[10px]">Contact Email</label>
                      <input
                        type="email"
                        placeholder="info@college.edu"
                        value={contactEmail}
                        onChange={(e) => setContactEmail(e.target.value)}
                        className="w-full text-xs p-2.5 rounded-xl border border-gray-300 font-medium focus:ring-2 focus:ring-purple-500 focus:outline-none bg-white"
                      />
                    </div>
                  </div>
                </div>

                {/* 4. Password Customization */}
                <div className="p-4 bg-amber-50/70 border border-amber-200 rounded-2xl space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="font-extrabold text-amber-950 uppercase tracking-wider text-[10px] flex items-center gap-1.5">
                      <Key className="w-3.5 h-3.5 text-amber-600" /> 4. Custom Initial Passwords (Optional)
                    </p>
                    <span className="text-[9px] text-amber-800 font-semibold">Default: {displayName || '{Code}'}@2026</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="block font-bold text-gray-700 text-[9px]">Branch Principal Password</label>
                      <input
                        type="text"
                        placeholder={`${displayName || 'Code'}@2026`}
                        value={principalPassword}
                        onChange={(e) => setPrincipalPassword(e.target.value)}
                        className="w-full text-xs p-2.5 rounded-xl border border-gray-300 font-mono font-bold bg-white focus:ring-2 focus:ring-amber-500 focus:outline-none"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="block font-bold text-gray-700 text-[9px]">Receptionist Password</label>
                      <input
                        type="text"
                        placeholder={`${displayName || 'Code'}@2026`}
                        value={receptionistPassword}
                        onChange={(e) => setReceptionistPassword(e.target.value)}
                        className="w-full text-xs p-2.5 rounded-xl border border-gray-300 font-mono font-bold bg-white focus:ring-2 focus:ring-amber-500 focus:outline-none"
                      />
                    </div>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isOnboardingLoading}
                  className="w-full py-3.5 bg-gradient-to-r from-[#731A73] via-purple-800 to-indigo-900 hover:from-purple-900 hover:to-indigo-950 text-white rounded-2xl font-extrabold shadow-md transition-all text-xs uppercase tracking-wider flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {isOnboardingLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin text-amber-300" />
                      <span>Provisioning College & Accounts...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4 text-amber-300" />
                      <span>Create College & Provision Accounts</span>
                    </>
                  )}
                </button>
              </form>
            </div>
          )}
        </div>
      )}

      {/* 5. Global Audit Logs & System Telemetry Tab */}
      {activeTab === 'audit' && (
        <div className="space-y-6 animate-fadeIn">
          {/* Health Monitor Card */}
          <div className="bg-white p-5 rounded-3xl shadow-md border border-purple-100 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-gray-100 pb-3">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-[#731A73]" />
                <div>
                  <h3 className="font-heading font-extrabold text-sm text-gray-900">System Telemetry & Health Monitor</h3>
                  <p className="text-[11px] text-gray-500 font-medium">Stuck offline sync detection, failed login metrics, and cloud ping status</p>
                </div>
              </div>
              <span className={`px-3 py-1 rounded-full text-xs font-black uppercase ${
                healthMetrics.cloudStatus === 'healthy' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-amber-50 text-amber-700 border border-amber-200'
              }`}>
                ● Cloud: {healthMetrics.cloudStatus} ({healthMetrics.cloudLatencyMs}ms)
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="p-3 bg-purple-50/50 rounded-2xl border border-purple-100/80">
                <span className="text-[10px] uppercase font-bold text-gray-500">Failed Logins (24h)</span>
                <p className="text-xl font-extrabold font-mono text-purple-900 mt-0.5">{healthMetrics.failedLogins24h}</p>
              </div>

              <div className="p-3 bg-purple-50/50 rounded-2xl border border-purple-100/80">
                <span className="text-[10px] uppercase font-bold text-gray-500">Stuck / Pending Syncs</span>
                <p className="text-xl font-extrabold font-mono text-purple-900 mt-0.5">{healthMetrics.stuckSyncCount}</p>
              </div>

              <div className="p-3 bg-purple-50/50 rounded-2xl border border-purple-100/80">
                <span className="text-[10px] uppercase font-bold text-gray-500">Active SOS Dispatches</span>
                <p className="text-xl font-extrabold font-mono text-amber-600 mt-0.5">{healthMetrics.activeSosCount}</p>
              </div>
            </div>
          </div>

          {/* Audit Logs List with Multi-Tenant Isolation Filter */}
          <div className="p-6 bg-white rounded-3xl border border-purple-100 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-100 pb-3">
              <div>
                <h3 className="font-heading font-bold text-lg text-gray-900">Security Audit Logs</h3>
                <p className="text-xs text-gray-500">Track and isolate gate operations and login events per college tenant</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-gray-600">Filter Tenant:</span>
                <select
                  value={auditCollegeFilter}
                  onChange={(e) => setAuditCollegeFilter(e.target.value)}
                  className="text-xs font-bold p-2 bg-purple-50 border border-purple-200 rounded-xl text-purple-950 focus:outline-none"
                >
                  <option value="all">All College Tenants</option>
                  {colleges.map(c => (
                    <option key={c.id} value={c.id}>{c.display_name} ({c.name})</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="space-y-2">
              {(() => {
                const filtered = auditLogs.filter(log => {
                  if (auditCollegeFilter === 'all') return true;
                  const meta = log.metadata || {};
                  return meta.college_id === auditCollegeFilter || meta.collegeId === auditCollegeFilter;
                });

                if (filtered.length === 0) {
                  return <p className="text-xs text-gray-400 text-center py-6">No audit records found for selected tenant.</p>;
                }

                return filtered.map((log) => (
                  <div key={log.id} className="p-3 bg-gray-50/80 rounded-xl border border-gray-100 flex items-center justify-between text-xs">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-gray-800">{log.actor_name}</span>
                        <span className="px-2 py-0.5 rounded text-[9px] font-mono bg-purple-100 text-purple-800 font-bold uppercase">{log.action}</span>
                        {log.scope && (
                          <span className="px-1.5 py-0.5 rounded text-[8px] font-mono bg-gray-200 text-gray-700 font-bold uppercase">{log.scope}</span>
                        )}
                      </div>
                    </div>
                    <span className="font-mono text-gray-400 text-[10px]">{new Date(log.created_at).toLocaleString()}</span>
                  </div>
                ));
              })()}
            </div>
          </div>
        </div>
      )}

      {/* 6. Visitor Feedback Logs Tab with Multi-Tenant Isolation */}
      {activeTab === 'feedback' && (() => {
        const collegeBranchIds = feedbackCollegeFilter === 'all'
          ? branches.map(b => b.id)
          : branches.filter(b => b.college_id === feedbackCollegeFilter).map(b => b.id);

        const scopedVisits = feedbackCollegeFilter === 'all'
          ? allVisits
          : allVisits.filter(v => collegeBranchIds.includes(v.branch_id));

        const feedbackVisits = scopedVisits.filter(v => v.rating || v.feedback_comment);
        const ratedVisits = scopedVisits.filter(v => v.rating && v.rating > 0);
        const avgRating = ratedVisits.length > 0
          ? (ratedVisits.reduce((acc, v) => acc + (v.rating || 0), 0) / ratedVisits.length).toFixed(1)
          : '5.0';

        return (
          <div className="space-y-6 animate-fadeIn">
            {/* Filter Header */}
            <div className="flex items-center justify-between bg-white p-4 rounded-2xl border border-purple-100 shadow-2xs">
              <div>
                <h4 className="font-heading font-black text-sm text-purple-950">Tenant Feedback Isolation</h4>
                <p className="text-[11px] text-gray-500">Filter satisfaction and comments per individual college</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-gray-600">College:</span>
                <select
                  value={feedbackCollegeFilter}
                  onChange={(e) => setFeedbackCollegeFilter(e.target.value)}
                  className="text-xs font-bold p-2 bg-purple-50 border border-purple-200 rounded-xl text-purple-950 focus:outline-none"
                >
                  <option value="all">All College Tenants</option>
                  {colleges.map(c => (
                    <option key={c.id} value={c.id}>{c.display_name} ({c.name})</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="p-5 bg-gradient-to-br from-amber-500 via-amber-600 to-amber-700 text-white rounded-3xl shadow-xl flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-black uppercase tracking-wider text-amber-200">
                    {feedbackCollegeFilter === 'all' ? 'Platform Average' : 'College Tenant'} Rating
                  </span>
                  <div className="flex items-baseline gap-2 mt-1">
                    <span className="text-4xl font-extrabold font-heading">{avgRating}</span>
                    <span className="text-amber-200 text-xs font-bold">/ 5.0 Stars</span>
                  </div>
                  <div className="flex items-center gap-1 mt-2">
                    {[1, 2, 3, 4, 5].map((s) => (
                      <Star key={s} className={`w-4 h-4 ${s <= Math.round(Number(avgRating)) ? 'fill-amber-300 text-amber-300' : 'text-amber-800'}`} />
                    ))}
                  </div>
                </div>
                <div className="w-14 h-14 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center text-white border border-white/30">
                  <Star className="w-8 h-8 fill-amber-300 text-amber-300" />
                </div>
              </div>

              <div className="vms-metric-premium vms-card-shine">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] text-gray-500 font-black uppercase tracking-wider">Total Feedback Submissions</span>
                  <div className="w-8 h-8 rounded-xl bg-purple-50 text-[#800080] flex items-center justify-center font-bold">
                    <MessageSquare className="w-4 h-4" />
                  </div>
                </div>
                <p className="text-3xl font-extrabold text-[#800080] font-heading">{feedbackVisits.length}</p>
                <p className="text-[11px] text-gray-400 mt-1 font-medium">
                  {feedbackCollegeFilter === 'all' ? 'All tenants combined' : 'Filtered college'}
                </p>
              </div>

              <div className="vms-metric-premium accent-green vms-card-shine">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] text-gray-500 font-black uppercase tracking-wider">High Satisfaction</span>
                  <div className="w-8 h-8 rounded-xl bg-green-50 text-green-600 flex items-center justify-center font-bold">
                    <Star className="w-4 h-4 fill-green-500" />
                  </div>
                </div>
                <p className="text-3xl font-extrabold text-green-600 font-heading">
                  {ratedVisits.filter(v => (v.rating || 5) >= 4).length}
                </p>
                <p className="text-[11px] text-green-700 font-bold mt-1">4 & 5 Star Ratings</p>
              </div>
            </div>

            <div className="p-6 bg-white rounded-3xl border border-purple-100 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-heading font-bold text-lg text-gray-900">Tenant Visitor Feedback Feed</h3>
                  <p className="text-xs text-gray-500">Real-time visitor rating and experience comments recorded during gate exit</p>
                </div>
              </div>

              <div className="space-y-3">
                {feedbackVisits.length === 0 ? (
                  <div className="text-center py-10 bg-purple-50/40 rounded-2xl border border-dashed border-purple-200">
                    <MessageSquare className="w-8 h-8 text-purple-300 mx-auto mb-2" />
                    <p className="text-xs text-gray-500 font-bold">No visitor feedback records found.</p>
                  </div>
                ) : (
                  feedbackVisits.map((v) => (
                    <div key={v.id} className="p-4 bg-purple-50/30 border border-purple-100 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs">
                      <div className="flex items-start gap-3.5">
                        <img
                          src={v.visitor_photo_url || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=300&q=80'}
                          alt=""
                          className="w-12 h-12 rounded-2xl object-cover ring-2 ring-purple-200 shadow-2xs shrink-0"
                        />
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-extrabold text-sm text-gray-900">{v.visitor_name}</span>
                            <span className="text-xs font-mono font-bold text-gray-500">({v.visitor_phone})</span>
                            <div className="flex items-center gap-0.5 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                              {[1, 2, 3, 4, 5].map((s) => (
                                <Star
                                  key={s}
                                  className={`w-3 h-3 ${s <= (v.rating || 5) ? 'fill-amber-400 text-amber-400' : 'text-gray-200'}`}
                                />
                              ))}
                              <span className="text-[10px] font-extrabold text-amber-900 ml-1">{v.rating || 5}/5</span>
                            </div>
                          </div>
                          <p className="text-xs text-[#731A73] font-semibold">
                            Host: {v.host_name} • Purpose: {v.purpose}
                          </p>
                          {v.feedback_comment && (
                            <p className="text-xs text-gray-800 bg-white p-2 rounded-xl border border-purple-100 italic font-medium">
                              "{v.feedback_comment}"
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="text-right shrink-0 text-xs text-gray-500 font-mono">
                        <p className="font-bold text-gray-700">Exit Completed</p>
                        <p className="text-[11px]">{v.check_out_time ? new Date(v.check_out_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Recently'}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {/* ──────────────────────────────────────────────────────────
          MODAL: COLLEGE CREDENTIALS & USER ACCOUNTS HUB
      ────────────────────────────────────────────────────────── */}
      {selectedCollegeForCredentials && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white rounded-3xl shadow-2xl border border-purple-100 max-w-3xl w-full max-h-[90vh] flex flex-col overflow-hidden animate-scaleUp">
            {/* Modal Header */}
            <div className="p-5 bg-gradient-to-r from-purple-950 via-purple-900 to-indigo-950 text-white flex items-center justify-between gap-3 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-white/10 backdrop-blur-md p-1 border border-white/20 flex items-center justify-center shrink-0">
                  {selectedCollegeForCredentials.logo_url ? (
                    <img src={selectedCollegeForCredentials.logo_url} alt="" className="max-h-full max-w-full object-contain" />
                  ) : (
                    <Key className="w-6 h-6 text-amber-300" />
                  )}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-heading font-extrabold text-lg text-white">{selectedCollegeForCredentials.display_name}</h3>
                    <span className="px-2 py-0.5 rounded-full bg-amber-400/20 text-amber-300 border border-amber-400/30 text-[10px] font-bold">
                      {collegeAccounts.length} Staff Accounts
                    </span>
                  </div>
                  <p className="text-xs text-purple-200 font-medium">{selectedCollegeForCredentials.name}</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => exportCollegeCredentialsFile(selectedCollegeForCredentials.display_name, collegeAccounts)}
                  className="px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-bold border border-white/20 flex items-center gap-1.5 transition-colors"
                  title="Download Credentials Text File"
                >
                  <Download className="w-3.5 h-3.5 text-amber-300" /> Dossier (.txt)
                </button>
                <button
                  onClick={() => copyAllCollegeCredentialsText(selectedCollegeForCredentials.display_name, collegeAccounts)}
                  className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-gray-950 rounded-xl text-xs font-extrabold flex items-center gap-1.5 shadow-sm transition-all"
                >
                  <Copy className="w-3.5 h-3.5" />
                  {copiedField === 'all_college_creds' ? '✓ Copied' : 'Copy All'}
                </button>
                <button
                  onClick={() => setSelectedCollegeForCredentials(null)}
                  className="p-2 text-white/70 hover:text-white hover:bg-white/10 rounded-xl transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-5 text-xs">
              {/* Action Banner to Add New Staff */}
              <div className="flex items-center justify-between bg-purple-50 p-3.5 rounded-2xl border border-purple-100">
                <div>
                  <p className="font-extrabold text-purple-950 text-xs">Provisioned Staff & Gate Passcodes</p>
                  <p className="text-[11px] text-gray-500 font-medium">3-Role Architecture: Branch Principals and Front Desk Receptionists.</p>
                </div>
                <button
                  onClick={() => setIsAddStaffOpen(!isAddStaffOpen)}
                  className="px-3.5 py-2 bg-[#731A73] hover:bg-[#5b125b] text-white rounded-xl font-bold flex items-center gap-1.5 shadow-xs transition-all shrink-0"
                >
                  <UserPlus className="w-4 h-4 text-amber-300" />
                  {isAddStaffOpen ? 'Cancel' : 'Add New Account'}
                </button>
              </div>

              {/* Add New Staff Form Drawer */}
              {isAddStaffOpen && (
                <form onSubmit={handleCreateStaffSubmit} className="p-4 bg-gradient-to-br from-purple-50/80 to-amber-50/60 rounded-2xl border border-purple-200 space-y-3 animate-fadeIn">
                  <p className="font-extrabold text-purple-900 text-xs uppercase tracking-wider">Create New Staff Account (Receptionist or Principal)</p>
                  
                  {staffCreateError && (
                    <div className="p-2.5 bg-red-50 text-red-700 rounded-xl border border-red-200 font-bold">{staffCreateError}</div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="block font-bold text-gray-700 text-[10px]">Full Name *</label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. Ramesh Kumar"
                        value={newStaffForm.full_name}
                        onChange={(e) => setNewStaffForm({ ...newStaffForm, full_name: e.target.value })}
                        className="w-full text-xs p-2.5 rounded-xl border border-gray-300 font-medium focus:ring-2 focus:ring-purple-500 focus:outline-none"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="block font-bold text-gray-700 text-[10px]">Role *</label>
                      <select
                        value={newStaffForm.role}
                        onChange={(e) => setNewStaffForm({ ...newStaffForm, role: e.target.value as any })}
                        className="w-full text-xs p-2.5 rounded-xl border border-gray-300 font-bold focus:ring-2 focus:ring-purple-500 focus:outline-none text-gray-800"
                      >
                        <option value="receptionist">Front Desk Receptionist</option>
                        <option value="branch_principal">Branch Principal</option>
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="block font-bold text-gray-700 text-[10px]">Login ID / Username *</label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. vimtech.reception2"
                        value={newStaffForm.login_id}
                        onChange={(e) => setNewStaffForm({ ...newStaffForm, login_id: e.target.value })}
                        className="w-full text-xs p-2.5 rounded-xl border border-gray-300 font-mono font-bold focus:ring-2 focus:ring-purple-500 focus:outline-none"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="block font-bold text-gray-700 text-[10px]">Assign Campus Branch *</label>
                      <select
                        value={newStaffForm.branch_id}
                        onChange={(e) => setNewStaffForm({ ...newStaffForm, branch_id: e.target.value })}
                        className="w-full text-xs p-2.5 rounded-xl border border-gray-300 font-medium focus:ring-2 focus:ring-purple-500 focus:outline-none"
                      >
                        {branches.filter(b => b.college_id === selectedCollegeForCredentials.id).map(b => (
                          <option key={b.id} value={b.id}>{b.name}</option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-1 sm:col-span-2">
                      <label className="block font-bold text-gray-700 text-[10px]">Initial Password *</label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. Vimtech@2026"
                        value={newStaffForm.password}
                        onChange={(e) => setNewStaffForm({ ...newStaffForm, password: e.target.value })}
                        className="w-full text-xs p-2.5 rounded-xl border border-gray-300 font-mono font-bold focus:ring-2 focus:ring-purple-500 focus:outline-none"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    className="w-full py-2.5 bg-gradient-to-r from-[#731A73] to-purple-800 hover:from-purple-800 hover:to-purple-900 text-white rounded-xl font-extrabold shadow-sm transition-all text-xs uppercase tracking-wider"
                  >
                    Create & Save Account
                  </button>
                </form>
              )}

              {/* Accounts List Cards */}
              <div className="space-y-3">
                {collegeAccounts.length === 0 ? (
                  <p className="text-center py-6 text-gray-400">No staff accounts provisioned yet.</p>
                ) : (
                  collegeAccounts.map((acct) => {
                    const isPwShown = !!showPasswordMap[acct.id];
                    const isEditingPw = editingPasswordUserId === acct.id;
                    const isPwUpdated = passwordSuccessUserId === acct.id;

                    return (
                      <div key={acct.id} className="p-4 bg-white rounded-2xl border border-purple-100 shadow-2xs hover:border-purple-200 transition-all space-y-3">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-purple-100 text-[#731A73] flex items-center justify-center font-bold text-sm uppercase shrink-0">
                              {acct.full_name.charAt(0)}
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <h4 className="font-extrabold text-sm text-gray-900">{acct.full_name}</h4>
                                <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase ${
                                  acct.role === 'branch_principal'
                                    ? 'bg-blue-100 text-blue-900 border border-blue-200'
                                    : 'bg-purple-100 text-purple-900 border border-purple-200'
                                }`}>
                                  {acct.role.replace('_', ' ')}
                                </span>
                                <span className={`px-2 py-0.2 rounded-full text-[9px] font-bold ${acct.is_active ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
                                  {acct.is_active ? 'Active' : 'Suspended'}
                                </span>
                              </div>
                              <p className="text-[11px] text-gray-500 mt-0.5">
                                Campus: <strong className="text-gray-700">{acct.branchName}</strong>
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleToggleStaffStatus(acct.id)}
                              className={`px-2.5 py-1 rounded-lg font-bold text-[10px] border transition-colors ${acct.is_active ? 'bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100' : 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100'}`}
                            >
                              {acct.is_active ? 'Suspend' : 'Activate'}
                            </button>
                            <button
                              onClick={() => handleDeleteStaffAccount(acct.id, acct.full_name)}
                              className="p-1.5 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors"
                              title="Delete Staff Account"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        {/* Credential Data Strip */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 bg-gray-50/80 p-3 rounded-xl border border-gray-200/70">
                          {/* Login ID */}
                          <div className="space-y-0.5">
                            <span className="text-[10px] uppercase font-bold text-gray-400 block">Login ID</span>
                            <div className="flex items-center justify-between bg-white px-2.5 py-1.5 rounded-lg border border-gray-200">
                              <span className="font-mono font-bold text-purple-950 text-xs">{acct.login_id}</span>
                              <button
                                onClick={() => copyToClipboard(acct.login_id, `modal_login_${acct.id}`)}
                                className="p-1 text-gray-400 hover:text-purple-800 rounded transition-colors"
                                title="Copy Login ID"
                              >
                                {copiedField === `modal_login_${acct.id}` ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                              </button>
                            </div>
                          </div>

                          {/* Password */}
                          <div className="space-y-0.5">
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] uppercase font-bold text-gray-400 block">Current Password</span>
                              {!isEditingPw && (
                                <button
                                  onClick={() => {
                                    setEditingPasswordUserId(acct.id);
                                    setNewPasswordInput(acct.password || 'Vimtech@2026');
                                  }}
                                  className="text-[10px] text-[#731A73] hover:underline font-bold"
                                >
                                  Change Password
                                </button>
                              )}
                            </div>

                            {isEditingPw ? (
                              <div className="flex items-center gap-1.5">
                                <input
                                  type="text"
                                  placeholder="Type new password..."
                                  value={newPasswordInput}
                                  onChange={(e) => setNewPasswordInput(e.target.value)}
                                  className="flex-1 text-xs p-1.5 rounded-lg border border-purple-400 font-mono font-bold focus:ring-1 focus:ring-purple-500 focus:outline-none"
                                />
                                <button
                                  onClick={() => handleAdminChangePassword(acct.id)}
                                  className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-[10px] shadow-xs"
                                >
                                  Save
                                </button>
                                <button
                                  onClick={() => { setEditingPasswordUserId(null); setNewPasswordInput(''); }}
                                  className="p-1.5 text-gray-400 hover:text-gray-600"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            ) : (
                              <div className="flex items-center justify-between bg-white px-2.5 py-1.5 rounded-lg border border-gray-200">
                                <span className="font-mono font-bold text-gray-800 text-xs">
                                  {isPwShown ? (acct.password || 'Vimtech@2026') : '••••••••••••'}
                                </span>
                                <div className="flex items-center gap-1">
                                  <button
                                    onClick={() => handleTogglePasswordVisibility(acct.id)}
                                    className="p-1 text-gray-400 hover:text-purple-800 rounded transition-colors"
                                    title={isPwShown ? 'Hide' : 'Reveal'}
                                  >
                                    {isPwShown ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                                  </button>
                                  <button
                                    onClick={() => copyToClipboard(acct.password || 'Vimtech@2026', `modal_pw_${acct.id}`)}
                                    className="p-1 text-gray-400 hover:text-purple-800 rounded transition-colors"
                                    title="Copy Password"
                                  >
                                    {copiedField === `modal_pw_${acct.id}` ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                                  </button>
                                </div>
                              </div>
                            )}
                            {isPwUpdated && (
                              <p className="text-[10px] text-emerald-600 font-bold mt-0.5 flex items-center gap-1">
                                <Check className="w-3 h-3" /> Password successfully updated & active!
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-gray-50 border-t border-gray-100 flex items-center justify-between shrink-0">
              <span className="text-[11px] text-gray-500 font-medium">
                Portal Login URL: <strong className="text-purple-900 font-mono">https://localhost:3000/</strong>
              </span>
              <button
                onClick={() => setSelectedCollegeForCredentials(null)}
                className="px-5 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-xl font-bold transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ──────────────────────────────────────────────────────────
          MODAL: EDIT COLLEGE TENANT DETAILS (With Photo Upload)
      ────────────────────────────────────────────────────────── */}
      {editingCollege && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white rounded-3xl shadow-2xl border border-purple-100 max-w-xl w-full p-6 space-y-5 animate-scaleUp max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-purple-100 text-[#731A73] flex items-center justify-center font-bold">
                  <Building2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-heading font-extrabold text-base text-gray-900">Edit College Tenant Details</h3>
                  <p className="text-[11px] text-gray-500 font-medium">{editingCollege.name}</p>
                </div>
              </div>
              <button onClick={() => setEditingCollege(null)} className="p-1.5 text-gray-400 hover:text-gray-600 rounded-xl hover:bg-gray-100 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEditCollege} className="space-y-4 text-xs">
              {/* Photo / Logo Upload Box inside Edit Modal */}
              <div className="p-3.5 bg-gradient-to-br from-purple-50/70 to-indigo-50/50 rounded-2xl border border-purple-100 space-y-2.5">
                <div className="flex items-center justify-between">
                  <label className="block font-extrabold text-purple-900 uppercase tracking-wider text-[10px] flex items-center gap-1.5">
                    <Camera className="w-3.5 h-3.5 text-[#731A73]" /> College Logo & Badge Photo
                  </label>
                  {editCollegeForm.logo_url && (
                    <button
                      type="button"
                      onClick={() => setEditCollegeForm(prev => ({ ...prev, logo_url: '' }))}
                      className="text-[10px] text-red-600 hover:text-red-800 font-bold underline"
                    >
                      Remove Photo
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-3 bg-white p-2.5 rounded-xl border border-purple-200/80">
                  <div className="w-14 h-14 rounded-xl bg-purple-50/50 border border-purple-100 p-1 flex items-center justify-center shrink-0 shadow-xs overflow-hidden">
                    {editCollegeForm.logo_url ? (
                      <img src={editCollegeForm.logo_url} alt="Logo" className="max-w-full max-h-full object-contain rounded-lg" />
                    ) : (
                      <VimtechLogo size="sm" showSubtitle={false} />
                    )}
                  </div>

                  <div className="flex-1 space-y-1.5 min-w-0">
                    <div className="flex items-center gap-2">
                      <label
                        htmlFor="edit-college-logo-file"
                        className="py-1.5 px-3 bg-[#731A73] hover:bg-[#5b125b] text-white rounded-lg text-xs font-bold shadow-xs cursor-pointer inline-flex items-center gap-1.5 transition-all"
                      >
                        <Upload className="w-3.5 h-3.5 text-amber-300" />
                        <span>Upload New Image</span>
                      </label>
                      <input
                        id="edit-college-logo-file"
                        type="file"
                        accept="image/*"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleEditCollegePhotoUpload(file);
                        }}
                        className="hidden"
                      />
                      <span className="text-[10px] text-gray-400">PNG, JPG, SVG</span>
                    </div>
                    <input
                      type="text"
                      placeholder="...or paste image URL"
                      value={editCollegeForm.logo_url}
                      onChange={(e) => setEditCollegeForm({ ...editCollegeForm, logo_url: e.target.value })}
                      className="w-full text-[11px] p-1.5 rounded-lg border border-gray-200 font-mono text-gray-700 bg-gray-50/50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-purple-500"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-1">
                <label className="block font-bold text-gray-700 text-[10px]">Official College Name *</label>
                <input
                  type="text"
                  required
                  value={editCollegeForm.name}
                  onChange={(e) => setEditCollegeForm({ ...editCollegeForm, name: e.target.value })}
                  className="w-full p-2.5 rounded-xl border border-gray-300 font-medium focus:ring-2 focus:ring-purple-500 focus:outline-none bg-white"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="block font-bold text-gray-700 text-[10px]">Short Display Code *</label>
                  <input
                    type="text"
                    required
                    value={editCollegeForm.display_name}
                    onChange={(e) => setEditCollegeForm({ ...editCollegeForm, display_name: e.target.value })}
                    className="w-full p-2.5 rounded-xl border border-gray-300 font-bold focus:ring-2 focus:ring-purple-500 focus:outline-none bg-white"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block font-bold text-gray-700 text-[10px]">Tagline / Group</label>
                  <input
                    type="text"
                    value={editCollegeForm.tagline}
                    onChange={(e) => setEditCollegeForm({ ...editCollegeForm, tagline: e.target.value })}
                    className="w-full p-2.5 rounded-xl border border-gray-300 font-medium focus:ring-2 focus:ring-purple-500 focus:outline-none bg-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="block font-bold text-gray-700 text-[10px]">Contact Phone</label>
                  <input
                    type="text"
                    placeholder="+91 XXXXX XXXXX"
                    value={editCollegeForm.contact_phone}
                    onChange={(e) => setEditCollegeForm({ ...editCollegeForm, contact_phone: e.target.value })}
                    className="w-full p-2.5 rounded-xl border border-gray-300 font-medium focus:ring-2 focus:ring-purple-500 focus:outline-none bg-white"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block font-bold text-gray-700 text-[10px]">Contact Email</label>
                  <input
                    type="email"
                    placeholder="info@college.edu"
                    value={editCollegeForm.contact_email}
                    onChange={(e) => setEditCollegeForm({ ...editCollegeForm, contact_email: e.target.value })}
                    className="w-full p-2.5 rounded-xl border border-gray-300 font-medium focus:ring-2 focus:ring-purple-500 focus:outline-none bg-white"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="block font-bold text-gray-700 text-[10px]">Campus Address</label>
                <input
                  type="text"
                  placeholder="e.g. NH-206, B.H. Road"
                  value={editCollegeForm.address}
                  onChange={(e) => setEditCollegeForm({ ...editCollegeForm, address: e.target.value })}
                  className="w-full p-2.5 rounded-xl border border-gray-300 font-medium focus:ring-2 focus:ring-purple-500 focus:outline-none bg-white"
                />
              </div>

              <div className="space-y-1">
                <label className="block font-bold text-gray-700 text-[10px]">Tenant Operational Status</label>
                <select
                  value={editCollegeForm.status}
                  onChange={(e) => setEditCollegeForm({ ...editCollegeForm, status: e.target.value as any })}
                  className="w-full p-2.5 rounded-xl border border-gray-300 font-bold focus:ring-2 focus:ring-purple-500 focus:outline-none text-gray-800 bg-white"
                >
                  <option value="active">Active Operational</option>
                  <option value="suspended">Suspended / Inactive</option>
                </select>
              </div>

              <div className="flex items-center gap-2.5 pt-3 border-t border-gray-100">
                <button
                  type="submit"
                  disabled={isSavingEditCollege}
                  className="flex-1 py-2.5 bg-[#731A73] hover:bg-[#5b125b] text-white rounded-xl font-bold shadow-xs transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {isSavingEditCollege ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin text-amber-300" />
                      <span>Saving Changes...</span>
                    </>
                  ) : (
                    <span>Save Changes</span>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setEditingCollege(null)}
                  className="py-2.5 px-4 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-bold transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ──────────────────────────────────────────────────────────
          MODAL: DEDICATED COLLEGE PHOTO / LOGO MANAGER
      ────────────────────────────────────────────────────────── */}
      {photoModalCollege && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white rounded-3xl shadow-2xl border border-purple-100 max-w-md w-full p-6 space-y-5 animate-scaleUp">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-purple-100 text-[#731A73] flex items-center justify-center font-bold">
                  <Camera className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-heading font-extrabold text-base text-gray-900">Upload College Photo / Logo</h3>
                  <p className="text-[11px] text-gray-500 font-medium">{photoModalCollege.display_name} — {photoModalCollege.name}</p>
                </div>
              </div>
              <button
                onClick={() => setPhotoModalCollege(null)}
                className="p-1.5 text-gray-400 hover:text-gray-600 rounded-xl hover:bg-gray-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Photo Live Preview Container */}
            <div className="space-y-2 text-center">
              <div className="w-28 h-28 mx-auto rounded-3xl bg-gradient-to-br from-purple-50 via-white to-indigo-50 border-2 border-purple-200 p-2 flex items-center justify-center shadow-md overflow-hidden relative group">
                {photoModalPreview ? (
                  <img src={photoModalPreview} alt="Logo" className="max-w-full max-h-full object-contain" />
                ) : (
                  <VimtechLogo size="md" showSubtitle={false} />
                )}
              </div>
              <p className="text-[11px] text-gray-500 font-medium">
                This image is featured on visitor gate passes, badges, and platform reports.
              </p>
            </div>

            {/* Upload Actions Dropzone */}
            <div className="space-y-3">
              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={async (e) => {
                  e.preventDefault();
                  const file = e.dataTransfer.files?.[0];
                  if (file && photoModalCollege) {
                    await handleDirectCardLogoUpload(photoModalCollege.id, file);
                    setPhotoModalCollege(null);
                  }
                }}
                className="p-5 border-2 border-dashed border-purple-200 hover:border-purple-400 rounded-2xl bg-purple-50/40 text-center space-y-2 transition-all cursor-pointer"
                onClick={() => document.getElementById('photo-modal-file-input')?.click()}
              >
                <input
                  id="photo-modal-file-input"
                  type="file"
                  accept="image/*"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (file && photoModalCollege) {
                      await handleDirectCardLogoUpload(photoModalCollege.id, file);
                      setPhotoModalCollege(null);
                    }
                  }}
                  className="hidden"
                />
                <div className="w-10 h-10 mx-auto rounded-xl bg-purple-100 text-[#731A73] flex items-center justify-center">
                  <Upload className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-xs font-bold text-gray-800">Click to upload or drag & drop photo</p>
                  <p className="text-[10px] text-gray-400 mt-0.5">Supports PNG, JPG, JPEG, WEBP, SVG</p>
                </div>
              </div>

              {/* Paste Image URL Fallback */}
              <div className="space-y-1.5">
                <label className="block text-[10px] font-bold text-gray-600 uppercase tracking-wider">Or Paste Image URL</label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    placeholder="https://..."
                    value={photoModalUrlInput}
                    onChange={(e) => {
                      setPhotoModalUrlInput(e.target.value);
                      setPhotoModalPreview(e.target.value);
                    }}
                    className="flex-1 text-xs p-2.5 rounded-xl border border-gray-300 font-mono focus:ring-2 focus:ring-purple-500 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => handleSavePhotoModal(photoModalUrlInput)}
                    className="px-3.5 py-2.5 bg-purple-100 hover:bg-purple-200 text-purple-900 rounded-xl text-xs font-bold transition-colors shrink-0"
                  >
                    Apply URL
                  </button>
                </div>
              </div>

              {/* Reset to Default Action */}
              {photoModalCollege.logo_url && (
                <button
                  type="button"
                  onClick={() => handleSavePhotoModal('')}
                  className="w-full py-2 bg-red-50 hover:bg-red-100 text-red-700 rounded-xl text-xs font-bold transition-colors"
                >
                  Remove Custom Logo (Use Default)
                </button>
              )}
            </div>

            {/* Modal Footer */}
            <div className="pt-2 border-t border-gray-100 flex items-center justify-end">
              <button
                type="button"
                onClick={() => setPhotoModalCollege(null)}
                className="px-5 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-xs font-bold transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ──────────────────────────────────────────────────────────
          MODAL: ADD CAMPUS BRANCH
      ────────────────────────────────────────────────────────── */}
      {addBranchCollege && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white rounded-3xl shadow-2xl border border-purple-100 max-w-md w-full p-6 space-y-4 animate-scaleUp">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div className="flex items-center gap-2">
                <MapPin className="w-5 h-5 text-[#731A73]" />
                <div>
                  <h3 className="font-heading font-extrabold text-base text-gray-900">Add Campus Branch</h3>
                  <p className="text-[11px] text-gray-500">{addBranchCollege.display_name}</p>
                </div>
              </div>
              <button onClick={() => setAddBranchCollege(null)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveAddBranch} className="space-y-3 text-xs">
              <div className="space-y-1">
                <label className="block font-bold text-gray-700 text-[10px]">Branch / Campus Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. City Campus / North Wing"
                  value={addBranchForm.name}
                  onChange={(e) => setAddBranchForm({ ...addBranchForm, name: e.target.value })}
                  className="w-full p-2.5 rounded-xl border border-gray-300 font-medium focus:ring-2 focus:ring-purple-500 focus:outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="block font-bold text-gray-700 text-[10px]">Campus Address</label>
                <input
                  type="text"
                  placeholder="e.g. Block B, Knowledge Park"
                  value={addBranchForm.address}
                  onChange={(e) => setAddBranchForm({ ...addBranchForm, address: e.target.value })}
                  className="w-full p-2.5 rounded-xl border border-gray-300 font-medium focus:ring-2 focus:ring-purple-500 focus:outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="block font-bold text-gray-700 text-[10px]">Max Simultaneous Visitor Limit</label>
                <input
                  type="number"
                  min={10}
                  max={5000}
                  value={addBranchForm.max_visitors_inside}
                  onChange={(e) => setAddBranchForm({ ...addBranchForm, max_visitors_inside: parseInt(e.target.value) || 100 })}
                  className="w-full p-2.5 rounded-xl border border-gray-300 font-mono font-bold focus:ring-2 focus:ring-purple-500 focus:outline-none"
                />
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-[#731A73] hover:bg-[#5b125b] text-white rounded-xl font-bold shadow-xs transition-all"
                >
                  Create Branch
                </button>
                <button
                  type="button"
                  onClick={() => setAddBranchCollege(null)}
                  className="py-2.5 px-4 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-bold transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isReportModalOpen && <ReportExporter scope="platform" targetName="Vidyavahini Group Platform" visits={allVisits} branches={branches} onClose={() => setIsReportModalOpen(false)} />}
    </div>
  );
};
