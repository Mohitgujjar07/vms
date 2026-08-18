import { Visit } from '../types';
import { drawQrCodeToCanvas } from './qrCodeGenerator';

/**
 * Renders an ultra-sharp, pixel-perfect Official Campus Gate Entry Pass Canvas
 */
export const generatePassCanvas = async (visit: Visit): Promise<HTMLCanvasElement> => {
  const canvas = document.createElement('canvas');
  // High-DPI executive pass canvas (800px width x 1020px height)
  canvas.width = 800;
  canvas.height = 1020;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context not supported');

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  // 1. Outer Background Gradient (Sleek slate / dark subtle gradient)
  const bgGrad = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
  bgGrad.addColorStop(0, '#f8fafc');
  bgGrad.addColorStop(1, '#e2e8f0');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // 2. Main Gate Pass Card Container
  const cardX = 30;
  const cardY = 30;
  const cardW = 740;
  const cardH = 960;
  const radius = 28;

  // Outer Card Surface Shadow
  ctx.save();
  ctx.shadowColor = 'rgba(15, 23, 42, 0.16)';
  ctx.shadowBlur = 32;
  ctx.shadowOffsetY = 16;
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.roundRect(cardX, cardY, cardW, cardH, radius);
  ctx.fill();
  ctx.restore();

  // Imperial Purple Card Border
  ctx.lineWidth = 3;
  ctx.strokeStyle = '#731A73';
  ctx.stroke();

  // 3. Security Foil Gold Top Strip Bar
  const foilGrad = ctx.createLinearGradient(cardX, cardY, cardX + cardW, cardY + 48);
  foilGrad.addColorStop(0, '#92400e');
  foilGrad.addColorStop(0.3, '#fbbf24');
  foilGrad.addColorStop(0.7, '#f59e0b');
  foilGrad.addColorStop(1, '#92400e');

  ctx.save();
  ctx.beginPath();
  ctx.roundRect(cardX, cardY, cardW, 46, [radius, radius, 0, 0]);
  ctx.clip();
  ctx.fillStyle = foilGrad;
  ctx.fillRect(cardX, cardY, cardW, 46);
  ctx.restore();

  ctx.fillStyle = '#291000';
  ctx.font = '900 13px monospace';
  ctx.textAlign = 'left';
  ctx.fillText('★ OFFICIAL CAMPUS GATE ENTRY PASS ★', cardX + 24, cardY + 28);

  ctx.textAlign = 'right';
  ctx.fillText('VIMTECH-SEC', cardX + cardW - 24, cardY + 28);

  // 4. Official College Header Banner
  const headerY = cardY + 46;

  try {
    const logoImg = new Image();
    await new Promise((resolve) => {
      logoImg.onload = resolve;
      logoImg.onerror = resolve;
      logoImg.src = (visit as any).college_logo_url || '/vgi_logo.png';
    });
    if (logoImg.complete && logoImg.naturalWidth !== 0) {
      const logoW = 340;
      const logoH = Math.min(65, (logoImg.naturalHeight / logoImg.naturalWidth) * logoW);
      ctx.drawImage(logoImg, (800 - logoW) / 2, headerY + 12, logoW, logoH);
    } else {
      ctx.fillStyle = '#731A73';
      ctx.font = '900 30px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('V I M T E C H', 400, headerY + 44);

      ctx.fillStyle = '#64748b';
      ctx.font = 'bold 13px sans-serif';
      ctx.fillText('Vidyavahini Institute of Management & Technology', 400, headerY + 66);
    }
  } catch (e) {
    ctx.fillStyle = '#731A73';
    ctx.font = '900 30px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('V I M T E C H', 400, headerY + 44);
  }

  // Approval Badges Box
  const badgeY = headerY + 84;
  ctx.strokeStyle = '#f3e8ff';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(70, badgeY);
  ctx.lineTo(730, badgeY);
  ctx.stroke();

  // AICTE & Univ Badges
  ctx.fillStyle = '#faf5ff';
  ctx.beginPath();
  ctx.roundRect(140, badgeY + 8, 230, 26, 13);
  ctx.fill();
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = '#e9d5ff';
  ctx.stroke();
  ctx.fillStyle = '#731A73';
  ctx.font = 'bold 11px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('★ Approved by AICTE', 255, badgeY + 25);

  ctx.fillStyle = '#faf5ff';
  ctx.beginPath();
  ctx.roundRect(410, badgeY + 8, 250, 26, 13);
  ctx.fill();
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = '#e9d5ff';
  ctx.stroke();
  ctx.fillStyle = '#731A73';
  ctx.font = 'bold 11px sans-serif';
  ctx.fillText('★ Tumkur Univ. Affiliated', 535, badgeY + 25);

  // Header Divider Line
  ctx.strokeStyle = '#e9d5ff';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(cardX, headerY + 128);
  ctx.lineTo(cardX + cardW, headerY + 128);
  ctx.stroke();

  // 5. Visitor Info Section Card
  const infoY = headerY + 140;
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.roundRect(56, infoY, 688, 160, 20);
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = '#f3e8ff';
  ctx.stroke();

  // Safe image loader
  const safeLoadImageDataUrl = async (rawUrl: string): Promise<string | null> => {
    if (!rawUrl) return null;
    if (rawUrl.startsWith('data:')) return rawUrl;
    try {
      const res = await fetch(rawUrl, { mode: 'cors' });
      if (!res.ok) return null;
      const blob = await res.blob();
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(typeof reader.result === 'string' ? reader.result : null);
        reader.onerror = () => resolve(null);
        reader.readAsDataURL(blob);
      });
    } catch (e) {
      return null;
    }
  };

  // Visitor Photo
  const photoX = 76;
  const photoY = infoY + 18;
  const photoSize = 124;

  const rawPhotoUrl = visit.visitor_photo_url || '';
  const safeDataUrl = await safeLoadImageDataUrl(rawPhotoUrl);

  let photoLoaded = false;
  if (safeDataUrl) {
    try {
      const img = new Image();
      await new Promise((resolve) => {
        img.onload = () => resolve(true);
        img.onerror = () => resolve(false);
        img.src = safeDataUrl;
      });

      if (img.complete && img.naturalWidth !== 0) {
        ctx.save();
        ctx.beginPath();
        ctx.roundRect(photoX, photoY, photoSize, photoSize, 18);
        ctx.clip();
        ctx.drawImage(img, photoX, photoY, photoSize, photoSize);
        ctx.restore();
        photoLoaded = true;
      }
    } catch (e) {
      photoLoaded = false;
    }
  }

  if (!photoLoaded) {
    ctx.fillStyle = '#731A73';
    ctx.beginPath();
    ctx.roundRect(photoX, photoY, photoSize, photoSize, 18);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = '900 52px sans-serif';
    ctx.textAlign = 'center';
    const initial = (visit.visitor_name || 'V')[0].toUpperCase();
    ctx.fillText(initial, photoX + photoSize / 2, photoY + 80);
  }

  // Photo Ring Border
  ctx.lineWidth = 3.5;
  ctx.strokeStyle = 'rgba(115, 26, 115, 0.4)';
  ctx.beginPath();
  ctx.roundRect(photoX, photoY, photoSize, photoSize, 18);
  ctx.stroke();

  // Category & Status Pills
  const detailsX = 224;
  
  // Category Pill
  ctx.fillStyle = '#731A73';
  ctx.beginPath();
  ctx.roundRect(detailsX, infoY + 18, 150, 24, 12);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.font = '900 11px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText((visit.category || 'VISITOR').toUpperCase() + ' PASS', detailsX + 75, infoY + 34);

  // Active Green Pill
  ctx.fillStyle = '#ecfdf5';
  ctx.beginPath();
  ctx.roundRect(detailsX + 160, infoY + 18, 90, 24, 12);
  ctx.fill();
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = '#a7f3d0';
  ctx.stroke();
  ctx.fillStyle = '#065f46';
  ctx.font = '900 11px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('● ACTIVE', detailsX + 205, infoY + 34);

  // Visitor Name
  ctx.fillStyle = '#0f172a';
  ctx.font = '900 24px sans-serif';
  ctx.textAlign = 'left';
  const displayName = (visit.visitor_name || 'VISITOR').slice(0, 28);
  ctx.fillText(displayName, detailsX, infoY + 74);

  // Visitor Phone
  ctx.fillStyle = '#64748b';
  ctx.font = 'bold 15px monospace';
  ctx.fillText('+91 ' + (visit.visitor_phone || ''), detailsX, infoY + 102);

  // Purpose & Host
  ctx.fillStyle = '#731A73';
  ctx.font = 'bold 13px sans-serif';
  const displayPurpose = `Purpose: ${visit.purpose || 'Campus Visit'}`.slice(0, 48);
  ctx.fillText(displayPurpose, detailsX, infoY + 128);

  const displayHost = `Host: ${visit.host_name || 'Faculty Host'}`.slice(0, 40);
  ctx.fillStyle = '#475569';
  ctx.font = 'bold 12px sans-serif';
  ctx.fillText(displayHost, detailsX, infoY + 148);

  // 6. QR Code Section Container
  const qrSectionY = infoY + 176;
  const qrBoxW = 688;
  const qrBoxH = 360;

  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.roundRect(56, qrSectionY, qrBoxW, qrBoxH, 20);
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = '#f3e8ff';
  ctx.stroke();

  // QR Code Frame Inner Box
  const qrSize = 220;
  const qrX = (800 - qrSize) / 2;
  const qrY = qrSectionY + 22;

  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.roundRect(qrX - 12, qrY - 12, qrSize + 24, qrSize + 24, 18);
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = '#e9d5ff';
  ctx.stroke();

  // DIRECT PURE MATHEMATICAL QR GENERATION (ZERO DOM DEPENDENCY)
  const tokenString = visit.qr_token || `VMS-VIMTECH-${Date.now()}`;
  await drawQrCodeToCanvas(ctx, tokenString, qrX, qrY, qrSize, {
    fgColor: '#0f172a',
    bgColor: '#ffffff',
    eccLevel: 'H',
    logoUrl: '/vgi_logo.png',
    logoSize: 48
  });

  // Security Token Badge Box
  const tokenY = qrY + qrSize + 22;
  ctx.fillStyle = '#0f172a';
  ctx.beginPath();
  ctx.roundRect(86, tokenY, 628, 48, 14);
  ctx.fill();

  ctx.fillStyle = '#fbbf24';
  ctx.font = '900 16px monospace';
  ctx.textAlign = 'center';
  ctx.fillText(`SECURITY PASS TOKEN: ${tokenString}`, 400, tokenY + 30);

  // 7. Time & Validity Information Matrix
  const footerY = qrSectionY + qrBoxH + 16;
  ctx.fillStyle = '#faf5ff';
  ctx.beginPath();
  ctx.roundRect(56, footerY, 688, 70, 16);
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = '#f3e8ff';
  ctx.stroke();

  // Entry Time
  ctx.textAlign = 'left';
  ctx.fillStyle = '#64748b';
  ctx.font = 'bold 11px sans-serif';
  ctx.fillText('ENTRY TIMESTAMP', 80, footerY + 26);

  const entryTimeStr = visit.check_in_time 
    ? new Date(visit.check_in_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true })
    : 'Today';
  ctx.fillStyle = '#0f172a';
  ctx.font = '900 16px monospace';
  ctx.fillText(entryTimeStr, 80, footerY + 52);

  // Gate Verification
  ctx.textAlign = 'center';
  ctx.fillStyle = '#64748b';
  ctx.font = 'bold 11px sans-serif';
  ctx.fillText('GATE STATUS', 400, footerY + 26);
  ctx.fillStyle = '#059669';
  ctx.font = '900 15px sans-serif';
  ctx.fillText('✓ VERIFIED ENTRY', 400, footerY + 52);

  // Validity
  ctx.textAlign = 'right';
  ctx.fillStyle = '#64748b';
  ctx.font = 'bold 11px sans-serif';
  ctx.fillText('PASS VALIDITY', 720, footerY + 26);

  ctx.fillStyle = '#731A73';
  ctx.font = '900 15px sans-serif';
  ctx.fillText('Valid Today Only', 720, footerY + 52);

  // 8. Bottom Security Seal Bar
  ctx.fillStyle = '#0f172a';
  ctx.beginPath();
  ctx.roundRect(cardX, cardY + cardH - 36, cardW, 36, [0, 0, radius, radius]);
  ctx.fill();

  ctx.fillStyle = '#fbbf24';
  ctx.font = '900 11px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('AUTHENTIC CAMPUS GATE PASS • VIDYAVAHINI GROUP (VIMTECH-VMS)', 400, cardY + cardH - 13);

  return canvas;
};

