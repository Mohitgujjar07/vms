import React, { useState, useEffect, useRef } from 'react';
import { Host, Visitor, Visit, BlacklistEntry } from '../../types';
import { vmsService } from '../../services/vmsService';
import { VimtechLogo } from '../VimtechLogo';
import { QRCodeSVG } from 'qrcode.react';
import {
  shareWhatsAppPassDirectly,
  generatePassImageBlob,
  copyPassPhotoToClipboard,
  copyPassTextToClipboard,
  downloadPassImage,
  buildWhatsAppPassMessage
} from '../../utils/passImageGenerator';
import { downloadPassPdf } from '../../utils/passPdfGenerator';
import {
  X, Camera, Video, Phone, User, Building, AlertTriangle,
  CheckCircle2, QrCode, ShieldAlert, Sparkles, Printer, ArrowRight,
  Upload, FlipHorizontal, Image as ImageIcon, RefreshCw, Copy, Check,
  Download, FileText, Share2, MessageCircle
} from 'lucide-react';

interface CheckInModalProps {
  branchId: string;
  collegeId?: string;
  receptionistId?: string;
  receptionistName?: string;
  hosts: Host[];
  onClose: () => void;
  onSuccess: () => void;
}

export const CheckInModal: React.FC<CheckInModalProps> = ({
  branchId, collegeId, receptionistId, receptionistName,
  hosts, onClose, onSuccess
}) => {
  const [step, setStep] = useState<'details' | 'qr'>('details');
  const [phone, setPhone] = useState('');
  const [fullName, setFullName] = useState('');
  const [photoUrl, setPhotoUrl] = useState<string>('');
  const [selectedHostId, setSelectedHostId] = useState('');
  const [purpose, setPurpose] = useState('Admissions Enquiry for BCA / BBA / MBA');
  const [category, setCategory] = useState('Admissions');
  const [customPurpose, setCustomPurpose] = useState('');
  const [isExistingVisitor, setIsExistingVisitor] = useState(false);
  const [blacklistAlert, setBlacklistAlert] = useState<BlacklistEntry | null>(null);
  const [insideCheckError, setInsideCheckError] = useState<string | null>(null);
  
  // Camera & Stream states
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  const [cameraError, setCameraError] = useState<string | null>(null);

  const [isSaving, setIsSaving] = useState(false);
  const [createdVisit, setCreatedVisit] = useState<Visit | null>(null);
  const [isOfflineSaved, setIsOfflineSaved] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const [isTextCopied, setIsTextCopied] = useState(false);
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);
  const [isDownloadingImage, setIsDownloadingImage] = useState(false);

  const handleCopyPassPhoto = async (visit: Visit) => {
    try {
      await copyPassPhotoToClipboard(visit);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 4000);
    } catch (err) {
      console.warn('Copy pass photo error:', err);
      try {
        await downloadPassImage(visit);
        alert('Pass photo downloaded to your device!');
      } catch (e) {
        console.error('Download error:', e);
      }
    }
  };

  const handleCopyPassText = async (visit: Visit) => {
    try {
      await copyPassTextToClipboard(visit);
      setIsTextCopied(true);
      setTimeout(() => setIsTextCopied(false), 3000);
    } catch (err) {
      console.error('Copy pass text error:', err);
    }
  };

  const handleDownloadImage = async (visit: Visit) => {
    try {
      setIsDownloadingImage(true);
      await downloadPassImage(visit);
    } catch (err) {
      console.error('Download image error:', err);
    } finally {
      setIsDownloadingImage(false);
    }
  };

  const handleDownloadPdf = async (visit: Visit) => {
    try {
      setIsDownloadingPdf(true);
      await downloadPassPdf(visit);
    } catch (err) {
      console.error('Download PDF error:', err);
    } finally {
      setIsDownloadingPdf(false);
    }
  };

  const handleOpenWhatsAppChat = (visit: Visit, target: 'visitor' | 'host' = 'visitor') => {
    shareWhatsAppPassDirectly(visit, target);
  };
  
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (phone.trim().length >= 10) handlePhoneLookup(phone.trim());
    else { setBlacklistAlert(null); setInsideCheckError(null); }
  }, [phone]);

  // Bind camera stream to video element whenever video element or stream state updates
  useEffect(() => {
    if (isCameraActive && cameraStream && videoRef.current) {
      videoRef.current.srcObject = cameraStream;
      videoRef.current.play().catch(err => console.warn('Video play error:', err));
    }
  }, [isCameraActive, cameraStream]);

  // Cleanup camera stream on unmount
  useEffect(() => {
    return () => {
      stopCameraStream();
    };
  }, []);

  // Automatically copy pass photo badge to clipboard when new pass QR screen opens
  useEffect(() => {
    if (step === 'qr' && createdVisit) {
      copyPassPhotoToClipboard(createdVisit).then(() => {
        setIsCopied(true);
        setTimeout(() => setIsCopied(false), 4000);
      }).catch(err => {
        console.warn('Auto copy pass photo on check-in failed:', err);
      });
    }
  }, [step, createdVisit]);

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const digitsOnly = e.target.value.replace(/\D/g, '').slice(0, 10);
    setPhone(digitsOnly);
  };

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const lettersOnly = e.target.value.replace(/[^a-zA-Z\s\.\']/g, '');
    setFullName(lettersOnly);
  };

  const stopCameraStream = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach(t => t.stop());
      setCameraStream(null);
    }
    setIsCameraActive(false);
  };

  const handlePhoneLookup = async (inputPhone: string) => {
    const blEntry = await vmsService.checkBlacklist(inputPhone, branchId, collegeId);
    setBlacklistAlert(blEntry || null);
    const foundVisitor = await vmsService.lookupVisitorByPhone(inputPhone);
    if (foundVisitor) {
      setIsExistingVisitor(true);
      setFullName(foundVisitor.name);
      if (foundVisitor.photo_url) setPhotoUrl(foundVisitor.photo_url);
    } else {
      setIsExistingVisitor(false);
    }
  };

  const startCamera = async (mode: 'user' | 'environment' = facingMode) => {
    stopCameraStream();
    setCameraError(null);
    setIsCameraActive(true);

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Camera stream not supported over unsecure HTTP LAN connection. Use device camera photo upload.');
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: mode }, width: { ideal: 640 }, height: { ideal: 480 } }
      });
      setFacingMode(mode);
      setCameraStream(stream);
    } catch (err: any) {
      console.warn("Live WebRTC camera failed, falling back to native tablet file picker", err);
      setIsCameraActive(false);
      setCameraError("Live stream restricted. Tapping 'Take Photo' will open your tablet camera!");
      // Automatically trigger tablet camera file input fallback
      if (fileInputRef.current) {
        fileInputRef.current.click();
      }
    }
  };

  const toggleCameraFacingMode = () => {
    const nextMode = facingMode === 'user' ? 'environment' : 'user';
    startCamera(nextMode);
  };

  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const canvas = canvasRef.current;
      canvas.width = 400;
      canvas.height = 400;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        // Draw cropped centered square photo
        const video = videoRef.current;
        const minDim = Math.min(video.videoWidth || 400, video.videoHeight || 400);
        const sx = (video.videoWidth - minDim) / 2 || 0;
        const sy = (video.videoHeight - minDim) / 2 || 0;
        ctx.drawImage(video, sx, sy, minDim, minDim, 0, 0, 400, 400);
        setPhotoUrl(canvas.toDataURL('image/jpeg', 0.85));
        stopCameraStream();
      }
    }
  };

  // Process image file captured by native tablet camera or picked from gallery
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_SIZE = 400;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_SIZE) {
            height = Math.round((height * MAX_SIZE) / width);
            width = MAX_SIZE;
          }
        } else {
          if (height > MAX_SIZE) {
            width = Math.round((width * MAX_SIZE) / height);
            height = MAX_SIZE;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          setPhotoUrl(canvas.toDataURL('image/jpeg', 0.85));
          setCameraError(null);
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setInsideCheckError(null);

    if (phone.length !== 10) {
      alert('Visitor Phone Number must be exactly 10 numeric digits.');
      return;
    }
    if (!fullName.trim() || fullName.trim().length < 2) {
      alert('Please enter a valid Visitor Full Name (letters only).');
      return;
    }
    // Host person selection requirement removed as requested

    setIsSaving(true);
    try {
      const finalPurpose = purpose === 'Other' ? customPurpose : purpose;
      const defaultPhoto = photoUrl || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=300&q=80';
      const result = await vmsService.createCheckIn({
        branchId, collegeId, receptionistId, receptionistName,
        visitorName: fullName, visitorPhone: phone, visitorPhotoUrl: defaultPhoto,
        hostId: selectedHostId || 'host-vimtech-001', purpose: `${category}: ${finalPurpose}`
      });
      const created = { ...result.visit, category };
      setCreatedVisit(created);
      setIsOfflineSaved(result.isOffline);
      setStep('qr');
      vmsService.autoDispatchPassNotification(created);
      onSuccess();
    } catch (err: any) {
      setInsideCheckError(err?.message || 'Check-in failed');
    } finally {
      setIsSaving(false);
    }
  };

  const getWhatsAppShareUrl = (visit: Visit) => {
    const rawPhone = (visit.visitor_phone || '').replace(/\D/g, '');
    const phoneWithCountryCode = rawPhone.length === 10 ? `91${rawPhone}` : rawPhone;
    const message = buildWhatsAppPassMessage(visit, 'visitor');
    return `https://api.whatsapp.com/send?phone=${phoneWithCountryCode}&text=${encodeURIComponent(message)}`;
  };

  return (
    <div className="vms-modal-overlay animate-fadeIn">
      {/* Hidden Native Device Camera / File Input Trigger */}
      <input
        type="file"
        ref={fileInputRef}
        accept="image/*"
        capture="user"
        onChange={handleFileUpload}
        className="hidden"
      />

      <div className="vms-modal max-w-lg max-h-[90vh] flex flex-col shadow-2xl rounded-3xl border-2 border-purple-100">

        {/* Header */}
        <div className="px-6 py-4 border-b border-purple-100 bg-white flex items-center justify-between">
          <VimtechLogo size="sm" showSubtitle={true} />
          <button onClick={() => { stopCameraStream(); onClose(); }} className="p-2 rounded-xl text-gray-400 hover:text-gray-700 hover:bg-purple-50 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Wizard Step Progress */}
        <div className="px-6 py-3 bg-purple-50/60 border-b border-purple-100 flex items-center justify-between text-xs font-bold">
          <span className={`flex items-center gap-2 ${step === 'details' ? 'text-[#731A73]' : 'text-emerald-700'}`}>
            <span className={`w-6 h-6 rounded-full text-xs flex items-center justify-center font-extrabold shadow-sm ${step === 'details' ? 'bg-[#731A73] text-white' : 'bg-emerald-600 text-white'}`}>1</span>
            Visitor & Host Identity Info
          </span>
          <span className="text-purple-300 font-bold">→</span>
          <span className={`flex items-center gap-2 ${step === 'qr' ? 'text-[#731A73]' : 'text-gray-400'}`}>
            <span className={`w-6 h-6 rounded-full text-xs flex items-center justify-center font-extrabold ${step === 'qr' ? 'bg-[#731A73] text-white' : 'bg-gray-200 text-gray-500'}`}>2</span>
            Verified Gate QR Pass
          </span>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto space-y-4 flex-1">
          {step === 'details' ? (
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Phone */}
              <div className="p-4 bg-purple-50/40 rounded-2xl border border-purple-100 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-extrabold text-gray-800 uppercase tracking-wider">
                    1. Visitor Mobile Phone Number *
                  </label>
                  <span className={`text-[10px] font-mono font-extrabold px-2.5 py-0.5 rounded-full border shadow-sm ${
                    phone.length === 10
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : 'bg-purple-50 text-[#731A73] border-purple-200'
                  }`}>
                    {phone.length === 10 ? '✓ 10 Digits Valid' : `${phone.length} / 10 Digits`}
                  </span>
                </div>

                <div className="relative flex items-center">
                  <Phone className="w-5 h-5 text-[#731A73] absolute left-3.5 pointer-events-none z-10" />
                  <input
                    type="tel"
                    required
                    maxLength={10}
                    placeholder="Enter 10-digit phone (digits only, e.g. 9876543210)"
                    value={phone}
                    onChange={handlePhoneChange}
                    className={`w-full !pl-12 pr-28 text-sm py-3 font-mono font-bold rounded-xl border focus:outline-none focus:ring-2 bg-white transition-all ${
                      phone.length === 10
                        ? 'border-emerald-400 focus:ring-emerald-400/30 text-gray-900'
                        : 'border-gray-300 focus:ring-[#731A73]/30 focus:border-[#731A73]'
                    }`}
                  />
                  {isExistingVisitor && (
                    <span className="absolute right-3 vms-badge-green text-[10px] shadow-sm font-bold flex items-center gap-1">
                      <Sparkles className="w-3 h-3 text-amber-500" /> Repeat Visitor
                    </span>
                  )}
                </div>
                <p className="text-[10px] text-gray-400 font-medium">Numeric digits only (0–9). Automatically limited to 10 digits.</p>
              </div>

              {/* Blacklist Alert */}
              {blacklistAlert && (
                <div className="p-4 bg-red-50 border-2 border-red-300 rounded-2xl text-red-700 text-xs flex items-start gap-3 shadow-sm animate-pulse">
                  <ShieldAlert className="w-6 h-6 text-red-500 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-extrabold text-sm uppercase">SECURITY ALERT: Visitor is Blacklisted!</p>
                    <p className="mt-0.5 text-red-600 font-medium">{blacklistAlert.reason}</p>
                  </div>
                </div>
              )}

              {/* Check-in Error / Alert */}
              {insideCheckError && (
                <div className="p-4 bg-amber-50 border-2 border-amber-300 rounded-2xl text-amber-800 text-xs flex items-start gap-3 shadow-sm animate-fadeIn">
                  <AlertTriangle className="w-6 h-6 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-extrabold text-sm uppercase">
                      {insideCheckError.includes('already checked in') ? 'Check-in Blocked (Active Visit Detected)' : 'Check-in Error'}
                    </p>
                    <p className="mt-1 text-amber-700 font-medium">{insideCheckError}</p>
                  </div>
                </div>
              )}

              {/* Photo & Name */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-center p-4 bg-purple-50/20 rounded-2xl border border-purple-100">
                <div className="sm:col-span-1 flex flex-col items-center">
                  <div className="relative w-28 h-28 rounded-2xl overflow-hidden border-2 border-[#731A73]/30 bg-purple-50 flex items-center justify-center group shadow-md">
                    {isCameraActive ? (
                      <>
                        <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
                        <button
                          type="button"
                          onClick={toggleCameraFacingMode}
                          title="Switch Front/Back Camera"
                          className="absolute top-1.5 right-1.5 p-1.5 bg-black/60 hover:bg-black/80 text-white rounded-full transition-colors"
                        >
                          <FlipHorizontal className="w-3.5 h-3.5" />
                        </button>
                      </>
                    ) : photoUrl ? (
                      <img src={photoUrl} alt="Visitor" className="w-full h-full object-cover" />
                    ) : (
                      <User className="w-12 h-12 text-[#731A73]/40" />
                    )}

                    {!isCameraActive && (
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center text-xs font-bold text-white transition-opacity"
                      >
                        <Camera className="w-6 h-6 mb-1" />
                        Take Photo
                      </button>
                    )}
                  </div>
                  <canvas ref={canvasRef} className="hidden" />

                  {/* Photo Actions */}
                  <div className="mt-2 flex flex-col items-center gap-1.5 w-full">
                    {isCameraActive ? (
                      <div className="flex gap-1 w-full justify-center">
                        <button type="button" onClick={capturePhoto}
                          className="px-3 py-1.5 vms-btn-primary text-xs flex items-center gap-1 shadow-sm font-bold bg-[#731A73]">
                          <Camera className="w-3.5 h-3.5" /> Snap
                        </button>
                        <button type="button" onClick={stopCameraStream}
                          className="px-2 py-1.5 vms-btn-secondary text-xs font-bold">
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <div className="flex flex-col gap-1 items-center w-full">
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          className="w-full py-2 px-3 bg-purple-50 hover:bg-purple-100 text-[#731A73] border border-purple-200 rounded-xl text-xs font-extrabold flex items-center justify-center gap-1.5 transition-colors shadow-sm"
                        >
                          <Camera className="w-4 h-4" />
                          {photoUrl ? 'Retake Photo' : 'Take Photo (Tablet)'}
                        </button>

                        <button
                          type="button"
                          onClick={() => startCamera('user')}
                          className="text-[11px] text-[#731A73] hover:underline font-bold flex items-center gap-1 mt-1"
                        >
                          <Video className="w-3.5 h-3.5" /> Live Webcam Stream
                        </button>
                      </div>
                    )}
                  </div>

                  {cameraError && (
                    <p className="text-[10px] text-amber-600 mt-1 text-center leading-tight font-medium">{cameraError}</p>
                  )}
                </div>

                <div className="sm:col-span-2 space-y-1">
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-extrabold text-gray-800 uppercase tracking-wider">
                      2. Visitor Full Name *
                    </label>
                    {fullName.trim().length >= 2 && (
                      <span className="text-[10px] font-bold text-emerald-600 flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Valid Name
                      </span>
                    )}
                  </div>
                  <div className="relative flex items-center">
                    <User className="w-5 h-5 text-[#731A73] absolute left-3.5 pointer-events-none z-10" />
                    <input
                      type="text"
                      required
                      placeholder="Enter full name (letters only, e.g. Suresh Babu)"
                      value={fullName}
                      onChange={handleNameChange}
                      className="w-full !pl-12 pr-4 text-sm py-3 font-semibold rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#731A73]/30 focus:border-[#731A73] bg-white"
                    />
                  </div>
                  <p className="text-[10px] text-gray-400 font-medium">Letters and spaces only. Numbers are automatically blocked.</p>
                </div>
              </div>

              {/* Category & Purpose */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">3. Category *</label>
                  <select value={category} onChange={(e) => setCategory(e.target.value)} className="w-full vms-input text-xs font-bold">
                    <option value="Admissions">Admissions Candidate / Parent</option>
                    <option value="Meeting Staff">Faculty / Staff Meeting</option>
                    <option value="Parent Visit">Student Parent Visit</option>
                    <option value="AICTE / University">AICTE / Tumkur Univ. Official</option>
                    <option value="Vendor / Courier">Vendor / Courier / Delivery</option>
                    <option value="CDC Placement">CDC / Company Recruiter</option>
                    <option value="Alumni">VIMTECH Alumnus</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">4. Purpose *</label>
                  <select value={purpose} onChange={(e) => setPurpose(e.target.value)} className="w-full vms-input text-xs font-medium">
                    <option value="Admissions Enquiry for BCA / BBA / MBA">Admissions Enquiry</option>
                    <option value="Meeting with HOD / Faculty">Meeting HOD / Faculty</option>
                    <option value="Fee Payment / Accounts Office">Fee Payment / Accounts</option>
                    <option value="CDC Placement Interview">CDC Placement Interview</option>
                    <option value="Official Audit / Inspection">Official Audit / Inspection</option>
                    <option value="Other">Other Custom Purpose</option>
                  </select>
                </div>
              </div>

              {purpose === 'Other' && (
                <input type="text" required placeholder="Enter custom purpose details..."
                  value={customPurpose} onChange={(e) => setCustomPurpose(e.target.value)}
                  className="w-full vms-input text-xs font-medium" />
              )}

              {/* Submit */}
              <div className="pt-3 flex items-center justify-end gap-3 border-t border-gray-100">
                <button type="button" onClick={onClose} className="vms-btn-secondary text-xs py-2.5">Cancel</button>
                <button type="submit" disabled={isSaving}
                  className="vms-btn-primary text-xs py-3 px-6 font-extrabold flex items-center gap-2 disabled:opacity-50 shadow-md">
                  {isSaving ? 'Processing...' : 'Complete Check-In & Issue Pass'}
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </form>
          ) : createdVisit ? (
            /* Executive Digital Visitor Pass */
            <div className="text-center space-y-4 py-1 animate-fadeIn">
                <div className={`vms-badge ${isOfflineSaved ? 'vms-badge-amber' : 'vms-badge-green'} shadow-md text-xs py-1.5 px-4 font-extrabold`}>
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  {isOfflineSaved ? 'Saved Locally (Pending Sync)' : 'VIMTECH Official Gate Pass • Verified Active Entry'}
                </div>

                {/* Executive Branded Pass Badge (Google Enterprise Standard) */}
                <div id="printable-pass" className="bg-white rounded-3xl border-2 border-[#731A73] max-w-md mx-auto shadow-2xl relative overflow-hidden text-left vms-pass-watermark">
                  {/* Security Foil Accent Header Bar */}
                  <div className="vms-pass-foil-header py-2.5 px-4 text-white flex items-center justify-between shadow-md">
                    <div className="flex items-center gap-2">
                      <span className="vms-live-pulse-dot" />
                      <span className="text-[10px] font-black uppercase tracking-widest text-amber-300">★ OFFICIAL CAMPUS GATE PASS ★</span>
                    </div>
                    <span className="text-[9px] font-mono font-extrabold text-slate-200 bg-white/10 px-2 py-0.5 rounded-md border border-white/20">VIMTECH-SEC</span>
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
                    {/* Visitor Photo & Identity Card */}
                    <div className="flex items-center gap-3.5 bg-white p-3.5 rounded-2xl border border-purple-200 shadow-sm relative overflow-hidden">
                      <div className="relative shrink-0">
                        <img
                          src={createdVisit.visitor_photo_url || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=300&q=80'}
                          alt={createdVisit.visitor_name}
                          className="w-16 h-16 rounded-2xl object-cover ring-2 ring-[#731A73] ring-offset-2 shadow-sm"
                        />
                        <span className="absolute -bottom-1 -right-1 bg-emerald-500 text-white rounded-full p-0.5 ring-2 ring-white shadow">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                        </span>
                      </div>

                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="inline-block px-2.5 py-0.5 bg-[#731A73] text-white rounded-full text-[9px] font-black uppercase tracking-wider shadow-2xs">
                            {createdVisit.category || 'VISITOR'} PASS
                          </span>
                          <span className="text-[9px] font-mono font-black text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                            ● ACTIVE INSIDE
                          </span>
                        </div>
                        <h3 className="font-heading font-black text-base text-gray-900 leading-snug">{createdVisit.visitor_name}</h3>
                        <p className="text-xs text-gray-600 font-mono font-bold">+91 {createdVisit.visitor_phone}</p>
                        <div className="pt-1 border-t border-gray-100 flex items-center justify-between text-[11px]">
                          <span className="text-[#731A73] font-extrabold truncate">Purpose: <strong className="text-gray-900">{createdVisit.purpose}</strong></span>
                        </div>
                      </div>
                    </div>

                    {/* QR Code Container */}
                    <div className="text-center bg-white p-4 rounded-2xl border-2 border-purple-100 shadow-md relative">
                      <div className="flex items-center justify-center p-2">
                        <div className="p-3 bg-white rounded-2xl border border-purple-200 shadow-inner inline-block">
                          <QRCodeSVG
                            value={createdVisit.qr_token || 'VMS-PASS'}
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
                        <span className="text-xs font-mono font-black text-amber-400 tracking-wider">{createdVisit.qr_token}</span>
                      </div>
                    </div>

                    {/* Access Matrix Details */}
                    <div className="grid grid-cols-2 gap-2.5 text-xs bg-purple-50/50 p-3.5 rounded-2xl border border-purple-200">
                      <div>
                        <span className="text-gray-500 block uppercase font-extrabold text-[9px] tracking-wider">Entry Timestamp</span>
                        <strong className="text-gray-900 font-mono font-bold">{new Date(createdVisit.check_in_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true })}</strong>
                      </div>
                      <div className="text-right">
                        <span className="text-gray-500 block uppercase font-extrabold text-[9px] tracking-wider">Gate Clearance</span>
                        <strong className="text-emerald-700 font-bold flex items-center justify-end gap-1">
                          <span className="w-2 h-2 rounded-full bg-emerald-500" /> Verified Entry
                        </strong>
                      </div>
                      <div className="col-span-2 pt-2 border-t border-purple-200/80 flex items-center justify-between text-[11px]">
                        <span className="text-gray-600 font-bold">Campus: <strong className="text-gray-900">Main Campus (Tumkur)</strong></span>
                        <span className="text-[#731A73] font-extrabold">Valid Today Only</span>
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
                <div className="p-3.5 bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 rounded-2xl text-left text-xs space-y-1.5 no-print shadow-2xs">
                  <div className="flex items-center justify-between">
                    <p className="font-extrabold text-emerald-950 flex items-center gap-1.5">
                      <Sparkles className="w-4 h-4 text-amber-500 shrink-0" />
                      Instant Visitor Pass Sharing & Dispatch:
                    </p>
                    <span className="text-[10px] font-mono font-black text-emerald-800 bg-emerald-100/80 px-2 py-0.5 rounded-full border border-emerald-300/60">
                      +91 {createdVisit.visitor_phone}
                    </span>
                  </div>
                  <p className="text-[11px] text-emerald-800 font-medium leading-relaxed">
                    Share directly to WhatsApp, copy formatted token summary or badge image, or download PDF gate pass for physical distribution.
                  </p>
                </div>

                {/* Primary WhatsApp Direct Share Buttons */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1 no-print">
                  <button
                    type="button"
                    onClick={() => handleOpenWhatsAppChat(createdVisit, 'visitor')}
                    title="Direct WhatsApp Pass Delivery to Visitor"
                    className="py-3 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl text-xs font-black flex items-center justify-center gap-2 shadow-lg shadow-emerald-900/20 active:scale-95 transition-all"
                  >
                    <MessageCircle className="w-4.5 h-4.5" />
                    <span>Send Pass to Visitor (WhatsApp)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleOpenWhatsAppChat(createdVisit, 'host')}
                    title="Direct WhatsApp Arrival Alert to Visiting Host"
                    className="py-3 px-4 bg-purple-800 hover:bg-purple-900 text-white rounded-2xl text-xs font-black flex items-center justify-center gap-2 shadow-lg shadow-purple-950/20 active:scale-95 transition-all"
                  >
                    <Share2 className="w-4.5 h-4.5 text-amber-300" />
                    <span>Alert Host (WhatsApp)</span>
                  </button>
                </div>

                {/* Secondary Quick Action Tools: Copy & Downloads */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 no-print">
                  <button
                    type="button"
                    onClick={() => handleCopyPassText(createdVisit)}
                    className={`py-2.5 px-3 rounded-xl text-xs font-extrabold flex items-center justify-center gap-1.5 border transition-all shadow-2xs active:scale-95 ${
                      isTextCopied
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-md'
                        : 'bg-white hover:bg-purple-50 text-gray-800 border-gray-200 hover:border-purple-300'
                    }`}
                  >
                    {isTextCopied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4 text-purple-700" />}
                    <span>{isTextCopied ? '✓ Text Copied!' : 'Copy Text'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleCopyPassPhoto(createdVisit)}
                    className={`py-2.5 px-3 rounded-xl text-xs font-extrabold flex items-center justify-center gap-1.5 border transition-all shadow-2xs active:scale-95 ${
                      isCopied
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-md'
                        : 'bg-white hover:bg-purple-50 text-gray-800 border-gray-200 hover:border-purple-300'
                    }`}
                  >
                    {isCopied ? <Check className="w-4 h-4" /> : <ImageIcon className="w-4 h-4 text-purple-700" />}
                    <span>{isCopied ? '✓ Image Copied!' : 'Copy Photo'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleDownloadImage(createdVisit)}
                    disabled={isDownloadingImage}
                    className="py-2.5 px-3 bg-white hover:bg-purple-50 text-gray-800 border border-gray-200 hover:border-purple-300 rounded-xl text-xs font-extrabold flex items-center justify-center gap-1.5 shadow-2xs active:scale-95 transition-all disabled:opacity-50"
                  >
                    <Download className="w-4 h-4 text-purple-700" />
                    <span>{isDownloadingImage ? 'Downloading...' : 'Save PNG'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleDownloadPdf(createdVisit)}
                    disabled={isDownloadingPdf}
                    className="py-2.5 px-3 bg-white hover:bg-purple-50 text-gray-800 border border-gray-200 hover:border-purple-300 rounded-xl text-xs font-extrabold flex items-center justify-center gap-1.5 shadow-2xs active:scale-95 transition-all disabled:opacity-50"
                  >
                    <FileText className="w-4 h-4 text-purple-700" />
                    <span>{isDownloadingPdf ? 'Generating...' : 'Save PDF'}</span>
                  </button>
                </div>

                {/* Footer Controls: Print and Done */}
                <div className="flex items-center justify-between pt-2 border-t border-gray-100 no-print">
                  <button
                    type="button"
                    onClick={() => window.print()}
                    className="py-2.5 px-4 bg-purple-50 hover:bg-purple-100 text-[#731A73] border border-purple-200 text-xs flex items-center justify-center gap-1.5 rounded-xl font-black shadow-2xs active:scale-95 transition-all"
                  >
                    <Printer className="w-4 h-4" /> Print Pass
                  </button>

                  <button
                    type="button"
                    onClick={onClose}
                    className="py-2.5 px-6 bg-slate-900 hover:bg-slate-950 text-white text-xs font-black rounded-xl shadow-md active:scale-95 transition-all"
                  >
                    Done & Close
                  </button>
                </div>
              </div>
            ) : null}
        </div>
      </div>
    </div>
  );
};
