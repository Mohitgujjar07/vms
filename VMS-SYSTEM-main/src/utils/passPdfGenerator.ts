import jsPDF from 'jspdf';
import { Visit } from '../types';
import { generatePassCanvas, buildWhatsAppPassMessage } from './passImageGenerator';

/**
 * Generates an Executive High-Definition VIMTECH Digital Gate Pass as a jsPDF document
 */
export const generatePassPdf = async (visit: Visit): Promise<jsPDF> => {
  const canvas = await generatePassCanvas(visit);
  const imgData = canvas.toDataURL('image/png');

  // Create A5 Executive Card PDF Document (148mm x 210mm)
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a5',
  });

  // Soft purple-tinted background
  doc.setFillColor(250, 245, 255);
  doc.rect(0, 0, 148, 210, 'F');

  // Outer Imperial Purple Border Frame
  doc.setDrawColor(115, 26, 115);
  doc.setLineWidth(1.2);
  doc.rect(5, 5, 138, 200);

  // Render HD Pass Image Canvas inside PDF
  const imgW = 130;
  const imgH = (980 / 800) * imgW; // Maintains exact 800x980 aspect ratio (~159.25mm)
  const imgX = (148 - imgW) / 2; // 9mm
  const imgY = 12;

  doc.addImage(imgData, 'PNG', imgX, imgY, imgW, imgH, undefined, 'FAST');

  // PDF Document Security Footer Meta
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(115, 26, 115);
  doc.text('VIDYAVAHINI GROUP • CENTRALIZED VISITOR MANAGEMENT SYSTEM', 74, 180, { align: 'center' });

  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 110, 120);
  doc.text(`Official Document ID: VMS-PDF-${visit.qr_token || 'PASS'} • Generated: ${new Date().toLocaleString()}`, 74, 185, { align: 'center' });
  doc.text(`Visitor Phone: ${visit.visitor_phone || 'N/A'} • Campus: VIMTECH Main Campus, Tumkur`, 74, 189, { align: 'center' });

  return doc;
};

/**
 * Generates and triggers automatic browser download of the PDF Gate Pass
 */
export const downloadPassPdf = async (visit: Visit): Promise<string> => {
  const doc = await generatePassPdf(visit);
  const visitorName = (visit.visitor_name || 'Visitor').replace(/\s+/g, '_');
  const filename = `VIMTECH_Digital_Gate_Pass_${visitorName}.pdf`;
  doc.save(filename);
  return filename;
};

/**
 * Generates the PDF Gate Pass, triggers automatic download, and opens WhatsApp
 * pre-filled with the visitor's mobile phone number entered in Visitor & Host Identity Info.
 */
export const shareWhatsAppPassPdfDirectly = async (
  visit: Visit,
  target: 'visitor' | 'host' = 'visitor',
  customPhone?: string
): Promise<void> => {
  let targetPhone = customPhone;
  if (!targetPhone) {
    if (target === 'host') {
      targetPhone = (visit as any).host_phone || (visit as any).host_contact || '';
    } else {
      targetPhone = visit.visitor_phone || '';
    }
  }

  const digitsOnly = (targetPhone || '').replace(/\D/g, '');
  if (!digitsOnly || digitsOnly.length < 10) {
    alert(`No valid 10-digit mobile phone number found for ${target === 'host' ? 'Host' : 'Visitor'}.`);
    return;
  }

  const phoneWithCountryCode = digitsOnly.length === 10 ? `91${digitsOnly}` : digitsOnly;
  const visitorName = visit.visitor_name || 'Visitor';
  const filename = `VIMTECH_Digital_Gate_Pass_${visitorName.replace(/\s+/g, '_')}.pdf`;

  // 1. Generate PDF Pass Blob & Trigger Local Device Download
  let pdfBlob: Blob | null = null;
  try {
    const doc = await generatePassPdf(visit);
    pdfBlob = doc.output('blob');

    // Automatically trigger PDF download
    const downloadLink = document.createElement('a');
    downloadLink.href = URL.createObjectURL(pdfBlob);
    downloadLink.download = filename;
    document.body.appendChild(downloadLink);
    downloadLink.click();
    setTimeout(() => {
      try { document.body.removeChild(downloadLink); } catch (e) {}
    }, 500);
  } catch (err) {
    console.warn('PDF generation warning:', err);
  }

  const isPreReg = (visit.status as string) === 'pre_registered' || Boolean((visit as any).expected_arrival_time);
  const message = buildWhatsAppPassMessage(visit, target, isPreReg, true);

  // 2. Web Share API 2 (Native file sharing on mobile / tablet if supported)
  if (pdfBlob && navigator.canShare && typeof File !== 'undefined') {
    try {
      const pdfFile = new File([pdfBlob], filename, { type: 'application/pdf' });
      if (navigator.canShare({ files: [pdfFile] })) {
        await navigator.share({
          title: 'VIMTECH Digital Gate Pass PDF',
          text: message,
          files: [pdfFile]
        });
        return;
      }
    } catch (shareErr) {
      console.warn('Native web share bypassed/cancelled:', shareErr);
    }
  }

  // 3. Open WhatsApp Web / App targeted directly to visitor phone number using universal wa.me format
  const whatsappUrl = `https://wa.me/${phoneWithCountryCode}?text=${encodeURIComponent(message)}`;
  const waWin = window.open(whatsappUrl, '_blank');
  if (!waWin) {
    window.location.href = whatsappUrl;
  }
};
