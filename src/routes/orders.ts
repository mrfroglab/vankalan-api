import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { z } from 'zod';
import { IStorage } from '../db/storage.js';
import { createMidtransSnapTransaction } from '../lib/midtrans.js';
import { notificationWorker } from '../worker/notificationQueue.js';
import { Order, OrderItem, CreateOrderResult } from '../types/index.js';

const orderItemSchema = z.object({
  name: z.string().min(1),
  qty: z.number().int().positive(),
  unit: z.number().int().nonnegative(),
  egg: z.boolean().optional(),
  temp: z.enum(['Panas', 'Dingin']).optional(),
  note: z.string().optional(),
});

const createOrderSchema = z.object({
  name: z.string().min(1),
  phone: z.string().min(6),
  mode: z.enum(['asap', 'scheduled']),
  pickup: z.number().positive(),
  estimate: z.number().int().positive().default(10),
  items: z.array(orderItemSchema).min(1),
  total: z.number().int().positive(),
  note: z.string().optional(),
  recipientShiftId: z.string().optional(),
});

const updateStatusSchema = z.object({
  fulfillment: z.enum(['NEW', 'PREPARING', 'READY', 'COMPLETED', 'CANCELLED']),
});

const updatePaymentSchema = z.object({
  payment: z.enum(['PENDING', 'PAID', 'FAILED', 'EXPIRED']),
});

const cancelOrderSchema = z.object({
  reason: z.string().min(1),
});

const refundRecordSchema = z.object({
  status: z.enum(['NONE', 'PENDING', 'PARTIAL_REFUNDED', 'FULL_REFUNDED']),
  amount: z.number().int().positive(),
  reason: z.string().min(1),
  confirmedAt: z.number().optional(),
});

function generateOrderNumber(): string {
  const now = new Date();
  const dateStr = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
    .format(now)
    .replace(/-/g, '');

  const randomDigits = Math.floor(1000 + Math.random() * 9000);
  return `PV-${dateStr}-${randomDigits}`;
}

