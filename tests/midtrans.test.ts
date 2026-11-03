import { describe, it, expect, beforeEach } from 'vitest';
import crypto from 'crypto';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { MemoryStorage } from '../src/db/storage.js';
import { verifyMidtransSignature, mapMidtransStatus } from '../src/lib/midtrans.js';

describe('Midtrans Integration & Webhook', () => {
  const SERVER_KEY = 'SB-Mid-server-TEST123456';

  it('verifyMidtransSignature validates correct sha512 signature', () => {
    const orderId = 'PV-20261103-1234';
    const statusCode = '200';
    const grossAmount = '25000.00';

    const validHash = crypto
      .createHash('sha512')
      .update(`${orderId}${statusCode}${grossAmount}${SERVER_KEY}`)
      .digest('hex');

    const validPayload = {
      order_id: orderId,
      status_code: statusCode,
      gross_amount: grossAmount,
      signature_key: validHash,
      transaction_status: 'settlement',
    };

    expect(verifyMidtransSignature(validPayload, SERVER_KEY)).toBe(true);

    const invalidPayload = {
      ...validPayload,
      signature_key: 'invalid_tampered_signature',
    };
    expect(verifyMidtransSignature(invalidPayload, SERVER_KEY)).toBe(false);
  });

  it('mapMidtransStatus maps settlement to PAID and expire to EXPIRED', () => {
    expect(mapMidtransStatus('settlement')).toBe('PAID');
    expect(mapMidtransStatus('capture', 'accept')).toBe('PAID');
    expect(mapMidtransStatus('capture', 'challenge')).toBe('PENDING');
    expect(mapMidtransStatus('expire')).toBe('EXPIRED');
    expect(mapMidtransStatus('cancel')).toBe('FAILED');
    expect(mapMidtransStatus('deny')).toBe('FAILED');
    expect(mapMidtransStatus('pending')).toBe('PENDING');
  });

  it('POST /api/webhooks/midtrans transitions order to PAID with valid signature', async () => {
    const storage = new MemoryStorage();
    const app = createApp(storage);
    process.env.MIDTRANS_SERVER_KEY = SERVER_KEY;

    // Seed an order
    const created = await storage.createOrder({
      id: 'ord_test_midtrans',
      token: 'tok_test',
      number: 'PV-20261103-9999',
      created: Date.now(),
      pickup: Date.now() + 10 * 60 * 1000,
      estimate: 10,
      mode: 'asap',
      name: 'Rudi',
      phone: '081234567890',
      payment: 'PENDING',
      fulfillment: 'NEW',
      notification: 'QUEUED',
      recipientShiftId: 's1',
      items: [{ name: 'Indomie Goreng', qty: 1, unit: 10000 }],
      total: 10000,
      attempts: 0,
    });

    const signature = crypto
      .createHash('sha512')
      .update(`${created.number}20010000.00${SERVER_KEY}`)
      .digest('hex');

    const webhookRes = await request(app)
      .post('/api/webhooks/midtrans')
      .send({
        order_id: created.number,
        status_code: '200',
        gross_amount: '10000.00',
        signature_key: signature,
        transaction_status: 'settlement',
      });

    expect(webhookRes.status).toBe(200);
    expect(webhookRes.body.status).toBe('ok');

    const updated = await storage.getOrderById(created.id);
    expect(updated?.payment).toBe('PAID');
    expect(updated?.paidAt).toBeDefined();
  });
});
