-- Letterhead, pack-outs, bank rec, send log, settings, staff, departments.

create table if not exists company_profile (
  id integer primary key default 1 check (id = 1),
  legal_name text not null default 'Plein Produce LLC',
  short_name text not null default 'Plein',
  tagline text not null default 'Fresh produce',
  city text not null default 'Nogales, Arizona',
  country text not null default 'USA',
  email text,
  phone text,
  address_line text,
  paca_license text,
  paca_notice text,
  updated_at timestamptz not null default now()
);

insert into company_profile (id, legal_name, short_name, tagline, city, country, email, phone, address_line, paca_license, paca_notice)
values (
  1,
  'Plein Produce LLC',
  'Plein',
  'Fresh produce',
  'Nogales, Arizona',
  'USA',
  'juan@pleinproduce.com',
  '520-555-0140',
  'Nogales, Arizona, USA',
  '',
  'The perishable agricultural commodities listed on this invoice are sold subject to the statutory trust authorized by section 5(c) of the Perishable Agricultural Commodities Act, 1930 (7 U.S.C. 499e(c)). The seller of these commodities retains a trust claim over these commodities, all inventories of food or other products derived from these commodities, and any receivables or proceeds from the sale of these commodities until full payment is received.'
)
on conflict (id) do nothing;

create table if not exists app_settings (
  key text primary key,
  value text not null
);

insert into app_settings (key, value) values
  ('print_po_on_place', 'false'),
  ('share_vendor_portal', 'true'),
  ('auto_fulfill', 'true'),
  ('paca_on_invoices', 'true'),
  ('default_terms_days', '0'),
  ('expenses_in_breakeven', 'true'),
  ('online_ordering', 'false'),
  ('require_cpo', 'false')
on conflict (key) do nothing;

create table if not exists departments (
  id serial primary key,
  name text not null unique
);

insert into departments (name)
select 'Uncategorized'
where not exists (select 1 from departments where name = 'Uncategorized');

create table if not exists staff (
  id serial primary key,
  user_id text unique,
  name text not null,
  email text,
  role text not null default 'admin',
  perms jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

insert into staff (name, email, role)
select 'Juan Mercado', 'juan@pleinproduce.com', 'admin'
where not exists (select 1 from staff where email = 'juan@pleinproduce.com');

create table if not exists pack_outs (
  id serial primary key,
  pack_number text not null unique,
  pack_date date not null,
  location_id integer references locations(id),
  notes text,
  created_by text,
  created_at timestamptz not null default now()
);

create table if not exists pack_out_lines (
  id serial primary key,
  pack_out_id integer not null references pack_outs(id) on delete cascade,
  direction text not null check (direction in ('in', 'out')),
  lot_id integer references lots(id),
  product_id integer references products(id),
  pack_style_id integer references pack_styles(id),
  qty numeric(14, 3) not null,
  unit text not null,
  unit_cost numeric(12, 4)
);

create table if not exists bank_accounts (
  id serial primary key,
  name text not null,
  bank_name text,
  last4 text,
  opening_balance numeric(14, 2) not null default 0,
  is_active boolean not null default true
);

insert into bank_accounts (name, bank_name, last4, opening_balance)
select 'Operating', 'Wells Fargo', '4410', 0
where not exists (select 1 from bank_accounts);

create table if not exists bank_lines (
  id serial primary key,
  bank_account_id integer not null references bank_accounts(id),
  line_date date not null,
  description text not null,
  amount numeric(14, 2) not null,
  cash_movement_id integer references cash_movements(id),
  status text not null default 'open',
  created_at timestamptz not null default now()
);

create table if not exists send_events (
  id serial primary key,
  channel text not null,
  doc_tipo text,
  doc_id integer,
  doc_number text,
  party_name text,
  address text,
  created_by text,
  created_at timestamptz not null default now()
);

alter table sales_orders add column if not exists created_by text;
alter table purchase_orders add column if not exists created_by text;
alter table lots add column if not exists pack_out_id integer references pack_outs(id);
