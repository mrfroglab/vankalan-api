import { describe, it, expect } from 'vitest';
import {
  normalizePhoneNumber,
  buildOrderNotificationText,
  formatRupiah,
} from '../src/lib/waha.js';
import { Order } from '../types/index.js';

describe('WAHA Notification Utilities', () => {
  it('normalizePhoneNumber normalizes 08xx and +62xx to 628xx format', () => {
    expect(normalizePhoneNumber('081234567890')).toBe('6281234567890');
    expect(normalizePhoneNumber('+6281234567890')).toBe('6281234567890');
    expect(normalizePhoneNumber('6281234567890')).toBe('6281234567890');
    expect(normalizePhoneNumber('0812-3456-7890')).toBe('6281234567890');
  });

  it('formatRupiah formats currency correctly', () => {
    expect(formatRupiah(10000)).toMatch(/^Rp10[.,]000$/);
    expect(formatRupiah(0)).toBe('Rp0');
  });

  it('buildOrderNotificationText produces valid PRD FR-32 format', () => {
    const order: Order = {
      id: 'ord_1',
      token: 'tok_1',
      number: 'PV-20261021-0042',
      created: 1729512000000,
      pickup: 1729515600000,
      estimate: 10,
      mode: 'scheduled',
      name: 'Raka',
      phone: '6281234567890',
      note: 'Jangan terlalu pedas',
      payment: 'PAID',
      fulfillment: 'NEW',
      notification: 'QUEUED',
      recipientShiftId: 's1',
      items: [
        { name: 'Indomie Goreng', qty: 1, unit: 14000, egg: true, note: 'tidak pedas' },
        { name: 'Es Teh Manis', qty: 1, unit: 4000, temp: 'Dingin' },
      ],
      total: 18000,
    };

    const text = buildOrderNotificationText(order);

    expect(text).toContain('PESANAN ONLINE — WARMINDO PUTRA VANGKALAN');
    expect(text).toContain('No. order: PV-20261021-0042');
    expect(text).toContain('Pembayaran: LUNAS');
    expect(text).toContain('Pelanggan: Raka');
    expect(text).toContain('WA pelanggan: 6281234567890');
    expect(text).toContain('1x Indomie Goreng — dengan telur');
    expect(text).toContain('Catatan: tidak pedas');
    expect(text).toContain('Catatan order: Jangan terlalu pedas');
    expect(text).toContain('Siapkan mendekati waktu ambil.');
    expect(text).toContain('Hubungi pelanggan secara manual ketika siap.');
  });
});
