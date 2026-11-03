import { Router, Request, Response } from 'express';
import { IStorage } from '../db/storage.js';
import { z } from 'zod';

const menuItemSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  description: z.string().optional().default(''),
  price: z.number().int().positive(),
  category: z.string().min(1),
  kind: z.enum(['noodle', 'soup', 'rice', 'toast', 'tea', 'coffee', 'orange']),
  available: z.boolean().default(true),
  egg: z.boolean().optional(),
  popular: z.boolean().optional(),
  temperatures: z.array(z.enum(['Panas', 'Dingin'])).optional(),
  coldExtra: z.number().optional(),
  image: z.string().optional(),
  rating: z.number().optional(),
  reviewsCount: z.number().optional(),
  prepTime: z.number().optional(),
  badge: z.enum(['FAVORIT', 'BARU', 'TERLARIS']).optional(),
  portion: z.enum(['Reguler', 'Double', 'Jumbo']).optional(),
  mealTime: z.array(z.enum(['Sarapan', 'Snacks', 'Makan Malam', 'Larut Malam'])).optional(),
});

export function createMenuRouter(storage: IStorage): Router {
  const router = Router();

  // GET /api/menu
  router.get('/menu', async (_req: Request, res: Response) => {
    try {
      const items = await storage.getMenuItems();
      res.json(items);
    } catch (err) {
      console.error('[GET /api/menu] Error:', err);
      res.status(500).json({ error: 'Failed to retrieve menu items' });
    }
  });

  // PUT /api/menu
  router.put('/menu', async (req: Request, res: Response) => {
    try {
      const body = req.body;
      const items = Array.isArray(body) ? body : body?.items;
      if (!Array.isArray(items)) {
        res.status(400).json({ error: 'Payload must include an items array' });
        return;
      }

      const parsed = z.array(menuItemSchema).safeParse(items);
      if (!parsed.success) {
        res.status(400).json({ error: 'Invalid menu item payload', details: parsed.error.issues });
        return;
      }

      const saved = await storage.saveMenuItems(parsed.data);
      res.json(saved);
    } catch (err) {
      console.error('[PUT /api/menu] Error:', err);
      res.status(500).json({ error: 'Failed to save menu items' });
    }
  });

  // GET /api/categories
  router.get('/categories', async (_req: Request, res: Response) => {
    try {
      const categories = await storage.getCategories();
      res.json(categories);
    } catch (err) {
      console.error('[GET /api/categories] Error:', err);
      res.status(500).json({ error: 'Failed to retrieve categories' });
    }
  });

  // PUT /api/categories
  router.put('/categories', async (req: Request, res: Response) => {
    try {
      const body = req.body;
      const categories = Array.isArray(body) ? body : body?.categories;
      if (!Array.isArray(categories)) {
        res.status(400).json({ error: 'Payload must include a categories array' });
        return;
      }

      const parsed = z.array(z.string().min(1)).safeParse(categories);
      if (!parsed.success) {
        res.status(400).json({ error: 'Invalid categories payload', details: parsed.error.issues });
        return;
      }

      const saved = await storage.saveCategories(parsed.data);
      res.json(saved);
    } catch (err) {
      console.error('[PUT /api/categories] Error:', err);
      res.status(500).json({ error: 'Failed to save categories' });
    }
  });

  return router;
}
