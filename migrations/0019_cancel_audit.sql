-- Cancel + audit trail. Reuses the existing `status` text column on
-- invoices/sales_orders/purchase_orders/supplier_bills — several reads
-- already defensively filter `status <> 'cancelled'` even though nothing
-- ever set it; this wires that up for real. cash_movements has no status
-- column at all, so cancelled_at itself is the flag there.

alter table invoices add column if not exists cancelled_at timestamptz;
alter table invoices add column if not exists cancelled_by text;
alter table invoices add column if not exists cancel_reason text;

alter table sales_orders add column if not exists cancelled_at timestamptz;
alter table sales_orders add column if not exists cancelled_by text;
alter table sales_orders add column if not exists cancel_reason text;

alter table purchase_orders add column if not exists cancelled_at timestamptz;
alter table purchase_orders add column if not exists cancelled_by text;
alter table purchase_orders add column if not exists cancel_reason text;

alter table supplier_bills add column if not exists cancelled_at timestamptz;
alter table supplier_bills add column if not exists cancelled_by text;
alter table supplier_bills add column if not exists cancel_reason text;

alter table cash_movements add column if not exists cancelled_at timestamptz;
alter table cash_movements add column if not exists cancelled_by text;
alter table cash_movements add column if not exists cancel_reason text;
