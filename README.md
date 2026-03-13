# 🏦 CommunityFinance — Platform Keuangan Komunitas

Platform all-in-one untuk mengelola keuangan pribadi dan komunitas dengan keamanan tingkat enterprise.

## 🏗️ Arsitektur

```
community-finance/
├── apps/
│   ├── frontend/          # React + Vite + TailwindCSS + Framer Motion
│   ├── backend/           # Node.js + Koa.js (REST API)
│   └── worker/            # Background job processor
├── packages/
│   └── shared/            # Shared types & utilities
└── docker/                # Docker configs
    ├── postgres/
    └── rabbitmq/
```

## 🛠️ Tech Stack

| Layer | Teknologi |
|-------|-----------|
| **Frontend** | React 18, Vite, TypeScript, TailwindCSS, Framer Motion |
| **Backend** | Node.js, **Koa.js** (framework), JWT Auth, Zod validation |
| **Database** | PostgreSQL 15 |
| **Cache** | Redis 7 |
| **Message Queue** | **RabbitMQ** (amqplib) |
| **Worker** | Node.js background jobs + node-cron |
| **Security** | JWT + Refresh tokens, bcrypt, 2FA (TOTP), Rate limiting, Audit logs |
| **State** | Zustand (client), React Query (server) |
| **Charts** | Recharts |

## 🚀 Cara Menjalankan

### Prerequisites
- Docker & Docker Compose
- Node.js 20+
- npm 9+

### 1. Clone & Install
```bash
git clone <repo-url>
cd community-finance
npm run install:all
```

### 2. Setup Environment
```bash
cp apps/backend/.env.example apps/backend/.env
cp apps/frontend/.env.example apps/frontend/.env
```

### 3. Jalankan Infrastructure (Docker)
```bash
npm run docker:up
```

Ini akan menjalankan:
- PostgreSQL (port 5432)
- Redis (port 6379)  
- RabbitMQ (port 5672, Management UI: 15672)

### 4. Jalankan Semua Services
```bash
npm run dev
```

Atau jalankan per service:
```bash
npm run dev:backend    # API: http://localhost:3001
npm run dev:frontend   # UI:  http://localhost:5173
npm run dev:worker     # Background worker
```

### 5. Akses Aplikasi
- **Frontend**: http://localhost:5173
- **API**: http://localhost:3001/api/v1
- **API Health**: http://localhost:3001/api/v1/health
- **RabbitMQ UI**: http://localhost:15672 (cfrabbit/rabbitpass123)

### Demo Credentials
```
Email: admin@communityfinance.id
Password: password123
```

## 🔒 Fitur Keamanan

- ✅ **JWT Authentication** — Access token (15 menit) + Refresh token (7 hari)
- ✅ **2FA/TOTP** — Google Authenticator compatible
- ✅ **Rate Limiting** — Per IP, per endpoint
- ✅ **Token Blacklisting** — via Redis
- ✅ **Audit Logging** — Semua aksi user tercatat
- ✅ **bcrypt** — Password hashing dengan salt rounds 12
- ✅ **CORS** — Configured per origin
- ✅ **Helmet** — HTTP security headers
- ✅ **Input Validation** — Zod schema validation
- ✅ **SQL Injection Prevention** — Parameterized queries
- ✅ **Transaction Integrity** — PostgreSQL ACID transactions

## 📊 Fitur Utama

### 🏦 Perbankan Pribadi
- Multi-rekening (Tabungan, Giro, Investasi, Pinjaman)
- Transfer antar rekening
- Riwayat transaksi dengan filter & pencarian
- Transaksi terjadwal (recurring)
- Kategorisasi otomatis

### 👥 Komunitas
- **Arisan** — Manajemen arisan dengan giliran otomatis
- **Koperasi** — Simpan pinjam dengan bunga
- **Grup Tabungan** — Dana bersama
- **Klub Investasi** — Portofolio kolektif
- Approval workflow untuk transaksi komunitas
- Peran: Admin, Bendahara, Anggota

### 💰 Anggaran & Laporan
- Budget planner bulanan/tahunan
- Laporan: Net Worth, Cash Flow, Cost of Living
- Grafik: Area, Bar, Pie, Line charts
- Perbandingan periode

### 🔔 Notifikasi
- Real-time via RabbitMQ
- Email notifications (configurable)
- In-app notifications

## 🔄 Message Queue (RabbitMQ)

```
Exchanges:
  finance.events (topic)     → transaction.*
  notifications.fanout       → broadcast

Queues:
  notifications              → handle user notifications
  transactions.process       → process transaction events  
  emails.send                → send email notifications
  scheduled.jobs             → trigger scheduled tasks
  audit.logs                 → write audit trail
```

## 🗄️ Database Schema

```sql
users → bank_accounts → transactions
     → budgets → budget_categories
     → notifications
     → audit_logs

communities → community_members
           → community_funds
           → community_transactions
```

## 📁 API Endpoints

```
POST   /api/v1/auth/register
POST   /api/v1/auth/login
POST   /api/v1/auth/refresh
POST   /api/v1/auth/logout
GET    /api/v1/auth/me
POST   /api/v1/auth/2fa/setup
POST   /api/v1/auth/2fa/verify

GET    /api/v1/accounts
POST   /api/v1/accounts
GET    /api/v1/accounts/:id
PUT    /api/v1/accounts/:id

GET    /api/v1/transactions
POST   /api/v1/transactions
GET    /api/v1/transactions/:id
GET    /api/v1/transactions/stats/summary

GET    /api/v1/communities
GET    /api/v1/communities/my
POST   /api/v1/communities
GET    /api/v1/communities/:id
POST   /api/v1/communities/:id/join
GET    /api/v1/communities/:id/members
POST   /api/v1/communities/:id/contribute

GET    /api/v1/reports/dashboard
GET    /api/v1/reports/investment
GET    /api/v1/reports/cost-of-living
GET    /api/v1/reports/net-worth

GET    /api/v1/budgets
POST   /api/v1/budgets
GET    /api/v1/budgets/:id

GET    /api/v1/notifications
PATCH  /api/v1/notifications/:id/read
PATCH  /api/v1/notifications/read-all

GET    /api/v1/admin/stats          [admin only]
GET    /api/v1/admin/users          [admin only]
GET    /api/v1/admin/audit-logs     [admin only]
```

## 🌐 Production Deployment

```bash
# Build frontend
cd apps/frontend && npm run build

# Use PM2 for Node.js processes
pm2 start apps/backend/src/index.js --name cf-api
pm2 start apps/worker/src/index.js --name cf-worker

# Or full Docker deployment
docker-compose -f docker-compose.prod.yml up -d
```

## 📝 Lisensi

MIT © 2025 CommunityFinance
