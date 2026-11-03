import { PrismaClient } from '@prisma/client';
import {
  Category,
  MenuItem,
  Shift,
  StoreSettings,
  Order,
  OrderItem,
  RefundRecord,
  OrderFulfillmentStatus,
  OrderPaymentStatus,
  OrderNotificationStatus,
} from '../types/index.js';
import {
  DEFAULT_CATEGORIES,
  DEFAULT_SETTINGS,
  INITIAL_MENU,
  INITIAL_SHIFTS,
} from '../lib/constants.js';

export interface IStorage {
  getMenuItems(): Promise<MenuItem[]>;
  saveMenuItems(items: MenuItem[]): Promise<MenuItem[]>;
  getCategories(): Promise<string[]>;
  saveCategories(categories: string[]): Promise<string[]>;
  getStoreSettings(): Promise<StoreSettings>;
  saveStoreSettings(settings: Partial<StoreSettings>): Promise<StoreSettings>;
  getShifts(): Promise<Shift[]>;
  saveShifts(shifts: Shift[]): Promise<Shift[]>;
  getOrders(): Promise<Order[]>;
  getOrderById(id: string): Promise<Order | null>;
  getOrderByToken(token: string): Promise<Order | null>;
  getOrderByNumber(orderNumber: string): Promise<Order | null>;
  createOrder(order: Order): Promise<Order>;
  updateOrderStatus(id: string, fulfillment: OrderFulfillmentStatus): Promise<Order>;
  updateOrderPayment(id: string, payment: OrderPaymentStatus, paidAt?: number): Promise<Order>;
  cancelOrder(id: string, reason: string): Promise<Order>;
  recordRefund(id: string, refund: RefundRecord): Promise<Order>;
  updateOrderNotification(
    id: string,
    notification: OrderNotificationStatus,
    attempts: number
  ): Promise<Order>;
  seedDemoOrders(): Promise<Order[]>;
  resetAll(): Promise<void>;
}

export class MemoryStorage implements IStorage {
  private menu: MenuItem[] = [...INITIAL_MENU];
  private categories: string[] = [...DEFAULT_CATEGORIES];
  private settings: StoreSettings = { ...DEFAULT_SETTINGS };
  private shifts: Shift[] = [...INITIAL_SHIFTS];
  private orders: Order[] = [];

  async getMenuItems(): Promise<MenuItem[]> {
    return [...this.menu];
  }

  async saveMenuItems(items: MenuItem[]): Promise<MenuItem[]> {
    this.menu = [...items];
    return [...this.menu];
  }

  async getCategories(): Promise<string[]> {
    return [...this.categories];
  }

  async saveCategories(categories: string[]): Promise<string[]> {
    this.categories = [...categories];
    return [...this.categories];
  }

  async getStoreSettings(): Promise<StoreSettings> {
    return { ...this.settings };
  }

  async saveStoreSettings(settings: Partial<StoreSettings>): Promise<StoreSettings> {
    this.settings = { ...this.settings, ...settings };
    return { ...this.settings };
  }

  async getShifts(): Promise<Shift[]> {
    return [...this.shifts];
  }

  async saveShifts(shifts: Shift[]): Promise<Shift[]> {
    this.shifts = [...shifts];
    return [...this.shifts];
  }

  async getOrders(): Promise<Order[]> {
    return [...this.orders].sort((a, b) => b.created - a.created);
  }

  async getOrderById(id: string): Promise<Order | null> {
    const found = this.orders.find((o) => o.id === id);
    return found ? { ...found } : null;
  }

  async getOrderByToken(token: string): Promise<Order | null> {
    const found = this.orders.find((o) => o.token === token);
    return found ? { ...found } : null;
  }

  async getOrderByNumber(orderNumber: string): Promise<Order | null> {
    const found = this.orders.find((o) => o.number === orderNumber);
    return found ? { ...found } : null;
  }

  async createOrder(order: Order): Promise<Order> {
    this.orders.unshift({ ...order });
    return { ...order };
  }

  async updateOrderStatus(id: string, fulfillment: OrderFulfillmentStatus): Promise<Order> {
    const index = this.orders.findIndex((o) => o.id === id);
    if (index === -1) throw new Error(`Order ${id} not found`);

    const order = this.orders[index];
    const updated: Order = {
      ...order,
      fulfillment,
      completedAt: fulfillment === 'COMPLETED' ? Date.now() : order.completedAt,
    };
    this.orders[index] = updated;
    return { ...updated };
  }

