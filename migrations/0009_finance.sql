-- Chart of accounts, payables mix (PO + EXP), credits, payment applications.

alter table expenses add column if not exists due_date date;
alter table expenses add column if not exists account_number text;
update expenses set due_date = issue_date where due_date is null;

alter table purchase_orders add column if not exists paid numeric(12, 2) not null default 0;

alter table invoices add column if not exists invoice_type text not null default 'sale';
alter table invoices add column if not exists parent_invoice_id integer references invoices(id);
alter table invoices add column if not exists sales_rep text;

create table if not exists gl_accounts (
  id serial primary key,
  number text not null unique,
  name text not null,
  description text,
  statement text not null,
  kind text not null,
  subtype text,
  parent_number text,
  tracking_start date not null default current_date,
  starting_balance numeric(14, 2) not null default 0,
  sort_order integer not null default 0,
  is_active boolean not null default true
);

create table if not exists gl_mappings (
  map_key text primary key,
  account_number text not null
);

create table if not exists expense_po_links (
  expense_id integer not null references expenses(id) on delete cascade,
  purchase_order_id integer not null references purchase_orders(id) on delete cascade,
  amount_applied numeric(12, 2) not null default 0,
  primary key (expense_id, purchase_order_id)
);

create table if not exists payment_applications (
  id serial primary key,
  cash_movement_id integer references cash_movements(id) on delete cascade,
  kind text not null,
  target_kind text not null,
  target_id integer not null,
  amount numeric(12, 2) not null,
  created_at timestamptz not null default now()
);

create index if not exists pay_app_mov_idx on payment_applications (cash_movement_id);

insert into gl_accounts (number, name, description, statement, kind, subtype, parent_number, tracking_start, starting_balance, sort_order) values
  ('40000', 'Sales Revenue', 'All income from sales orders', 'income', 'revenue', 'Revenue', null, '2025-09-01', 0, 10),
  ('40001', 'Rebate', 'Rebates for Customers', 'income', 'revenue', 'Revenue', '40000', '2025-10-21', 0, 11),
  ('40002', 'Uncollected Credits', null, 'income', 'revenue', 'Revenue', null, '2026-05-01', 0, 12),
  ('50000', 'Cost of Goods Sold', 'COGS from all food sales & purchases', 'income', 'cogs', 'COGS', null, '2025-10-01', 0, 20),
  ('50001', 'Rebate', null, 'income', 'cogs', 'COGS', '50000', '2025-10-21', 0, 21),
  ('51000', 'Freight', null, 'income', 'expense', 'Freight Expenses', null, '2025-07-01', 0, 30),
  ('51001', 'Pallet Charges', 'Charges for Pallets', 'income', 'expense', 'Freight Expenses', '51000', '2025-10-17', 0, 31),
  ('52000', 'Return to Vendor', null, 'income', 'expense', 'Return to Vendor Expenses', null, '2025-10-01', 0, 32),
  ('53000', 'Supplies', null, 'income', 'expense', 'Expense', null, '2025-10-03', 0, 33),
  ('54000', 'Utilities', null, 'income', 'expense', 'Expense', null, '2025-10-03', 0, 34),
  ('54001', 'Power', null, 'income', 'expense', 'Expense', '54000', '2025-10-10', 0, 35),
  ('55000', 'Insurances', null, 'income', 'expense', 'Expense', null, '2025-10-03', 0, 36),
  ('59999', 'General Expenses', 'Catch-all operating expenses', 'income', 'expense', 'Expense', null, '2025-10-01', 0, 39),
  ('12000', 'Accounts Receivable', null, 'balance', 'asset', 'Current > AR', null, '2025-10-01', 0, 50),
  ('13000', 'Inventory Assets', null, 'balance', 'asset', 'Current > Inventory', null, '2025-10-01', 0, 51),
  ('14000', 'CASH', null, 'balance', 'asset', 'Current > Bank', null, '2025-10-06', 0, 52),
  ('16000', 'My Bank', 'Main operating account', 'balance', 'asset', 'Current > Bank', null, '2025-11-13', 15000, 53),
  ('12900', 'Bounced Check Clearing Account', 'Used for Balancing Bounced Checks', 'balance', 'asset', 'Other Assets', null, '2025-11-17', 0, 54),
  ('16100', 'AP/AR Offset', 'Account to record balancing A/P vs A/R', 'balance', 'asset', 'Current > Bank', null, '2025-11-18', 0, 55),
  ('16900', 'Customer Rebates', null, 'balance', 'asset', 'Current > Bank', null, '2026-02-19', 0, 56),
  ('20100', 'Accounts Payable', null, 'balance', 'liability', 'Current > AP', null, '2025-07-01', 0, 70),
  ('20200', 'Credit Card', null, 'balance', 'liability', 'Current > Credit Card', null, '2025-11-14', 0, 71),
  ('39999', 'Starting Inventory', null, 'balance', 'equity', 'Equity', null, '2025-10-31', 0, 80),
  ('30000', 'Starting Equity', null, 'balance', 'equity', 'Equity', null, '2025-11-13', 15000, 81)
on conflict (number) do nothing;

insert into gl_mappings (map_key, account_number) values
  ('ap', '20100'),
  ('ar', '12000'),
  ('bank_collections', '16000'),
  ('bank_billpay', '16000'),
  ('revenue', '40000'),
  ('cogs', '50000'),
  ('Freight', '51000'),
  ('Inspection Services', '59999'),
  ('Quality Control', '59999'),
  ('Advertising', '59999'),
  ('Commissions and fees', '59999'),
  ('Cost of Labor', '50000'),
  ('Disposal fees', '59999'),
  ('Dues & Subscriptions', '53000'),
  ('Equipment', '53000'),
  ('Boxes', '53000'),
  ('Supplies', '53000'),
  ('Insurance', '55000'),
  ('Legal & Professional fees', '55000')
on conflict (map_key) do nothing;

insert into expense_po_links (expense_id, purchase_order_id, amount_applied)
select e.id, e.purchase_order_id, e.amount
from expenses e
where e.purchase_order_id is not null
  and not exists (
    select 1 from expense_po_links x
    where x.expense_id = e.id and x.purchase_order_id = e.purchase_order_id
  );

insert into invoices (invoice_number, customer_id, status, issue_date, due_date, subtotal, total, paid, notes, invoice_type, sales_rep)
select 'PP-2026-CR-001', c.id, 'open', '2026-06-08', null, -350, -350, 0, 'Credit — Papaya Maradol quality', 'credit', 'Juan Mercado'
from customers c
where c.name = 'Northgate Markets'
  and not exists (select 1 from invoices where invoice_number = 'PP-2026-CR-001');

select setval('gl_accounts_id_seq', (select coalesce(max(id), 1) from gl_accounts));
select setval('invoices_id_seq', (select coalesce(max(id), 1) from invoices));
