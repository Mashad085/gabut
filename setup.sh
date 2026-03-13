#!/usr/bin/env bash
# =============================================================================
# CommunityFinance — Setup Script (tanpa Docker)
# Diuji di Ubuntu 22.04 / 24.04 & Debian 12
# Jalankan: bash setup.sh
# =============================================================================
set -e
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; NC='\033[0m'
info()  { echo -e "${CYAN}[INFO]${NC}  $1"; }
ok()    { echo -e "${GREEN}[OK]${NC}    $1"; }
warn()  { echo -e "${YELLOW}[WARN]${NC}  $1"; }
error() { echo -e "${RED}[ERROR]${NC} $1"; exit 1; }

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo ""
echo -e "${CYAN}╔════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║    CommunityFinance — Setup Script     ║${NC}"
echo -e "${CYAN}╚════════════════════════════════════════╝${NC}"
echo ""

# ── 1. Cek OS ─────────────────────────────────────────────────────────────────
if ! command -v apt-get &>/dev/null; then
  error "Script ini membutuhkan apt-get (Ubuntu/Debian)"
fi

# ── 2. Install system dependencies ───────────────────────────────────────────
info "Menginstall system dependencies..."
apt-get update -qq
apt-get install -y --fix-missing curl wget gnupg2 lsb-release ca-certificates 2>/dev/null || true

# ── 3. Node.js 20 LTS ────────────────────────────────────────────────────────
if ! command -v node &>/dev/null || [[ $(node -v | cut -d. -f1 | tr -d 'v') -lt 18 ]]; then
  info "Menginstall Node.js 20 LTS..."
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash - 2>/dev/null
  apt-get install -y nodejs
  ok "Node.js $(node -v) terinstall"
else
  ok "Node.js $(node -v) sudah ada"
fi

# ── 4. PostgreSQL ─────────────────────────────────────────────────────────────
if ! command -v psql &>/dev/null; then
  info "Menginstall PostgreSQL..."
  apt-get install -y postgresql postgresql-client 2>/dev/null || \
  apt-get install -y --fix-missing postgresql postgresql-client
  ok "PostgreSQL terinstall"
else
  ok "PostgreSQL sudah ada: $(psql --version)"
fi

# Start PostgreSQL
PG_VERSION=$(pg_lsclusters -h 2>/dev/null | awk '{print $1}' | head -1)
if [ -n "$PG_VERSION" ]; then
  pg_ctlcluster "$PG_VERSION" main start 2>/dev/null || true
else
  pg_ctlcluster 16 main start 2>/dev/null || \
  pg_ctlcluster 15 main start 2>/dev/null || \
  pg_ctlcluster 14 main start 2>/dev/null || true
fi
sleep 1

# Create DB user and database
info "Menyiapkan database PostgreSQL..."
PG_CMD() { su -c "psql $*" postgres 2>/dev/null || sudo -u postgres psql $* 2>/dev/null; }

PG_CMD -c "SELECT 1 FROM pg_roles WHERE rolname='cfuser'" | grep -q 1 \
  || PG_CMD -c "CREATE USER cfuser WITH PASSWORD 'cfpass123';" 2>/dev/null || true

PG_CMD -c "SELECT 1 FROM pg_database WHERE datname='community_finance'" | grep -q 1 \
  || PG_CMD -c "CREATE DATABASE community_finance OWNER cfuser;" 2>/dev/null || true

PG_CMD -c "GRANT ALL PRIVILEGES ON DATABASE community_finance TO cfuser;" 2>/dev/null || true
PG_CMD -d community_finance -c "CREATE EXTENSION IF NOT EXISTS \"uuid-ossp\";" 2>/dev/null || true
PG_CMD -d community_finance -c "CREATE EXTENSION IF NOT EXISTS \"pgcrypto\";" 2>/dev/null || true

# Run schema
info "Menjalankan schema & seed data..."
su -c "psql -d community_finance -f '$SCRIPT_DIR/docker/postgres/init.sql'" postgres 2>/dev/null \
  || sudo -u postgres psql -d community_finance -f "$SCRIPT_DIR/docker/postgres/init.sql" 2>/dev/null \
  || warn "Schema mungkin sudah ada, skip."

ok "Database siap"

# ── 5. Redis ──────────────────────────────────────────────────────────────────
if ! command -v redis-server &>/dev/null; then
  info "Menginstall Redis..."
  apt-get install -y redis-server
  ok "Redis terinstall"
else
  ok "Redis sudah ada: $(redis-server --version | awk '{print $3}')"
fi

# Start Redis tanpa password (development)
if ! redis-cli ping &>/dev/null; then
  info "Menjalankan Redis..."
  redis-server --daemonize yes --loglevel warning
  sleep 1
fi
redis-cli ping | grep -q PONG && ok "Redis berjalan" || warn "Redis tidak merespons"

# ── 6. Install npm dependencies ───────────────────────────────────────────────
info "Menginstall npm dependencies..."
npm install --silent 2>/dev/null || npm install
cd apps/frontend && npm install --silent 2>/dev/null || npm install
cd ../backend  && npm install --silent 2>/dev/null || npm install
cd "$SCRIPT_DIR"
ok "Semua dependencies terinstall"

# ── 7. Update .env Redis URL (tanpa password) ─────────────────────────────────
# Redis kita jalankan tanpa password di development
if [ -f apps/backend/.env ]; then
  sed -i 's|REDIS_URL=redis://:redispass123@localhost:6379|REDIS_URL=redis://localhost:6379|g' apps/backend/.env
fi
if [ -f apps/worker/.env ]; then
  sed -i 's|REDIS_URL=redis://:redispass123@localhost:6379|REDIS_URL=redis://localhost:6379|g' apps/worker/.env
fi

# ── 8. Selesai ────────────────────────────────────────────────────────────────
echo ""
echo -e "${GREEN}╔════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║         Setup Selesai!  🎉             ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════╝${NC}"
echo ""
echo -e "  ${CYAN}Jalankan aplikasi:${NC}"
echo -e "  ${YELLOW}npm run dev${NC}"
echo ""
echo -e "  ${CYAN}URL:${NC}"
echo -e "  Frontend  → ${YELLOW}http://localhost:5173${NC}"
echo -e "  Backend   → ${YELLOW}http://localhost:3001${NC}"
echo -e "  Health    → ${YELLOW}http://localhost:3001/api/v1/health${NC}"
echo ""
echo -e "  ${CYAN}Akun demo:${NC}"
echo -e "  admin@communityfinance.id / password123"
echo -e "  budi@example.com          / password123"
echo ""
