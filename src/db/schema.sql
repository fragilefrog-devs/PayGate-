-- ============================================================================
-- PayGate Platform v3.1 — Production Database Schema Reference
-- For Supabase migrations, see: supabase/migrations/20261013000001_paygate_v3_core_schema.sql
-- ============================================================================

-- Core Enums
CREATE TYPE provider_type AS ENUM ('bkash', 'nagad', 'rocket');
CREATE TYPE payment_status AS ENUM ('created', 'awaiting_payment', 'confirming', 'paid', 'expired', 'cancelled', 'needs_review');
CREATE TYPE review_reason AS ENUM ('underpaid', 'overpaid', 'wrong_wallet', 'late_after_expiry', 'duplicate_trx_id', 'unmatched_reference', 'manual_hold');
CREATE TYPE kyb_status AS ENUM ('pending', 'verified', 'rejected', 'under_review');
CREATE TYPE payout_status AS ENUM ('pending', 'approved', 'rejected', 'completed');
CREATE TYPE payout_account_type AS ENUM ('bank', 'mfs');
CREATE TYPE device_status AS ENUM ('online', 'offline', 'draining', 'revoked');
CREATE TYPE wallet_status AS ENUM ('active', 'draining', 'disabled', 'limit_reached');
CREATE TYPE ledger_entry_type AS ENUM ('payin_credit', 'platform_fee_debit', 'payout_debit', 'reversal_debit', 'adjustment');

-- Merchants
CREATE TABLE merchants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'active',
  kyb_status kyb_status NOT NULL DEFAULT 'verified',
  payout_type payout_account_type NOT NULL DEFAULT 'bank',
  payout_account_number VARCHAR(64) NOT NULL,
  payout_account_name VARCHAR(255) NOT NULL,
  payout_bank_name VARCHAR(128),
  payout_routing_number VARCHAR(32),
  fee_rate_bps INT NOT NULL DEFAULT 500, -- 5.00%
  risk_tier VARCHAR(32) NOT NULL DEFAULT 'tier_1',
  live_api_key VARCHAR(128) NOT NULL UNIQUE,
  test_api_key VARCHAR(128) NOT NULL UNIQUE,
  webhook_secret VARCHAR(128) NOT NULL,
  webhook_url TEXT,
  auto_confirm_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Pricing Plans (Server-Authoritative in Paisa)
CREATE TABLE pricing_plans (
  id VARCHAR(64) PRIMARY KEY,
  merchant_id UUID NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  amount_paisa BIGINT NOT NULL CHECK (amount_paisa > 0),
  currency VARCHAR(3) NOT NULL DEFAULT 'BDT',
  version INT NOT NULL DEFAULT 1,
  external_sku VARCHAR(64) NOT NULL,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_merchant_sku_version UNIQUE (merchant_id, external_sku, version)
);

-- Payments (Core Transaction Claim)
CREATE TABLE payments (
  id VARCHAR(64) PRIMARY KEY,
  merchant_id UUID NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
  plan_id VARCHAR(64) NOT NULL REFERENCES pricing_plans(id),
  plan_snapshot JSONB NOT NULL,
  order_id VARCHAR(128) NOT NULL,
  customer_phone VARCHAR(24),
  amount_paisa BIGINT NOT NULL CHECK (amount_paisa > 0),
  fee_amount_paisa BIGINT NOT NULL,
  net_amount_paisa BIGINT NOT NULL,
  provider provider_type NOT NULL,
  assigned_wallet_id VARCHAR(64) NOT NULL,
  reference VARCHAR(8) NOT NULL UNIQUE,
  status payment_status NOT NULL DEFAULT 'awaiting_payment',
  submitted_trx_id VARCHAR(64),
  submitted_at TIMESTAMPTZ,
  matched_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ NOT NULL,
  review_reason review_reason,
  review_notes TEXT,
  idempotency_key VARCHAR(128),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Incoming Transactions (Forwarded SMS Ingest)
CREATE TABLE incoming_txns (
  id VARCHAR(64) PRIMARY KEY,
  device_id VARCHAR(64) NOT NULL,
  sim_slot INT NOT NULL,
  sender_address VARCHAR(64) NOT NULL,
  raw_sms_body TEXT NOT NULL,
  provider provider_type NOT NULL,
  trx_id VARCHAR(64) NOT NULL UNIQUE,
  amount_paisa BIGINT NOT NULL,
  ref_raw VARCHAR(128),
  ref_normalized VARCHAR(8),
  counterparty_msisdn VARCHAR(24),
  received_at TIMESTAMPTZ NOT NULL,
  matched_payment_id VARCHAR(64) REFERENCES payments(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Ledger Entries (Double-Entry Bookkeeping)
CREATE TABLE ledger_entries (
  id VARCHAR(64) PRIMARY KEY,
  merchant_id UUID NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
  payment_id VARCHAR(64) REFERENCES payments(id),
  payout_id VARCHAR(64),
  type ledger_entry_type NOT NULL,
  debit_paisa BIGINT NOT NULL DEFAULT 0,
  credit_paisa BIGINT NOT NULL DEFAULT 0,
  balance_paisa_after BIGINT NOT NULL,
  description TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Payouts
CREATE TABLE payouts (
  id VARCHAR(64) PRIMARY KEY,
  merchant_id UUID NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
  reference_id VARCHAR(64) NOT NULL UNIQUE,
  amount_paisa BIGINT NOT NULL CHECK (amount_paisa >= 100000), -- Tk 1,000 threshold
  destination_account JSONB NOT NULL,
  status payout_status NOT NULL DEFAULT 'pending',
  maker_id VARCHAR(128) NOT NULL,
  checker_id VARCHAR(128),
  requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  approved_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ
);
