import { Order, Shift } from '../types/index.js';
import { TIMEZONE } from './constants.js';

export interface SendWhatsAppResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

/**
 * Format date & time in WIB for notifications
 */
export function formatDateTimeWIB(timestamp: number | Date): string {
  return new Intl.DateTimeFormat('id-ID', {
    timeZone: TIMEZONE,
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(timestamp)) + ' WIB';
}

/**
 * Format currency in Indonesian Rupiah
 */
export function formatRupiah(amount: number): string {
  return 'Rp' + Number(amount || 0).toLocaleString('id-ID');
}

/**
 * Normalize Indonesian phone numbers to 628xxxxxxxx format
 */
export function normalizePhoneNumber(rawPhone: string): string {
  let clean = rawPhone.replace(/\D/g, '');
  if (clean.startsWith('0')) {
    clean = '62' + clean.slice(1);
  } else if (!clean.startsWith('62') && clean.length > 0) {
    clean = '62' + clean;
  }
  return clean;
}

/**
 * Builds notification text strictly per PRD FR-32 template
 */
export function buildOrderNotificationText(order: Order): string {
  const pickupTimeStr = formatDateTimeWIB(order.pickup);
  const paymentStr = order.payment === 'PAID' ? 'LUNAS' : order.payment;

  const itemLines = order.items
    .map((item) => {
      const details: string[] = [];
      if (item.egg) details.push('dengan telur');
      if (item.temp) details.push(item.temp.toLowerCase());
      const detailsStr = details.length > 0 ? ` — ${details.join(', ')}` : '';
      const itemNote = item.note ? `\n   Catatan: ${item.note}` : '';
      return `${item.qty}x ${item.name}${detailsStr} — ${formatRupiah(item.unit * item.qty)}${itemNote}`;
    })
    .join('\n');

  const orderNote = order.note?.trim() ? order.note.trim() : '-';

  return `PESANAN ONLINE — WARMINDO PUTRA VANGKALAN
No. order: ${order.number}
Pembayaran: ${paymentStr}
Pelanggan: ${order.name}
WA pelanggan: ${order.phone}
Ambil: ${pickupTimeStr}

${itemLines}

Catatan order: ${orderNote}
Total dibayar: ${formatRupiah(order.total)}

Siapkan mendekati waktu ambil.
Hubungi pelanggan secara manual ketika siap.`;
}

/**
 * Send WhatsApp notification via WAHA REST API (WEBJS engine)
 */
export async function sendOrderNotification(
  order: Order,
  targetShift?: Shift | null
): Promise<SendWhatsAppResult> {
  const wahaBaseUrl = (process.env.WAHA_BASE_URL || '').replace(/\/+$/, '');
  const wahaApiKey = process.env.WAHA_API_KEY || '';
  const wahaSession = process.env.WAHA_SESSION || 'default';

  // Determine recipient phone number (Shift penjaga priority, fallback to shift id or env)
  const recipientPhone = targetShift?.phone || process.env.DEFAULT_WA_RECIPIENT || '';

  if (!recipientPhone) {
    return {
      success: false,
      error: 'Recipient phone number is missing or shift not found',
    };
  }

  const normalizedPhone = normalizePhoneNumber(recipientPhone);
  const chatId = `${normalizedPhone}@c.us`;
  const messageText = buildOrderNotificationText(order);

  // If WAHA is not configured in environment, log simulation and report success or graceful bypass
  if (!wahaBaseUrl) {
    console.log(`[WAHA Simulated] To: ${chatId}\n${messageText}`);
    return {
      success: true,
      messageId: `sim_${Date.now()}`,
    };
  }

  const endpoint = `${wahaBaseUrl}/api/sendText`;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (wahaApiKey) {
    headers['X-Api-Key'] = wahaApiKey;
  }

  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        session: wahaSession,
        chatId,
        text: messageText,
      }),
    });

    if (!res.ok) {
      const errBody = await res.text();
      return {
        success: false,
        error: `WAHA HTTP ${res.status}: ${errBody || res.statusText}`,
      };
    }

    const data = (await res.json()) as { id?: string; messageId?: string };
    return {
      success: true,
      messageId: data.id || data.messageId || `waha_${Date.now()}`,
    };
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err);
    return {
      success: false,
      error: `Network error connecting to WAHA: ${errMsg}`,
    };
  }
}
