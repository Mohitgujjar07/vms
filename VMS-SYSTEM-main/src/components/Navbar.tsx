import React, { useState, useEffect } from 'react';
import { Profile, College, Branch } from '../types';
import { syncEngine } from '../offline/syncEngine';
import { VimtechLogo } from './VimtechLogo';
import SpecularButton from './ui/SpecularButton';
import LightBeamButton from './ui/LightBeamButton';
import {
  User, LogOut, Wifi, WifiOff,
  RefreshCw, ChevronDown, CheckCircle2, MapPin, Menu, X
} from 'lucide-react';

interface NavbarProps {
  currentProfile: Profile;
  activeCollege: College;
  activeBranch?: Branch;
  colleges: College[];
  branches: Branch[];
  onSelectCollege: (collegeId: string) => void;
  onSelectBranch: (branchId: string) => void;
  onLogout: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentProfile,
  activeCollege,
  activeBranch,
  colleges,
  branches,
  onSelectCollege,
  onSelectBranch,
  onLogout
}) => {

  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingCount, setPendingCount] = useState(0);
  const [isRoleDropdownOpen, setIsRoleDropdownOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);


  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    const interval = setInterval(async () => {
      const count = await syncEngine.getPendingCount();
      setPendingCount(count);
    }, 2000);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(interval);
    };
  }, []);

  return (
    <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-xl border-b border-purple-100/90 shadow-sm shadow-purple-950/5">

      {/* Main header */}
      <div className="max-w-7xl mx-auto px-3 sm:px-6 py-3 flex items-center justify-between gap-3">
        {/* Left: Logo */}
        <div className="flex items-center gap-3">
          {activeCollege?.logo_url && currentProfile.role !== 'super_admin' ? (
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-xl bg-white p-1 shadow-sm border border-purple-100 flex items-center justify-center shrink-0">
                <img src={activeCollege.logo_url} alt={activeCollege.name} className="max-w-full max-h-full object-contain" />
              </div>
              <div className="hidden sm:block">
                <h1 className="font-heading font-black text-sm text-gray-900 tracking-tight leading-none">{activeCollege.name}</h1>
                <p className="text-[10px] font-bold text-purple-700 tracking-wider uppercase mt-0.5">Visitor Management System</p>
              </div>
            </div>
          ) : (
            <VimtechLogo size="md" showSubtitle={true} />
          )}
        </div>

        {/* Right Actions for Desktop & Mobile */}
        <div className="flex items-center gap-2.5">

          {/* Multi-Tenant College Switcher (Desktop) */}
          {currentProfile.role === 'super_admin' && colleges.length > 0 && (
            <div className="hidden md:flex items-center gap-2 vms-input py-1.5 px-3 text-xs bg-white shadow-xs border border-purple-200">
              <span className="text-xs">🏛️</span>
              <select
                value={activeCollege?.id || ''}
                onChange={(e) => onSelectCollege(e.target.value)}
                className="bg-transparent text-xs text-purple-950 font-bold focus:outline-none cursor-pointer max-w-[180px] truncate"
              >
                {colleges.map(c => (
                  <option key={c.id} value={c.id}>{c.display_name} ({c.name})</option>
                ))}
              </select>
            </div>
          )}

          {/* Branch Switcher (Desktop) */}
          {currentProfile.role === 'super_admin' && branches.length > 0 && (
            <div className="hidden md:flex items-center gap-2 vms-input py-1.5 px-3 text-xs bg-white shadow-xs border border-purple-100">
              <MapPin className="w-3.5 h-3.5 text-[#800080]" />
              <select
                value={activeBranch?.id || ''}
                onChange={(e) => onSelectBranch(e.target.value)}
                className="bg-transparent text-xs text-gray-700 focus:outline-none cursor-pointer font-semibold"
              >
                <option value="">All Branches</option>
                {branches
                  .filter(b => !activeCollege?.id || b.college_id === activeCollege.id)
                  .map(b => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
              </select>
            </div>
          )}

          {/* Sync Indicator */}
          <div className={`flex items-center gap-2 text-[11px] font-bold px-3 py-1.5 rounded-full border transition-all shadow-xs ${
            isOnline
              ? pendingCount > 0
                ? 'bg-amber-50 text-amber-800 border-amber-200/90'
                : 'bg-emerald-50 text-emerald-800 border-emerald-200/90'
              : 'bg-rose-50 text-rose-800 border-rose-200/90'
          }`}>
            {isOnline ? (
              pendingCount > 0 ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin text-amber-600" />
                  <span className="text-[11px]">Sync ({pendingCount})</span>
                </>
              ) : (
                <>
                  <span className="vms-live-pulse-dot" />
                  <span className="hidden sm:inline">Online</span>
                </>
              )
            ) : (
              <>
                <WifiOff className="w-3.5 h-3.5 text-rose-600" />
                <span className="text-[11px]">Offline</span>
              </>
            )}
          </div>

          {/* Profile Dropdown (Desktop) */}
          <div className="relative hidden md:block">
            <button
              onClick={() => setIsRoleDropdownOpen(!isRoleDropdownOpen)}
              className="flex items-center gap-2.5 vms-input py-1.5 px-3 text-xs font-bold hover:border-[#800080] bg-white shadow-xs transition-all hover:shadow-sm"
            >
              <div className="w-6 h-6 rounded-full bg-purple-100 text-[#800080] flex items-center justify-center font-black text-[11px] border border-purple-200">
                {currentProfile.full_name.charAt(0)}
              </div>
              <span className="max-w-[120px] truncate text-gray-800 font-bold">
                {currentProfile.full_name.split(' ')[0]}
              </span>
              <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
            </button>

            {isRoleDropdownOpen && (
              <div className="absolute right-0 mt-2.5 w-72 vms-card-elevated py-2.5 z-50 animate-scaleIn shadow-2xl border-purple-100 bg-white/98">
                <div className="px-4 py-2.5 border-b border-gray-100/80 bg-purple-50/50">
                  <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Logged in Account</p>
                  <p className="text-sm font-black text-gray-900 mt-0.5">{currentProfile.full_name}</p>
                  <p className="text-xs text-[#800080] font-mono mt-0.5 font-bold">{currentProfile.login_id}</p>
                  <div className="mt-2 inline-block px-2.5 py-1 bg-purple-100 text-[#731A73] border border-purple-200 rounded-lg text-[10px] font-black uppercase tracking-wider">
                    ROLE: {currentProfile.role.replace('_', ' ')}
                  </div>
                </div>

                <div className="mt-2.5 pt-1 px-2">
                  <LightBeamButton
                    onClick={onLogout}
                    variant="danger"
                    className="w-full py-2.5 font-bold text-xs flex items-center justify-center gap-2"
                  >
                    <LogOut className="w-4 h-4" />
                    <span>Sign Out Account</span>
                  </LightBeamButton>
                </div>
              </div>
            )}
          </div>

          {/* Mobile Menu Toggle Button */}
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="md:hidden p-2 rounded-xl text-[#800080] hover:bg-purple-50 transition-colors border border-purple-100"
            aria-label="Toggle Navigation Menu"
          >
            {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer Navigation Menu */}
      {isMobileMenuOpen && (
        <div className="md:hidden bg-white border-t border-gray-100 p-4 space-y-4 shadow-xl animate-slideDown">
          <div className="p-3 bg-purple-50 rounded-xl border border-purple-100">
            <p className="text-[11px] text-gray-500 font-medium">Logged in User</p>
            <p className="text-sm font-bold text-[#800080]">{currentProfile.full_name}</p>
            <p className="text-xs text-gray-600 font-mono mt-0.5">{currentProfile.login_id}</p>
          </div>

          {/* Mobile Branch Selector */}
          {currentProfile.role === 'super_admin' && branches.length > 0 && (
            <div className="space-y-1">
              <label className="block text-[11px] font-bold text-gray-500 uppercase">Select Branch</label>
              <div className="flex items-center gap-2 vms-input py-2 px-3">
                <MapPin className="w-4 h-4 text-[#800080]" />
                <select
                  value={activeBranch?.id || ''}
                  onChange={(e) => { onSelectBranch(e.target.value); setIsMobileMenuOpen(false); }}
                  className="w-full bg-transparent text-xs text-gray-800 font-medium focus:outline-none"
                >
                  <option value="">All Branches</option>
                  {branches.map(b => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {/* Sign Out Button */}
          <button
            onClick={() => { onLogout(); setIsMobileMenuOpen(false); }}
            className="w-full flex items-center justify-center gap-2 p-2.5 rounded-xl text-xs font-bold text-red-600 bg-red-50 border border-red-200"
          >
            <LogOut className="w-4 h-4" />
            <span>Sign Out Account</span>
          </button>
        </div>
      )}
    </header>
  );
};