export const generatePassImageBlob = async (visit: Visit): Promise<Blob> => {
  const canvas = await generatePassCanvas(visit);
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('Failed to generate pass image blob'));
    }, 'image/png');
  });
};

/**
 * W3C Compliant Synchronous User-Gesture Clipboard Image Writer
 */
export const copyPassPhotoToClipboard = async (visit: Visit): Promise<boolean> => {
  if (!navigator.clipboard || !window.ClipboardItem) {
    throw new Error('Clipboard API not supported in this browser');
  }

  // Pass Promise<Blob> directly to ClipboardItem so Chrome retains active user gesture
  const blobPromise = generatePassImageBlob(visit);

  await navigator.clipboard.write([
    new ClipboardItem({
      'image/png': blobPromise
    })
  ]);

  return true;
};

/**
 * Generates a stylish, professional, and formatted WhatsApp message for digital passes.
 */
export const buildWhatsAppPassMessage = (
  visit: Partial<Visit>,
  target: 'visitor' | 'host' = 'visitor',
  isPreReg: boolean = false,
  isPdf: boolean = false
): string => {
  const checkInFormatted = visit.check_in_time
    ? new Date(visit.check_in_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true })
    : ((visit as any).expected_arrival_time || 'Today');

  const visitorName = visit.visitor_name || 'Valued Visitor';
  const visitorPhone = visit.visitor_phone || 'N/A';
  const hostName = visit.host_name || 'Faculty / Staff Host';
  const purpose = visit.purpose || 'Official Campus Visit';
  const qrToken = visit.qr_token || 'N/A';

  if (target === 'host') {
    return (
`🔔 *VISITOR ARRIVAL ALERT*
*VIMTECH Front Desk Reception*
━━━━━━━━━━━━━━━━━━━━━

Dear *${hostName}*,

Your visitor has arrived at the reception desk and is waiting to meet you:

📋 *VISITOR DETAILS*
▸ *Visitor Name*: *${visitorName}*
▸ *Contact Number*: \`${visitorPhone}\`
▸ *Purpose of Visit*: ${purpose}
▸ *Arrival Timestamp*: ${checkInFormatted}
▸ *Token Code*: \`\`\`${qrToken}\`\`\`

━━━━━━━━━━━━━━━━━━━━━
🏢 *Front Desk Reception, VIMTECH Main Campus*
🔒 _Centralised Visitor Management System (VMS)_`
    );
  }

  if (isPreReg) {
    return (
`⚡ *VIMTECH PRE-APPROVED ENTRY PASS*
*Vidyavahini Institute of Management & Technology*
━━━━━━━━━━━━━━━━━━━━━

Dear *${visitorName}*,

Your express campus pass has been pre-approved for your upcoming visit:

📋 *PASS DETAILS*
▸ *Visitor Name*: ${visitorName}
▸ *Mobile No*: \`${visitorPhone}\`
▸ *Visiting Host*: *${hostName}*
▸ *Purpose of Visit*: ${purpose}
▸ *Expected Arrival*: ${checkInFormatted}
▸ *Campus Location*: Main Campus, Tumkur

🎫 *EXPRESS TOKEN CODE*
\`\`\`${qrToken}\`\`\`

━━━━━━━━━━━━━━━━━━━━━
⚡ *FAST-TRACK ENTRY INSTRUCTIONS*
• Present this token code at the gate for priority entry access.
• Keep your token code handy for check-out.

_Issued by VIMTECH Administration | Centralised VMS_
🌐 www.vimtech.in`
    );
  }

  return (
`🏛️ *VIMTECH CAMPUS DIGITAL PASS*
*Vidyavahini Institute of Management & Technology*
━━━━━━━━━━━━━━━━━━━━━

Dear *${visitorName}*,

Welcome to VIMTECH Campus. Your official digital entry pass has been issued by the Front Desk Reception:

📋 *VISITOR PASS SUMMARY*
▸ *Visitor Name*: ${visitorName}
▸ *Mobile No*: \`${visitorPhone}\`
▸ *Visiting Host*: *${hostName}*
▸ *Purpose of Visit*: ${purpose}
▸ *Check-in Time*: ${checkInFormatted}
▸ *Campus Location*: Main Campus, Tumkur

🎫 *PASS TOKEN CODE*
\`\`\`${qrToken}\`\`\`

${isPdf ? '📎 *PDF PASS ATTACHMENT*: A PDF format pass document has been generated and saved for your records.\n\n' : ''}━━━━━━━━━━━━━━━━━━━━━
🛡️ *ENTRY & EXIT INSTRUCTIONS*
• Present this digital pass or token code at the main security gate.
• Retain this token code for fast-track exit verification at check-out.

_Issued by Reception Desk | VIMTECH Centralised VMS_
🌐 www.vimtech.in`
  );
};

