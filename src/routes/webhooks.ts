import { Router, Request, Response } from 'express';
import { IStorage } from '../db/storage.js';
import { verifyMidtransSignature, mapMidtransStatus } from '../lib/midtrans.js';
import { notificationWorker } from '../worker/notificationQueue.js';
import { MidtransNotificationPayload } from '../types/index.js';

export function createWebhooksRouter(storage: IStorage): Router {
  const router = Router();

  // POST /api/webhooks/midtrans
  router.post('/midtrans', async (req: Request, res: Response) => {
    try {
      const payload = req.body as MidtransNotificationPayload;
      const serverKey = process.env.MIDTRANS_SERVER_KEY || '';

      if (!payload || !payload.order_id) {
        res.status(400).json({ error: 'Missing transaction notification data' });
        return;
      }

      // Verify signature if server key is present in environment
      if (serverKey) {
        const isValid = verifyMidtransSignature(payload, serverKey);
        if (!isValid) {
          console.warn('[Midtrans Webhook] Invalid signature rejected for order:', payload.order_id);
          res.status(403).json({ error: 'Invalid notification signature' });
          return;
        }
      }

      // Find order by order number (PV-YYYYMMDD-XXXX)
      const order = await storage.getOrderByNumber(payload.order_id);
      if (!order) {
        console.warn('[Midtrans Webhook] Order not found for order_id:', payload.order_id);
        // Respond with 200 to satisfy Midtrans retry policy when order is obsolete
        res.status(200).json({ status: 'ok', message: 'Order not found, ignored' });
        return;
      }

      const targetPaymentStatus = mapMidtransStatus(
        payload.transaction_status,
        payload.fraud_status
      );

      // Idempotency: only transition if status changed
      if (order.payment !== targetPaymentStatus) {
        const updatedOrder = await storage.updateOrderPayment(order.id, targetPaymentStatus);

        // If transitioning to PAID, trigger WhatsApp notification immediately
        if (targetPaymentStatus === 'PAID') {
          notificationWorker.triggerNotification(order.id, storage).catch((err) =>
            console.error('[Midtrans Webhook WA Trigger] Error:', err)
          );
        }

        console.log(
          `[Midtrans Webhook] Order ${order.number} transitioned ${order.payment} -> ${targetPaymentStatus}`
        );
      }

      res.status(200).json({ status: 'ok' });
    } catch (err) {
      console.error('[POST /api/webhooks/midtrans] Error:', err);
      res.status(500).json({ error: 'Failed to process Midtrans webhook' });
    }
  });

  return router;
}
