-- Community Finance Database Schema
-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================
-- USERS & AUTH
-- ============================================
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email VARCHAR(255) UNIQUE NOT NULL,
  username VARCHAR(50) UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  full_name VARCHAR(255) NOT NULL,
  avatar_url TEXT,
  phone VARCHAR(20),
  is_verified BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  role VARCHAR(20) DEFAULT 'member' CHECK (role IN ('admin', 'moderator', 'member')),
  two_factor_enabled BOOLEAN DEFAULT false,
  two_factor_secret TEXT,
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE refresh_tokens (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  token TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  action VARCHAR(100) NOT NULL,
  resource_type VARCHAR(50),
  resource_id UUID,
  ip_address INET,
  user_agent TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- COMMUNITY BANKING
-- ============================================
CREATE TABLE bank_accounts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  account_number VARCHAR(20) UNIQUE NOT NULL,
  account_type VARCHAR(20) NOT NULL CHECK (account_type IN ('savings', 'checking', 'investment', 'loan')),
  account_name VARCHAR(100) NOT NULL,
  balance DECIMAL(15,2) DEFAULT 0.00,
  currency VARCHAR(3) DEFAULT 'IDR',
  is_active BOOLEAN DEFAULT true,
  is_primary BOOLEAN DEFAULT false,
  interest_rate DECIMAL(5,4) DEFAULT 0.0000,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id UUID REFERENCES bank_accounts(id) ON DELETE CASCADE,
  related_account_id UUID REFERENCES bank_accounts(id),
  transaction_type VARCHAR(20) NOT NULL CHECK (transaction_type IN ('credit', 'debit', 'transfer', 'interest', 'fee')),
  category VARCHAR(50),
  subcategory VARCHAR(50),
  amount DECIMAL(15,2) NOT NULL,
  balance_after DECIMAL(15,2) NOT NULL,
  description TEXT,
  payee VARCHAR(255),
  reference_number VARCHAR(50),
  status VARCHAR(20) DEFAULT 'completed' CHECK (status IN ('pending', 'completed', 'failed', 'cancelled')),
  metadata JSONB DEFAULT '{}',
  transaction_date TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE scheduled_transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id UUID REFERENCES bank_accounts(id) ON DELETE CASCADE,
  transaction_type VARCHAR(20) NOT NULL,
  amount DECIMAL(15,2) NOT NULL,
  description TEXT,
  payee VARCHAR(255),
  category VARCHAR(50),
  frequency VARCHAR(20) CHECK (frequency IN ('daily', 'weekly', 'monthly', 'yearly', 'once')),
  next_run_at TIMESTAMPTZ NOT NULL,
  end_date TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- COMMUNITY GROUPS (Arisan, Koperasi, etc.)
-- ============================================
CREATE TABLE communities (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(100) UNIQUE NOT NULL,
  description TEXT,
  community_type VARCHAR(30) CHECK (community_type IN ('arisan', 'koperasi', 'savings_group', 'investment_club', 'general')),
  avatar_url TEXT,
  cover_url TEXT,
  is_public BOOLEAN DEFAULT true,
  max_members INTEGER,
  total_fund DECIMAL(15,2) DEFAULT 0.00,
  currency VARCHAR(3) DEFAULT 'IDR',
  created_by UUID REFERENCES users(id),
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE community_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  community_id UUID REFERENCES communities(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  role VARCHAR(20) DEFAULT 'member' CHECK (role IN ('admin', 'treasurer', 'member')),
  contribution_amount DECIMAL(15,2) DEFAULT 0.00,
  total_contributed DECIMAL(15,2) DEFAULT 0.00,
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(community_id, user_id)
);

CREATE TABLE community_funds (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  community_id UUID REFERENCES communities(id) ON DELETE CASCADE,
  fund_name VARCHAR(100) NOT NULL,
  fund_type VARCHAR(30) CHECK (fund_type IN ('main', 'emergency', 'investment', 'loan_pool')),
  balance DECIMAL(15,2) DEFAULT 0.00,
  target_amount DECIMAL(15,2),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE community_transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  community_id UUID REFERENCES communities(id) ON DELETE CASCADE,
  fund_id UUID REFERENCES community_funds(id),
  user_id UUID REFERENCES users(id),
  transaction_type VARCHAR(20) CHECK (transaction_type IN ('contribution', 'withdrawal', 'distribution', 'loan', 'repayment')),
  amount DECIMAL(15,2) NOT NULL,
  description TEXT,
  approved_by UUID REFERENCES users(id),
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'completed')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- BUDGET & FINANCE PLANNING
-- ============================================
CREATE TABLE budgets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  period_type VARCHAR(10) CHECK (period_type IN ('monthly', 'yearly')),
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  total_income DECIMAL(15,2) DEFAULT 0.00,
  total_budgeted DECIMAL(15,2) DEFAULT 0.00,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE budget_categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  budget_id UUID REFERENCES budgets(id) ON DELETE CASCADE,
  category_name VARCHAR(100) NOT NULL,
  budgeted_amount DECIMAL(15,2) DEFAULT 0.00,
  spent_amount DECIMAL(15,2) DEFAULT 0.00,
  color VARCHAR(7),
  icon VARCHAR(50),
  is_income BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- NOTIFICATIONS
-- ============================================
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  type VARCHAR(30) CHECK (type IN ('transaction', 'community', 'security', 'system', 'reminder')),
  is_read BOOLEAN DEFAULT false,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- INDEXES
-- ============================================
CREATE INDEX idx_transactions_account_id ON transactions(account_id);
CREATE INDEX idx_transactions_date ON transactions(transaction_date DESC);
CREATE INDEX idx_bank_accounts_user_id ON bank_accounts(user_id);
CREATE INDEX idx_community_members_user_id ON community_members(user_id);
CREATE INDEX idx_notifications_user_id ON notifications(user_id, is_read);
CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id, created_at DESC);

-- ============================================
-- SEED DATA
-- ============================================
INSERT INTO users (id, email, username, password_hash, full_name, role, is_verified) VALUES
  ('00000000-0000-0000-0000-000000000001', 'admin@communityfinance.id', 'admin', '$2b$12$rnbHxuc.3T2JRR0HU2I/CO.59Dkcn5juAyHYeRqRO8Gu1gsQ2Oa.G', 'Administrator', 'admin', true),
  ('00000000-0000-0000-0000-000000000002', 'budi@example.com', 'budi_santoso', '$2b$12$rnbHxuc.3T2JRR0HU2I/CO.59Dkcn5juAyHYeRqRO8Gu1gsQ2Oa.G', 'Budi Santoso', 'member', true),
  ('00000000-0000-0000-0000-000000000003', 'siti@example.com', 'siti_rahayu', '$2b$12$rnbHxuc.3T2JRR0HU2I/CO.59Dkcn5juAyHYeRqRO8Gu1gsQ2Oa.G', 'Siti Rahayu', 'member', true);

-- Password for all: password123

INSERT INTO communities (id, name, slug, description, community_type, is_public, created_by) VALUES
  ('00000000-0000-0000-0000-000000000010', 'Arisan RT 05', 'arisan-rt-05', 'Arisan warga RT 05 Kelurahan Merdeka', 'arisan', true, '00000000-0000-0000-0000-000000000001'),
  ('00000000-0000-0000-0000-000000000011', 'Koperasi Simpan Pinjam Bersama', 'ksp-bersama', 'Koperasi simpan pinjam untuk warga', 'koperasi', true, '00000000-0000-0000-0000-000000000001'),
  ('00000000-0000-0000-0000-000000000012', 'Club Investasi Muda', 'investasi-muda', 'Komunitas investasi untuk generasi muda', 'investment_club', true, '00000000-0000-0000-0000-000000000002');

UPDATE users SET updated_at = NOW();

-- ============================================
-- JOB QUEUE (pengganti RabbitMQ)
-- ============================================
CREATE TABLE IF NOT EXISTS job_queue (
  id           BIGSERIAL    PRIMARY KEY,
  type         VARCHAR(60)  NOT NULL,
  payload      JSONB        NOT NULL DEFAULT '{}',
  status       VARCHAR(20)  NOT NULL DEFAULT 'pending'
                 CHECK (status IN ('pending','processing','done','failed')),
  priority     SMALLINT     NOT NULL DEFAULT 5,
  attempts     SMALLINT     NOT NULL DEFAULT 0,
  last_error   TEXT,
  run_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  started_at   TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_job_queue_pending
  ON job_queue (priority ASC, run_at ASC)
  WHERE status = 'pending';

-- Grant permissions to cfuser
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO cfuser;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO cfuser;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO cfuser;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO cfuser;