/**
 * Copies the formatted WhatsApp pass text to clipboard
 */
export const copyPassTextToClipboard = async (
  visit: Partial<Visit>,
  target: 'visitor' | 'host' = 'visitor',
  isPreReg: boolean = false
): Promise<boolean> => {
  const message = buildWhatsAppPassMessage(visit, target, isPreReg);
  if (navigator.clipboard && navigator.clipboard.writeText) {
    await navigator.clipboard.writeText(message);
    return true;
  }
  const textArea = document.createElement('textarea');
  textArea.value = message;
  textArea.style.position = 'fixed';
  textArea.style.opacity = '0';
  document.body.appendChild(textArea);
  textArea.focus();
  textArea.select();
  document.execCommand('copy');
  document.body.removeChild(textArea);
  return true;
};

/**
 * Downloads the high definition pass image badge to the client device
 */
export const downloadPassImage = async (visit: Visit): Promise<string> => {
  const visitorName = (visit.visitor_name || 'Visitor').replace(/\s+/g, '_');
  const filename = `VIMTECH_Gate_Pass_${visitorName}.png`;
  const passBlob = await generatePassImageBlob(visit);
  if (passBlob) {
    const downloadLink = document.createElement('a');
    downloadLink.href = URL.createObjectURL(passBlob);
    downloadLink.download = filename;
    document.body.appendChild(downloadLink);
    downloadLink.click();
    setTimeout(() => {
      try { document.body.removeChild(downloadLink); } catch (e) {}
    }, 500);
  }
  return filename;
};

