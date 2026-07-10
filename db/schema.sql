-- PaySupport schema
-- A support-engineering-flavored fintech domain: accounts, cards, transactions
-- that flow through an external vendor (card/ACH processor), support tickets,
-- an audit trail, and a table for reconciliation findings.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Internal support staff (not customers). Roles gate write access.
CREATE TABLE users (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email         TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role          TEXT NOT NULL DEFAULT 'support' CHECK (role IN ('support', 'engineer', 'admin')),
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE accounts (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_name TEXT NOT NULL,
    email         TEXT NOT NULL UNIQUE,
    account_type  TEXT NOT NULL CHECK (account_type IN ('checking', 'savings', 'credit')),
    balance_cents BIGINT NOT NULL DEFAULT 0,
    status        TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'frozen', 'closed')),
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE cards (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id  UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    last4       CHAR(4) NOT NULL,
    network     TEXT NOT NULL CHECK (network IN ('visa', 'mastercard', 'amex')),
    status      TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'locked', 'expired')),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Every transaction is mirrored at a vendor (card network / ACH rail).
-- vendor_ref_id + vendor_status are OUR last known copy of vendor state;
-- the reconciliation engine re-queries the vendor live and diffs against this.
CREATE TABLE transactions (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id     UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    card_id        UUID REFERENCES cards(id) ON DELETE SET NULL,
    type           TEXT NOT NULL CHECK (type IN ('card_purchase', 'ach_credit', 'ach_debit', 'transfer')),
    amount_cents   BIGINT NOT NULL,
    currency       CHAR(3) NOT NULL DEFAULT 'USD',
    status         TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'settled', 'failed', 'disputed')),
    vendor_ref_id  TEXT,
    vendor_status  TEXT,
    description    TEXT,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    settled_at     TIMESTAMPTZ
);

CREATE INDEX idx_transactions_account_id ON transactions(account_id);
CREATE INDEX idx_transactions_status ON transactions(status);
CREATE INDEX idx_transactions_vendor_ref_id ON transactions(vendor_ref_id);

CREATE TABLE support_tickets (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id     UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    transaction_id UUID REFERENCES transactions(id) ON DELETE SET NULL,
    subject        TEXT NOT NULL,
    description    TEXT,
    status         TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'investigating', 'resolved')),
    assigned_to    UUID REFERENCES users(id),
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    resolved_at    TIMESTAMPTZ
);

CREATE INDEX idx_tickets_status ON support_tickets(status);
CREATE INDEX idx_tickets_account_id ON support_tickets(account_id);

-- Append-only trail of everything a support/engineering action touched.
CREATE TABLE audit_log (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    actor       TEXT NOT NULL, -- user id (as text) or 'system'
    action      TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id   TEXT NOT NULL,
    details     JSONB,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_audit_log_entity ON audit_log(entity_type, entity_id);

-- Findings produced by the reconciliation engine when internal state
-- and vendor state disagree on a transaction.
CREATE TABLE reconciliation_discrepancies (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transaction_id        UUID NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
    discrepancy_type      TEXT NOT NULL CHECK (discrepancy_type IN ('status_mismatch', 'amount_mismatch', 'vendor_not_found')),
    internal_status        TEXT,
    vendor_status          TEXT,
    internal_amount_cents  BIGINT,
    vendor_amount_cents    BIGINT,
    resolved              BOOLEAN NOT NULL DEFAULT false,
    created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_discrepancies_resolved ON reconciliation_discrepancies(resolved);
