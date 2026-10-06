-- Seed data for local development / demoing the API.
-- Demo staff logins, one per role, all with password: password123
--   admin@paysupport.dev     admin
--   engineer@paysupport.dev  engineer  (can run reconciliation sweeps)
--   support@paysupport.dev   support   (read-only: diagnose and view discrepancies)
-- All three share one precomputed bcrypt hash of "password123". Demo-only
-- credentials: never reuse this hash or password outside local development.

INSERT INTO users (id, email, password_hash, role) VALUES
    ('11111111-1111-1111-1111-111111111111', 'admin@paysupport.dev',    '$2a$10$9W7BWrkUCiTXF4EpXvbUZ.14.0W3zH0RT9lQn/MkTYv8IsqKQpbFC', 'admin'),
    ('11111111-1111-1111-1111-111111111112', 'engineer@paysupport.dev', '$2a$10$9W7BWrkUCiTXF4EpXvbUZ.14.0W3zH0RT9lQn/MkTYv8IsqKQpbFC', 'engineer'),
    ('11111111-1111-1111-1111-111111111113', 'support@paysupport.dev',  '$2a$10$9W7BWrkUCiTXF4EpXvbUZ.14.0W3zH0RT9lQn/MkTYv8IsqKQpbFC', 'support');

INSERT INTO accounts (id, customer_name, email, account_type, balance_cents, status) VALUES
    ('a1111111-0000-0000-0000-000000000001', 'Jordan Reyes',  'jordan.reyes@example.com',  'checking', 254300, 'active'),
    ('a1111111-0000-0000-0000-000000000002', 'Priya Natarajan', 'priya.n@example.com',     'savings',  980000, 'active'),
    ('a1111111-0000-0000-0000-000000000003', 'Marcus Webb',   'marcus.webb@example.com',   'credit',   -12050, 'active'),
    ('a1111111-0000-0000-0000-000000000004', 'Elena Cho',     'elena.cho@example.com',     'checking', 3200,   'frozen');

INSERT INTO cards (id, account_id, last4, network, status) VALUES
    ('c1111111-0000-0000-0000-000000000001', 'a1111111-0000-0000-0000-000000000001', '4242', 'visa', 'active'),
    ('c1111111-0000-0000-0000-000000000002', 'a1111111-0000-0000-0000-000000000003', '5100', 'mastercard', 'active'),
    ('c1111111-0000-0000-0000-000000000003', 'a1111111-0000-0000-0000-000000000004', '3782', 'amex', 'locked');

-- Transactions intentionally include ones whose vendor_ref_id matches a
-- transaction the vendor mock knows about (so /diagnose has something to
-- compare against), and one with no vendor_ref_id (vendor_not_found case).
INSERT INTO transactions (id, account_id, card_id, type, amount_cents, status, vendor_ref_id, vendor_status, description, created_at) VALUES
    ('e1111111-0000-0000-0000-000000000001', 'a1111111-0000-0000-0000-000000000001', 'c1111111-0000-0000-0000-000000000001', 'card_purchase', 4599, 'settled', 'vtx_1001', 'settled', 'Coffee shop purchase', now() - interval '2 days'),
    ('e1111111-0000-0000-0000-000000000002', 'a1111111-0000-0000-0000-000000000002', NULL, 'ach_credit', 500000, 'pending', 'vtx_1002', 'pending', 'Payroll deposit', now() - interval '1 day'),
    ('e1111111-0000-0000-0000-000000000003', 'a1111111-0000-0000-0000-000000000003', 'c1111111-0000-0000-0000-000000000002', 'card_purchase', 12050, 'settled', 'vtx_1003', 'settled', 'Electronics store', now() - interval '5 days'),
    ('e1111111-0000-0000-0000-000000000004', 'a1111111-0000-0000-0000-000000000004', NULL, 'ach_debit', 7500, 'failed', NULL, NULL, 'Rent auto-pay (account frozen)', now() - interval '3 hours'),
    ('e1111111-0000-0000-0000-000000000005', 'a1111111-0000-0000-0000-000000000001', 'c1111111-0000-0000-0000-000000000001', 'transfer', 20000, 'pending', 'vtx_1005', 'settled', 'Transfer to savings', now() - interval '10 hours');

INSERT INTO support_tickets (id, account_id, transaction_id, subject, description, status, assigned_to) VALUES
    ('d1111111-0000-0000-0000-000000000001', 'a1111111-0000-0000-0000-000000000004', 'e1111111-0000-0000-0000-000000000004', 'Customer disputes failed rent payment', 'Customer says account should not be frozen; rent auto-pay failed.', 'open', NULL),
    ('d1111111-0000-0000-0000-000000000002', 'a1111111-0000-0000-0000-000000000001', 'e1111111-0000-0000-0000-000000000005', 'Transfer shows pending 10h+', 'Customer reports internal transfer to savings still pending.', 'investigating', '11111111-1111-1111-1111-111111111111');
