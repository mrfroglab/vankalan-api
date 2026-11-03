import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { MemoryStorage } from '../src/db/storage.js';

describe('Health API', () => {
  it('GET /health returns 200 and service metadata', async () => {
    const storage = new MemoryStorage();
    const app = createApp(storage);

    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.service).toBe('vankalan-api');
    expect(typeof res.body.uptime).toBe('number');
  });

  it('GET /unknown-path returns 404', async () => {
    const storage = new MemoryStorage();
    const app = createApp(storage);

    const res = await request(app).get('/api/does-not-exist');
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Not Found');
  });
});
