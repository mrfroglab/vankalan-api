import crypto from 'crypto';
import { Order, MidtransNotificationPayload } from '../types/index.js';

export interface CreateSnapTransactionResult {
  token: string;
  redirect_url: string;
}

/**
 * Get Midtrans API Base URL based on environment
 */
export function getMidtransSnapUrl(): string {
  const isProduction = process.env.MIDTRANS_IS_PRODUCTION === 'true';
  return isProduction
    ? 'https://app.midtrans.com/snap/v1/transactions'
    : 'https://app.sandbox.midtrans.com/snap/v1/transactions';
}

/**
 * Verifies Midtrans Webhook SHA512 signature
 */
export function verifyMidtransSignature(
  payload: MidtransNotificationPayload,
  serverKey: string
): boolean {
  if (!serverKey || !payload.signature_key) {
    return false;
  }

  const rawString = `${payload.order_id}${payload.status_code}${payload.gross_amount}${serverKey}`;
  const computedHash = crypto.createHash('sha512').update(rawString).digest('hex');

  return computedHash.toLowerCase() === payload.signature_key.toLowerCase();
}

/**
 * Creates a Snap transaction token on Midtrans
 */
export async function createMidtransSnapTransaction(
  order: Order
): Promise<CreateSnapTransactionResult | null> {
  const serverKey = process.env.MIDTRANS_SERVER_KEY;
  if (!serverKey) {
    // If Midtrans is not configured, return null (frontend will fallback to simulation modal)
    return null;
  }

  const snapUrl = getMidtransSnapUrl();
  const authHeader = Buffer.from(`${serverKey}:`).toString('base64');

  const itemDetails = order.items.map((item, index) => ({
    id: `item_${index + 1}`,
    price: item.unit,
    quantity: item.qty,
    name: item.name.slice(0, 50),
  }));

  const payload = {
    transaction_details: {
      order_id: order.number,
      gross_amount: order.total,
    },
    item_details: itemDetails,
    customer_details: {
      first_name: order.name,
      phone: order.phone,
    },
    callbacks: {
      finish: `${process.env.FRONTEND_URL || 'https://vankalan.hallojanu.me'}/order/${order.token}`,
    },
  };

  try {
    const res = await fetch(snapUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Authorization: `Basic ${authHeader}`,
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error(`[Midtrans Snap Error] ${res.status}: ${errText}`);
      return null;
    }

    const data = (await res.json()) as CreateSnapTransactionResult;
    return data;
  } catch (err) {
    console.error('[Midtrans Snap Network Error]', err);
    return null;
  }
}

/**
 * Maps Midtrans transaction status string to OrderPaymentStatus
 */
export function mapMidtransStatus(
  transactionStatus: string,
  fraudStatus?: string
): 'PAID' | 'PENDING' | 'FAILED' | 'EXPIRED' {
  if (transactionStatus === 'capture') {
    if (fraudStatus === 'accept') {
      return 'PAID';
    }
    return 'PENDING';
  } else if (transactionStatus === 'settlement') {
    return 'PAID';
  } else if (transactionStatus === 'cancel' || transactionStatus === 'deny') {
    return 'FAILED';
  } else if (transactionStatus === 'expire') {
    return 'EXPIRED';
  } else if (transactionStatus === 'pending') {
    return 'PENDING';
  }
  return 'PENDING';
}
