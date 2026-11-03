import { IStorage, getStorage } from '../db/storage.js';
import { sendOrderNotification } from '../lib/waha.js';
import { Order } from '../types/index.js';

interface PendingRetry {
  orderId: string;
  nextAttemptTime: number;
  attempts: number;
}

// Progressive retry delays in milliseconds: 30s, 2m (120s), 5m (300s)
const RETRY_DELAYS = [30 * 1000, 120 * 1000, 300 * 1000];
const MAX_ATTEMPTS = 3;

class NotificationQueueWorker {
  private queue: PendingRetry[] = [];
  private intervalTimer: NodeJS.Timeout | null = null;
  private isProcessing = false;

  start(intervalMs: number = 5000): void {
    if (this.intervalTimer) return;
    this.intervalTimer = setInterval(() => {
      this.processQueue().catch((err) =>
        console.error('[NotificationWorker] Queue processing error:', err)
      );
    }, intervalMs);
  }

  stop(): void {
    if (this.intervalTimer) {
      clearInterval(this.intervalTimer);
      this.intervalTimer = null;
    }
  }

  async triggerNotification(orderId: string, storage?: IStorage): Promise<boolean> {
    const store = storage || getStorage();
    const order = await store.getOrderById(orderId);
    if (!order) return false;

    const shifts = await store.getShifts();
    const targetShift = shifts.find((s) => s.id === order.recipientShiftId) || shifts[0];

    const currentAttempts = (order.attempts || 0) + 1;
    await store.updateOrderNotification(order.id, 'UNKNOWN', currentAttempts);

    const result = await sendOrderNotification(order, targetShift);

    if (result.success) {
      await store.updateOrderNotification(order.id, 'SENT', currentAttempts);
      // Remove any pending retries for this order
      this.queue = this.queue.filter((item) => item.orderId !== order.id);
      return true;
    } else {
      console.warn(
        `[NotificationWorker] Send failed for order ${order.number} (attempt ${currentAttempts}):`,
        result.error
      );

      if (currentAttempts < MAX_ATTEMPTS) {
        const delay = RETRY_DELAYS[currentAttempts - 1] || RETRY_DELAYS[RETRY_DELAYS.length - 1];
        const nextAttemptTime = Date.now() + delay;

        await store.updateOrderNotification(order.id, 'QUEUED', currentAttempts);

        // Enqueue or update pending retry
        const existingIdx = this.queue.findIndex((item) => item.orderId === order.id);
        if (existingIdx !== -1) {
          this.queue[existingIdx] = { orderId: order.id, nextAttemptTime, attempts: currentAttempts };
        } else {
          this.queue.push({ orderId: order.id, nextAttemptTime, attempts: currentAttempts });
        }
      } else {
        // Exceeded maximum retry attempts -> mark as FAILED for manual operator review (PRD FR-34)
        await store.updateOrderNotification(order.id, 'FAILED', currentAttempts);
        this.queue = this.queue.filter((item) => item.orderId !== order.id);
      }
      return false;
    }
  }

  private async processQueue(): Promise<void> {
    if (this.isProcessing || this.queue.length === 0) return;
    this.isProcessing = true;

    try {
      const now = Date.now();
      const readyJobs = this.queue.filter((job) => job.nextAttemptTime <= now);

      for (const job of readyJobs) {
        await this.triggerNotification(job.orderId);
      }
    } finally {
      this.isProcessing = false;
    }
  }
}

export const notificationWorker = new NotificationQueueWorker();
