import React, { useState, useEffect, useRef } from 'react';
import { EmergencySosAlert } from '../../types';
import { vmsService } from '../../services/vmsService';
import { eventBus } from '../../services/eventBus';
import { AlertOctagon, CheckCircle2, Volume2, VolumeX } from 'lucide-react';

interface SosModalProps { branchId?: string; }

export const SosModal: React.FC<SosModalProps> = ({ branchId }) => {
  const [alerts, setAlerts] = useState<EmergencySosAlert[]>([]);
  const [isMuted, setIsMuted] = useState(false);
  const [audioBlocked, setAudioBlocked] = useState(false);
  const audioCtxRef = useRef<AudioContext | null>(null);

  const checkAlerts = async () => {
    try {
      let active = await vmsService.getActiveSosAlerts(branchId);
      // Fallback: if no alerts for current branch, check if any global/other branch active SOS exists
      if (active.length === 0 && branchId) {
        const allActive = await vmsService.getActiveSosAlerts(undefined);
        if (allActive.length > 0) {
          active = allActive;
        }
      }
      setAlerts(active);
    } catch (e) {
      console.warn('SosModal checkAlerts error:', e);
    }
  };

  useEffect(() => {
    checkAlerts();

    const unsubGlobal = vmsService.subscribe(checkAlerts);
    const unsubRaised = eventBus.on('sos:raised', checkAlerts);
    const unsubDismissed = eventBus.on('sos:dismissed', checkAlerts);

    const interval = setInterval(checkAlerts, 1000);
    const handleFocus = () => checkAlerts();
    window.addEventListener('focus', handleFocus);

    // Global user interaction listener to unblock Web Audio API autoplay
    const handleUserGesture = () => {
      if (audioCtxRef.current && audioCtxRef.current.state === 'suspended') {
        audioCtxRef.current.resume().then(() => {
          setAudioBlocked(false);
        }).catch(() => {});
      }
    };

    window.addEventListener('click', handleUserGesture);
    window.addEventListener('pointerdown', handleUserGesture);
    window.addEventListener('keydown', handleUserGesture);

    return () => {
      unsubGlobal();
      unsubRaised();
      unsubDismissed();
      clearInterval(interval);
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('click', handleUserGesture);
      window.removeEventListener('pointerdown', handleUserGesture);
      window.removeEventListener('keydown', handleUserGesture);
    };
  }, [branchId]);

  // Professional Emergency Alarm Siren Generator (Web Audio API Continuous Dual-Oscillator Siren)
  useEffect(() => {
    if (alerts.length === 0 || isMuted) {
      if (audioCtxRef.current) {
        audioCtxRef.current.close().catch(() => {});
        audioCtxRef.current = null;
      }
      return;
    }

    let intervalId: any = null;

    const playSirenBurst = () => {
      try {
        if (!audioCtxRef.current || audioCtxRef.current.state === 'closed') {
          const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
          if (AudioContextClass) {
            audioCtxRef.current = new AudioContextClass();
          }
        }

        const ctx = audioCtxRef.current;
        if (!ctx) return;

        if (ctx.state === 'suspended') {
          ctx.resume().then(() => {
            setAudioBlocked(false);
          }).catch(() => {
            setAudioBlocked(true);
          });
        } else {
          setAudioBlocked(false);
        }

        const now = ctx.currentTime;
        const duration = 0.8; // 800ms per siren sweep pulse

        // Master Gain
        const masterGain = ctx.createGain();
        masterGain.gain.setValueAtTime(0.25, now);
        masterGain.gain.setValueAtTime(0.25, now + duration - 0.05);
        masterGain.gain.linearRampToValueAtTime(0.01, now + duration);
        masterGain.connect(ctx.destination);

        // Oscillator 1: High-Power Sawtooth Siren Sweep (650Hz -> 1250Hz -> 650Hz)
        const osc1 = ctx.createOscillator();
        osc1.type = 'sawtooth';
        osc1.frequency.setValueAtTime(650, now);
        osc1.frequency.linearRampToValueAtTime(1250, now + 0.4);
        osc1.frequency.linearRampToValueAtTime(650, now + 0.8);
        osc1.connect(masterGain);

        // Oscillator 2: Square Wave Detuned Sub-Siren for Heavy Industrial/Police Punch
        const osc2 = ctx.createOscillator();
        osc2.type = 'square';
        osc2.frequency.setValueAtTime(660, now);
        osc2.frequency.linearRampToValueAtTime(1260, now + 0.4);
        osc2.frequency.linearRampToValueAtTime(660, now + 0.8);

        const osc2Gain = ctx.createGain();
        osc2Gain.gain.setValueAtTime(0.12, now);
        osc2.connect(osc2Gain);
        osc2Gain.connect(masterGain);

        osc1.start(now);
        osc2.start(now);
        osc1.stop(now + duration);
        osc2.stop(now + duration);
      } catch (e) {
        console.warn('Audio Context error:', e);
      }
    };

    // Play immediate siren burst and loop continuously every 850ms while active
    playSirenBurst();
    intervalId = setInterval(playSirenBurst, 850);

    return () => {
      if (intervalId) clearInterval(intervalId);
      if (audioCtxRef.current) {
        try {
          audioCtxRef.current.close().catch(() => {});
        } catch (e) {}
        audioCtxRef.current = null;
      }
    };
  }, [alerts.length, isMuted]);

  if (alerts.length === 0) return null;

  const currentAlert = alerts[0];

  const handleDismiss = async () => {
    await vmsService.dismissSosAlert(currentAlert.id);
    setAlerts(prev => prev.filter(a => a.id !== currentAlert.id));
  };

  const handleToggleSound = () => {
    if (audioCtxRef.current && audioCtxRef.current.state === 'suspended') {
      audioCtxRef.current.resume().then(() => setAudioBlocked(false)).catch(() => {});
    }
    setIsMuted(!isMuted);
  };

  return (
    <>
      {/* Red Vignette Screen Border Glow */}
      <div className="fixed inset-0 border-4 sm:border-8 border-red-600/90 pointer-events-none z-[9998] animate-pulse" />

      {/* Top Banner Alert Overlay */}
      <div className="fixed top-2 left-2 right-2 sm:left-6 sm:right-6 z-[9999] p-2 flex justify-center animate-slideDown font-sans">
        <div className="w-full max-w-4xl bg-gradient-to-r from-red-700 via-red-600 to-red-800 text-white rounded-2xl shadow-2xl p-4 sm:p-5 border-2 border-red-300 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">

          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-white text-red-600 flex items-center justify-center shrink-0 shadow-lg animate-bounce">
              <AlertOctagon className="w-7 h-7" />
            </div>

            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="px-2.5 py-0.5 bg-amber-400 text-red-950 font-black text-[10px] uppercase rounded-full tracking-wider animate-pulse">
                  CRITICAL EMERGENCY SOS
                </span>
                <span className="text-[11px] font-mono text-white/90 bg-red-900/60 px-2 py-0.5 rounded-md">
                  {new Date(currentAlert.created_at).toLocaleTimeString()}
                </span>
              </div>
              <h4 className="font-heading font-black text-base sm:text-lg text-white mt-1 leading-tight">
                Emergency Call: {currentAlert.receptionist_name || 'Front Desk Duty Officer'}
              </h4>
              <p className="text-xs text-red-100 font-medium mt-0.5">
                Location: <strong className="text-white font-bold">{currentAlert.branch_name || 'Main Gate'}</strong> • Message: "{currentAlert.message}"
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
            <button
              onClick={handleToggleSound}
              className="px-3 py-2 bg-red-800/90 hover:bg-red-900 text-white rounded-xl text-xs font-bold border border-red-400 transition-all flex items-center gap-1.5 shadow-sm"
              title={isMuted ? "Unmute Siren" : "Mute Siren"}
            >
              {isMuted ? <VolumeX className="w-4 h-4 text-amber-300" /> : <Volume2 className="w-4 h-4 text-emerald-300" />}
              <span>{isMuted ? 'Muted' : audioBlocked ? 'Click to Enable Siren' : 'Siren Active'}</span>
            </button>

            <button
              onClick={handleDismiss}
              className="px-5 py-2.5 bg-white text-red-700 hover:bg-red-50 font-black rounded-xl text-xs shadow-lg flex items-center gap-2 transition-all active:scale-95 border border-red-200"
            >
              <CheckCircle2 className="w-4 h-4 text-green-600" /> Acknowledge & Dismiss SOS
            </button>
          </div>

        </div>
      </div>
    </>
  );
};
