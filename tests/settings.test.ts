import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { MemoryStorage } from '../src/db/storage.js';

describe('Settings & Shifts API', () => {
  let storage: MemoryStorage;
  let app: ReturnType<typeof createApp>;

  beforeEach(() => {
    storage = new MemoryStorage();
    app = createApp(storage);
  });

  it('GET /api/settings returns default settings', async () => {
    const res = await request(app).get('/api/settings');
    expect(res.status).toBe(200);
    expect(res.body.open).toBe(true);
    expect(res.body.estimate).toBe(10);
    expect(res.body.eggPrice).toBe(4000);
  });

  it('PATCH /api/settings updates settings partially', async () => {
    const res = await request(app).patch('/api/settings').send({
      open: false,
      estimate: 15,
      eggPrice: 5000,
    });
    expect(res.status).toBe(200);
    expect(res.body.open).toBe(false);
    expect(res.body.estimate).toBe(15);
    expect(res.body.eggPrice).toBe(5000);

    const getRes = await request(app).get('/api/settings');
    expect(getRes.body.open).toBe(false);
  });

  it('GET /api/shifts returns shifts', async () => {
    const res = await request(app).get('/api/shifts');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
  });

  it('PUT /api/shifts updates shifts', async () => {
    const newShifts = [
      { id: 's_new', name: 'Kang Deden', phone: '628999999999' },
    ];
    const res = await request(app).put('/api/shifts').send({ shifts: newShifts });
    expect(res.status).toBe(200);
    expect(res.body).toEqual(newShifts);
  });

  it('POST /api/reset resets data back to defaults', async () => {
    await request(app).patch('/api/settings').send({ open: false });
    const resetRes = await request(app).post('/api/reset');
    expect(resetRes.status).toBe(200);

    const getRes = await request(app).get('/api/settings');
    expect(getRes.body.open).toBe(true);
  });
});
