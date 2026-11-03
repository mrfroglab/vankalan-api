export type Category = 'Mi' | 'Nasi' | 'Camilan' | 'Minuman';

export interface MenuItem {
  id: string;
  name: string;
  description: string;
  price: number;
  category: Category | string;
  kind: 'noodle' | 'soup' | 'rice' | 'toast' | 'tea' | 'coffee' | 'orange';
  available: boolean;
  egg?: boolean;
  popular?: boolean;
  temperatures?: ('Panas' | 'Dingin')[];
  coldExtra?: number;
  image?: string;
  rating?: number;
  reviewsCount?: number;
  prepTime?: number;
  badge?: 'FAVORIT' | 'BARU' | 'TERLARIS';
  portion?: 'Reguler' | 'Double' | 'Jumbo';
  mealTime?: ('Sarapan' | 'Snacks' | 'Makan Malam' | 'Larut Malam')[];
}

export type OrderPaymentStatus = 'PENDING' | 'PAID' | 'FAILED' | 'EXPIRED';
export type OrderFulfillmentStatus = 'NEW' | 'PREPARING' | 'READY' | 'COMPLETED' | 'CANCELLED';
export type OrderNotificationStatus = 'QUEUED' | 'SENT' | 'FAILED' | 'UNKNOWN';
export type RefundStatus = 'NONE' | 'PENDING' | 'PARTIAL_REFUNDED' | 'FULL_REFUNDED';

export interface RefundRecord {
  status: RefundStatus;
  amount: number;
  reason: string;
  confirmedAt?: number;
}

export interface OrderItem {
  name: string;
  qty: number;
  unit: number;
  egg?: boolean;
  temp?: 'Panas' | 'Dingin';
  note?: string;
}

export interface Order {
  id: string;
  token: string;
  number: string;
  created: number;
  pickup: number;
  estimate: number;
  mode: 'asap' | 'scheduled';
  name: string;
  phone: string;
  note?: string;
  payment: OrderPaymentStatus;
  fulfillment: OrderFulfillmentStatus;
  notification: OrderNotificationStatus;
  recipientShiftId: string;
  items: OrderItem[];
  total: number;
  paidAt?: number;
  cancelReason?: string;
  refund?: RefundRecord;
  attempts?: number;
  completedAt?: number;
  snapToken?: string;
}

export interface Shift {
  id: string;
  name: string;
  phone: string;
}

export interface StoreSettings {
  open: boolean;
  estimate: number;
  eggPrice: number;
  recipientShiftId: string;
  waConnected: boolean;
}

export interface CreateOrderPayload {
  name: string;
  phone: string;
  mode: 'asap' | 'scheduled';
  pickup: number;
  estimate: number;
  items: OrderItem[];
  total: number;
  note?: string;
  recipientShiftId?: string;
}

export interface CreateOrderResult {
  order: Order;
  snapToken?: string;
  redirectUrl?: string;
}

export interface MidtransNotificationPayload {
  order_id: string;
  status_code: string;
  gross_amount: string;
  signature_key: string;
  transaction_status: string;
  fraud_status?: string;
  payment_type?: string;
  settlement_time?: string;
  transaction_time?: string;
}