  async updateOrderPayment(
    id: string,
    payment: OrderPaymentStatus,
    paidAt?: number
  ): Promise<Order> {
    const index = this.orders.findIndex((o) => o.id === id);
    if (index === -1) throw new Error(`Order ${id} not found`);

    const order = this.orders[index];
    const now = paidAt || Date.now();
    const updated: Order = {
      ...order,
      payment,
      paidAt: payment === 'PAID' ? now : order.paidAt,
      pickup:
        payment === 'PAID' && order.mode === 'asap'
          ? now + order.estimate * 60 * 1000
          : order.pickup,
    };
    this.orders[index] = updated;
    return { ...updated };
  }

  async cancelOrder(id: string, reason: string): Promise<Order> {
    const index = this.orders.findIndex((o) => o.id === id);
    if (index === -1) throw new Error(`Order ${id} not found`);

    const order = this.orders[index];
    const updated: Order = {
      ...order,
      fulfillment: 'CANCELLED',
      cancelReason: reason,
      refund: {
        status: 'PENDING',
        amount: order.total,
        reason,
      },
    };
    this.orders[index] = updated;
    return { ...updated };
  }

  async recordRefund(id: string, refund: RefundRecord): Promise<Order> {
    const index = this.orders.findIndex((o) => o.id === id);
    if (index === -1) throw new Error(`Order ${id} not found`);

    const order = this.orders[index];
    const updated: Order = {
      ...order,
      refund: {
        ...refund,
        confirmedAt: refund.confirmedAt || Date.now(),
      },
    };
    this.orders[index] = updated;
    return { ...updated };
  }

  async updateOrderNotification(
    id: string,
    notification: OrderNotificationStatus,
    attempts: number
  ): Promise<Order> {
    const index = this.orders.findIndex((o) => o.id === id);
    if (index === -1) throw new Error(`Order ${id} not found`);

    const order = this.orders[index];
    const updated: Order = {
      ...order,
      notification,
      attempts,
    };
    this.orders[index] = updated;
    return { ...updated };
  }

  async seedDemoOrders(): Promise<Order[]> {
    const now = Date.now();
    const dateStr = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Jakarta',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    })
      .format(new Date(now))
      .replace(/-/g, '');

    const demoOrders: Order[] = [
      {
        id: 'ord_demo_1',
        token: 'tok_demo_101',
        number: `PV-${dateStr}-1041`,
        created: now - 15 * 60 * 1000,
        pickup: now + 5 * 60 * 1000,
        estimate: 10,
        mode: 'asap',
        name: 'Raka Pratama',
        phone: '6281234500011',
        note: 'Mi goreng jangan terlalu lembek ya mas.',
        payment: 'PAID',
        fulfillment: 'NEW',
        notification: 'SENT',
        recipientShiftId: 's1',
        items: [
          { name: 'Indomie Goreng', qty: 1, unit: 14000, egg: true, note: 'Pedas sedang' },
          { name: 'Es Teh Manis', qty: 1, unit: 4000, temp: 'Dingin' },
        ],
        total: 18000,
        paidAt: now - 15 * 60 * 1000,
        attempts: 1,
      },
      {
        id: 'ord_demo_2',
        token: 'tok_demo_102',
        number: `PV-${dateStr}-1042`,
        created: now - 25 * 60 * 1000,
        pickup: now + 10 * 60 * 1000,
        estimate: 10,
        mode: 'scheduled',
        name: 'Nadia Safitri',
        phone: '6281234500012',
        note: 'Banyakin kuah karinya.',
        payment: 'PAID',
        fulfillment: 'PREPARING',
        notification: 'SENT',
        recipientShiftId: 's1',
        items: [
          { name: 'Indomie Kari Ayam', qty: 1, unit: 10000, egg: false },
          { name: 'Roti Bakar Cokelat Keju', qty: 1, unit: 12000 },
        ],
        total: 22000,
        paidAt: now - 25 * 60 * 1000,
        attempts: 1,
      },
    ];

    this.orders = [...demoOrders, ...this.orders];
    return [...this.orders];
  }

