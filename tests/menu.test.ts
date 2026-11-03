import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { MemoryStorage } from '../src/db/storage.js';

describe('Menu & Categories API', () => {
  let storage: MemoryStorage;
  let app: ReturnType<typeof createApp>;

  beforeEach(() => {
    storage = new MemoryStorage();
    app = createApp(storage);
  });

  it('GET /api/menu returns initial menu items', async () => {
    const res = await request(app).get('/api/menu');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
    expect(res.body[0]).toHaveProperty('name');
    expect(res.body[0]).toHaveProperty('price');
  });

  it('PUT /api/menu updates menu items', async () => {
    const newItems = [
      {
        id: 'm_test_1',
        name: 'Indomie Dobel Keju',
        description: 'Porsi dobel lezat',
        price: 18000,
        category: 'Mi',
        kind: 'noodle',
        available: true,
      },
    ];

    const res = await request(app).put('/api/menu').send({ items: newItems });
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].name).toBe('Indomie Dobel Keju');

    const getRes = await request(app).get('/api/menu');
    expect(getRes.body).toHaveLength(1);
    expect(getRes.body[0].id).toBe('m_test_1');
  });

  it('GET /api/categories returns default categories', async () => {
    const res = await request(app).get('/api/categories');
    expect(res.status).toBe(200);
    expect(res.body).toEqual(['Mi', 'Nasi', 'Camilan', 'Minuman']);
  });

  it('PUT /api/categories updates categories', async () => {
    const newCategories = ['Spesial', 'Gorengan', 'Kopi'];
    const res = await request(app).put('/api/categories').send({ categories: newCategories });
    expect(res.status).toBe(200);
    expect(res.body).toEqual(newCategories);

    const getRes = await request(app).get('/api/categories');
    expect(getRes.body).toEqual(newCategories);
  });
});
