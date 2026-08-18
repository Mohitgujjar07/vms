import React, { useState, useEffect } from 'react';
import { Visit } from '../../types';
import { generatePassCanvas, shareWhatsAppPassDirectly } from '../../utils/passImageGenerator';
import { VimtechLogo } from '../VimtechLogo';
import { X, Copy, Download, MessageSquare, Check, Sparkles, AlertCircle } from 'lucide-react';

interface WhatsAppShareModalProps {
  visit: Visit;
  onClose: () => void;
}

export const WhatsAppShareModal: React.FC<WhatsAppShareModalProps> = ({ visit, onClose }) => {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imageBlob, setImageBlob] = useState<Blob | null>(null);
  const [isCopied, setIsCopied] = useState(false);
  const [isGenerating, setIsGenerating] = useState(true);

  useEffect(() => {
    let isMounted = true;
    generatePassCanvas(visit).then(canvas => {
      if (!isMounted) return;
      const url = canvas.toDataURL('image/png');
      setImageUrl(url);

      canvas.toBlob(blob => {
        if (blob && isMounted) {
          setImageBlob(blob);
          // Automatically copy to clipboard when pass image is generated
          if (navigator.clipboard && window.ClipboardItem) {
            navigator.clipboard.write([
              new ClipboardItem({ 'image/png': blob })
            ]).then(() => {
              if (isMounted) {
                setIsCopied(true);
                setTimeout(() => setIsCopied(false), 4000);
              }
            }).catch(err => {
              console.warn('Auto copy pass photo error:', err);
            });
          }
        }
        setIsGenerating(false);
      }, 'image/png');
    }).catch(err => {
      console.error('Failed to generate pass image:', err);
      setIsGenerating(false);
    });

    return () => { isMounted = false; };
  }, [visit]);

  const rawPhone = (visit.visitor_phone || '').replace(/\D/g, '');
  const phoneWithCountryCode = rawPhone.length === 10 ? `91${rawPhone}` : rawPhone;

  const handleCopyImage = async () => {
    if (!imageBlob) return;
    try {
      if (navigator.clipboard && window.ClipboardItem) {
        await navigator.clipboard.write([
          new ClipboardItem({ 'image/png': imageBlob })
        ]);
        setIsCopied(true);
        setTimeout(() => setIsCopied(false), 4000);
      } else {
        alert('Clipboard image copy is restricted in this browser. Use the Download Photo button!');
      }
    } catch (err) {
      console.warn('Clipboard copy error:', err);
      alert('Could not copy image automatically. Please use Download Photo button!');
    }
  };

  const handleDownloadImage = () => {
    if (!imageUrl) return;
    const a = document.createElement('a');
    a.href = imageUrl;
    a.download = `VIMTECH_Gate_Pass_${(visit.visitor_name || 'Visitor').replace(/\s+/g, '_')}.png`;
    a.click();
  };

  const handleOpenWhatsApp = async () => {
    await shareWhatsAppPassDirectly(visit);
  };

  return (
    <div className="vms-modal-overlay animate-fadeIn z-50">
      <div className="vms-modal max-w-md w-full p-6 bg-white rounded-3xl shadow-2xl border-2 border-emerald-200 relative overflow-hidden text-left">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <span className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-extrabold text-sm">
              💬
            </span>
            <div>
              <h3 className="font-heading font-extrabold text-base text-gray-900 leading-tight">
                Send Pass Photo via WhatsApp
              </h3>
              <p className="text-[11px] text-gray-500 font-medium">
                Visitor: <strong className="text-gray-800">{visit.visitor_name}</strong> ({visit.visitor_phone})
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-xl text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="py-4 space-y-4">
          {/* Pass Image Preview */}
          <div className="bg-slate-900 p-3 rounded-2xl border border-slate-700 text-center relative group min-h-[220px] flex items-center justify-center">
            {isGenerating ? (
              <div className="text-white text-xs font-bold flex flex-col items-center gap-2">
                <span className="w-6 h-6 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
                Generating Pass Photo Badge...
              </div>
            ) : imageUrl ? (
              <div className="relative max-h-[260px] overflow-hidden rounded-xl border border-slate-700 shadow-md">
                <img src={imageUrl} alt="Gate Pass Photo Badge" className="max-h-[250px] w-auto mx-auto object-contain rounded-lg" />
                <span className="absolute top-2 right-2 px-2 py-0.5 bg-black/70 text-amber-300 text-[9px] font-mono font-extrabold rounded-md backdrop-blur-sm">
                  ★ HD PASS PHOTO
                </span>
              </div>
            ) : (
              <p className="text-red-400 text-xs font-bold">Failed to load pass photo preview</p>
            )}
          </div>

          {/* User Guidance Alert */}
          <div className="p-3 bg-emerald-50/90 border border-emerald-200 rounded-2xl text-emerald-900 text-xs space-y-1">
            <p className="font-extrabold flex items-center gap-1.5 text-emerald-800">
              <Sparkles className="w-4 h-4 text-amber-500 shrink-0" />
              Direct Visitor WhatsApp Pass Delivery:
            </p>
            <p className="text-[11px] text-emerald-800 font-medium">
              Clicking <strong>Open WhatsApp & Send Pass Photo</strong> automatically opens WhatsApp directed to visitor number (<strong>{visit.visitor_phone}</strong>) with the PNG digital pass attached!
            </p>
          </div>

          {/* Action Buttons */}
          <div className="space-y-2 pt-1">
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={handleCopyImage}
                disabled={!imageBlob}
                className={`py-2.5 px-3 rounded-xl text-xs font-extrabold flex items-center justify-center gap-1.5 border transition-all shadow-sm ${
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
                onClick={handleDownloadImage}
                disabled={!imageUrl}
                className="py-2.5 px-3 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-extrabold flex items-center justify-center gap-1.5 border border-slate-300 transition-all shadow-sm"
              >
                <Download className="w-4 h-4" />
                Download Photo
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                type="button"
                onClick={() => shareWhatsAppPassDirectly(visit, 'visitor')}
                className="py-3 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl text-xs font-extrabold flex items-center justify-center gap-1.5 shadow-lg shadow-emerald-900/20 active:scale-95 transition-all"
              >
                <MessageSquare className="w-4 h-4" />
                Send to Visitor
              </button>

              <button
                type="button"
                onClick={() => shareWhatsAppPassDirectly(visit, 'host')}
                className="py-3 px-3 bg-purple-700 hover:bg-purple-800 text-white rounded-2xl text-xs font-extrabold flex items-center justify-center gap-1.5 shadow-lg shadow-purple-900/20 active:scale-95 transition-all"
              >
                🔔 Alert Host
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
