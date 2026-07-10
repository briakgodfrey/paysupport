export type UserRole = "support" | "engineer" | "admin";

export interface AuthUser {
  id: string;
  email: string;
  role: UserRole;
}

export interface Account {
  id: string;
  customer_name: string;
  email: string;
  account_type: "checking" | "savings" | "credit";
  balance_cents: number;
  status: "active" | "frozen" | "closed";
  created_at: string;
}

export interface Card {
  id: string;
  account_id: string;
  last4: string;
  network: "visa" | "mastercard" | "amex";
  status: "active" | "locked" | "expired";
  created_at: string;
}

export type TransactionType = "card_purchase" | "ach_credit" | "ach_debit" | "transfer";
export type TransactionStatus = "pending" | "settled" | "failed" | "disputed";

export interface Transaction {
  id: string;
  account_id: string;
  card_id: string | null;
  type: TransactionType;
  amount_cents: number;
  currency: string;
  status: TransactionStatus;
  vendor_ref_id: string | null;
  vendor_status: string | null;
  description: string | null;
  created_at: string;
  settled_at: string | null;
}

export interface SupportTicket {
  id: string;
  account_id: string;
  transaction_id: string | null;
  subject: string;
  description: string | null;
  status: "open" | "investigating" | "resolved";
  assigned_to: string | null;
  created_at: string;
  resolved_at: string | null;
}

export interface VendorTransaction {
  vendorRefId: string;
  status: "pending" | "settled" | "failed";
  amountCents: number;
  network: string;
  updatedAt: string;
}

export interface Discrepancy {
  id: string;
  transaction_id: string;
  discrepancy_type: "status_mismatch" | "amount_mismatch" | "vendor_not_found";
  internal_status: string | null;
  vendor_status: string | null;
  internal_amount_cents: number | null;
  vendor_amount_cents: number | null;
  resolved: boolean;
  created_at: string;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}
