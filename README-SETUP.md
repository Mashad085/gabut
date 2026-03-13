# CommunityFinance — Panduan Setup

Platform keuangan komunitas berbasis web. Dibangun dengan Node.js + Koa.js (backend), React + Vite (frontend), PostgreSQL, dan Redis. **Tidak membutuhkan Docker.**

---

## Persyaratan Sistem

| Komponen | Versi minimum |
|---|---|
| OS | Ubuntu 20.04+ / Debian 11+ |
| Node.js | 18 LTS atau 20 LTS |
| PostgreSQL | 14+ |
| Redis | 6+ |
| RAM | 512 MB |
| Disk | 500 MB |

---

## Cara Install (Otomatis)

Untuk Ubuntu/Debian, jalankan script setup yang sudah disediakan:

```bash
cd community-finance
bash setup.sh
```

Script ini akan otomatis:
- Install Node.js 20 LTS (jika belum ada)
- Install PostgreSQL (jika belum ada)
- Install Redis (jika belum ada)
- Membuat user dan database PostgreSQL
- Menjalankan schema dan seed data
- Menginstall semua npm dependencies

Setelah selesai:

```bash
npm run dev
```

---

## Cara Install Manual (Semua OS)

### 1. Instal Node.js 20

```bash
# Ubuntu/Debian
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo bash -
sudo apt-get install -y nodejs

# Atau pakai nvm
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
nvm install 20 && nvm use 20
```

### 2. Instal PostgreSQL

```bash
# Ubuntu/Debian
sudo apt-get install -y postgresql postgresql-client

# macOS
brew install postgresql@16
brew services start postgresql@16
```

### 3. Instal Redis

```bash
# Ubuntu/Debian
sudo apt-get install -y redis-server
redis-server --daemonize yes

# macOS
brew install redis
brew services start redis
```

### 4. Setup Database

```bash
# Login sebagai postgres superuser
sudo -u postgres psql
# atau: psql -U postgres

# Jalankan perintah ini di dalam psql:
CREATE USER cfuser WITH PASSWORD 'cfpass123';
CREATE DATABASE community_finance OWNER cfuser;
GRANT ALL PRIVILEGES ON DATABASE community_finance TO cfuser;
\q

# Jalankan schema
sudo -u postgres psql -d community_finance -f docker/postgres/init.sql
```

### 5. Install Dependencies

```bash
cd community-finance
npm run install:all
```

### 6. Jalankan

```bash
npm run dev
```

---

## Konfigurasi .env

File `.env` sudah tersedia di `apps/backend/.env` dan `apps/frontend/.env`. Konfigurasi default sudah siap untuk development lokal.

### apps/backend/.env (penting)

```env
DATABASE_URL=postgresql://cfuser:cfpass123@localhost:5432/community_finance
REDIS_URL=redis://localhost:6379
JWT_SECRET=<sudah di-generate, jangan diubah>
FRONTEND_URL=http://localhost:5173
```

### Jika Redis menggunakan password

```env
REDIS_URL=redis://:passwordanda@localhost:6379
```

### Untuk production

Ganti semua secret dengan nilai acak baru:

```bash
# Generate JWT secret baru
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

## URL Aplikasi

| Service | URL |
|---|---|
| Frontend | http://localhost:5173 |
| Backend API | http://localhost:3001 |
| Health check | http://localhost:3001/api/v1/health |

---

## Akun Demo

| Email | Password | Role |
|---|---|---|
| admin@communityfinance.id | password123 | admin |
| budi@example.com | password123 | member |
| siti@example.com | password123 | member |

---

## Struktur Project

```
community-finance/
├── apps/
│   ├── backend/          Node.js + Koa.js REST API
│   │   ├── src/
│   │   │   ├── db/       PostgreSQL + Redis helpers
│   │   │   ├── middleware/
│   │   │   ├── routes/   auth, accounts, transactions, communities, ...
│   │   │   └── services/ jobQueue.js + jobProcessor.js (cron jobs)
│   │   └── .env
│   └── frontend/         React + Vite + TypeScript
│       ├── src/
│       │   ├── pages/    Dashboard, Budget, Transactions, Communities, ...
│       │   ├── layouts/
│       │   ├── stores/   Zustand auth store
│       │   └── lib/      Axios API client
│       └── .env
├── docker/
│   └── postgres/
│       └── init.sql      Schema + seed data
├── setup.sh              Script install otomatis
└── README-SETUP.md       (file ini)
```

---

## Arsitektur Backend

```
HTTP Request
    │
    ▼
Koa Middleware Stack
  ├── helmet (security headers)
  ├── cors
  ├── koa-body (JSON parsing)
  ├── koa-logger
  ├── errorHandler
  └── rateLimiter (Redis-based)
    │
    ▼
Router (/api/v1/...)
    │
    ├── /auth          JWT login, register, 2FA, refresh token
    ├── /accounts      Rekening bank
    ├── /transactions  Transaksi keuangan
    ├── /communities   Arisan, koperasi, klub investasi
    ├── /budgets       Perencanaan anggaran
    ├── /reports       Dashboard analytics
    ├── /notifications
    └── /admin         Khusus role admin
    │
    ▼
PostgreSQL (data) + Redis (cache/session)
    │
    ▼
Job Processor (in-process, node-cron)
  ├── Poll job_queue setiap 5 detik
  ├── Cek scheduled transactions setiap menit
  ├── Proses bunga tabungan tanggal 1 tiap bulan
  └── Cleanup job lama setiap hari jam 03:00
```

---

## API Endpoints

### Auth
| Method | Endpoint | Keterangan |
|---|---|---|
| POST | /api/v1/auth/register | Daftar akun baru |
| POST | /api/v1/auth/login | Login |
| POST | /api/v1/auth/refresh | Refresh access token |
| POST | /api/v1/auth/logout | Logout (blacklist token) |
| GET  | /api/v1/auth/me | Info user login |
| POST | /api/v1/auth/2fa/setup | Setup 2FA |
| POST | /api/v1/auth/2fa/verify | Verifikasi 2FA |

### Accounts, Transactions, Communities, Budgets, Reports, Notifications — semua membutuhkan header:
```
Authorization: Bearer <accessToken>
```

---

## Troubleshooting

**PostgreSQL tidak bisa connect**
```bash
# Cek status
pg_ctlcluster 16 main status
# Start manual
pg_ctlcluster 16 main start
# Test koneksi
PGPASSWORD=cfpass123 psql -U cfuser -h localhost -d community_finance -c "SELECT 1"
```

**Redis tidak merespons**
```bash
redis-server --daemonize yes
redis-cli ping  # harusnya: PONG
```

**Port 3001 sudah dipakai**
```bash
# Cek proses
lsof -i :3001
# Ganti port di apps/backend/.env
PORT=3002
```

**npm install error**
```bash
# Pastikan Node.js versi 18+
node --version
# Clear cache
npm cache clean --force
npm run install:all
```
