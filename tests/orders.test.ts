import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { MemoryStorage } from '../src/db/storage.js';

describe('Orders API', () => {
  let storage: MemoryStorage;
  let app: ReturnType<typeof createApp>;

  beforeEach(() => {
    storage = new MemoryStorage();
    app = createApp(storage);
  });

  it('POST /api/orders creates a new order and calculates total correctly', async () => {
    const payload = {
      name: 'Raka Pratama',
      phone: '081234567890',
      mode: 'asap' as const,
      pickup: Date.now() + 15 * 60 * 1000,
      estimate: 10,
      note: 'Jangan terlalu pedas',
      items: [
        {
          name: 'Indomie Goreng', // price 10000 in INITIAL_MENU
          qty: 2,
          unit: 10000,
          egg: true, // +4000 eggPrice = 14000 each * 2 = 28000
        },
        {
          name: 'Es Teh Manis', // price 4000
          qty: 1,
          unit: 4000,
          temp: 'Dingin' as const,
        },
      ],
      total: 32000,
    };

    const res = await request(app).post('/api/orders').send(payload);
    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('order');
    expect(res.body.order.number).toMatch(/^PV-\d{8}-\d{4}$/);
    expect(res.body.order.token).toMatch(/^pv_/);
    expect(res.body.order.total).toBe(32000); // 14000*2 + 4000 = 32000
    expect(res.body.order.payment).toBe('PENDING');
    expect(res.body.order.fulfillment).toBe('NEW');
  });

  it('POST /api/orders rejects if warung is closed', async () => {
    await storage.saveStoreSettings({ open: false });

    const payload = {
      name: 'Budi',
      phone: '081234567890',
      mode: 'asap' as const,
      pickup: Date.now() + 15 * 60 * 1000,
      estimate: 10,
      items: [{ name: 'Indomie Goreng', qty: 1, unit: 10000 }],
      total: 10000,
    };

    const res = await request(app).post('/api/orders').send(payload);
    expect(res.status).toBe(403);
    expect(res.body.error).toContain('tutup');
  });

  it('GET /api/orders, /token/:token, and /:id work as expected', async () => {
    const createRes = await request(app)
      .post('/api/orders')
      .send({
        name: 'Siti',
        phone: '081234567899',
        mode: 'asap' as const,
        pickup: Date.now() + 10 * 60 * 1000,
        estimate: 10,
        items: [{ name: 'Es Teh Manis', qty: 1, unit: 4000 }],
        total: 4000,
      });

    const createdOrder = createRes.body.order;

    // By ID
    const byIdRes = await request(app).get(`/api/orders/${createdOrder.id}`);
    expect(byIdRes.status).toBe(200);
    expect(byIdRes.body.name).toBe('Siti');

    // By Token
    const byTokenRes = await request(app).get(`/api/orders/token/${createdOrder.token}`);
    expect(byTokenRes.status).toBe(200);
    expect(byTokenRes.body.id).toBe(createdOrder.id);

    // List
    const listRes = await request(app).get('/api/orders');
    expect(listRes.status).toBe(200);
    expect(listRes.body.length).toBeGreaterThanOrEqual(1);
  });

  it('PATCH status & payment work correctly', async () => {
    const createRes = await request(app)
      .post('/api/orders')
      .send({
        name: 'Siti',
        phone: '081234567899',
        mode: 'asap' as const,
        pickup: Date.now() + 10 * 60 * 1000,
        estimate: 10,
        items: [{ name: 'Es Teh Manis', qty: 1, unit: 4000 }],
        total: 4000,
      });
    const orderId = createRes.body.order.id;

    // Update payment
    const paymentRes = await request(app)
      .patch(`/api/orders/${orderId}/payment`)
      .send({ payment: 'PAID' });
    expect(paymentRes.status).toBe(200);
    expect(paymentRes.body.payment).toBe('PAID');
    expect(paymentRes.body.paidAt).toBeDefined();

    // Update fulfillment status
    const statusRes = await request(app)
      .patch(`/api/orders/${orderId}/status`)
      .send({ fulfillment: 'PREPARING' });
    expect(statusRes.status).toBe(200);
    expect(statusRes.body.fulfillment).toBe('PREPARING');
  });

  it('POST /cancel and POST /refund work correctly', async () => {
    const createRes = await request(app)
      .post('/api/orders')
      .send({
        name: 'Ahmad',
        phone: '081234567800',
        mode: 'asap' as const,
        pickup: Date.now() + 10 * 60 * 1000,
        estimate: 10,
        items: [{ name: 'Es Teh Manis', qty: 1, unit: 4000 }],
        total: 4000,
      });
    const orderId = createRes.body.order.id;

    // Cancel order
    const cancelRes = await request(app)
      .post(`/api/orders/${orderId}/cancel`)
      .send({ reason: 'Bahan habis' });
    expect(cancelRes.status).toBe(200);
    expect(cancelRes.body.fulfillment).toBe('CANCELLED');
    expect(cancelRes.body.refund.status).toBe('PENDING');

    // Confirm refund
    const refundRes = await request(app)
      .post(`/api/orders/${orderId}/refund`)
      .send({
        status: 'FULL_REFUNDED',
        amount: 4000,
        reason: 'Bahan habis - ditransfer via BCA',
      });
    expect(refundRes.status).toBe(200);
    expect(refundRes.body.refund.status).toBe('FULL_REFUNDED');
    expect(refundRes.body.refund.confirmedAt).toBeDefined();
  });

  it('POST /seed seeds demo orders', async () => {
    const res = await request(app).post('/api/orders/seed');
    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThanOrEqual(2);
  });
});
