import React, { useState, useEffect } from 'react';
import { College, Branch, Host, Visit } from '../../types';
import { vmsService } from '../../services/vmsService';
import { VimtechLogo } from '../VimtechLogo';
import { QRCodeSVG } from 'qrcode.react';
import SpecularButton from '../ui/SpecularButton';
import LightBeamButton from '../ui/LightBeamButton';
import { shareWhatsAppPassDirectly, generatePassImageBlob, copyPassPhotoToClipboard, buildWhatsAppPassMessage } from '../../utils/passImageGenerator';
import { User, Phone, Building, Calendar, CheckCircle2, QrCode, ArrowRight, Printer, Sparkles, Copy, Check } from 'lucide-react';

interface PreRegisterPageProps {
  college: College;
  branches: Branch[];
  onBackToDashboard?: () => void;
}

export const PreRegisterPage: React.FC<PreRegisterPageProps> = ({ college, branches, onBackToDashboard }) => {
  const [selectedBranchId, setSelectedBranchId] = useState(branches[0]?.id || '22222222-2222-2222-2222-222222222222');
  const [hosts, setHosts] = useState<Host[]>([]);
  const [selectedDept, setSelectedDept] = useState('All');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [category, setCategory] = useState('Admissions');
  const [purpose, setPurpose] = useState('Admissions Enquiry for BCA / BBA / MBA');
  const [selectedHostId, setSelectedHostId] = useState('');
  const [expectedTime, setExpectedTime] = useState('11:00 AM');
  const [isCopied, setIsCopied] = useState(false);

  const handleCopyPassPhoto = async (visit: Visit) => {
    try {
      await copyPassPhotoToClipboard(visit);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 4000);
    } catch (err) {
      console.warn('Copy pass photo error:', err);
      try {
        const blob = await generatePassImageBlob(visit);
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `VIMTECH_Gate_Pass_${(visit.visitor_name || 'Visitor').replace(/\s+/g, '_')}.png`;
        link.click();
        alert('Pass photo downloaded to device!');
      } catch (e) {
        console.error('Download error:', e);
      }
    }
  };

  const handleOpenWhatsAppChat = (visit: Visit) => {
    shareWhatsAppPassDirectly(visit);
  };
  
  const [createdPass, setCreatedPass] = useState<Visit | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (selectedBranchId) {
      vmsService.getHosts(selectedBranchId).then(setHosts);
    }
  }, [selectedBranchId]);

  // Automatically copy pass photo badge to clipboard when new pre-registered pass is created
  useEffect(() => {
    if (createdPass) {
      copyPassPhotoToClipboard(createdPass).then(() => {
        setIsCopied(true);
        setTimeout(() => setIsCopied(false), 4000);
      }).catch(err => {
        console.warn('Auto copy pass photo on pre-register failed:', err);
      });
    }
  }, [createdPass]);

  const filteredHosts = hosts.filter(h => 
    selectedDept === 'All' || h.department_or_class.toLowerCase().includes(selectedDept.toLowerCase())
  );

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const digitsOnly = e.target.value.replace(/\D/g, '').slice(0, 10);
    setPhone(digitsOnly);
  };

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const lettersOnly = e.target.value.replace(/[^a-zA-Z\s\.\']/g, '');
    setFullName(lettersOnly);
  };

  const getWhatsAppShareUrl = (pass: Visit) => {
    const rawPhone = (pass.visitor_phone || '').replace(/\D/g, '');
    const phoneWithCountryCode = rawPhone.length === 10 ? `91${rawPhone}` : rawPhone;
    const message = buildWhatsAppPassMessage(pass, 'visitor', true);
    return `https://api.whatsapp.com/send?phone=${phoneWithCountryCode}&text=${encodeURIComponent(message)}`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (phone.length !== 10) {
      alert("Mobile phone number must be exactly 10 numeric digits.");
      return;
    }
    if (!fullName.trim() || fullName.trim().length < 2) {
      alert("Please enter a valid full name (letters only).");
      return;
    }
    if (!selectedHostId) {
      alert("Please select a faculty/staff host.");
      return;
    }
    setIsSubmitting(true);

    try {
      const host = hosts.find(h => h.id === selectedHostId);
      const pass: Visit = {
        id: `vst-prereg-${Date.now()}`,
        visitor_id: `vis-${Date.now()}`,
        branch_id: selectedBranchId,
        host_id: selectedHostId,
        purpose: `${category}: ${purpose}`,
        status: 'checked_out',
        qr_token: `VMS-PRE-${Math.floor(1000 + Math.random() * 9000)}-TOKEN`,
        qr_expires_at: new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
        qr_used: false,
        check_in_time: new Date().toISOString(),
        created_at: new Date().toISOString(),
        visitor_name: fullName,
        visitor_phone: phone,
        host_name: host?.name || 'Faculty Host',
        host_department: host?.department_or_class || 'Department',
        category,
        is_pre_registered: true,
        expected_arrival_time: expectedTime
      };

      await vmsService.addPreRegisteredVisit(pass);
      setCreatedPass(pass);
    } catch (err: any) {
      alert("Pre-registration failed. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] py-8 px-4 flex flex-col items-center justify-center font-sans animate-fadeIn">
      <div className="w-full max-w-xl">

        {/* Top Header */}
        <div className="text-center mb-6">
          <VimtechLogo size="xl" showSubtitle={true} className="justify-center" />
          <p className="text-xs text-gray-500 mt-2 font-medium">
            Campus Visitor Self-Pre-Registration Portal
          </p>
        </div>

        {/* Content Box */}
        <div className="vms-card-elevated p-6 sm:p-8 space-y-6">

          {createdPass ? (
            /* Digital Pre-Approved Pass */
            <div className="text-center space-y-5 animate-fadeIn">
              <div className="w-16 h-16 rounded-full bg-green-50 border-2 border-green-200 flex items-center justify-center text-green-600 mx-auto">
                <CheckCircle2 className="w-10 h-10" />
              </div>

              <div>
                <span className="vms-badge vms-badge-green text-xs">
                  <Sparkles className="w-3.5 h-3.5" /> Pre-Approved Digital Gate Pass
                </span>
                <h3 className="font-heading font-bold text-2xl text-gray-900 mt-2">Registration Successful!</h3>
                <p className="text-xs text-gray-500 mt-1">Show this QR pass at the front desk for instant fast-track entry</p>
              </div>

              {/* Printable Pass Card (Executive Fast-Track Standard) */}
              <div id="printable-pass" className="bg-white rounded-3xl border-2 border-[#731A73] max-w-md mx-auto shadow-2xl relative overflow-hidden text-left vms-pass-watermark">
                {/* Security Foil Accent Header Bar */}
                <div className="vms-pass-foil-header py-2.5 px-4 text-white flex items-center justify-between shadow-md">
                  <div className="flex items-center gap-2">
                    <span className="vms-live-pulse-dot" />
                    <span className="text-[10px] font-black uppercase tracking-widest text-amber-300">★ PRE-APPROVED GATE PASS ★</span>
                  </div>
                  <span className="text-[9px] font-mono font-extrabold text-[#731A73] bg-emerald-400 px-2 py-0.5 rounded-md font-sans">FAST-TRACK</span>
                </div>

                {/* Official College Header Logo Banner */}
                <div className="p-4 bg-white border-b border-purple-100 text-center relative">
                  <VimtechLogo size="sm" showSubtitle={true} className="justify-center" />
                  <div className="mt-2.5 pt-2 border-t border-purple-100 flex items-center justify-center gap-2 text-[10px] text-gray-700 font-bold">
                    <span className="px-2.5 py-0.5 bg-amber-50 text-amber-900 rounded-full border border-amber-200 flex items-center gap-1">
                      ★ Approved by AICTE
                    </span>
                    <span className="px-2.5 py-0.5 bg-purple-50 text-[#731A73] rounded-full border border-purple-200">
                      ★ Tumkur Univ. Affiliated
                    </span>
                  </div>
                </div>

                {/* Pass Body Content */}
                <div className="p-4.5 space-y-4 bg-gradient-to-b from-purple-50/40 via-white to-slate-50/60">
                  <div className="bg-white p-4 rounded-2xl border border-purple-200 shadow-sm text-center relative overflow-hidden">
                    <span className="px-3 py-1 bg-emerald-50 text-emerald-800 rounded-full text-[10px] font-black uppercase tracking-wider border border-emerald-200 inline-flex items-center gap-1">
                      <Sparkles className="w-3.5 h-3.5 text-amber-500" /> FAST-TRACK PRE-APPROVED PASS
                    </span>
                    <h3 className="text-xl font-black text-gray-900 mt-2 font-heading">{createdPass.visitor_name}</h3>
                    <p className="text-xs text-gray-600 font-mono font-bold">+91 {createdPass.visitor_phone}</p>
                  </div>

                  {/* QR Code Container */}
                  <div className="text-center bg-white p-4 rounded-2xl border-2 border-purple-100 shadow-md relative">
                    <div className="flex items-center justify-center p-2">
                      <div className="p-3 bg-white rounded-2xl border border-purple-200 shadow-inner inline-block">
                        <QRCodeSVG
                          value={createdPass.qr_token || 'VMS-PASS'}
                          size={185}
                          level="H"
                          fgColor="#0f172a"
                          bgColor="#ffffff"
                          includeMargin={true}
                        />
                      </div>
                    </div>
                    <div className="mt-3 bg-slate-950 text-white py-2 px-3 rounded-xl border border-slate-800 flex items-center justify-between">
                      <span className="text-[9px] font-mono text-purple-300 font-bold uppercase tracking-wider">GATE PASS TOKEN:</span>
                      <span className="text-xs font-mono font-black text-amber-400 tracking-wider">{createdPass.qr_token}</span>
                    </div>
                  </div>

                  {/* Access Matrix Details */}
                  <div className="grid grid-cols-2 gap-2.5 text-xs bg-purple-50/50 p-3.5 rounded-2xl border border-purple-200">
                    <div>
                      <span className="text-gray-500 block uppercase font-extrabold text-[9px] tracking-wider">Faculty Host</span>
                      <strong className="text-[#731A73] text-xs font-bold">{createdPass.host_name}</strong>
                    </div>
                    <div className="text-right">
                      <span className="text-gray-500 block uppercase font-extrabold text-[9px] tracking-wider">Expected Arrival</span>
                      <strong className="text-gray-900 text-xs font-mono font-bold">{createdPass.expected_arrival_time}</strong>
                    </div>
                    <div className="col-span-2 pt-2 border-t border-purple-200/80 flex items-center justify-between text-[11px]">
                      <span className="text-gray-600 font-bold">Campus: <strong className="text-gray-900">Main Campus (Tumkur)</strong></span>
                      <span className="text-emerald-700 font-black">Fast-Track Express</span>
                    </div>
                  </div>
                </div>

                {/* Bottom Security Seal Bar */}
                <div className="bg-slate-950 py-2.5 px-4 text-center text-[9px] font-black font-mono text-amber-400 uppercase tracking-widest border-t border-slate-800 flex items-center justify-between shadow-inner">
                  <span>AUTHENTIC CAMPUS GATE PASS</span>
                  <span className="text-slate-400">VIDYAVAHINI GROUP (VIMTECH-VMS)</span>
                </div>
              </div>

              {/* Visual Guidance Banner */}
              <div className="p-3 bg-purple-50/80 border border-purple-200 rounded-2xl text-left text-xs space-y-1 no-print">
                <p className="font-extrabold text-[#731A73] flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-amber-500 shrink-0" />
                  How to Send Pass Photo via WhatsApp:
                </p>
                <ol className="list-decimal pl-4 text-[11px] text-gray-700 space-y-0.5 font-medium">
                  <li>Click <strong className="text-purple-900">📋 Copy Pass Photo</strong> below.</li>
                  <li>Click <strong className="text-emerald-700">💬 Open WhatsApp Chat</strong> & press <strong className="text-gray-900">Ctrl + V (Paste)</strong>!</li>
                </ol>
              </div>

              <div className="flex flex-wrap items-center justify-center gap-2 pt-1 no-print">
                <button
                  type="button"
                  onClick={() => handleCopyPassPhoto(createdPass)}
                  className={`px-4 py-2.5 rounded-xl text-xs font-extrabold flex items-center justify-center gap-1.5 border transition-all shadow-sm active:scale-95 ${
                    isCopied
                      ? 'bg-emerald-600 text-white border-emerald-600'
                      : 'bg-purple-50 hover:bg-purple-100 text-[#731A73] border-purple-200'
                  }`}
                >
                  {isCopied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  {isCopied ? '✓ Photo Copied!' : '📋 Copy Pass Photo'}
                </button>

                <button
                  type="button"
                  onClick={() => handleOpenWhatsAppChat(createdPass)}
                  className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-extrabold flex items-center justify-center gap-1.5 shadow-lg shadow-emerald-900/20 active:scale-95 transition-all"
                >
                  💬 Open WhatsApp Chat
                </button>

                <button onClick={() => window.print()} className="px-4 py-2.5 vms-btn-primary bg-[#731A73] text-white text-xs font-bold flex items-center justify-center gap-1.5 rounded-xl shadow-md">
                  <Printer className="w-4 h-4" /> Print Pass
                </button>

                {onBackToDashboard && (
                  <button onClick={onBackToDashboard} className="px-4 py-2.5 vms-btn-secondary text-xs font-bold rounded-xl">
                    Return to Portal
                  </button>
                )}
              </div>
            </div>
          ) : (
            /* Pre-Registration Form */
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="border-b border-gray-100 pb-3">
                <h3 className="font-heading font-bold text-lg text-gray-900">Pre-Register Campus Visit</h3>
                <p className="text-xs text-gray-500">Fill in your details before arrival to skip front desk queues</p>
              </div>

              {/* Branch */}
              <div>
                <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1.5">Select Campus Branch *</label>
                <select
                  value={selectedBranchId}
                  onChange={(e) => setSelectedBranchId(e.target.value)}
                  className="w-full vms-input text-xs"
                >
                  {branches.map(b => (
                    <option key={b.id} value={b.id}>{b.name} — {b.address}</option>
                  ))}
                </select>
              </div>

              {/* Name & Phone */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1.5">Full Name * (Letters Only)</label>
                  <div className="relative">
                    <User className="w-4 h-4 text-gray-400 absolute left-3.5 top-3" />
                    <input
                      type="text"
                      required
                      placeholder="e.g. Ramesh Hegde"
                      value={fullName}
                      onChange={handleNameChange}
                      className="w-full vms-input pl-10 text-xs font-medium"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1.5">Mobile Phone * (10 Digits)</label>
                  <div className="relative">
                    <Phone className="w-4 h-4 text-gray-400 absolute left-3.5 top-3" />
                    <input
                      type="tel"
                      required
                      maxLength={10}
                      placeholder="e.g. 9876543210"
                      value={phone}
                      onChange={handlePhoneChange}
                      className="w-full vms-input pl-10 text-xs font-mono font-bold"
                    />
                  </div>
                </div>
              </div>

              {/* Category & Expected Time */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1.5">Visitor Category *</label>
                  <select value={category} onChange={(e) => setCategory(e.target.value)} className="w-full vms-input text-xs">
                    <option value="Admissions">Admissions Candidate / Parent</option>
                    <option value="Meeting Staff">Faculty / Staff Meeting</option>
                    <option value="Parent Visit">Student Parent Visit</option>
                    <option value="CDC Placement">CDC / Company Recruiter</option>
                    <option value="AICTE / University">Official Inspector</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1.5">Expected Arrival Time *</label>
                  <select value={expectedTime} onChange={(e) => setExpectedTime(e.target.value)} className="w-full vms-input text-xs">
                    <option value="09:30 AM">09:30 AM</option>
                    <option value="11:00 AM">11:00 AM</option>
                    <option value="02:00 PM">02:00 PM</option>
                    <option value="04:00 PM">04:00 PM</option>
                  </select>
                </div>
              </div>

              {/* Submit */}
              <div className="pt-3 flex items-center justify-between">
                {onBackToDashboard && (
                  <button type="button" onClick={onBackToDashboard} className="vms-btn-secondary text-xs">
                    Cancel
                  </button>
                )}
                <LightBeamButton
                  type="submit"
                  disabled={isSubmitting}
                  variant="purple"
                  className="font-bold text-xs ml-auto shadow-lg py-3 px-6"
                >
                  {isSubmitting ? 'Generating Pass...' : 'Generate Pre-Approved Digital Pass'}
                  <ArrowRight className="w-4 h-4" />
                </LightBeamButton>
              </div>
            </form>
          )}

        </div>
      </div>
    </div>
  );
};