  async resetAll(): Promise<void> {
    this.menu = [...INITIAL_MENU];
    this.categories = [...DEFAULT_CATEGORIES];
    this.settings = { ...DEFAULT_SETTINGS };
    this.shifts = [...INITIAL_SHIFTS];
    this.orders = [];
  }
}

export class PrismaStorage implements IStorage {
  private prisma: PrismaClient;

  constructor(prismaClient?: PrismaClient) {
    this.prisma = prismaClient || new PrismaClient();
  }

  async getMenuItems(): Promise<MenuItem[]> {
    const items = await this.prisma.menuItem.findMany({
      orderBy: { createdAt: 'asc' },
    });
    if (items.length === 0) {
      await this.saveMenuItems(INITIAL_MENU);
      return INITIAL_MENU;
    }
    return items.map((item) => ({
      id: item.id,
      name: item.name,
      description: item.description,
      price: item.price,
      category: item.category as Category,
      kind: item.kind as MenuItem['kind'],
      available: item.available,
      egg: item.egg,
      popular: item.popular,
      temperatures: item.temperatures ? JSON.parse(item.temperatures) : undefined,
      coldExtra: item.coldExtra,
      image: item.image || undefined,
      rating: item.rating || undefined,
      reviewsCount: item.reviewsCount || undefined,
      prepTime: item.prepTime || undefined,
      badge: item.badge ? (item.badge as MenuItem['badge']) : undefined,
      portion: item.portion ? (item.portion as MenuItem['portion']) : undefined,
      mealTime: item.mealTime ? JSON.parse(item.mealTime) : undefined,
    }));
  }

  async saveMenuItems(items: MenuItem[]): Promise<MenuItem[]> {
    await this.prisma.$transaction(async (tx) => {
      await tx.menuItem.deleteMany({});
      for (const item of items) {
        await tx.menuItem.create({
          data: {
            id: item.id,
            name: item.name,
            description: item.description || '',
            price: item.price,
            category: item.category,
            kind: item.kind || 'noodle',
            available: item.available ?? true,
            egg: item.egg ?? false,
            popular: item.popular ?? false,
            temperatures: item.temperatures ? JSON.stringify(item.temperatures) : '[]',
            coldExtra: item.coldExtra || 0,
            image: item.image || null,
            rating: item.rating ?? 5.0,
            reviewsCount: item.reviewsCount ?? 0,
            prepTime: item.prepTime ?? 10,
            badge: item.badge || null,
            portion: item.portion || 'Reguler',
            mealTime: item.mealTime ? JSON.stringify(item.mealTime) : '[]',
          },
        });
      }
    });
    return this.getMenuItems();
  }

  async getCategories(): Promise<string[]> {
    const cats = await this.prisma.category.findMany({
      orderBy: { order: 'asc' },
    });
    if (cats.length === 0) {
      await this.saveCategories(DEFAULT_CATEGORIES);
      return DEFAULT_CATEGORIES;
    }
    return cats.map((c) => c.name);
  }

  async saveCategories(categories: string[]): Promise<string[]> {
    await this.prisma.$transaction(async (tx) => {
      await tx.category.deleteMany({});
      for (let i = 0; i < categories.length; i++) {
        await tx.category.create({
          data: {
            name: categories[i],
            order: i,
          },
        });
      }
    });
    return [...categories];
  }

  async getStoreSettings(): Promise<StoreSettings> {
    const settings = await this.prisma.storeSettings.findUnique({
      where: { id: 'default' },
    });
    if (!settings) {
      return this.saveStoreSettings(DEFAULT_SETTINGS);
    }
    return {
      open: settings.open,
      estimate: settings.estimate,
      eggPrice: settings.eggPrice,
      recipientShiftId: settings.recipientShiftId,
      waConnected: settings.waConnected,
    };
  }

  async saveStoreSettings(settings: Partial<StoreSettings>): Promise<StoreSettings> {
    const updated = await this.prisma.storeSettings.upsert({
      where: { id: 'default' },
      update: settings,
      create: {
        id: 'default',
        open: settings.open ?? DEFAULT_SETTINGS.open,
        estimate: settings.estimate ?? DEFAULT_SETTINGS.estimate,
        eggPrice: settings.eggPrice ?? DEFAULT_SETTINGS.eggPrice,
        recipientShiftId: settings.recipientShiftId ?? DEFAULT_SETTINGS.recipientShiftId,
        waConnected: settings.waConnected ?? DEFAULT_SETTINGS.waConnected,
      },
    });
    return {
      open: updated.open,
      estimate: updated.estimate,
      eggPrice: updated.eggPrice,
      recipientShiftId: updated.recipientShiftId,
      waConnected: updated.waConnected,
    };
  }

