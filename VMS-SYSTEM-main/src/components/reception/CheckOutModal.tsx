import React, { useState, useEffect, useRef } from 'react';
import { Visit } from '../../types';
import { vmsService } from '../../services/vmsService';
import { Html5Qrcode } from 'html5-qrcode';
import {
  X, QrCode, Search, CheckCircle2, AlertCircle, Clock, User, Zap, Image as ImageIcon,
  Sparkles, RefreshCw, Key, LogOut, ArrowRight, ShieldCheck, Star, MessageSquare,
  ThumbsUp, Check, ChevronRight, Camera, ArrowLeft, Printer, Heart, ThumbsDown,
  FileCheck, Shield, Building2, MapPin, Share2, MessageCircle, Scan, Flame
} from 'lucide-react';
import { VimtechLogo } from '../common/VimtechLogo';

interface CheckOutModalProps {
  branchId: string;
  activeVisits: Visit[];
  initialVisit?: Visit | null;
  onClose: () => void;
  onSuccess: () => void;
}

export const CheckOutModal: React.FC<CheckOutModalProps> = ({
  branchId, activeVisits, initialVisit, onClose, onSuccess
}) => {
  const [step, setStep] = useState<'select' | 'review' | 'success'>(initialVisit ? 'review' : 'select');
  const [tab, setTab] = useState<'scanner' | 'manual'>('scanner');
  const [pendingVisit, setPendingVisit] = useState<Visit | null>(initialVisit || null);
  const [manualQuery, setManualQuery] = useState('');
  const [manualToken, setManualToken] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successVisit, setSuccessVisit] = useState<Visit | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // Mandatory Visitor Feedback state (1 to 5 Stars & Compulsory Comment)
  const [selectedRating, setSelectedRating] = useState<number>(5);
  const [hoverRating, setHoverRating] = useState<number | null>(null);
  const [feedbackComment, setFeedbackComment] = useState<string>('Exceptional campus hospitality & prompt host meeting.');
  const [feedbackError, setFeedbackError] = useState<string | null>(null);
  
  // Scanner state & controls
  const [isFlashOn, setIsFlashOn] = useState(false);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [cameraFacing, setCameraFacing] = useState<'environment' | 'user'>('environment');

  const qrFileInputRef = useRef<HTMLInputElement | null>(null);
  const html5QrCodeRef = useRef<Html5Qrcode | null>(null);

  // Initialize Html5Qrcode live camera preview
  useEffect(() => {
    if (tab !== 'scanner' || step !== 'select') return;
    
    let isMounted = true;
    let qrScanner: Html5Qrcode | null = null;

    const fixVideoAlignment = () => {
      const container = document.getElementById('qr-reader-viewport');
      if (!container) return;

      container.querySelectorAll('div').forEach((el) => {
        el.style.cssText = `
          width: 100% !important;
          height: 100% !important;
          position: absolute !important;
          top: 0 !important;
          left: 0 !important;
          margin: 0 !important;
          padding: 0 !important;
          background: transparent !important;
          border: none !important;
          box-shadow: none !important;
        `;
      });

      const video = container.querySelector('video');
      if (video) {
        video.style.cssText = `
          width: 100% !important;
          height: 100% !important;
          object-fit: cover !important;
          object-position: center center !important;
          position: absolute !important;
          top: 0 !important;
          left: 0 !important;
          margin: 0 !important;
          padding: 0 !important;
          border-radius: 1.5rem !important;
          transform: none !important;
        `;
      }

      container.querySelectorAll(
        '#qr-shaded-region, button, select, a, span, p'
      ).forEach((el) => {
        (el as HTMLElement).style.cssText = `display: none !important; visibility: hidden !important; opacity: 0 !important;`;
      });
    };

    const startCamera = async () => {
      try {
        qrScanner = new Html5Qrcode("qr-reader-viewport");
        html5QrCodeRef.current = qrScanner;

        await qrScanner.start(
          { facingMode: cameraFacing },
          {
            fps: 24,
            qrbox: { width: 220, height: 220 },
            aspectRatio: 1.0
          },
          (decodedText) => {
            if (isMounted) {
              handleSelectTokenForReview(decodedText);
            }
          },
          () => {}
        );

        if (isMounted) {
          setIsCameraActive(true);
          fixVideoAlignment();
          setTimeout(fixVideoAlignment, 200);
          setTimeout(fixVideoAlignment, 600);
        }
      } catch (err) {
        console.warn("Live QR scanner camera init:", err);
        if (isMounted) {
          setIsCameraActive(false);
        }
      }
    };

    const timer = setTimeout(() => {
      startCamera();
    }, 150);

    return () => {
      isMounted = false;
      clearTimeout(timer);
      if (html5QrCodeRef.current) {
        if (html5QrCodeRef.current.isScanning) {
          html5QrCodeRef.current.stop().catch(() => {}).finally(() => {
            html5QrCodeRef.current?.clear();
            html5QrCodeRef.current = null;
          });
        } else {
          html5QrCodeRef.current.clear();
          html5QrCodeRef.current = null;
        }
      }
    };
  }, [tab, step, cameraFacing]);

  const handleSelectVisitForReview = (visit: Visit) => {
    setPendingVisit(visit);
    setSelectedRating(5);
    setFeedbackComment('Exceptional campus hospitality & prompt host meeting.');
    setFeedbackError(null);
    setErrorMessage(null);
    setStep('review');
  };

  const handleManualCheckout = (visitId: string) => {
    const visit = activeVisits.find(v => v.id === visitId);
    if (visit) {
      handleSelectVisitForReview(visit);
    } else {
      setErrorMessage('Selected visitor record is no longer active.');
    }
  };

  const handleSelectTokenForReview = async (token: string) => {
    if (!token.trim()) return;
    setIsProcessing(true);
    setErrorMessage(null);
    try {
      const cleanToken = token.trim().toLowerCase();
      let visit = activeVisits.find(v => (v.qr_token || '').toLowerCase() === cleanToken || v.qr_token === token.trim());
      if (!visit) {
        visit = activeVisits.find(v => v.visitor_phone === token.trim() || v.id === token.trim());
      }
      if (!visit) {
        const allVisits = await vmsService.getVisits(branchId);
        visit = allVisits.find(v => (v.qr_token || '').toLowerCase() === cleanToken && v.status === 'inside');
      }
      if (!visit) {
        throw new Error(`No active visitor inside campus matches pass token "${token.trim()}".`);
      }
      handleSelectVisitForReview(visit);
    } catch (err: any) {
      setErrorMessage(err?.message || 'Check-out token verification failed.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleConfirmCheckoutWithReview = async () => {
    if (!pendingVisit) return;
    
    // Validate mandatory feedback rating and comment
    if (!selectedRating || selectedRating < 1 || selectedRating > 5) {
      setFeedbackError('Please choose a star rating (1 to 5 Stars).');
      return;
    }

    if (!feedbackComment.trim()) {
      setFeedbackError('Please enter visitor feedback comments before completing checkout.');
      return;
    }

    setFeedbackError(null);
    setIsProcessing(true);
    setErrorMessage(null);

    try {
      const result = await vmsService.manualCheckOut(pendingVisit.id, selectedRating, feedbackComment.trim());
      setSuccessVisit(result.visit);
      setStep('success');
      onSuccess();
    } catch (err: any) {
      setErrorMessage(err?.message || 'Check-out processing failed. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleToggleFlashlight = async () => {
    const qrInstance = html5QrCodeRef.current;
    const nextState = !isFlashOn;
    setIsFlashOn(nextState);

    if (qrInstance && qrInstance.isScanning) {
      try {
        await qrInstance.applyVideoConstraints({
          advanced: [{ torch: nextState } as any]
        });
      } catch (err) {
        console.warn("Flashlight hardware control not supported on device:", err);
      }
    }
  };

  const handleToggleCameraFacing = () => {
    setCameraFacing(prev => prev === 'environment' ? 'user' : 'environment');
  };

  const handleGalleryClick = () => {
    if (qrFileInputRef.current) {
      qrFileInputRef.current.click();
    }
  };

  const handleQrFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    setErrorMessage(null);

    try {
      const html5Qrcode = new Html5Qrcode("qr-file-decoder");
      const decodedText = await html5Qrcode.scanFile(file, false);
      html5Qrcode.clear();
      await handleSelectTokenForReview(decodedText);
    } catch (err: any) {
      console.warn("QR File scan error:", err);
      setErrorMessage("Could not detect a clear QR code from the photo. Try another image or use manual search.");
    } finally {
      setIsProcessing(false);
      if (qrFileInputRef.current) qrFileInputRef.current.value = '';
    }
  };

  const insideVisits = activeVisits.filter(v => v.status === 'inside');

  const filteredActiveVisits = insideVisits.filter(v => {
    const q = manualQuery.toLowerCase().trim();
    if (!q) return true;
    return (
      v.visitor_name?.toLowerCase().includes(q) ||
      v.visitor_phone?.includes(q) ||
      v.qr_token?.toLowerCase().includes(q) ||
      v.host_name?.toLowerCase().includes(q) ||
      v.purpose?.toLowerCase().includes(q)
    );
  });

  const calculateDuration = (checkInStr: string, checkOutStr?: string | null) => {
    const start = new Date(checkInStr).getTime();
    const end = checkOutStr ? new Date(checkOutStr).getTime() : Date.now();
    const mins = Math.max(1, Math.round((end - start) / (1000 * 60)));
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return h > 0 ? `${h}h ${m}m` : `${m} mins`;
  };

  const ratingFeedbackPresets: Record<number, { label: string; emoji: string; presets: string[] }> = {
    5: {
      emoji: '🤩',
      label: '5 Stars • Exceptional Experience',
      presets: [
        "Exceptional Hospitality & Fast Entry",
        "Prompt Host Meeting & Courteous Staff",
        "Smooth & Professional Coordination",
        "Clean & Well-Organized Campus Facilities"
      ]
    },
    4: {
      emoji: '😊',
      label: '4 Stars • Great Experience',
      presets: [
        "Pleasant Experience & Helpful Staff",
        "Smooth Entry Process & Good Guidance",
        "Timely Meeting with Faculty Host",
        "Good Infrastructure & Reception"
      ]
    },
    3: {
      emoji: '🙂',
      label: '3 Stars • Satisfactory Visit',
      presets: [
        "Satisfactory Experience Overall",
        "Meeting Delayed Slightly",
        "Entry Process Took Some Time",
        "Department Directions Needed More Clarity"
      ]
    },
    2: {
      emoji: '😕',
      label: '2 Stars • Needs Improvement',
      presets: [
        "Host Was Delayed Significantly",
        "Long Wait Time at Reception Gate",
        "Difficult Finding Faculty Block",
        "Campus Signage Was Unclear"
      ]
    },
    1: {
      emoji: '😡',
      label: '1 Star • Unsatisfactory Visit',
      presets: [
        "Host Was Unavailable for Scheduled Meeting",
        "Excessive Wait at Security Desk",
        "Lack of Assistance at Reception",
        "Unsatisfactory Campus Experience"
      ]
    }
  };

  const handleShareExitSlipWhatsApp = (visit: Visit) => {
    const rawPhone = (visit.visitor_phone || '').replace(/\D/g, '');
    const phoneWithCountryCode = rawPhone.length === 10 ? `91${rawPhone}` : rawPhone;
    const duration = calculateDuration(visit.check_in_time, visit.check_out_time);
    const checkOutFormatted = visit.check_out_time 
      ? new Date(visit.check_out_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true })
      : 'Just now';

    const message = 
`🏛️ *VIMTECH CAMPUS EXIT CLEARANCE SLIP*
*Vidyavahini Institute of Management & Technology*
━━━━━━━━━━━━━━━━━━━━━

Dear *${visit.visitor_name || 'Valued Visitor'}*,

Thank you for visiting VIMTECH Campus. Your gate exit clearance has been authorized & recorded:

📋 *VISIT SUMMARY*
▸ *Visitor Name*: ${visit.visitor_name}
▸ *Contact Number*: \`${visit.visitor_phone}\`
▸ *Host Visited*: ${visit.host_name || 'Faculty / Staff'}
▸ *Purpose*: ${visit.purpose || 'Official Campus Visit'}
▸ *Total Stay*: *${duration}*
▸ *Gate Exit Time*: ${checkOutFormatted}
▸ *Feedback Rating*: ${'★'.repeat(visit.rating || selectedRating)} (${visit.rating || selectedRating}/5)

━━━━━━━━━━━━━━━━━━━━━
🔒 *SECURITY EXIT CLEARED*
• Gate status verified: Clean Exit Approved.
• We look forward to welcoming you again!

_Issued by Front Desk Reception | VIMTECH Centralised VMS_
🌐 www.vimtech.in`;

    const whatsappUrl = `https://api.whatsapp.com/send?phone=${phoneWithCountryCode}&text=${encodeURIComponent(message)}`;
    window.open(whatsappUrl, '_blank');
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 animate-fadeIn font-sans">
      {/* Hidden File Decoder Target DOM */}
      <div id="qr-file-decoder" className="hidden" />

      {/* Hidden File Input for Gallery Import */}
      <input
        type="file"
        ref={qrFileInputRef}
        accept="image/*"
        onChange={handleQrFileUpload}
        className="hidden"
      />

      <div className="w-full max-w-xl bg-white border-2 border-purple-200/80 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] font-sans text-gray-900 relative">
        
        {/* Top Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-[#4a0e4e] via-[#731A73] to-[#8a1d8a] text-white flex items-center justify-between shadow-md shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-amber-400 text-purple-950 flex items-center justify-center shadow-lg shrink-0 font-black">
              <LogOut className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-heading font-black text-lg text-white tracking-tight">Visitor Gate Sign-Out</h2>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-400/20 border border-emerald-300/40 text-emerald-300 text-[10px] font-black uppercase tracking-wider">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                  GATE DESK
                </span>
              </div>
              <p className="text-[11px] text-purple-200 font-medium">Scan QR gate pass or select visitor to record mandatory experience rating</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-xl bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-all border border-white/20 shrink-0 cursor-pointer"
          >
            <X className="w-4.5 h-4.5" />
          </button>
        </div>

        {/* Live Campus Occupancy Bar */}
        <div className="px-6 py-2 bg-purple-50/80 border-b border-purple-100 flex items-center justify-between text-xs shrink-0">
          <div className="flex items-center gap-2">
            <User className="w-3.5 h-3.5 text-[#731A73]" />
            <span className="font-extrabold text-gray-700">Currently Inside Campus:</span>
            <span className="font-mono font-black px-2.5 py-0.5 bg-white border border-purple-200 text-[#731A73] rounded-lg shadow-2xs text-[11px]">
              {insideVisits.length} Active Visitors
            </span>
          </div>

          <span className="text-[11px] font-bold text-gray-500 flex items-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            Mandatory Gate Feedback
          </span>
        </div>

        {/* Tab Selector when in Selection Mode */}
        {step === 'select' && !successVisit && (
          <div className="grid grid-cols-2 bg-slate-100 p-1.5 rounded-2xl mx-6 mt-3 border border-slate-200 text-xs font-bold shadow-inner shrink-0">
            <button
              onClick={() => setTab('scanner')}
              className={`py-2.5 rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer ${
                tab === 'scanner'
                  ? 'bg-[#731A73] text-white shadow-md font-black'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200/60'
              }`}
            >
              <Scan className="w-4 h-4" /> 📸 AI Live Scanner
            </button>
            <button
              onClick={() => setTab('manual')}
              className={`py-2.5 rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer ${
                tab === 'manual'
                  ? 'bg-[#731A73] text-white shadow-md font-black'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200/60'
              }`}
            >
              <Search className="w-4 h-4" /> 👥 Active Visitors ({insideVisits.length})
            </button>
          </div>
        )}

        <div className="p-5 overflow-y-auto space-y-4 flex-1">
          {/* Error Banner */}
          {errorMessage && (
            <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-2xl text-rose-800 text-xs flex items-start gap-2.5 shadow-sm animate-fadeIn">
              <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="font-extrabold text-rose-900">Exit Verification Alert</p>
                <p className="mt-0.5 text-rose-700 font-medium">{errorMessage}</p>
              </div>
            </div>
          )}

          {/* STEP 2: REVIEW & MANDATORY VISITOR FEEDBACK */}
          {step === 'review' && pendingVisit ? (
            <div className="space-y-4 animate-fadeIn">
              
              {/* Visitor Summary Header Card */}
              <div className="p-4 bg-gradient-to-r from-purple-50 via-white to-slate-50 rounded-2xl border-2 border-purple-200 shadow-sm flex items-center justify-between">
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className="relative shrink-0">
                    <img
                      src={pendingVisit.visitor_photo_url || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=300&q=80'}
                      alt={pendingVisit.visitor_name}
                      className="w-14 h-14 rounded-2xl object-cover ring-2 ring-[#731A73] shadow-sm"
                    />
                    <span className="w-3.5 h-3.5 rounded-full bg-emerald-500 border-2 border-white absolute -bottom-0.5 -right-0.5 shadow-2xs" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-black text-base text-gray-900 truncate">{pendingVisit.visitor_name}</h3>
                      <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[9px] font-black uppercase">
                        ACTIVE INSIDE
                      </span>
                    </div>
                    <p className="text-xs text-gray-600 font-mono font-bold">+91 {pendingVisit.visitor_phone}</p>
                    <p className="text-[11px] text-[#731A73] font-bold mt-0.5 truncate">
                      Host: {pendingVisit.host_name || 'Staff'} • {pendingVisit.purpose || 'Campus Visit'}
                    </p>
                    <div className="flex items-center gap-2 text-[10px] text-gray-500 font-mono font-bold mt-1">
                      <span>In: {new Date(pendingVisit.check_in_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true })}</span>
                      <span>•</span>
                      <span className="text-[#731A73] bg-purple-100/70 px-2 py-0.5 rounded-md">Stay: {calculateDuration(pendingVisit.check_in_time)}</span>
                    </div>
                  </div>
                </div>
                {!initialVisit && (
                  <button
                    type="button"
                    onClick={() => setStep('select')}
                    className="px-3 py-1.5 bg-white border border-purple-200 hover:bg-purple-50 text-[#731A73] text-xs font-bold rounded-xl transition-all shadow-2xs flex items-center gap-1 shrink-0 ml-2 cursor-pointer"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" /> Back
                  </button>
                )}
              </div>

              {/* Dedicated Compulsory Visitor Experience Feedback Form Box */}
              <div className="p-5 bg-white rounded-2xl border-2 border-purple-200 shadow-md space-y-4">
                <div className="flex items-center justify-between border-b border-purple-100 pb-3">
                  <div>
                    <h4 className="font-heading font-black text-base text-purple-950 flex items-center gap-2">
                      <Star className="w-5 h-5 text-amber-500 fill-amber-400" />
                      Mandatory Visitor Experience Rating
                    </h4>
                    <p className="text-xs text-gray-500">Record visitor rating & feedback to approve campus gate clearance</p>
                  </div>
                  <span className="px-3 py-1 bg-amber-50 text-amber-900 font-black text-xs rounded-full border border-amber-200 font-sans shadow-2xs">
                    {(ratingFeedbackPresets[hoverRating || selectedRating] || ratingFeedbackPresets[5]).emoji} {(ratingFeedbackPresets[hoverRating || selectedRating] || ratingFeedbackPresets[5]).label}
                  </span>
                </div>

                {/* 1-5 Star Interactive Buttons */}
                <div className="space-y-1.5 text-center">
                  <label className="block text-xs font-extrabold text-gray-700 uppercase tracking-wider">
                    Rate Campus Visit Experience (1 to 5 Stars) *
                  </label>
                  <div className="flex items-center justify-center gap-3 py-2">
                    {[1, 2, 3, 4, 5].map((star) => {
                      const active = star <= (hoverRating || selectedRating);
                      return (
                        <button
                          key={star}
                          type="button"
                          onMouseEnter={() => setHoverRating(star)}
                          onMouseLeave={() => setHoverRating(null)}
                          onClick={() => {
                            setSelectedRating(star);
                            const current = ratingFeedbackPresets[star];
                            if (current && current.presets.length > 0) {
                              setFeedbackComment(current.presets[0]);
                            }
                            if (feedbackError) setFeedbackError(null);
                          }}
                          className={`p-3.5 rounded-2xl transition-all transform hover:scale-125 cursor-pointer ${
                            active
                              ? 'text-amber-400 bg-amber-50 border-2 border-amber-400 shadow-md scale-110'
                              : 'text-gray-300 bg-gray-50 border border-gray-200 hover:text-amber-300'
                          }`}
                        >
                          <Star className={`w-7 h-7 ${active ? 'fill-amber-400' : 'fill-transparent'}`} />
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Quick Feedback Presets based on selected rating */}
                <div className="space-y-1.5">
                  <label className="block text-[11px] font-bold text-gray-600 uppercase tracking-wider">
                    1-Tap Feedback Highlights (Tap to select)
                  </label>
                  <div className="flex flex-wrap gap-1.5 text-xs font-bold">
                    {((ratingFeedbackPresets[selectedRating] || ratingFeedbackPresets[5]).presets).map((tag) => (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => {
                          setFeedbackComment(tag);
                          setFeedbackError(null);
                        }}
                        className={`px-3 py-1.5 rounded-xl border transition-all shadow-2xs text-xs font-bold cursor-pointer ${
                          feedbackComment === tag
                            ? 'bg-[#731A73] text-white border-purple-900 shadow-sm'
                            : 'bg-purple-50 hover:bg-purple-100 text-purple-900 border-purple-200'
                        }`}
                      >
                        ✓ {tag}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Mandatory Feedback Comment Box */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-extrabold text-gray-700 uppercase tracking-wider flex items-center justify-between">
                    <span>Visitor Comments & Feedback Notes *</span>
                    <span className="text-[10px] text-[#731A73] font-bold">Mandatory for Sign-Out</span>
                  </label>
                  <textarea
                    rows={2}
                    required
                    placeholder="Enter visitor feedback comments..."
                    value={feedbackComment}
                    onChange={(e) => {
                      setFeedbackComment(e.target.value);
                      if (feedbackError) setFeedbackError(null);
                    }}
                    className={`w-full text-xs p-3 rounded-xl border focus:ring-2 focus:ring-purple-500 focus:outline-none bg-purple-50/30 text-gray-900 font-semibold ${
                      feedbackError ? 'border-red-500 ring-1 ring-red-500' : 'border-purple-200'
                    }`}
                  />
                  {feedbackError && (
                    <p className="text-[11px] text-red-600 font-bold flex items-center gap-1 mt-0.5">
                      <AlertCircle className="w-3.5 h-3.5" /> {feedbackError}
                    </p>
                  )}
                </div>

                {/* Sign-Out Action Button */}
                <div className="pt-2">
                  <button
                    type="button"
                    onClick={handleConfirmCheckoutWithReview}
                    disabled={isProcessing || !feedbackComment.trim()}
                    className="w-full py-3.5 px-5 rounded-2xl bg-gradient-to-r from-[#731A73] via-purple-800 to-indigo-900 hover:from-purple-900 hover:to-indigo-950 text-white font-black text-xs uppercase tracking-wider shadow-lg transition-all disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer active:scale-98"
                  >
                    {isProcessing ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin text-amber-400" />
                        <span>Authorizing Gate Exit Clearance...</span>
                      </>
                    ) : (
                      <>
                        <LogOut className="w-4 h-4 text-amber-400" />
                        <span>Save Feedback & Authorize Visitor Exit</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          ) : null}

          {/* STEP 3: SUCCESS SCREEN WITH PERFORATED EXIT RECEIPT */}
          {successVisit ? (
            <div className="text-center py-2 space-y-4 animate-fadeIn">
              <div className="w-16 h-16 rounded-full bg-emerald-100 border-4 border-emerald-400 flex items-center justify-center text-emerald-700 mx-auto shadow-lg">
                <CheckCircle2 className="w-9 h-9 text-emerald-600" />
              </div>
              <div>
                <span className="px-3.5 py-1 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-full text-[10px] font-black uppercase tracking-wider font-mono shadow-2xs">
                  ✓ GATE EXIT PERMIT APPROVED
                </span>
                <h3 className="font-heading font-black text-xl text-gray-900 mt-2">Sign-Out Complete!</h3>
                <p className="text-xs text-gray-500 font-medium mt-0.5">Visitor gate clearance timestamped & feedback logged to campus registry</p>
              </div>

              {/* Perforated Exit Slip Certificate Card */}
              <div id="printable-exit-slip" className="p-5 text-left max-w-sm mx-auto space-y-3.5 border-2 border-purple-300 bg-white shadow-xl rounded-2xl relative overflow-hidden receipt-perforation">
                <div className="flex items-center justify-between border-b border-purple-100 pb-2.5">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-4.5 h-4.5 text-[#731A73]" />
                    <span className="text-[11px] font-black uppercase tracking-wider text-[#731A73]">VIMTECH GATE EXIT SLIP</span>
                  </div>
                  <span className="text-[9px] font-mono font-black text-amber-900 bg-amber-100 px-2 py-0.5 rounded-md border border-amber-200">
                    CLEARANCE APPROVED
                  </span>
                </div>

                <div className="flex items-center gap-3.5 pb-2">
                  <img
                    src={successVisit.visitor_photo_url || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=300&q=80'}
                    alt={successVisit.visitor_name}
                    className="w-13 h-13 rounded-xl object-cover ring-2 ring-purple-300 shadow-2xs"
                  />
                  <div>
                    <p className="font-black text-sm text-gray-900">{successVisit.visitor_name}</p>
                    <p className="text-xs text-gray-500 font-mono font-bold">+91 {successVisit.visitor_phone}</p>
                    <p className="text-[10px] text-[#731A73] font-extrabold mt-0.5 truncate">{successVisit.purpose || 'Campus Visit'}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-[10px] pt-2 border-t border-purple-100 bg-purple-50/50 p-2.5 rounded-xl">
                  <div>
                    <span className="text-[8px] text-gray-400 font-bold uppercase block">Entry Time</span>
                    <strong className="text-gray-900 font-mono font-bold">{new Date(successVisit.check_in_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true })}</strong>
                  </div>
                  <div>
                    <span className="text-[8px] text-gray-400 font-bold uppercase block">Exit Clearance Time</span>
                    <strong className="text-emerald-700 font-mono font-bold">{successVisit.check_out_time ? new Date(successVisit.check_out_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true }) : 'Just Now'}</strong>
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs pt-1">
                  <span className="text-gray-500 font-bold">Total Campus Stay:</span>
                  <span className="font-black text-[#731A73] bg-purple-50 px-2.5 py-1 rounded-lg border border-purple-200 font-mono flex items-center gap-1.5 text-[11px]">
                    <Clock className="w-3.5 h-3.5 text-amber-500" />
                    {calculateDuration(successVisit.check_in_time, successVisit.check_out_time)}
                  </span>
                </div>

                {/* Rating & Feedback Badge */}
                <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200 space-y-1">
                  <div className="flex items-center justify-between text-[10px]">
                    <span className="text-gray-500 font-bold uppercase text-[8px]">Feedback Rating:</span>
                    <div className="flex items-center gap-0.5">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <Star
                          key={star}
                          className={`w-3.5 h-3.5 ${
                            star <= (successVisit.rating || selectedRating)
                              ? 'text-amber-400 fill-amber-400'
                              : 'text-gray-200 fill-gray-200'
                          }`}
                        />
                      ))}
                    </div>
                  </div>
                  {(successVisit.feedback_comment || feedbackComment) && (
                    <p className="text-[10px] text-gray-700 italic font-medium bg-white p-1.5 rounded-lg border border-slate-100">
                      "{successVisit.feedback_comment || feedbackComment}"
                    </p>
                  )}
                </div>
              </div>

              {/* Action Buttons: WhatsApp Exit Slip, Print Slip, Done */}
              <div className="space-y-2 pt-1 max-w-sm mx-auto">
                <button
                  type="button"
                  onClick={() => handleShareExitSlipWhatsApp(successVisit)}
                  className="w-full py-3 px-4 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs flex items-center justify-center gap-2 shadow-md transition-all cursor-pointer active:scale-98"
                >
                  <MessageCircle className="w-4 h-4" /> Send Exit Clearance Slip on WhatsApp
                </button>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => window.print()}
                    className="py-2.5 px-3 rounded-xl bg-purple-50 hover:bg-purple-100 text-[#731A73] border border-purple-200 font-extrabold text-xs flex items-center justify-center gap-1.5 shadow-2xs transition-all cursor-pointer"
                  >
                    <Printer className="w-4 h-4 text-[#731A73]" /> Print Exit Slip
                  </button>
                  <button
                    type="button"
                    onClick={onClose}
                    className="py-2.5 px-3 rounded-xl bg-slate-900 hover:bg-slate-950 text-white font-black text-xs uppercase tracking-wider shadow-md transition-all cursor-pointer"
                  >
                    Done & Close
                  </button>
                </div>
              </div>
            </div>
          ) : tab === 'scanner' ? (
            /* SIMPLE, CLEAN & ELEGANT QR SCANNER */
            <div className="space-y-4 max-w-md mx-auto">
              
              {/* Clean Camera Viewfinder Box */}
              <div className="relative w-full aspect-square max-w-[270px] mx-auto rounded-3xl overflow-hidden bg-slate-900 border-2 border-purple-200 shadow-xl flex items-center justify-center">
                
                {/* Live Camera Stream */}
                <div id="qr-reader-viewport" className="absolute inset-0 w-full h-full overflow-hidden rounded-3xl" />

                {/* Minimal Loading State */}
                {!isCameraActive && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center p-4 text-center bg-slate-950 text-white z-10">
                    <RefreshCw className="w-8 h-8 animate-spin text-purple-400 mb-2" />
                    <p className="text-xs font-bold text-white">Starting Camera...</p>
                    <p className="text-[11px] text-gray-400 mt-0.5">Please allow camera permissions if prompted</p>
                  </div>
                )}

                {/* Clean Viewfinder Corner Guides */}
                <div className="absolute inset-0 z-20 flex items-center justify-center pointer-events-none p-6">
                  <div className="relative w-full h-full rounded-2xl border-2 border-dashed border-white/40 flex items-center justify-center">
                    {/* Top Left */}
                    <div className="absolute top-0 left-0 w-6 h-6 border-t-3 border-l-3 border-[#731A73] rounded-tl-lg" />
                    {/* Top Right */}
                    <div className="absolute top-0 right-0 w-6 h-6 border-t-3 border-r-3 border-[#731A73] rounded-tr-lg" />
                    {/* Bottom Left */}
                    <div className="absolute bottom-0 left-0 w-6 h-6 border-b-3 border-l-3 border-[#731A73] rounded-bl-lg" />
                    {/* Bottom Right */}
                    <div className="absolute bottom-0 right-0 w-6 h-6 border-b-3 border-r-3 border-[#731A73] rounded-br-lg" />

                    {/* Subtle Scan Pulse */}
                    {isCameraActive && (
                      <div className="w-12 h-12 rounded-full border border-purple-400/50 animate-ping opacity-30 pointer-events-none" />
                    )}
                  </div>
                </div>

                {/* Top Status Pill */}
                {isCameraActive && (
                  <div className="absolute top-3 inset-x-0 flex justify-center z-30 pointer-events-none">
                    <span className="px-3 py-1 bg-slate-900/80 backdrop-blur-md rounded-full text-[10px] font-bold text-emerald-400 border border-white/10 flex items-center gap-1.5 shadow">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      Scanner Ready • Align QR Pass
                    </span>
                  </div>
                )}
              </div>

              {/* Clean Minimal Controls */}
              <div className="flex items-center justify-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={handleToggleFlashlight}
                  className={`px-3.5 py-2 rounded-xl text-xs font-bold border flex items-center gap-1.5 transition-all cursor-pointer ${
                    isFlashOn 
                      ? 'bg-amber-500 text-white border-amber-600 shadow-sm' 
                      : 'bg-white hover:bg-purple-50 text-gray-700 border-gray-200'
                  }`}
                >
                  <Zap className={`w-4 h-4 ${isFlashOn ? 'text-white' : 'text-amber-500'}`} />
                  <span>{isFlashOn ? 'Flash ON' : 'Flashlight'}</span>
                </button>

                <button
                  type="button"
                  onClick={handleToggleCameraFacing}
                  className="px-3.5 py-2 rounded-xl bg-white hover:bg-purple-50 text-gray-700 border border-gray-200 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
                >
                  <Camera className="w-4 h-4 text-purple-700" />
                  <span>{cameraFacing === 'environment' ? 'Rear' : 'Front'} Camera</span>
                </button>

                <button
                  type="button"
                  onClick={handleGalleryClick}
                  disabled={isProcessing}
                  className="px-3.5 py-2 rounded-xl bg-white hover:bg-purple-50 text-gray-700 border border-gray-200 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
                >
                  <ImageIcon className="w-4 h-4 text-purple-700" />
                  <span>Upload QR</span>
                </button>
              </div>

              {/* Clean Token Search Input */}
              <div className="p-3.5 bg-gray-50 border border-gray-200 rounded-2xl space-y-2">
                <label className="block text-[11px] font-bold text-gray-600">
                  Or enter Token Code / Visitor Phone:
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="e.g. VMS-VIMTECH-8923 or 9876543210"
                    value={manualToken}
                    onChange={(e) => setManualToken(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && manualToken.trim()) {
                        handleSelectTokenForReview(manualToken);
                      }
                    }}
                    className="flex-1 bg-white border border-gray-300 text-gray-900 text-xs font-mono p-2.5 rounded-xl uppercase font-semibold focus:ring-2 focus:ring-purple-500 focus:outline-none placeholder-gray-400"
                  />
                  <button
                    type="button"
                    onClick={() => handleSelectTokenForReview(manualToken)}
                    disabled={!manualToken.trim() || isProcessing}
                    className="bg-[#731A73] hover:bg-[#5a135a] text-white font-bold text-xs px-4 rounded-xl disabled:opacity-50 transition-colors cursor-pointer"
                  >
                    {isProcessing ? 'Verifying...' : 'Verify'}
                  </button>
                </div>
              </div>
            </div>
          ) : (
            /* MANUAL SEARCH DIRECTORY TAB */
            <div className="space-y-3.5">
              <div className="relative flex items-center">
                <Search className="w-4 h-4 text-gray-400 absolute left-3.5 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Search active visitor by name, phone, token, or host..."
                  value={manualQuery}
                  onChange={(e) => setManualQuery(e.target.value)}
                  className="w-full pl-10 pr-4 text-xs py-3 font-semibold rounded-2xl bg-purple-50/40 border border-purple-200 text-gray-900 focus:ring-2 focus:ring-purple-500 focus:outline-none placeholder-gray-400"
                />
              </div>

              <div className="flex items-center justify-between text-xs px-1 text-gray-500 font-bold">
                <span>Showing {filteredActiveVisits.length} of {insideVisits.length} visitors inside campus</span>
                {manualQuery && (
                  <button
                    onClick={() => setManualQuery('')}
                    className="text-[#731A73] hover:underline font-bold text-[11px] cursor-pointer"
                  >
                    Clear search
                  </button>
                )}
              </div>

              <div className="space-y-2.5 max-h-80 overflow-y-auto pr-1">
                {filteredActiveVisits.length === 0 ? (
                  <div className="text-center py-12 bg-gray-50 rounded-2xl border border-dashed border-gray-200">
                    <User className="w-9 h-9 text-gray-300 mx-auto mb-2" />
                    <p className="text-xs text-gray-600 font-bold">No matching active inside visitors found.</p>
                    <p className="text-[11px] text-gray-400 mt-0.5">Check spelling or clear the search query</p>
                  </div>
                ) : (
                  filteredActiveVisits.map(v => {
                    return (
                      <div key={v.id} className="p-3.5 bg-white border border-purple-100 rounded-2xl flex items-center justify-between hover:border-purple-300 shadow-2xs transition-all">
                        <div className="flex items-center gap-3.5 min-w-0">
                          <div className="relative shrink-0">
                            <img
                              src={v.visitor_photo_url || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=300&q=80'}
                              alt={v.visitor_name}
                              className="w-12 h-12 rounded-2xl object-cover ring-2 ring-purple-100 shadow-2xs"
                            />
                            <span className="w-3.5 h-3.5 rounded-full bg-emerald-500 border-2 border-white absolute -bottom-0.5 -right-0.5 shadow-2xs" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <p className="font-extrabold text-xs text-gray-900 truncate">{v.visitor_name}</p>
                            </div>
                            <p className="text-[11px] text-gray-500 font-mono font-bold">+91 {v.visitor_phone}</p>
                            <div className="flex items-center gap-2 text-[10px] text-gray-600 mt-1">
                              <span className="text-[#731A73] font-black truncate">{v.purpose || 'Campus Visit'}</span>
                              <span>•</span>
                              <span className="font-mono font-black text-purple-700 bg-purple-50 px-1.5 py-0.5 rounded border border-purple-200 text-[10px]">
                                {calculateDuration(v.check_in_time)}
                              </span>
                            </div>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleManualCheckout(v.id)}
                          disabled={isProcessing}
                          className="px-3.5 py-2 bg-[#731A73] hover:bg-[#5a135a] text-white rounded-xl text-xs font-black shadow-sm transition-all shrink-0 uppercase tracking-wider flex items-center gap-1.5 active:scale-95 cursor-pointer ml-2"
                        >
                          <LogOut className="w-3.5 h-3.5 text-amber-400" /> Sign Out
                        </button>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
