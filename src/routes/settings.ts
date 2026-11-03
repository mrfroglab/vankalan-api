import { Router, Request, Response } from 'express';
import { IStorage } from '../db/storage.js';
import { z } from 'zod';

const storeSettingsSchema = z.object({
  open: z.boolean().optional(),
  estimate: z.number().int().min(1).optional(),
  eggPrice: z.number().int().min(0).optional(),
  recipientShiftId: z.string().optional(),
  waConnected: z.boolean().optional(),
});

const shiftSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  phone: z.string().min(6),
});

export function createSettingsRouter(storage: IStorage): Router {
  const router = Router();

  // GET /api/settings
  router.get('/settings', async (_req: Request, res: Response) => {
    try {
      const settings = await storage.getStoreSettings();
      res.json(settings);
    } catch (err) {
      console.error('[GET /api/settings] Error:', err);
      res.status(500).json({ error: 'Failed to retrieve store settings' });
    }
  });

  // PATCH /api/settings
  router.patch('/settings', async (req: Request, res: Response) => {
    try {
      const parsed = storeSettingsSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: 'Invalid settings payload', details: parsed.error.issues });
        return;
      }

      const updated = await storage.saveStoreSettings(parsed.data);
      res.json(updated);
    } catch (err) {
      console.error('[PATCH /api/settings] Error:', err);
      res.status(500).json({ error: 'Failed to update store settings' });
    }
  });

  // GET /api/shifts
  router.get('/shifts', async (_req: Request, res: Response) => {
    try {
      const shifts = await storage.getShifts();
      res.json(shifts);
    } catch (err) {
      console.error('[GET /api/shifts] Error:', err);
      res.status(500).json({ error: 'Failed to retrieve shifts' });
    }
  });

  // PUT /api/shifts
  router.put('/shifts', async (req: Request, res: Response) => {
    try {
      const body = req.body;
      const shifts = Array.isArray(body) ? body : body?.shifts;
      if (!Array.isArray(shifts)) {
        res.status(400).json({ error: 'Payload must include a shifts array' });
        return;
      }

      const parsed = z.array(shiftSchema).safeParse(shifts);
      if (!parsed.success) {
        res.status(400).json({ error: 'Invalid shifts payload', details: parsed.error.issues });
        return;
      }

      const saved = await storage.saveShifts(parsed.data);
      res.json(saved);
    } catch (err) {
      console.error('[PUT /api/shifts] Error:', err);
      res.status(500).json({ error: 'Failed to save shifts' });
    }
  });

  // POST /api/reset
  router.post('/reset', async (_req: Request, res: Response) => {
    try {
      await storage.resetAll();
      res.json({ success: true, message: 'All store data reset to defaults' });
    } catch (err) {
      console.error('[POST /api/reset] Error:', err);
      res.status(500).json({ error: 'Failed to reset store data' });
    }
  });

  return router;
}
