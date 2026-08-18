import React, { useState, useEffect } from 'react';
import { Profile, College, Branch } from './types';
import { vmsService } from './services/vmsService';
import { authService } from './services/authService';
import { Navbar } from './components/Navbar';
import { VimtechLogo } from './components/VimtechLogo';
import { ReceptionDashboard } from './components/reception/ReceptionDashboard';
import { PrincipalDashboard } from './components/principal/PrincipalDashboard';
import { SuperAdminDashboard } from './components/superadmin/SuperAdminDashboard';
import { SosModal } from './components/sos/SosModal';
import { SecurityHelpModal } from './components/common/SecurityHelpModal';
import DotField from './components/ui/DotField';
import LightBeamButton from './components/ui/LightBeamButton';
import { User, KeyRound, ArrowRight, Eye, EyeOff, Phone } from 'lucide-react';
import { INITIAL_COLLEGES, INITIAL_BRANCHES } from './services/mockData';
import { purgeLegacyMockCache } from './offline/purgeCache';
import { telemetry } from './services/telemetryService';

class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean; error: any }> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }

  componentDidCatch(error: any, errorInfo: any) {
    console.error("VMS React Error Boundary:", error, errorInfo);
    telemetry.captureException(error, { action: 'react_error_boundary', metadata: { componentStack: errorInfo?.componentStack } });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6 text-center">
          <div className="max-w-md w-full bg-white p-8 rounded-3xl shadow-xl border border-purple-200 space-y-4">
            <div className="w-16 h-16 rounded-full bg-purple-100 text-[#800080] flex items-center justify-center mx-auto text-2xl font-bold">
              ⚡
            </div>
            <h2 className="font-heading font-extrabold text-xl text-gray-900">VIMTECH VMS Interface</h2>
            <p className="text-xs text-gray-600">The application encountered a transient view state error and has recovered.</p>
            <p className="text-xs text-red-600 font-mono bg-red-50 p-3 rounded-xl border border-red-100 text-left overflow-auto max-h-32">
              {String(this.state.error?.message || this.state.error || 'Rendering Error')}
            </p>
            <button
              onClick={() => { this.setState({ hasError: false, error: null }); window.location.reload(); }}
              className="w-full vms-btn-primary py-3 text-xs font-bold shadow-md"
            >
              Reload VMS Dashboard
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export const App: React.FC = () => {
  const [currentProfile, setCurrentProfile] = useState<Profile | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);

  const [colleges, setColleges] = useState<College[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [activeCollegeId, setActiveCollegeId] = useState<string>('');
  const [activeBranchId, setActiveBranchId] = useState<string>('');

  const [loginIdInput, setLoginIdInput] = useState(() => localStorage.getItem('vms_last_login_id') || '');
  const [passwordInput, setPasswordInput] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberLogin, setRememberLogin] = useState(true);
  const [showSecurityHelp, setShowSecurityHelp] = useState(false);

  useEffect(() => {
    telemetry.initTelemetry();
    initAuthAndData();
  }, []);

  const initAuthAndData = async () => {
    try {
      await purgeLegacyMockCache();

      // 1. Try restoring session from local storage or Supabase auth
      let restoredProfile: Profile | null = await authService.restoreLocalSession();

      if (!restoredProfile) {
        const savedSession = localStorage.getItem('vms_active_session');
        if (savedSession) {
          try {
            restoredProfile = JSON.parse(savedSession);
          } catch (e) {}
        }
      }

      if (restoredProfile) {
        setCurrentProfile(restoredProfile);
        const colId = restoredProfile.college_id || '';
        const brId = restoredProfile.branch_id || '';
        setActiveCollegeId(colId);
        setActiveBranchId(brId);
        if (colId) await loadInitialData(colId);
      } else {
        await loadInitialData();
      }
    } catch (err) {
      console.warn("Auth restoration notice:", err);
    } finally {
      setIsInitializing(false);
    }
  };

  const loadInitialData = async (collegeId?: string) => {
    try {
      const colList = await vmsService.getColleges();
      if (colList && colList.length > 0) setColleges(colList);

      const targetColId = collegeId || activeCollegeId || (colList && colList[0]?.id) || '';
      let brList = targetColId ? await vmsService.getBranches(targetColId) : await vmsService.getBranches();
      if (!brList || brList.length === 0) {
        brList = await vmsService.getBranches();
      }
      if (brList && brList.length > 0) setBranches(brList);
    } catch (err) {
      console.warn("Initial data load notice:", err);
    }
  };

  const [loginError, setLoginError] = useState<string | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    setIsLoggingIn(true);

    try {
      if (rememberLogin) {
        localStorage.setItem('vms_last_login_id', loginIdInput);
      }
      const profile = await vmsService.login(loginIdInput, passwordInput);
      if (profile) {
        setCurrentProfile(profile);
        localStorage.setItem('vms_active_session', JSON.stringify(profile));
        const colId = profile.college_id || '';
        const brId = profile.branch_id || '';
        setActiveCollegeId(colId);
        setActiveBranchId(brId);
        await loadInitialData(colId);
      } else {
        setLoginError('Invalid Login ID or Password. Please check your credentials and try again.');
      }
    } catch (err: any) {
      setLoginError(err?.message || 'Login failed. Please check your credentials.');
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = async () => {
    localStorage.removeItem('vms_active_session');
    await vmsService.logout();
    setCurrentProfile(null);
  };

  const activeCollege = colleges.find(c => c.id === activeCollegeId) || colleges[0];
  const activeBranch = branches.find(b => b.id === activeBranchId) || branches[0];

  if (isInitializing) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center text-white">
        <div className="flex flex-col items-center gap-3">
          <span className="w-8 h-8 border-3 border-purple-400 border-t-transparent rounded-full animate-spin" />
          <p className="text-xs font-bold tracking-widest text-purple-200 uppercase">Initializing VMS Interface...</p>
        </div>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-[#f8fafc] text-gray-800 flex flex-col font-sans">
        <SosModal branchId={activeBranch?.id} />
        {currentProfile ? (
          <>
            <Navbar
              currentProfile={currentProfile}
              activeCollege={activeCollege}
              activeBranch={activeBranch}
              colleges={colleges}
              branches={branches}
              onSelectCollege={(cId) => {
                setActiveCollegeId(cId);
                const colBranches = branches.filter(b => b.college_id === cId);
                if (colBranches.length > 0) {
                  setActiveBranchId(colBranches[0].id);
                } else {
                  setActiveBranchId('');
                }
              }}
              onSelectBranch={(bId) => setActiveBranchId(bId)}
              onLogout={handleLogout}
            />

            <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6">
              {currentProfile.role === 'receptionist' && (
                activeBranch ? (
                  <ReceptionDashboard profile={currentProfile} branch={activeBranch} />
                ) : (
                  <div className="p-8 text-center text-sm font-bold text-purple-900 bg-purple-50 rounded-2xl border border-purple-100">
                    Loading branch interface...
                  </div>
                )
              )}
              {currentProfile.role === 'branch_principal' && (
                activeBranch ? (
                  <PrincipalDashboard profile={currentProfile} branch={activeBranch} />
                ) : (
                  <div className="p-8 text-center text-sm font-bold text-purple-900 bg-purple-50 rounded-2xl border border-purple-100">
                    Loading principal interface...
                  </div>
                )
              )}
              {currentProfile.role === 'super_admin' && (
                <SuperAdminDashboard profile={currentProfile} college={activeCollege} />
              )}
            </main>
          </>
        ) : (
        /* ===== EXECUTIVE LOGIN PAGE ===== */
        <div className="flex-1 flex flex-col justify-between p-4 sm:p-8 bg-gradient-to-br from-purple-100/60 via-slate-50 to-indigo-100/60 relative overflow-hidden min-h-screen">
          {/* DotField Background Canvas for Login Page Only */}
          <div className="absolute inset-0 z-0 pointer-events-none opacity-85">
            <DotField
              dotRadius={1.5}
              dotSpacing={14}
              bulgeStrength={67}
              glowRadius={160}
              sparkle={true}
              waveAmplitude={0}
              gradientFrom="rgba(128, 0, 128, 0.45)"
              gradientTo="rgba(99, 102, 241, 0.3)"
              glowColor="rgba(128, 0, 128, 0.2)"
            />
          </div>

          {/* Ambient Radial Background Orbs */}
          <div className="absolute top-10 left-10 w-[500px] h-[500px] bg-[#4A124A]/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute bottom-10 right-10 w-[500px] h-[500px] bg-indigo-300/20 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-purple-300/10 rounded-full blur-3xl pointer-events-none" />

          <div className="w-full max-w-lg mx-auto my-auto animate-scaleIn relative z-10 space-y-6">
            {/* Middle Top Highlighted Round Circle Logo */}
            <div className="flex justify-center -mb-4 relative z-20">
              <div className="w-28 h-28 sm:w-32 sm:h-32 rounded-full bg-white p-3 shadow-2xl border-4 border-purple-200/90 ring-8 ring-purple-500/10 flex items-center justify-center transition-all transform hover:scale-105">
                <img
                  src="/vgi_logo.png"
                  alt="Vidyavahini Group Logo"
                  className="w-full h-full object-contain p-1"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = '/vgi_logo.svg';
                  }}
                />
              </div>
            </div>

            {/* Elevated Glassmorphism Card */}
            <div className="vms-card-elevated p-8 pt-8 space-y-5 shadow-2xl border-t-4 border-t-[#4A124A] border-purple-100/90 bg-white/98 backdrop-blur-2xl rounded-3xl">
              <div className="text-center pt-2">
                <h2 className="font-heading font-black text-2xl text-gray-900 tracking-tight">Staff Entrance Portal</h2>
                <p className="text-xs text-gray-500 font-medium mt-1">Centralised Multi-Tenant Visitor Management System</p>
              </div>

              {loginError && (
                <div className="p-3.5 bg-red-50 border border-red-200 rounded-2xl text-red-700 text-xs font-bold flex items-start gap-2 animate-fadeIn">
                  <span className="text-base leading-none">⚠️</span>
                  <div className="flex-1">
                    <p>{loginError}</p>
                  </div>
                </div>
              )}

              <form onSubmit={handleLoginSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-black text-gray-700 uppercase tracking-wider mb-1.5">Login ID</label>
                  <div className="relative flex items-center">
                    <User className="w-5 h-5 text-[#800080] absolute left-3.5 pointer-events-none z-10" />
                    <input
                      type="text"
                      required
                      placeholder="e.g. super.admin or vimtech.reception1"
                      value={loginIdInput}
                      onChange={(e) => setLoginIdInput(e.target.value)}
                      className="w-full !pl-12 pr-4 text-sm py-3 font-semibold rounded-xl border border-gray-300 focus:outline-none focus:ring-4 focus:ring-[#800080]/15 focus:border-[#800080] bg-white shadow-2xs transition-all"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-black text-gray-700 uppercase tracking-wider mb-1.5">Password</label>
                  <div className="relative flex items-center">
                    <KeyRound className="w-5 h-5 text-[#800080] absolute left-3.5 pointer-events-none z-10" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={passwordInput}
                      onChange={(e) => setPasswordInput(e.target.value)}
                      className="w-full !pl-12 !pr-12 text-sm py-3 font-semibold rounded-xl border border-gray-300 focus:outline-none focus:ring-4 focus:ring-[#800080]/15 focus:border-[#800080] bg-white shadow-2xs transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3.5 text-gray-400 hover:text-[#800080] focus:outline-none transition-colors z-10 p-1"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs pt-1">
                  <label className="flex items-center gap-2 cursor-pointer text-gray-600 font-bold select-none">
                    <input
                      type="checkbox"
                      checked={rememberLogin}
                      onChange={(e) => setRememberLogin(e.target.checked)}
                      className="rounded border-gray-300 text-[#800080] focus:ring-[#800080]"
                    />
                    Remember Login ID
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowSecurityHelp(true)}
                    className="text-[#800080] font-black hover:underline cursor-pointer focus:outline-none"
                  >
                    Security Help
                  </button>
                </div>

                <LightBeamButton
                  type="submit"
                  variant="purple"
                  gradientColors={["#a53aed", "#f59e0b", "#a53aed"]}
                  disabled={isLoggingIn}
                  className="w-full py-4 text-base font-black flex items-center justify-center gap-2 shadow-xl cursor-pointer disabled:opacity-60"
                >
                  {isLoggingIn ? (
                    <>
                      <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Authenticating...
                    </>
                  ) : (
                    <>
                      Sign In to Front Desk <ArrowRight className="w-5 h-5" />
                    </>
                  )}
                </LightBeamButton>
              </form>
            </div>

            {/* Support Helpline Footer */}
            <div className="mt-6 text-center text-xs text-gray-500 space-y-1.5">
              <p className="flex items-center justify-center gap-1.5 font-semibold">
                <Phone className="w-3.5 h-3.5 text-purple-700" />
                Helpline: <span className="font-black text-gray-800">+91 8217230788</span> | <span className="font-bold text-gray-700">support@vidyavahini.in</span>
              </p>
              <p className="text-[11px] text-gray-400 font-mono">Vidyavahini Group • Centralised VMS Platform v2.4</p>
            </div>

            <p className="text-center text-xs text-gray-400 mt-6 font-semibold">
              © 2026 Vidyavahini Group • Centralised Multi-Tenant Visitor Management System
            </p>
          </div>
        </div>
      )}
      {showSecurityHelp && (
        <SecurityHelpModal onClose={() => setShowSecurityHelp(false)} />
      )}
    </div>
  </ErrorBoundary>
);
};
