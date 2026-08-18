/**
 * VMS Notification Service — SMS & WhatsApp Gate Pass Dispatch
 * Handles automated SMS gate pass link dispatch via Cloud SMS API gateways (Twilio/Fast2SMS/Meta API)
 * with instant fallback to browser WhatsApp Web links.
 */

export interface NotificationResult {
  success: boolean;
  channel: 'sms' | 'whatsapp' | 'link';
  message: string;
  shareUrl?: string;
}

class NotificationService {
  private smsApiUrl = (import.meta as any).env?.VITE_SMS_API_URL || '';
  private smsApiKey = (import.meta as any).env?.VITE_SMS_API_KEY || '';

  /**
   * Dispatch Gate Pass link via Automated SMS / Cloud API
   */
  async dispatchPassSms(
    visitorPhone: string,
    visitorName: string,
    passUrl: string,
    collegeName: string = 'VIMTECH'
  ): Promise<NotificationResult> {
    const cleanPhone = visitorPhone.replace(/[^0-9]/g, '');
    const messageText = `Gate Pass Issued for ${visitorName} at ${collegeName}.\nView Pass & QR Code: ${passUrl}`;

    // 1. Try Cloud SMS API Gateway if configured in environment
    if (this.smsApiUrl && this.smsApiKey) {
      try {
        const response = await fetch(this.smsApiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.smsApiKey}`
          },
          body: JSON.stringify({
            to: cleanPhone,
            message: messageText
          })
        });

        if (response.ok) {
          return {
            success: true,
            channel: 'sms',
            message: `Automated SMS gate pass dispatched to +91 ${cleanPhone}.`
          };
        }
      } catch (err) {
        console.warn('Cloud SMS Gateway dispatch fallback:', err);
      }
    }

    // 2. Generate WhatsApp web link fallback
    const encodedText = encodeURIComponent(messageText);
    const waUrl = `https://wa.me/${cleanPhone.length === 10 ? '91' + cleanPhone : cleanPhone}?text=${encodedText}`;

    return {
      success: true,
      channel: 'whatsapp',
      message: `Gate pass link generated for +91 ${cleanPhone}.`,
      shareUrl: waUrl
    };
  }

  /**
   * Format WhatsApp Web direct share URL
   */
  getWhatsAppShareUrl(visitorPhone: string, visitorName: string, passUrl: string, collegeName: string = 'VIMTECH'): string {
    const cleanPhone = visitorPhone.replace(/[^0-9]/g, '');
    const text = `Official Gate Pass issued for ${visitorName} at ${collegeName}.\nView Pass: ${passUrl}`;
    const encodedText = encodeURIComponent(text);
    return `https://wa.me/${cleanPhone.length === 10 ? '91' + cleanPhone : cleanPhone}?text=${encodedText}`;
  }
}

export const notificationService = new NotificationService();