  async getShifts(): Promise<Shift[]> {
    const shifts = await this.prisma.shift.findMany({
      orderBy: { id: 'asc' },
    });
    if (shifts.length === 0) {
      await this.saveShifts(INITIAL_SHIFTS);
      return INITIAL_SHIFTS;
    }
    return shifts.map((s) => ({ id: s.id, name: s.name, phone: s.phone }));
  }

  async saveShifts(shifts: Shift[]): Promise<Shift[]> {
    await this.prisma.$transaction(async (tx) => {
      await tx.shift.deleteMany({});
      for (const shift of shifts) {
        await tx.shift.create({
          data: {
            id: shift.id,
            name: shift.name,
            phone: shift.phone,
          },
        });
      }
    });
    return [...shifts];
  }

  private mapOrder(dbOrder: any): Order {
    return {
      id: dbOrder.id,
      token: dbOrder.token,
      number: dbOrder.number,
      created: Number(dbOrder.created),
      pickup: Number(dbOrder.pickup),
      estimate: dbOrder.estimate,
      mode: dbOrder.mode as 'asap' | 'scheduled',
      name: dbOrder.name,
      phone: dbOrder.phone,
      note: dbOrder.note || undefined,
      payment: dbOrder.payment as OrderPaymentStatus,
      fulfillment: dbOrder.fulfillment as OrderFulfillmentStatus,
      notification: dbOrder.notification as OrderNotificationStatus,
      recipientShiftId: dbOrder.recipientShiftId,
      total: dbOrder.total,
      paidAt: dbOrder.paidAt ? Number(dbOrder.paidAt) : undefined,
      completedAt: dbOrder.completedAt ? Number(dbOrder.completedAt) : undefined,
      cancelReason: dbOrder.cancelReason || undefined,
      attempts: dbOrder.attempts,
      snapToken: dbOrder.snapToken || undefined,
      items: dbOrder.items.map((i: any) => ({
        name: i.name,
        qty: i.qty,
        unit: i.unit,
        egg: i.egg,
        temp: i.temp || undefined,
        note: i.note || undefined,
      })),
      refund: dbOrder.refund
        ? {
            status: dbOrder.refund.status,
            amount: dbOrder.refund.amount,
            reason: dbOrder.refund.reason,
            confirmedAt: dbOrder.refund.confirmedAt
              ? Number(dbOrder.refund.confirmedAt)
              : undefined,
          }
        : undefined,
    };
  }

  async getOrders(): Promise<Order[]> {
    const orders = await this.prisma.order.findMany({
      include: { items: true, refund: true },
      orderBy: { created: 'desc' },
    });
    return orders.map((o) => this.mapOrder(o));
  }

