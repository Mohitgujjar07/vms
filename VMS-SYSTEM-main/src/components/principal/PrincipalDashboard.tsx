import React, { useState, useEffect } from 'react';
import { Profile, Branch, Visit, Host, BlacklistEntry, EmergencySosAlert, College } from '../../types';
import { vmsService } from '../../services/vmsService';
import { ReportExporter } from '../reports/ReportExporter';
import { VimtechLogo } from '../VimtechLogo';
import {
  Users, UserCheck, ShieldAlert, BarChart3, Clock, Plus,
  FileText, Download, Upload, Filter, UserPlus, Trash2, AlertOctagon, CheckCircle2,
  Star, MessageSquare, ThumbsUp
} from 'lucide-react';

interface PrincipalDashboardProps {
  profile: Profile;
  branch: Branch;
}

export const PrincipalDashboard: React.FC<PrincipalDashboardProps> = ({ profile, branch }) => {
  const [activeTab, setActiveTab] = useState<'analytics' | 'inside' | 'feedback' | 'hosts' | 'staff' | 'blacklist'>('analytics');
  const [visits, setVisits] = useState<Visit[]>([]);
  const [hosts, setHosts] = useState<Host[]>([]);
  const [blacklist, setBlacklist] = useState<BlacklistEntry[]>([]);
  const [staff, setStaff] = useState<Profile[]>([]);
  const [activeSosAlerts, setActiveSosAlerts] = useState<EmergencySosAlert[]>([]);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);

  // Directory filter & host add form
  const [selectedDeptFilter, setSelectedDeptFilter] = useState('all');
  const [isAddingHost, setIsAddingHost] = useState(false);
  const [newHostName, setNewHostName] = useState('');
  const [newHostType, setNewHostType] = useState<'staff' | 'student'>('staff');
  const [newHostDept, setNewHostDept] = useState('');

  // CSV Import State
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvStatus, setCsvStatus] = useState<string | null>(null);

  // Add Staff State
  const [isAddingStaff, setIsAddingStaff] = useState(false);
  const [newStaffLoginId, setNewStaffLoginId] = useState('');
  const [newStaffFullName, setNewStaffFullName] = useState('');

  // Add Blacklist State
  const [isAddingBlacklist, setIsAddingBlacklist] = useState(false);
  const [newBlPhone, setNewBlPhone] = useState('');
  const [newBlReason, setNewBlReason] = useState('');

  const [college, setCollege] = useState<College | null>(null);

  useEffect(() => {
    if (!branch?.id) return;
    loadData();
    const unsubscribe = vmsService.subscribe(() => {
      loadData();
    });
    return () => unsubscribe();
  }, [branch?.id]);

  const loadData = async () => {
    if (!branch?.id) return;
    setVisits(await vmsService.getVisits(branch.id));
    setHosts(await vmsService.getHosts(branch.id));
    setBlacklist(await vmsService.getBlacklist(branch.id));
    setStaff(await vmsService.getBranchStaff(branch.id));
    setActiveSosAlerts(await vmsService.getActiveSosAlerts(branch.id));
    if (branch.college_id) {
      const col = await vmsService.getCollegeById(branch.college_id);
      if (col) setCollege(col);
    }
  };

  const handleAddHost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newHostName || !newHostDept) return;
    await vmsService.addHost({
      college_id: branch.college_id,
      branch_id: branch.id,
      name: newHostName,
      type: newHostType,
      department_or_class: newHostDept
    });
    setNewHostName('');
    setNewHostDept('');
    setIsAddingHost(false);
    loadData();
  };

  const downloadCsvTemplate = () => {
    const csvContent = "Name,Type,Department\nProf. M. K. Sharma,staff,BCA\nDr. S. R. Nambiar,staff,MBA\nRahul V. Gowda,student,BBA 3rd Sem\nAnanya R. Rao,student,BCA 5th Sem";
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sample_host_import_template_${branch.name.toLowerCase().replace(/\s+/g, '_')}.csv`;
    a.click();
  };

  const handleCsvImport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!csvFile) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      const text = evt.target?.result as string;
      const lines = text.split('\n').filter(line => line.trim().length > 0);

      let successCount = 0;
      for (let i = 1; i < lines.length; i++) {
        const parts = lines[i].split(',').map(p => p.trim());
        if (parts.length >= 3 && parts[0] && parts[1] && parts[2]) {
          const typeVal = parts[1].toLowerCase().includes('student') ? 'student' : 'staff';
          await vmsService.addHost({
            college_id: branch.college_id,
            branch_id: branch.id,
            name: parts[0],
            type: typeVal,
            department_or_class: parts[2]
          });
          successCount++;
        }
      }

      setCsvStatus(`Successfully imported ${successCount} hosts into ${branch.name} directory!`);
      setCsvFile(null);
      loadData();
      setTimeout(() => setCsvStatus(null), 5000);
    };
    reader.readAsText(csvFile);
  };

  const handleCreateStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStaffLoginId || !newStaffFullName) return;
    await vmsService.createStaffAccount({
      login_id: newStaffLoginId,
      full_name: newStaffFullName,
      role: 'receptionist',
      college_id: branch.college_id,
      branch_id: branch.id
    });
    setNewStaffLoginId('');
    setNewStaffFullName('');
    setIsAddingStaff(false);
    loadData();
  };

  const handleAddBlacklist = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBlPhone || !newBlReason) return;
    await vmsService.addToBlacklist({
      college_id: branch.college_id,
      branch_id: branch.id,
      visitor_phone: newBlPhone,
      reason: newBlReason,
      added_by_profile_id: profile.id,
      scope: 'branch'
    });
    setNewBlPhone('');
    setNewBlReason('');
    setIsAddingBlacklist(false);
    loadData();
  };

  const activeVisits = visits.filter(v => v.status === 'inside');

  const filteredHosts = hosts.filter(h => {
    if (selectedDeptFilter === 'all') return true;
    return h.department_or_class?.toLowerCase().includes(selectedDeptFilter.toLowerCase());
  });

  return (
    <div className="space-y-6 pb-12 animate-fadeIn">
      {/* Active Emergency SOS Alert Banner */}
      {activeSosAlerts.length > 0 && (
        <div className="p-5 bg-gradient-to-r from-red-600 via-red-700 to-red-600 text-white rounded-2xl shadow-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-2 border-red-300 animate-pulse">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-white text-red-600 flex items-center justify-center shrink-0 shadow-lg animate-bounce">
              <AlertOctagon className="w-7 h-7" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 bg-amber-300 text-red-950 font-black text-[10px] uppercase rounded-full tracking-wider">
                  CRITICAL EMERGENCY SOS
                </span>
                <span className="text-[10px] text-white/80 font-mono">
                  {new Date(activeSosAlerts[0].created_at).toLocaleTimeString()}
                </span>
              </div>
              <h4 className="font-heading font-black text-lg text-white mt-0.5">
                Front Desk Call from {activeSosAlerts[0].receptionist_name}
              </h4>
              <p className="text-xs text-red-100 mt-0.5 font-medium">
                "{activeSosAlerts[0].message}"
              </p>
            </div>
          </div>
          <button
            onClick={async () => {
              await vmsService.dismissSosAlert(activeSosAlerts[0].id);
              loadData();
            }}
            className="px-5 py-2.5 bg-white hover:bg-red-50 text-red-700 font-extrabold rounded-xl text-xs shadow-lg flex items-center gap-2 shrink-0 transition-all active:scale-95"
          >
            <CheckCircle2 className="w-4 h-4 text-green-600" /> Acknowledge & Clear SOS
          </button>
        </div>
      )}

      {/* Professional Corporate Header */}
      <div className="vms-header-hero p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        {/* Left: Brand & Principal Office Info */}
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
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-purple-50 text-purple-700 border border-purple-200">
                <span className="w-2 h-2 rounded-full bg-[#731A73] animate-pulse" />
                Principal Office
              </span>
              <span className="text-slate-300">•</span>
              <span className="text-xs font-medium text-slate-600">{branch.name} Campus</span>
            </div>
            <p className="text-xs text-slate-500 font-medium">
              Campus Principal: <strong className="text-slate-900 font-semibold">{profile.full_name}</strong>
            </p>
          </div>
        </div>

        {/* Right: Occupancy Gauge & Export Button */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="px-3.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-right hidden sm:block">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Campus Gate Density</p>
            <div className="flex items-center gap-2.5">
              <div className="w-24 bg-slate-200 rounded-full h-2 overflow-hidden">
                <div
                  className={`h-full transition-all duration-500 ${
                    Math.round((activeVisits.length / (branch.max_visitors_inside || 100)) * 100) > 80
                      ? 'bg-red-500'
                      : Math.round((activeVisits.length / (branch.max_visitors_inside || 100)) * 100) > 50
                      ? 'bg-amber-500'
                      : 'bg-emerald-500'
                  }`}
                  style={{ width: `${Math.min(100, Math.max(5, Math.round((activeVisits.length / (branch.max_visitors_inside || 100)) * 100)))}%` }}
                />
              </div>
              <span className="font-mono font-bold text-xs text-slate-800">
                {Math.round((activeVisits.length / (branch.max_visitors_inside || 100)) * 100)}%
              </span>
            </div>
          </div>

          <button onClick={() => setIsReportModalOpen(true)} className="px-4 py-2.5 rounded-xl font-bold text-xs flex items-center gap-2 shrink-0 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 shadow-sm transition-all">
            <FileText className="w-4 h-4 text-purple-700" /> Export Reports
          </button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex bg-white p-1.5 rounded-2xl shadow-sm border border-purple-100 gap-1 overflow-x-auto text-xs font-bold">
        {[
          { id: 'analytics', label: '📊 Executive Analytics' },
          { id: 'inside', label: `🟢 Currently Inside (${activeVisits.length})` },
          { id: 'feedback', label: `⭐ Visitor Feedback (${visits.filter(v => v.rating || v.feedback_comment).length})` },
          { id: 'hosts', label: `👥 Host Directory (${hosts.length})` },
          { id: 'staff', label: `🔑 Staff Control (${staff.length})` },
          { id: 'blacklist', label: `🚫 Security Blacklist (${blacklist.length})` },
        ].map(tab => (
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

      {/* Tab: Executive Analytics */}
      {activeTab === 'analytics' && (() => {
        const completedVisits = visits.filter(v => v.check_in_time && v.check_out_time);
        const avgDurationMins = completedVisits.length > 0 
          ? Math.round(completedVisits.reduce((acc, v) => acc + (new Date(v.check_out_time!).getTime() - new Date(v.check_in_time).getTime()) / 60000, 0) / completedVisits.length)
          : 42;

        const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        const dayCounts = [0, 0, 0, 0, 0, 0, 0];
        visits.forEach(v => {
          const d = new Date(v.check_in_time).getDay();
          dayCounts[d]++;
        });
        const orderedDays = [1, 2, 3, 4, 5, 6, 0];
        const maxDayCount = Math.max(...dayCounts, 1);
        const weeklyData = orderedDays.map(dayIdx => ({
          day: dayNames[dayIdx],
          count: dayCounts[dayIdx],
          h: `${Math.max(12, Math.round((dayCounts[dayIdx] / maxDayCount) * 100))}%`
        }));
        const peakDay = weeklyData.reduce((prev, curr) => (curr.count > prev.count ? curr : prev), weeklyData[0]);

        let slot1 = 0, slot2 = 0, slot3 = 0, slot4 = 0;
        visits.forEach(v => {
          const hr = new Date(v.check_in_time).getHours();
          if (hr >= 9 && hr < 11) slot1++;
          else if (hr >= 11 && hr < 13) slot2++;
          else if (hr >= 13 && hr < 15) slot3++;
          else if (hr >= 15 && hr < 17) slot4++;
        });
        const totalSlots = Math.max(slot1 + slot2 + slot3 + slot4, 1);
        const peakSlots = [
          { time: '09:00 – 11:00 AM', count: slot1, pct: `${Math.max(10, Math.round((slot1 / totalSlots) * 100))}%`, label: 'Morning Rush', tag: 'bg-amber-50 text-amber-800 border-amber-200' },
          { time: '11:00 AM – 01:00 PM', count: slot2, pct: `${Math.max(10, Math.round((slot2 / totalSlots) * 100))}%`, label: 'Peak Traffic', tag: 'bg-purple-50 text-[#800080] border-purple-200' },
          { time: '01:00 – 03:00 PM', count: slot3, pct: `${Math.max(10, Math.round((slot3 / totalSlots) * 100))}%`, label: 'Post-Lunch', tag: 'bg-green-50 text-green-700 border-green-200' },
          { time: '03:00 – 05:00 PM', count: slot4, pct: `${Math.max(10, Math.round((slot4 / totalSlots) * 100))}%`, label: 'Evening Exit', tag: 'bg-purple-50 text-[#800080] border-purple-200' },
        ];

        return (
          <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="vms-metric-premium vms-card-shine">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black text-gray-500 uppercase tracking-wider">Total Campus Visits</span>
                  <div className="w-9 h-9 rounded-xl bg-purple-50 text-[#800080] flex items-center justify-center font-bold">
                    <Users className="w-5 h-5" />
                  </div>
                </div>
                <p className="text-3xl font-extrabold text-[#800080] mt-2 font-heading">{visits.length}</p>
                <span className="text-[11px] text-green-600 font-bold mt-1 inline-flex items-center gap-1">
                  ↑ Dynamic live count
                </span>
              </div>

              <div className="vms-metric-premium accent-green vms-card-shine">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black text-gray-500 uppercase tracking-wider">Currently Inside</span>
                  <div className="w-9 h-9 rounded-xl bg-green-50 text-green-600 flex items-center justify-center font-bold">
                    <span className="vms-dot-live" />
                  </div>
                </div>
                <p className="text-3xl font-extrabold text-green-600 mt-2 font-heading">{activeVisits.length}</p>
                <span className="text-[11px] text-gray-400 font-medium mt-1 inline-block">
                  Active on campus right now
                </span>
              </div>

              <div className="vms-metric-premium accent-amber vms-card-shine">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black text-gray-500 uppercase tracking-wider">Avg. Stay Duration</span>
                  <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
                    <Clock className="w-5 h-5" />
                  </div>
                </div>
                <p className="text-3xl font-extrabold text-amber-600 mt-2 font-heading">{avgDurationMins} min</p>
                <span className="text-[11px] text-amber-700 font-bold mt-1 inline-block">
                  Computed from completed visits
                </span>
              </div>

              <div className="vms-metric-premium accent-red vms-card-shine">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black text-gray-500 uppercase tracking-wider">Security Blacklist</span>
                  <div className="w-9 h-9 rounded-xl bg-red-50 text-red-600 flex items-center justify-center font-bold">
                    <ShieldAlert className="w-5 h-5" />
                  </div>
                </div>
                <p className="text-3xl font-extrabold text-red-600 mt-2 font-heading">{blacklist.length}</p>
                <span className="text-[11px] text-red-600 font-bold mt-1 inline-block">
                  Blocked entries
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Weekly Bar Chart */}
              <div className="p-6 space-y-4 bg-white rounded-3xl shadow-sm border border-purple-100">
                <div className="flex items-center justify-between">
                  <h3 className="font-heading font-extrabold text-base text-gray-900 flex items-center gap-2">
                    <BarChart3 className="w-5 h-5 text-[#800080]" /> Weekly Visitor Traffic
                  </h3>
                  <span className="text-xs font-mono font-bold text-[#800080]">Peak: {peakDay.day} ({peakDay.count})</span>
                </div>
                <div className="h-52 flex items-end justify-between gap-2.5 pt-6 pb-2 px-2 border-b border-gray-100">
                  {weeklyData.map((bar, i) => (
                    <div key={i} className="flex-1 flex flex-col items-center gap-2 group cursor-pointer">
                      <span className="text-[11px] font-mono font-extrabold text-[#800080] opacity-0 group-hover:opacity-100 transition-all duration-200 bg-purple-50 px-2 py-0.5 rounded-lg border border-purple-100 shadow-md">
                        {bar.count}
                      </span>
                      <div className="w-full bg-purple-50/40 rounded-2xl overflow-hidden flex items-end h-36 border border-purple-100/60">
                        <div
                          className="w-full rounded-2xl group-hover:brightness-110 transition-all duration-500 shadow-sm vms-bar-grow"
                          style={{ height: bar.h, background: 'linear-gradient(180deg, #a53aed, #4A124A)', animationDelay: `${i * 0.08}s` }}
                        />
                      </div>
                      <span className="text-xs font-bold text-gray-600 group-hover:text-[#800080] transition-colors">{bar.day}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Peak Hours */}
              <div className="p-6 space-y-4 bg-white rounded-3xl shadow-sm border border-amber-100">
                <div className="flex items-center justify-between">
                  <h3 className="font-heading font-extrabold text-base text-gray-900 flex items-center gap-2">
                    <Clock className="w-5 h-5 text-amber-600" /> Peak Visiting Hours Heatmap
                  </h3>
                  <span className="px-2.5 py-1 bg-amber-50 text-amber-800 rounded-full text-[10px] font-extrabold border border-amber-200">Live Traffic</span>
                </div>
                <div className="space-y-3.5 pt-1">
                  {peakSlots.map((item, idx) => (
                    <div key={idx} className="space-y-1.5 bg-gray-50/60 p-3 rounded-2xl border border-gray-100">
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-gray-800 font-bold flex items-center gap-2">
                          {item.time}
                          <span className={`px-2 py-0.5 rounded text-[9px] font-bold border ${item.tag}`}>{item.label}</span>
                        </span>
                        <span className="text-[#800080] font-extrabold font-mono">{item.count} visitors</span>
                      </div>
                      <div className="w-full bg-gray-200 h-2 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-amber-500 to-[#800080]"
                          style={{ width: item.pct }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Tab: Currently Inside */}
      {activeTab === 'inside' && (
        <div className="p-6 space-y-4 bg-white rounded-3xl shadow-sm border border-purple-100">
          <h3 className="font-heading font-bold text-lg text-gray-900">Visitors Currently Inside Campus</h3>
          <div className="divide-y divide-gray-100 text-xs">
            {activeVisits.length === 0 ? <p className="py-8 text-center text-gray-400 font-medium">No active visitors on campus right now.</p> : activeVisits.map(v => (
              <div key={v.id} className="py-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <img src={v.visitor_photo_url} alt="" className="w-10 h-10 rounded-xl object-cover ring-2 ring-gray-100" />
                  <div>
                    <p className="font-bold text-gray-900 text-sm">{v.visitor_name}</p>
                    <p className="text-gray-500 font-mono">{v.visitor_phone}</p>
                    <p className="text-[#800080] font-semibold">Host: {v.host_name}</p>
                  </div>
                </div>
                <button onClick={async () => { await vmsService.manualCheckOut(v.id); loadData(); }}
                  className="px-3 py-1.5 bg-red-50 text-red-700 rounded-xl font-bold text-xs border border-red-200 hover:bg-red-100 transition-colors">Force Check Out</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab: Visitor Feedback */}
      {activeTab === 'feedback' && (() => {
        const feedbackVisits = visits.filter(v => v.rating || v.feedback_comment);
        const ratedVisits = visits.filter(v => v.rating && v.rating > 0);
        const avgRating = ratedVisits.length > 0
          ? (ratedVisits.reduce((acc, v) => acc + (v.rating || 0), 0) / ratedVisits.length).toFixed(1)
          : '5.0';

        const count5 = ratedVisits.filter(v => v.rating === 5).length;
        const count4 = ratedVisits.filter(v => v.rating === 4).length;
        const count3 = ratedVisits.filter(v => v.rating === 3).length;
        const count2 = ratedVisits.filter(v => v.rating === 2).length;
        const count1 = ratedVisits.filter(v => v.rating === 1).length;
        const totalRated = ratedVisits.length || 1;

        return (
          <div className="space-y-6 animate-fadeIn">
            {/* Feedback Overview Header Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="p-5 bg-gradient-to-br from-amber-500 via-amber-600 to-amber-700 text-white rounded-3xl shadow-xl flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-black uppercase tracking-wider text-amber-200">Overall Visitor Rating</span>
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
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black text-gray-500 uppercase tracking-wider">Total Reviews</span>
                  <div className="w-9 h-9 rounded-xl bg-purple-50 text-[#731A73] flex items-center justify-center font-bold">
                    <MessageSquare className="w-5 h-5" />
                  </div>
                </div>
                <p className="text-3xl font-extrabold text-[#731A73] mt-2 font-heading">{feedbackVisits.length}</p>
                <p className="text-[11px] text-gray-400 mt-1 font-medium">Feedback records collected</p>
              </div>

              <div className="vms-metric-premium accent-green vms-card-shine">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black text-gray-500 uppercase tracking-wider">Satisfaction Rate</span>
                  <div className="w-9 h-9 rounded-xl bg-green-50 text-green-600 flex items-center justify-center font-bold">
                    <ThumbsUp className="w-5 h-5" />
                  </div>
                </div>
                <p className="text-3xl font-extrabold text-green-600 mt-2 font-heading">
                  {Math.round(((count5 + count4) / totalRated) * 100)}%
                </p>
                <p className="text-[11px] text-green-700 font-bold mt-1">Positive (4 & 5 Star) feedback</p>
              </div>
            </div>

            {/* Star Distribution Breakdown */}
            <div className="p-6 bg-white rounded-3xl border border-purple-100 shadow-sm space-y-3">
              <h3 className="font-heading font-extrabold text-base text-gray-900 flex items-center gap-2">
                <Star className="w-5 h-5 text-amber-500 fill-amber-400" /> Star Rating Distribution
              </h3>
              <div className="space-y-2 pt-1">
                {[
                  { star: 5, count: count5, label: '5 Stars (Excellent)' },
                  { star: 4, count: count4, label: '4 Stars (Great)' },
                  { star: 3, count: count3, label: '3 Stars (Good)' },
                  { star: 2, count: count2, label: '2 Stars (Fair)' },
                  { star: 1, count: count1, label: '1 Star (Poor)' },
                ].map((item) => {
                  const pct = Math.round((item.count / totalRated) * 100);
                  return (
                    <div key={item.star} className="flex items-center gap-3 text-xs">
                      <span className="w-28 font-bold text-gray-700 flex items-center gap-1">
                        {item.star} <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400 inline" /> ({item.count})
                      </span>
                      <div className="flex-1 bg-gray-100 rounded-full h-3 overflow-hidden">
                        <div
                          className="bg-amber-400 h-full rounded-full transition-all duration-500"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="w-12 text-right font-mono font-bold text-gray-600">{pct}%</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Feedback Feed / Comments Table */}
            <div className="p-6 bg-white rounded-3xl border border-purple-100 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-heading font-bold text-lg text-gray-900">Recent Visitor Experience Feedback Logs</h3>
                  <p className="text-xs text-gray-500">Collected during gate exit & visitor checkout</p>
                </div>
                <button
                  onClick={() => setIsReportModalOpen(true)}
                  className="px-3.5 py-2 bg-purple-50 hover:bg-purple-100 text-[#731A73] border border-purple-200 text-xs font-bold rounded-xl flex items-center gap-1.5 transition-all shadow-2xs"
                >
                  <FileText className="w-4 h-4" /> Download PDF/Excel Report
                </button>
              </div>

              <div className="space-y-3">
                {feedbackVisits.length === 0 ? (
                  <div className="text-center py-10 bg-purple-50/40 rounded-2xl border border-dashed border-purple-200">
                    <MessageSquare className="w-8 h-8 text-purple-300 mx-auto mb-2" />
                    <p className="text-xs text-gray-500 font-bold">No visitor feedback records submitted yet.</p>
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
                            Visited: {v.host_name} ({v.purpose})
                          </p>
                          {v.feedback_comment && (
                            <p className="text-xs text-gray-800 bg-white p-2 rounded-xl border border-purple-100 italic font-medium">
                              "{v.feedback_comment}"
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="text-right shrink-0 text-xs text-gray-500 font-mono">
                        <p className="font-bold text-gray-700">Checked Out</p>
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

      {/* Tab: Host Directory */}
      {activeTab === 'hosts' && (
        <div className="space-y-6">
          <div className="p-6 space-y-4 border-l-4 border-l-[#800080] bg-white rounded-3xl shadow-sm border border-purple-100">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="font-heading font-bold text-base text-gray-900 flex items-center gap-2">
                  <Upload className="w-5 h-5 text-[#800080]" /> Bulk CSV Host Import
                </h3>
                <p className="text-xs text-gray-500 mt-0.5 font-medium">
                  Import staff & student hosts in bulk. Expected columns: <code className="text-[#800080] bg-purple-50 px-1.5 py-0.5 rounded border border-purple-100 font-mono font-bold">Name, Type, Department</code>
                </p>
              </div>
              <button onClick={downloadCsvTemplate} className="px-4 py-2 bg-gray-50 hover:bg-purple-50 text-[#731A73] border border-purple-200 rounded-xl text-xs flex items-center gap-1.5 shrink-0 font-bold shadow-sm">
                <Download className="w-4 h-4" /> Download Sample CSV Template
              </button>
            </div>

            <form onSubmit={handleCsvImport} className="space-y-3">
              <div className="flex flex-col sm:flex-row items-center gap-3">
                <input
                  type="file"
                  accept=".csv"
                  onChange={(e) => setCsvFile(e.target.files?.[0] || null)}
                  className="text-xs w-full sm:w-auto file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-purple-50 file:text-[#800080] hover:file:bg-purple-100"
                />
                <button type="submit" disabled={!csvFile} className="px-5 py-2.5 bg-gradient-to-r from-[#731A73] to-[#5b125b] text-white rounded-xl text-xs disabled:opacity-50 font-bold shadow-md">
                  Upload & Commit to Directory
                </button>
              </div>
              {csvFile && (
                <div className="p-3 bg-purple-50/60 border border-purple-200 rounded-xl text-xs flex items-center justify-between text-purple-900 font-mono">
                  <span>Selected CSV File: <strong>{csvFile.name}</strong> ({(csvFile.size / 1024).toFixed(1)} KB)</span>
                  <span className="text-green-700 font-bold">✓ Ready to Process</span>
                </div>
              )}
              {csvStatus && <p className="text-xs text-green-600 font-bold bg-green-50 p-2.5 rounded-xl border border-green-200">{csvStatus}</p>}
            </form>
          </div>

          <div className="p-6 space-y-4 bg-white rounded-3xl shadow-sm border border-purple-100">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <h3 className="font-heading font-bold text-lg text-gray-900">VIMTECH Staff & Student Directory</h3>
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-[#800080]" />
                <select value={selectedDeptFilter} onChange={(e) => setSelectedDeptFilter(e.target.value)} className="text-xs py-2 px-3 rounded-xl border border-gray-300 font-medium">
                  <option value="all">All Departments</option>
                  <option value="BCA">BCA</option><option value="BBA">BBA</option><option value="MBA">MBA</option>
                  <option value="CDC">CDC</option><option value="IQAC">IQAC</option><option value="Administration">Administration</option>
                </select>
                <button onClick={() => setIsAddingHost(!isAddingHost)} className="px-4 py-2 bg-gradient-to-r from-[#731A73] to-[#5b125b] text-white rounded-xl text-xs font-bold flex items-center gap-1.5"><Plus className="w-4 h-4" /> Add Host</button>
              </div>
            </div>
            {isAddingHost && (
              <form onSubmit={handleAddHost} className="p-4 grid grid-cols-1 sm:grid-cols-4 gap-3 bg-purple-50/30 border border-purple-100 rounded-2xl">
                <input type="text" required placeholder="Full Name" value={newHostName} onChange={(e) => setNewHostName(e.target.value)} className="text-xs p-2.5 rounded-xl border border-gray-300" />
                <select value={newHostType} onChange={(e) => setNewHostType(e.target.value as any)} className="text-xs p-2.5 rounded-xl border border-gray-300"><option value="staff">Staff</option><option value="student">Student</option></select>
                <input type="text" required placeholder="Department" value={newHostDept} onChange={(e) => setNewHostDept(e.target.value)} className="text-xs p-2.5 rounded-xl border border-gray-300" />
                <button type="submit" className="px-4 py-2.5 bg-[#731A73] text-white font-bold rounded-xl text-xs">Save</button>
              </form>
            )}
            <div className="divide-y divide-gray-100 text-xs">
              {filteredHosts.map(h => (
                <div key={h.id} className="py-3 flex items-center justify-between">
                  <div><p className="font-bold text-gray-900 text-sm">{h.name}</p><p className="text-gray-500 font-medium">{h.department_or_class}</p></div>
                  <span className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold border ${h.type === 'staff' ? 'bg-purple-50 text-[#800080] border-purple-200' : 'bg-blue-50 text-blue-700 border-blue-200'}`}>{h.type}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Tab: Staff Control */}
      {activeTab === 'staff' && (
        <div className="p-6 space-y-4 bg-white rounded-3xl shadow-sm border border-purple-100">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-heading font-bold text-lg text-gray-900">Receptionist & Staff Accounts</h3>
              <p className="text-xs text-gray-500 font-medium">Manage operational staff accounts for {branch.name}</p>
            </div>
            <button onClick={() => setIsAddingStaff(!isAddingStaff)} className="px-4 py-2 bg-[#731A73] text-white rounded-xl text-xs font-bold flex items-center gap-1.5"><UserPlus className="w-4 h-4" /> Create Account</button>
          </div>
          {isAddingStaff && (
            <form onSubmit={handleCreateStaff} className="p-4 grid grid-cols-1 sm:grid-cols-3 gap-3 bg-purple-50/30 border border-purple-100 rounded-2xl">
              <input type="text" required placeholder="Login ID" value={newStaffLoginId} onChange={(e) => setNewStaffLoginId(e.target.value)} className="text-xs p-2.5 rounded-xl border border-gray-300" />
              <input type="text" required placeholder="Full Name" value={newStaffFullName} onChange={(e) => setNewStaffFullName(e.target.value)} className="text-xs p-2.5 rounded-xl border border-gray-300" />
              <button type="submit" className="px-4 py-2.5 bg-[#731A73] text-white font-bold rounded-xl text-xs">Create</button>
            </form>
          )}
          <div className="divide-y divide-gray-100 text-xs">
            {staff.map(s => (
              <div key={s.id} className="py-3 flex items-center justify-between">
                <div>
                  <p className="font-bold text-gray-900 text-sm">{s.full_name}</p>
                  <p className="text-[#800080] font-mono">{s.login_id}</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={async () => {
                      await vmsService.resetStaffPassword(s.id);
                      alert(`Password reset requested for ${s.full_name}. User will be prompted on next login.`);
                      loadData();
                    }}
                    className="px-3 py-1.5 text-xs text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl font-bold"
                  >
                    Reset Password
                  </button>
                  <button onClick={async () => { await vmsService.toggleStaffStatus(s.id); loadData(); }}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-bold border ${s.is_active ? 'bg-red-50 text-red-700 border-red-200' : 'bg-green-50 text-green-700 border-green-200'}`}>
                    {s.is_active ? 'Deactivate' : 'Reactivate'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab: Security Blacklist */}
      {activeTab === 'blacklist' && (
        <div className="p-6 space-y-4 bg-white rounded-3xl shadow-sm border border-purple-100">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-heading font-bold text-lg text-gray-900">Branch Blacklist & Security Blocklist</h3>
              <p className="text-xs text-gray-500 font-medium">Manage blacklisted visitor numbers for {branch.name}</p>
            </div>
            <button onClick={() => setIsAddingBlacklist(!isAddingBlacklist)} className="px-4 py-2 bg-red-600 text-white rounded-xl text-xs font-bold flex items-center gap-1.5"><Plus className="w-4 h-4" /> Add Entry</button>
          </div>
          {isAddingBlacklist && (
            <form onSubmit={handleAddBlacklist} className="p-4 space-y-3 bg-red-50/30 border border-red-100 rounded-2xl">
              <input type="tel" required placeholder="Phone (+91...)" value={newBlPhone} onChange={(e) => setNewBlPhone(e.target.value)} className="w-full text-xs p-2.5 rounded-xl border border-gray-300" />
              <textarea required placeholder="Reason..." value={newBlReason} onChange={(e) => setNewBlReason(e.target.value)} className="w-full text-xs p-2.5 rounded-xl border border-gray-300 h-20" />
              <button type="submit" className="px-4 py-2.5 bg-red-600 text-white font-bold rounded-xl text-xs">Save</button>
            </form>
          )}
          <div className="divide-y divide-gray-100 text-xs">
            {blacklist.map(b => (
              <div key={b.id} className="py-3 flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-mono font-bold text-red-700 text-sm">{b.visitor_phone}</p>
                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                      b.scope === 'college' || b.escalated_to_college
                        ? 'bg-purple-50 text-[#800080] border-purple-200'
                        : 'bg-amber-50 text-amber-700 border-amber-200'
                    }`}>
                      {b.scope === 'college' || b.escalated_to_college ? 'COLLEGE-WIDE BAN' : 'BRANCH BAN'}
                    </span>
                  </div>
                  <p className="text-gray-600 mt-0.5 font-medium">{b.reason}</p>
                </div>
                <div className="flex items-center gap-2">
                  {!b.escalated_to_college && b.scope !== 'college' && (
                    <button
                      onClick={async () => {
                        await vmsService.escalateBlacklistEntry(b.id);
                        loadData();
                      }}
                      className="px-3 py-1.5 text-xs bg-purple-50 text-[#800080] hover:bg-purple-100 border border-purple-200 rounded-xl font-extrabold"
                    >
                      Escalate to College Ban
                    </button>
                  )}
                  <button onClick={async () => { await vmsService.removeFromBlacklist(b.id); loadData(); }} className="p-2 text-gray-400 hover:text-red-600">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {isReportModalOpen && <ReportExporter scope="branch" targetName={branch.name} visits={visits} onClose={() => setIsReportModalOpen(false)} />}
    </div>
  );
};
