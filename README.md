# Vankalan API (`vankalan-api`)

Backend REST API untuk sistem pemesanan online **Warmindo Putra Vangkalan**.

Dibangun dengan arsitektur terpisah (non-monorepo) menggunakan **Express**, **TypeScript**, **Prisma ORM**, **PostgreSQL**, **Midtrans Snap**, dan **WAHA (WhatsApp HTTP API)**.

## Fitur Utama

- **Katalog Menu & Kategori**: CRUD menu, varian suhu (Panas/Dingin), opsi telur, dan status ketersediaan item.
- **Pengaturan Warung & Sif**: Kontrol buka/tutup warung, estimasi durasi persiapan, dan rotasi penjaga sif aktif.
- **Pemesanan & Validasi Harga**: Validasi harga server-side, pembuatan nomor order terstandar (`PV-YYYYMMDD-XXXX`), dan token akses publik pelanggan.
- **Gateway Pembayaran Midtrans Snap**: Pembuatan snap transaction token & verifikasi webhook idempoten dengan tanda tangan SHA512.
- **Worker Notifikasi WhatsApp (WAHA)**: Pengiriman rincian pesanan ke nomor WA penjaga sif aktif sesuai standar template PRD FR-32 dengan kebijakan retry bertahap (30 detik, 2 menit, 5 menit).
- **Audit & Penanganan Pengembalian Dana (Refund)**: Pembatalan pesanan dan pencatatan riwayat konfirmasi refund.
- **Deployment Terpadu**: Kompatibel dengan infrastruktur `/opt/stacks` Thinkpad Pop!_OS via Caddy reverse proxy dan Docker network `gateway-net`.

## Tech Stack

- **Runtime**: Node.js v22 (LTS)
- **Framework**: Express.js 4.x + TypeScript 5.x
- **Database & ORM**: PostgreSQL 16 + Prisma ORM 5.x
- **Testing**: Vitest + Supertest (23/23 tests passing)
- **Package Manager**: pnpm

## API Endpoints

### Menu & Kategori
- `GET /api/menu` — Mengambil daftar menu
- `PUT /api/menu` — Memperbarui daftar menu
- `GET /api/categories` — Mengambil daftar kategori
- `PUT /api/categories` — Memperbarui daftar kategori

### Pengaturan & Sif
- `GET /api/settings` — Mengambil pengaturan warung
- `PATCH /api/settings` — Memperbarui pengaturan warung
- `GET /api/shifts` — Mengambil daftar sif penjaga
- `PUT /api/shifts` — Memperbarui daftar sif penjaga
- `POST /api/reset` — Reset semua data ke baseline default

### Pemesanan (Orders)
- `GET /api/orders` — Daftar seluruh pesanan (terbaru di atas)
- `POST /api/orders` — Membuat pesanan baru & mendapatkan snapToken Midtrans
- `GET /api/orders/:id` — Detail pesanan berdasarkan ID
- `GET /api/orders/token/:token` — Detail pesanan berdasarkan token pelacakan pelanggan
- `PATCH /api/orders/:id/status` — Memperbarui status pemenuhan (`NEW`, `PREPARING`, `READY`, `COMPLETED`, `CANCELLED`)
- `PATCH /api/orders/:id/payment` — Memperbarui status pembayaran (`PENDING`, `PAID`, `FAILED`, `EXPIRED`)
- `POST /api/orders/:id/cancel` — Membatalkan pesanan
- `POST /api/orders/:id/refund` — Konfirmasi pencatatan refund
- `POST /api/orders/:id/retry-wa` — Memicu pengiriman ulang notifikasi WhatsApp
- `POST /api/orders/seed` — Seed data pesanan demo

### Webhook
- `POST /api/webhooks/midtrans` — Handler webhook transaksi Midtrans (verifikasi signature SHA512)

### Health Check
- `GET /health` — Status kesehatan service dan uptime

## Pengembangan Lokal

```bash
# 1. Install dependencies
pnpm install

# 2. Setup database Prisma
pnpm prisma:generate

# 3. Jalankan test
pnpm test

# 4. Jalankan dev server
pnpm dev
```
