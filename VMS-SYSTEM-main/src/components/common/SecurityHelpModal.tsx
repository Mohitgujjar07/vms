import React, { useState } from 'react';
import {
  ShieldAlert, Phone, KeyRound, X,
  Lock, Headphones, FileText
} from 'lucide-react';

interface SecurityHelpModalProps {
  onClose: () => void;
}

export const SecurityHelpModal: React.FC<SecurityHelpModalProps> = ({ onClose }) => {
  const [activeTab, setActiveTab] = useState<'login_help' | 'sop'>('login_help');

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 animate-fadeIn font-sans">
      <div className="w-full max-w-lg bg-white border border-purple-100 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-purple-900 via-[#731A73] to-purple-950 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500 text-purple-950 flex items-center justify-center font-black shadow-lg">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <div>
              <h2 className="font-heading font-extrabold text-lg text-white tracking-tight flex items-center gap-2">
                Gate Support & SOP
              </h2>
              <p className="text-xs text-purple-200 font-medium">VIMTECH Campus Control & Front Desk Help</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-2xl bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-all border border-white/20"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Buttons */}
        <div className="grid grid-cols-2 bg-purple-50 p-1.5 border-b border-purple-100 text-xs font-bold">
          <button
            onClick={() => setActiveTab('login_help')}
            className={`py-2.5 rounded-xl flex items-center justify-center gap-1.5 transition-all ${
              activeTab === 'login_help'
                ? 'bg-[#731A73] text-white shadow-md font-extrabold'
                : 'text-gray-600 hover:text-gray-900 hover:bg-purple-100'
            }`}
          >
            <KeyRound className="w-4 h-4" /> Account Help
          </button>

          <button
            onClick={() => setActiveTab('sop')}
            className={`py-2.5 rounded-xl flex items-center justify-center gap-1.5 transition-all ${
              activeTab === 'sop'
                ? 'bg-[#731A73] text-white shadow-md font-extrabold'
                : 'text-gray-600 hover:text-gray-900 hover:bg-purple-100'
            }`}
          >
            <FileText className="w-4 h-4" /> Gate SOP
          </button>
        </div>

        {/* Body Content */}
        <div className="p-6 overflow-y-auto space-y-4 flex-1">
          {activeTab === 'login_help' && (
            <div className="space-y-4 text-xs">
              <div className="p-4 bg-purple-50 border border-purple-100 rounded-2xl space-y-2">
                <h4 className="font-extrabold text-[#731A73] flex items-center gap-1.5">
                  <KeyRound className="w-4 h-4" /> Forgot Login ID or Password?
                </h4>
                <p className="text-gray-600 font-medium leading-relaxed">
                  If you are a receptionist or gate security officer unable to log in:
                </p>
                <ul className="list-disc pl-4 space-y-1 text-gray-700 font-semibold">
                  <li>Verify that your <strong>Login ID</strong> follows format: <code>super.admin</code>, <code>Pradeepkumar.nb@gmail.com</code>, or <code>vimtech.reception1</code></li>
                  <li>Passwords are issued privately by your Branch Principal / IT Admin — ask them to reset it if forgotten</li>
                  <li>Ensure your keyboard <strong>Caps Lock</strong> is turned off</li>
                </ul>
              </div>

              <div className="p-4 border border-gray-200 rounded-2xl space-y-2 bg-white">
                <h4 className="font-extrabold text-gray-900 flex items-center gap-1.5">
                  <Lock className="w-4 h-4 text-amber-500" /> Account Locked / Inactive?
                </h4>
                <p className="text-gray-600 font-medium">
                  Contact your <strong>Branch Principal</strong> or <strong>IT Administrator</strong> to reset your profile credentials or activate your receptionist account.
                </p>
                <div className="pt-2 flex items-center gap-2 text-gray-800 font-mono font-bold">
                  <span>✉️ Email IT Support:</span>
                  <a href="mailto:info@vimtech.in" className="text-[#731A73] hover:underline">info@vimtech.in</a>
                </div>
              </div>

              {/* Direct Hotlines */}
              <div className="pt-2 border-t border-gray-100 space-y-2">
                <p className="text-[11px] font-extrabold text-gray-500 uppercase tracking-wider">Direct Helpline Numbers</p>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <a
                    href="tel:+918217230788"
                    className="p-3 bg-purple-50/60 border border-purple-100 rounded-xl flex items-center gap-2.5 hover:bg-purple-100/60 transition-all group"
                  >
                    <Phone className="w-4 h-4 text-[#731A73]" />
                    <div>
                      <span className="text-[10px] text-gray-500 font-bold block">Main Gate Patrol</span>
                      <strong className="text-gray-900 font-mono font-bold group-hover:text-[#731A73]">+91 8217230788</strong>
                    </div>
                  </a>

                  <a
                    href="tel:08023459876"
                    className="p-3 bg-purple-50/60 border border-purple-100 rounded-xl flex items-center gap-2.5 hover:bg-purple-100/60 transition-all group"
                  >
                    <Headphones className="w-4 h-4 text-[#731A73]" />
                    <div>
                      <span className="text-[10px] text-gray-500 font-bold block">Control Command</span>
                      <strong className="text-gray-900 font-mono font-bold group-hover:text-[#731A73]">080-2345-9876</strong>
                    </div>
                  </a>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'sop' && (
            <div className="space-y-3 text-xs">
              <div className="p-3.5 bg-gray-50 border border-gray-200 rounded-2xl space-y-1">
                <span className="px-2 py-0.5 bg-[#731A73] text-white rounded text-[10px] font-black uppercase">Step 1</span>
                <p className="font-extrabold text-gray-900 mt-1">Mandatory Visitor Registration</p>
                <p className="text-gray-600 font-medium">All walk-in visitors, parents, vendor contractors, and interview candidates must register at the reception desk before entering campus.</p>
              </div>

              <div className="p-3.5 bg-gray-50 border border-gray-200 rounded-2xl space-y-1">
                <span className="px-2 py-0.5 bg-[#731A73] text-white rounded text-[10px] font-black uppercase">Step 2</span>
                <p className="font-extrabold text-gray-900 mt-1">Digital QR Pass Verification</p>
                <p className="text-gray-600 font-medium">Verify visitor digital QR badge or print paper pass before granting entry through turnstile gates.</p>
              </div>

              <div className="p-3.5 bg-gray-50 border border-gray-200 rounded-2xl space-y-1">
                <span className="px-2 py-0.5 bg-[#731A73] text-white rounded text-[10px] font-black uppercase">Step 3</span>
                <p className="font-extrabold text-gray-900 mt-1">Campus Exit Verification</p>
                <p className="text-gray-600 font-medium">Scan visitor QR pass at the exit gate to timestamp check-out and maintain accurate live campus headcount.</p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 bg-gray-50 border-t border-gray-100 text-center">
          <button
            onClick={onClose}
            className="w-full py-2.5 bg-gray-200 hover:bg-gray-300 text-gray-800 font-extrabold text-xs rounded-xl transition-all"
          >
            Close Support Window
          </button>
        </div>

      </div>
    </div>
  );
};
