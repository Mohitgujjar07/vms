import React, { useState, useEffect } from 'react';
import { Profile, Branch, Visit, Host, College } from '../../types';
import { vmsService } from '../../services/vmsService';
import { CheckInModal } from './CheckInModal';
import { CheckOutModal } from './CheckOutModal';
import { VimtechLogo } from '../VimtechLogo';
import SpecularButton from '../ui/SpecularButton';
import LightBeamButton from '../ui/LightBeamButton';
import { shareWhatsAppPassDirectly, generatePassImageBlob, copyPassPhotoToClipboard, buildWhatsAppPassMessage } from '../../utils/passImageGenerator';
import {
  Users, UserCheck, QrCode, ShieldAlert, Search,
  Clock, Plus, ArrowUpRight, CheckCircle2, UserCheck2, Copy, Check, Trash2, Star
} from 'lucide-react';

interface ReceptionDashboardProps {
  profile: Profile;
  branch: Branch;
}

export const ReceptionDashboard: React.FC<ReceptionDashboardProps> = ({ profile, branch }) => {
  const [visits, setVisits] = useState<Visit[]>([]);
  const [hosts, setHosts] = useState<Host[]>([]);
  const [preRegVisits, setPreRegVisits] = useState<Visit[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'inside' | 'checked_out'>('all');
  const [isCheckInOpen, setIsCheckInOpen] = useState(false);
  const [isCheckOutOpen, setIsCheckOutOpen] = useState(false);
  const [checkOutTargetVisit, setCheckOutTargetVisit] = useState<Visit | null>(null);
  const [sosSent, setSosSent] = useState(false);
  const [copiedVisitId, setCopiedVisitId] = useState<string | null>(null);
  const [college, setCollege] = useState<College | null>(null);

  const handleCopyPassPhoto = async (visit: Visit) => {
    try {
      await copyPassPhotoToClipboard(visit);
      setCopiedVisitId(visit.id);
      setTimeout(() => setCopiedVisitId(null), 4000);
    } catch (err) {
      console.warn('Copy pass photo error:', err);
      try {
        const blob = await generatePassImageBlob(visit);
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `Gate_Pass_${(visit.visitor_name || 'Visitor').replace(/\s+/g, '_')}.png`;
        link.click();
        alert('Pass photo downloaded to device!');
      } catch (e) {
        console.error('Download error:', e);
      }
    }
  };

  const [currentTime, setCurrentTime] = useState(
    new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })
  );

  useEffect(() => {
    const timer = setInterval(() => {
      setNow(new Date());
      setCurrentTime(
        new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })
      );
    }, 1000);

    if (!branch?.id) {
      return () => clearInterval(timer);
    }

    loadData();
    const unsubscribe = vmsService.subscribeToVisits(branch.id, () => {
      loadData();
    });

    return () => {
      clearInterval(timer);
      unsubscribe();
    };
  }, [branch?.id]);

  const loadData = async () => {
    if (!branch?.id) return;
    const branchVisits = await vmsService.getVisits(branch.id);
    const branchHosts = await vmsService.getHosts(branch.id);
    const preReg = await vmsService.getPreRegisteredVisits(branch.id);
    
    setVisits(branchVisits);
    setHosts(branchHosts);
    setPreRegVisits(preReg);

    if (branch.college_id) {
      const col = await vmsService.getCollegeById(branch.college_id);
      if (col) setCollege(col);
    }
  };

  const handleFastTrackCheckIn = async (visitId: string) => {
    await vmsService.checkInPreRegisteredVisit(visitId);
    loadData();
  };

  const handleRaiseSos = async () => {
    const confirmSos = window.confirm("Are you sure you want to trigger an EMERGENCY SOS ALERT to the Branch Principal?");
    if (confirmSos) {
      await vmsService.raiseSosAlert(
        branch?.id || '22222222-2222-2222-2222-222222222222',
        profile?.id || 'usr-reception',
        profile?.full_name || 'Front Desk Duty Officer',
        "Urgent assistance requested at front desk reception.",
        branch?.name || 'Main Campus Front Gate'
      );
      setSosSent(true);
      setTimeout(() => setSosSent(false), 5000);
    }
  };

  const handleClearVisitorLog = async () => {
    if (window.confirm(`Are you sure you want to clear Today's Visitor Log for ${branch.name}? This will purge visit records for this branch.`)) {
      await vmsService.clearVisits(branch.id);
      await loadData();
    }
  };

  const getWhatsAppShareUrl = (visit: Visit) => {
    const rawPhone = (visit.visitor_phone || '').replace(/\D/g, '');
    const phoneWithCountryCode = rawPhone.length === 10 ? `91${rawPhone}` : rawPhone;
    const message = buildWhatsAppPassMessage(visit, 'visitor');
    return `https://api.whatsapp.com/send?phone=${phoneWithCountryCode}&text=${encodeURIComponent(message)}`;
  };

  const activeVisits = visits.filter(v => v.status === 'inside');
  const todayVisits = visits.filter(v => {
    return new Date(v.check_in_time).toDateString() === new Date().toDateString();
  });

  const filteredVisits = visits.filter(v => {
    const matchesSearch =
      v.visitor_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      v.visitor_phone?.includes(searchQuery) ||
      v.host_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      v.purpose?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || v.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6 pb-12 animate-fadeIn">
      {/* Professional Corporate Header */}
      <div className="vms-header-hero p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Left: Brand & Gate Status */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          {college?.logo_url ? (
            <div className="w-12 h-12 rounded-2xl bg-white p-1 shadow-sm border border-purple-100 flex items-center justify-center shrink-0">
              <img src={college.logo_url} alt={college.name} className="max-w-full max-h-full object-contain" />
            </div>
          ) : college?.display_name && college.display_name !== 'VIMTECH' ? (
            <div className="w-12 h-12 rounded-2xl bg-[#731A73] text-white p-1 shadow-sm border border-purple-100 flex flex-col items-center justify-center shrink-0">
              <span className="font-heading font-black text-xs leading-none tracking-tight">{college.display_name.slice(0, 4)}</span>
              <span className="text-[8px] font-bold uppercase opacity-80 mt-0.5">VMS</span>
            </div>
          ) : (
            <VimtechLogo size="md" showSubtitle={true} />
          )}
          <div className="h-8 w-px bg-slate-200 hidden sm:block" />
          <div className="space-y-0.5">
            <div className="flex items-center gap-2">
              {college?.name && <h2 className="font-heading font-extrabold text-base text-gray-900">{college.name}</h2>}
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                Front Desk Gate Active
              </span>
              <span className="text-slate-300">•</span>
              <span className="text-xs font-medium text-slate-600">{branch.name}</span>
            </div>
            <p className="text-xs text-slate-500 font-medium">
              Duty Officer: <strong className="text-slate-900 font-semibold">{profile.full_name}</strong>
            </p>
          </div>
        </div>

        {/* Right: IST Clock & SOS Trigger */}
        <div className="flex items-center gap-3">
          <div className="px-3.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-right hidden sm:block">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Live IST Clock</p>
            <p className="font-mono text-sm font-bold text-slate-800">{currentTime}</p>
          </div>

          <LightBeamButton
            onClick={handleRaiseSos}
            variant={sosSent ? 'purple' : 'danger'}
            className="px-4 py-2.5 text-xs font-bold shadow-md"
          >
            <ShieldAlert className="w-4 h-4 text-red-300" />
            {sosSent ? 'SOS Broadcasted!' : 'Emergency SOS'}
          </LightBeamButton>
        </div>
      </div>

      {/* Main Check-In / Check-Out Action Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Visitor IN */}
        <button
          onClick={() => setIsCheckInOpen(true)}
          className="p-6 text-left border-2 border-purple-200/90 bg-gradient-to-br from-purple-50/80 via-white to-purple-100/40 hover:border-[#731A73] rounded-3xl shadow-sm hover:shadow-2xl transition-all duration-300 group relative overflow-hidden active:scale-[0.99]"
        >
          {/* Ambient Glow Orb */}
          <div className="absolute -right-8 -top-8 w-40 h-40 bg-[#731A73]/10 rounded-full blur-2xl group-hover:bg-[#731A73]/20 transition-all pointer-events-none" />

          <div className="flex items-center justify-between relative z-10">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#731A73] via-[#5b125b] to-[#450a45] text-white flex items-center justify-center shadow-lg shadow-purple-900/20 group-hover:scale-110 transition-transform duration-300">
              <Plus className="w-7 h-7" />
            </div>
            <span className="px-3.5 py-1.5 bg-purple-100/90 text-[#731A73] rounded-full text-xs font-black uppercase tracking-wider flex items-center gap-1.5 border border-purple-200/90 shadow-sm group-hover:bg-[#731A73] group-hover:text-white transition-colors">
              VISITOR IN <ArrowUpRight className="w-4 h-4" />
            </span>
          </div>
          
          <div className="mt-5 relative z-10">
            <h3 className="font-heading font-extrabold text-xl text-gray-900 group-hover:text-[#731A73] transition-colors flex items-center gap-2">
              New Visitor Check-In
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            </h3>
            <p className="text-xs text-gray-600 mt-1.5 font-medium leading-relaxed">
              Capture visitor phone, photo snap, department host & issue instant single-use digital QR gate pass.
            </p>
          </div>
        </button>

        {/* Visitor OUT */}
        <button
          onClick={() => setIsCheckOutOpen(true)}
          className="p-6 text-left border-2 border-amber-200/90 bg-gradient-to-br from-amber-50/80 via-white to-amber-100/40 hover:border-amber-500 rounded-3xl shadow-sm hover:shadow-2xl transition-all duration-300 group relative overflow-hidden active:scale-[0.99]"
        >
          {/* Ambient Glow Orb */}
          <div className="absolute -right-8 -top-8 w-40 h-40 bg-amber-500/10 rounded-full blur-2xl group-hover:bg-amber-500/20 transition-all pointer-events-none" />

          <div className="flex items-center justify-between relative z-10">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-500 via-amber-600 to-amber-700 text-white flex items-center justify-center shadow-lg shadow-amber-900/20 group-hover:scale-110 transition-transform duration-300">
              <QrCode className="w-7 h-7" />
            </div>
            <span className="px-3.5 py-1.5 bg-amber-100/90 text-amber-900 rounded-full text-xs font-black uppercase tracking-wider flex items-center gap-1.5 border border-amber-200 shadow-sm group-hover:bg-amber-600 group-hover:text-white transition-colors">
              VISITOR OUT <ArrowUpRight className="w-4 h-4" />
            </span>
          </div>

          <div className="mt-5 relative z-10">
            <h3 className="font-heading font-extrabold text-xl text-gray-900 group-hover:text-amber-800 transition-colors flex items-center gap-2">
              Scan QR / Visitor Check-Out
              <span className="px-2 py-0.5 bg-amber-100 text-amber-800 text-[10px] font-black rounded-full font-mono">
                {activeVisits.length} Inside
              </span>
            </h3>
            <p className="text-xs text-gray-600 mt-1.5 font-medium leading-relaxed">
              Scan QR pass with camera or search visitor by phone/name to verify exit timestamp & clear gate.
            </p>
          </div>
        </button>
      </div>



      {/* 4 Premium Metric Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="vms-metric-premium accent-green vms-card-shine">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black text-gray-500 uppercase tracking-wider">Currently Inside</span>
            <div className="w-9 h-9 rounded-xl bg-green-50 text-green-600 flex items-center justify-center">
              <span className="vms-dot-live" />
            </div>
          </div>
          <p className="text-3xl font-extrabold text-green-600 mt-2 font-heading">{activeVisits.length}</p>
          <p className="text-[11px] text-gray-400 mt-1 font-medium">Active visitors on campus</p>
        </div>

        <div className="vms-metric-premium vms-card-shine">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black text-gray-500 uppercase tracking-wider">Today's Visits</span>
            <div className="w-9 h-9 rounded-xl bg-purple-50 text-[#800080] flex items-center justify-center font-bold">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <p className="text-3xl font-extrabold text-[#800080] mt-2 font-heading">{todayVisits.length}</p>
          <p className="text-[11px] text-gray-400 mt-1 font-medium">Total check-ins today</p>
        </div>

        <div className="vms-metric-premium accent-amber vms-card-shine">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black text-gray-500 uppercase tracking-wider">Capacity Limit</span>
            <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
              <ShieldAlert className="w-4 h-4" />
            </div>
          </div>
          <p className="text-3xl font-extrabold text-amber-600 mt-2 font-heading">{branch.max_visitors_inside || '100'}</p>
          <p className="text-[11px] text-gray-400 mt-1 font-medium">Max allowed inside</p>
        </div>

        <div className="vms-metric-premium accent-blue vms-card-shine">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black text-gray-500 uppercase tracking-wider">Available Hosts</span>
            <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
              <UserCheck2 className="w-4 h-4" />
            </div>
          </div>
          <p className="text-3xl font-extrabold text-blue-600 mt-2 font-heading">{hosts.length}</p>
          <p className="text-[11px] text-gray-400 mt-1 font-medium">Staff & Student directory</p>
        </div>
      </div>

      {/* Visitor Log Table */}
      <div className="p-6 space-y-4 bg-white rounded-3xl shadow-sm border border-purple-100">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-gray-100">
          <div>
            <div className="flex items-center gap-3">
              <h3 className="font-heading font-bold text-lg text-gray-900 flex items-center gap-2">
                Today's Visitor Log
                <span className="px-2.5 py-0.5 bg-purple-50 text-[#800080] rounded-full text-xs font-black border border-purple-100">
                  {filteredVisits.length} Records
                </span>
              </h3>
              <button
                onClick={handleClearVisitorLog}
                title="Clear Today's Visitor Log"
                className="px-2.5 py-1 rounded-xl text-xs font-bold bg-red-50 text-red-600 hover:bg-red-100 border border-red-200 transition-all flex items-center gap-1 shadow-xs"
              >
                <Trash2 className="w-3.5 h-3.5" /> Clear Log
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-0.5 font-medium">Real-time check-in/out records for {branch.name}</p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Status Filter Tabs */}
            <div className="inline-flex bg-gray-100/80 p-1 rounded-2xl gap-1 text-xs font-bold border border-gray-200/60 overflow-x-auto">
              <button
                onClick={() => setStatusFilter('all')}
                className={`px-3.5 py-1.5 rounded-xl transition-all ${
                  statusFilter === 'all'
                    ? 'bg-white text-[#800080] shadow-sm font-extrabold'
                    : 'text-gray-500 hover:text-gray-800'
                }`}
              >
                All ({visits.length})
              </button>
              <button
                onClick={() => setStatusFilter('inside')}
                className={`px-3.5 py-1.5 rounded-xl transition-all ${
                  statusFilter === 'inside'
                    ? 'bg-green-600 text-white shadow-sm font-extrabold'
                    : 'text-gray-500 hover:text-gray-800'
                }`}
              >
                Inside ({activeVisits.length})
              </button>
              <button
                onClick={() => setStatusFilter('checked_out')}
                className={`px-3.5 py-1.5 rounded-xl transition-all ${
                  statusFilter === 'checked_out'
                    ? 'bg-[#800080] text-white shadow-sm font-extrabold'
                    : 'text-gray-500 hover:text-gray-800'
                }`}
              >
                Checked Out ({visits.filter(v => v.status === 'checked_out').length})
              </button>
            </div>

            {/* Clean Search Input */}
            <div className="relative flex items-center">
              <Search className="w-4 h-4 text-gray-400 absolute left-3.5 pointer-events-none z-10" />
              <input
                type="text"
                placeholder="Search visitor, phone, host..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-48 sm:w-60 !pl-10 pr-8 py-2.5 text-xs font-medium rounded-2xl border-2 border-gray-200 focus:outline-none focus:border-[#800080] bg-white transition-all"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 text-xs text-gray-400 hover:text-gray-600 font-bold p-0.5"
                >
                  ✕
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Visitor Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-gray-200 text-gray-500 font-extrabold uppercase tracking-wider text-[10px] bg-gray-50/50">
                <th className="py-3.5 px-4">Visitor</th>
                <th className="py-3.5 px-4">Purpose</th>
                <th className="py-3.5 px-4">Host Person</th>
                <th className="py-3.5 px-4">Check-In Time</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredVisits.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-gray-400">
                    <div className="flex flex-col items-center gap-2">
                      <Search className="w-8 h-8 text-gray-300" />
                      <p className="font-semibold text-sm text-gray-500">No visitor records found</p>
                      <p className="text-xs text-gray-400">Try searching a different name, phone, or host</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredVisits.map(v => (
                  <tr key={v.id} className="hover:bg-purple-50/30 transition-colors">
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-3">
                        <img
                          src={v.visitor_photo_url || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=300&q=80'}
                          alt={v.visitor_name}
                          className="w-10 h-10 rounded-xl object-cover ring-2 ring-gray-100 shadow-sm"
                        />
                        <div>
                          <div className="flex items-center gap-1.5">
                            <p className="font-bold text-gray-900 text-xs sm:text-sm">{v.visitor_name}</p>
                            {(v.category === 'AICTE/UNIV' || v.category === 'PLACEMENT' || v.category === 'GOVT' || v.category === 'RECRUITER') && (
                              <span className="px-1.5 py-0.5 bg-amber-100 text-amber-900 rounded font-black text-[9px] uppercase border border-amber-200">
                                ★ VIP
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-gray-500 font-mono">{v.visitor_phone}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-gray-600 font-medium">{v.purpose}</td>
                    <td className="py-3.5 px-4">
                      <p className="text-[#800080] font-bold">{v.host_name}</p>
                      <p className="text-[10px] text-gray-400 font-medium">{v.host_department}</p>
                    </td>
                    <td className="py-3.5 px-4 font-mono text-gray-600 font-medium">
                      {new Date(v.check_in_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="space-y-1">
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold inline-flex items-center gap-1.5 ${
                          v.status === 'inside'
                            ? 'bg-green-50 text-green-700 border border-green-200'
                            : 'bg-gray-100 text-gray-600 border border-gray-200'
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${v.status === 'inside' ? 'bg-green-500' : 'bg-gray-400'}`} />
                          {v.status === 'inside' ? 'Inside' : 'Checked Out'}
                        </span>
                        {v.status === 'checked_out' && (v.rating || v.feedback_comment) && (
                          <div className="flex items-center gap-1 text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-lg border border-amber-200 w-fit" title={v.feedback_comment || 'Visitor Rating'}>
                            <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                            <span>{v.rating || 5}/5 Stars</span>
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => handleCopyPassPhoto(v)}
                          title="Copy Pass Photo to Clipboard"
                          className={`px-2.5 py-1.5 rounded-xl text-xs font-extrabold border transition-all shadow-sm active:scale-95 flex items-center gap-1 ${
                            copiedVisitId === v.id
                              ? 'bg-emerald-600 text-white border-emerald-600'
                              : 'bg-purple-50 hover:bg-purple-100 text-[#731A73] border-purple-200'
                          }`}
                        >
                          {copiedVisitId === v.id ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                          <span className="hidden sm:inline">{copiedVisitId === v.id ? 'Copied' : 'Copy Pass'}</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => shareWhatsAppPassDirectly(v)}
                          title="Generate PNG Pass, Copy to Clipboard, Download & Open WhatsApp Chat"
                          className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-extrabold transition-all shadow-sm active:scale-95 flex items-center gap-1"
                        >
                          💬 <span className="hidden sm:inline">WhatsApp</span>
                        </button>

                        {v.status === 'inside' ? (
                          <button
                            onClick={() => {
                              setCheckOutTargetVisit(v);
                              setIsCheckOutOpen(true);
                            }}
                            className="px-3.5 py-1.5 bg-gradient-to-r from-[#731A73] to-purple-900 hover:from-purple-900 hover:to-purple-950 text-white rounded-xl text-xs font-black shadow-sm transition-all active:scale-95 cursor-pointer"
                          >
                            Check Out
                          </button>
                        ) : (
                          <span className="text-[10px] text-gray-400 font-medium bg-gray-50 px-2 py-1 rounded-lg">Completed</span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modals */}
      {isCheckInOpen && (
        <CheckInModal
          branchId={branch.id}
          collegeId={branch.college_id}
          receptionistId={profile.id}
          receptionistName={profile.full_name}
          hosts={hosts}
          onClose={() => setIsCheckInOpen(false)}
          onSuccess={loadData}
        />
      )}

      {isCheckOutOpen && (
        <CheckOutModal
          branchId={branch.id}
          activeVisits={activeVisits}
          initialVisit={checkOutTargetVisit}
          onClose={() => {
            setIsCheckOutOpen(false);
            setCheckOutTargetVisit(null);
          }}
          onSuccess={loadData}
        />
      )}
    </div>
  );
};