  async getOrderById(id: string): Promise<Order | null> {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: { items: true, refund: true },
    });
    return order ? this.mapOrder(order) : null;
  }

  async getOrderByToken(token: string): Promise<Order | null> {
    const order = await this.prisma.order.findUnique({
      where: { token },
      include: { items: true, refund: true },
    });
    return order ? this.mapOrder(order) : null;
  }

  async getOrderByNumber(orderNumber: string): Promise<Order | null> {
    const order = await this.prisma.order.findUnique({
      where: { number: orderNumber },
      include: { items: true, refund: true },
    });
    return order ? this.mapOrder(order) : null;
  }

  async createOrder(order: Order): Promise<Order> {
    const created = await this.prisma.order.create({
      data: {
        id: order.id,
        token: order.token,
        number: order.number,
        created: BigInt(order.created),
        pickup: BigInt(order.pickup),
        estimate: order.estimate,
        mode: order.mode,
        name: order.name,
        phone: order.phone,
        note: order.note || null,
        payment: order.payment,
        fulfillment: order.fulfillment,
        notification: order.notification,
        recipientShiftId: order.recipientShiftId,
        total: order.total,
        snapToken: order.snapToken || null,
        items: {
          create: order.items.map((i) => ({
            name: i.name,
            qty: i.qty,
            unit: i.unit,
            egg: i.egg ?? false,
            temp: i.temp || null,
            note: i.note || null,
          })),
        },
      },
      include: { items: true, refund: true },
    });
    return this.mapOrder(created);
  }

  async updateOrderStatus(id: string, fulfillment: OrderFulfillmentStatus): Promise<Order> {
    const now = Date.now();
    const updated = await this.prisma.order.update({
      where: { id },
      data: {
        fulfillment,
        completedAt: fulfillment === 'COMPLETED' ? BigInt(now) : undefined,
      },
      include: { items: true, refund: true },
    });
    return this.mapOrder(updated);
  }

  async updateOrderPayment(
    id: string,
    payment: OrderPaymentStatus,
    paidAt?: number
  ): Promise<Order> {
    const order = await this.prisma.order.findUnique({ where: { id } });
    if (!order) throw new Error(`Order ${id} not found`);

    const now = paidAt || Date.now();
    const newPickup =
      payment === 'PAID' && order.mode === 'asap'
        ? BigInt(now + order.estimate * 60 * 1000)
        : order.pickup;

    const updated = await this.prisma.order.update({
      where: { id },
      data: {
        payment,
        paidAt: payment === 'PAID' ? BigInt(now) : undefined,
        pickup: newPickup,
      },
      include: { items: true, refund: true },
    });
    return this.mapOrder(updated);
  }

  async cancelOrder(id: string, reason: string): Promise<Order> {
    const order = await this.prisma.order.findUnique({ where: { id } });
    if (!order) throw new Error(`Order ${id} not found`);

    const updated = await this.prisma.order.update({
      where: { id },
      data: {
        fulfillment: 'CANCELLED',
        cancelReason: reason,
        refund: {
          upsert: {
            create: {
              status: 'PENDING',
              amount: order.total,
              reason,
            },
            update: {
              status: 'PENDING',
              amount: order.total,
              reason,
            },
          },
        },
      },
      include: { items: true, refund: true },
    });
    return this.mapOrder(updated);
  }

  async recordRefund(id: string, refund: RefundRecord): Promise<Order> {
    const updated = await this.prisma.order.update({
      where: { id },
      data: {
        refund: {
          upsert: {
            create: {
              status: refund.status,
              amount: refund.amount,
              reason: refund.reason,
              confirmedAt: refund.confirmedAt ? BigInt(refund.confirmedAt) : BigInt(Date.now()),
            },
            update: {
              status: refund.status,
              amount: refund.amount,
              reason: refund.reason,
              confirmedAt: refund.confirmedAt ? BigInt(refund.confirmedAt) : BigInt(Date.now()),
            },
          },
        },
      },
      include: { items: true, refund: true },
    });
    return this.mapOrder(updated);
  }

  async updateOrderNotification(
    id: string,
    notification: OrderNotificationStatus,
    attempts: number
  ): Promise<Order> {
    const updated = await this.prisma.order.update({
      where: { id },
      data: {
        notification,
        attempts,
      },
      include: { items: true, refund: true },
    });
    return this.mapOrder(updated);
  }

  async seedDemoOrders(): Promise<Order[]> {
    const mem = new MemoryStorage();
    const seeds = await mem.seedDemoOrders();
    for (const seed of seeds) {
      await this.createOrder(seed);
    }
    return this.getOrders();
  }

  async resetAll(): Promise<void> {
    await this.prisma.$transaction([
      this.prisma.orderItem.deleteMany(),
      this.prisma.refundRecord.deleteMany(),
      this.prisma.notificationJob.deleteMany(),
      this.prisma.order.deleteMany(),
      this.prisma.menuItem.deleteMany(),
      this.prisma.category.deleteMany(),
      this.prisma.shift.deleteMany(),
      this.prisma.storeSettings.deleteMany(),
    ]);
  }
}

let activeStorage: IStorage | null = null;

export function getStorage(): IStorage {
  if (activeStorage) return activeStorage;

  if (process.env.DATABASE_URL && process.env.NODE_ENV !== 'test') {
    try {
      activeStorage = new PrismaStorage();
      return activeStorage;
    } catch (err) {
      console.warn('[Storage] Falling back to MemoryStorage due to Prisma initialization error:', err);
      activeStorage = new MemoryStorage();
      return activeStorage;
    }
  }

  activeStorage = new MemoryStorage();
  return activeStorage;
}

export function setStorage(storage: IStorage): void {
  activeStorage = storage;
}