export function createOrdersRouter(storage: IStorage): Router {
  const router = Router();

  // GET /api/orders
  router.get('/orders', async (_req: Request, res: Response) => {
    try {
      const orders = await storage.getOrders();
      res.json(orders);
    } catch (err) {
      console.error('[GET /api/orders] Error:', err);
      res.status(500).json({ error: 'Failed to retrieve orders' });
    }
  });

  // GET /api/orders/token/:token
  router.get('/orders/token/:token', async (req: Request, res: Response) => {
    try {
      const { token } = req.params;
      const order = await storage.getOrderByToken(token);
      if (!order) {
        res.status(404).json({ error: 'Order not found' });
        return;
      }
      res.json(order);
    } catch (err) {
      console.error('[GET /api/orders/token/:token] Error:', err);
      res.status(500).json({ error: 'Failed to retrieve order by token' });
    }
  });

  // GET /api/orders/:id
  router.get('/orders/:id', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const order = await storage.getOrderById(id);
      if (!order) {
        res.status(404).json({ error: 'Order not found' });
        return;
      }
      res.json(order);
    } catch (err) {
      console.error('[GET /api/orders/:id] Error:', err);
      res.status(500).json({ error: 'Failed to retrieve order' });
    }
  });

  // POST /api/orders
  router.post('/orders', async (req: Request, res: Response) => {
    try {
      const parsed = createOrderSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: 'Invalid order payload', details: parsed.error.issues });
        return;
      }

      const payload = parsed.data;
      const settings = await storage.getStoreSettings();

      // Check if store is open
      if (!settings.open) {
        res.status(403).json({ error: 'Warung sedang tutup, tidak menerima pesanan saat ini' });
        return;
      }

      // Server-side Price Verification
      const menuItems = await storage.getMenuItems();
      let calculatedTotal = 0;

      const validatedItems: OrderItem[] = payload.items.map((item) => {
        const menuItem = menuItems.find(
          (m) => m.name.toLowerCase() === item.name.toLowerCase()
        );
        let unitPrice = menuItem ? menuItem.price : item.unit;

        if (item.egg) {
          unitPrice += settings.eggPrice;
        }
        if (item.temp === 'Dingin' && menuItem?.coldExtra) {
          unitPrice += menuItem.coldExtra;
        }

        calculatedTotal += unitPrice * item.qty;

        return {
          name: item.name,
          qty: item.qty,
          unit: unitPrice,
          egg: item.egg,
          temp: item.temp,
          note: item.note,
        };
      });

      const now = Date.now();
      const token = 'pv_' + crypto.randomBytes(6).toString('hex');
      const orderNumber = generateOrderNumber();
      const recipientShiftId = payload.recipientShiftId || settings.recipientShiftId || 's1';

      const newOrder: Order = {
        id: 'ord_' + now + '_' + crypto.randomBytes(3).toString('hex'),
        token,
        number: orderNumber,
        created: now,
        pickup: payload.pickup,
        estimate: payload.estimate || settings.estimate || 10,
        mode: payload.mode,
        name: payload.name.trim(),
        phone: payload.phone.trim(),
        note: payload.note?.trim() || undefined,
        payment: 'PENDING',
        fulfillment: 'NEW',
        notification: 'QUEUED',
        recipientShiftId,
        items: validatedItems,
        total: calculatedTotal > 0 ? calculatedTotal : payload.total,
        attempts: 0,
      };

      // Create Midtrans Snap Transaction if configured
      let snapToken: string | undefined;
      let redirectUrl: string | undefined;

      const snapResult = await createMidtransSnapTransaction(newOrder);
      if (snapResult) {
        snapToken = snapResult.token;
        redirectUrl = snapResult.redirect_url;
        newOrder.snapToken = snapToken;
      }

      const savedOrder = await storage.createOrder(newOrder);

      const result: CreateOrderResult = {
        order: savedOrder,
        snapToken,
        redirectUrl,
      };

      res.status(201).json(result);
    } catch (err) {
      console.error('[POST /api/orders] Error:', err);
      res.status(500).json({ error: 'Failed to create order' });
    }
  });

  // PATCH /api/orders/:id/status
  router.patch('/orders/:id/status', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const parsed = updateStatusSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: 'Invalid status payload', details: parsed.error.issues });
        return;
      }

      const updated = await storage.updateOrderStatus(id, parsed.data.fulfillment);
      res.json(updated);
    } catch (err) {
      console.error('[PATCH /api/orders/:id/status] Error:', err);
      res.status(500).json({ error: 'Failed to update order status' });
    }
  });

  // PATCH /api/orders/:id/payment
  router.patch('/orders/:id/payment', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const parsed = updatePaymentSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: 'Invalid payment payload', details: parsed.error.issues });
        return;
      }

      const updated = await storage.updateOrderPayment(id, parsed.data.payment);

      // If marked PAID, trigger WA notification immediately
      if (parsed.data.payment === 'PAID') {
        notificationWorker.triggerNotification(id, storage).catch((err) =>
          console.error('[Payment Notification Trigger] Error:', err)
        );
      }

      res.json(updated);
    } catch (err) {
      console.error('[PATCH /api/orders/:id/payment] Error:', err);
      res.status(500).json({ error: 'Failed to update order payment' });
    }
  });

  // POST /api/orders/:id/cancel
  router.post('/orders/:id/cancel', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const parsed = cancelOrderSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: 'Cancel reason is required' });
        return;
      }

      const updated = await storage.cancelOrder(id, parsed.data.reason);
      res.json(updated);
    } catch (err) {
      console.error('[POST /api/orders/:id/cancel] Error:', err);
      res.status(500).json({ error: 'Failed to cancel order' });
    }
  });

  // POST /api/orders/:id/refund
  router.post('/orders/:id/refund', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const parsed = refundRecordSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: 'Invalid refund payload', details: parsed.error.issues });
        return;
      }

      const updated = await storage.recordRefund(id, parsed.data);
      res.json(updated);
    } catch (err) {
      console.error('[POST /api/orders/:id/refund] Error:', err);
      res.status(500).json({ error: 'Failed to record refund' });
    }
  });

  // POST /api/orders/:id/retry-wa
  router.post('/orders/:id/retry-wa', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const success = await notificationWorker.triggerNotification(id, storage);
      const order = await storage.getOrderById(id);
      res.json({ success, order });
    } catch (err) {
      console.error('[POST /api/orders/:id/retry-wa] Error:', err);
      res.status(500).json({ error: 'Failed to retry WhatsApp notification' });
    }
  });

  // POST /api/orders/seed
  router.post('/orders/seed', async (_req: Request, res: Response) => {
    try {
      const orders = await storage.seedDemoOrders();
      res.json(orders);
    } catch (err) {
      console.error('[POST /api/orders/seed] Error:', err);
      res.status(500).json({ error: 'Failed to seed demo orders' });
    }
  });

  return router;
}