export const shareWhatsAppPassDirectly = async (
  visit: Visit,
  target: 'visitor' | 'host' = 'visitor',
  customPhone?: string
) => {
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
  const isPreReg = (visit.status as string) === 'pre_registered' || Boolean((visit as any).expected_arrival_time);
  const message = buildWhatsAppPassMessage(visit, target, isPreReg);

  // Formulate WhatsApp direct message endpoint
  const encodedMsg = encodeURIComponent(message);
  const whatsappUrl = `https://api.whatsapp.com/send?phone=${phoneWithCountryCode}&text=${encodedMsg}`;

  // IMPORTANT: Open WhatsApp window immediately to prevent popup blockers
  const waWin = window.open(whatsappUrl, '_blank');
  if (!waWin) {
    window.location.href = whatsappUrl;
  }

  // Background helper: copy text and photo to clipboard for user convenience
  try {
    if (navigator.clipboard && window.ClipboardItem) {
      const passBlobPromise = generatePassImageBlob(visit);
      navigator.clipboard.write([
        new ClipboardItem({ 'image/png': passBlobPromise })
      ]).catch(() => {
        navigator.clipboard.writeText(message).catch(() => {});
      });
    }
  } catch (clipErr) {
    console.warn('Clipboard write warning:', clipErr);
  }
};
