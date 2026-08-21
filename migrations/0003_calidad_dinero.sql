-- Camino C: calidad PACA + facturación + CxC/CxP + tesorería

alter table lots add column if not exists quality_state text not null default 'sano';
alter table lots add column if not exists quality_note text;

update lots set quality_state = 'retenido', quality_note = 'Aceptada con incidencia — deshidratación en arribo'
where lot_number = 'LOT-2608-004' and quality_state = 'sano';

create table if not exists receptions (
  id serial primary key,
  purchase_order_id integer not null references purchase_orders(id),
  received_date date not null default current_date,
  inspection_type text not null default 'Ninguna',
  inspection_folio text,
  unloaded boolean not null default true,
  notes text,
  warning text,
  created_at timestamptz not null default now()
);

create table if not exists reception_lines (
  id serial primary key,
  reception_id integer not null references receptions(id) on delete cascade,
  purchase_order_line_id integer not null references purchase_order_lines(id),
  result text not null,
  quantity numeric(14, 3) not null,
  affected_qty numeric(14, 3),
  defect_type text,
  defect_reason text,
  lot_sano_id integer references lots(id),
  lot_retenido_id integer references lots(id),
  notes text
);

create table if not exists invoices (
  id serial primary key,
  invoice_number text not null unique,
  sales_order_id integer references sales_orders(id),
  customer_id integer not null references customers(id),
  status text not null default 'open',
  issue_date date not null default current_date,
  due_date date,
  subtotal numeric(14, 2) not null default 0,
  total numeric(14, 2) not null default 0,
  paid numeric(14, 2) not null default 0,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists invoice_lines (
  id serial primary key,
  invoice_id integer not null references invoices(id) on delete cascade,
  product_id integer references products(id),
  description text,
  quantity numeric(14, 3) not null,
  unit text,
  unit_price numeric(12, 4),
  amount numeric(14, 2) not null
);

create table if not exists supplier_bills (
  id serial primary key,
  bill_number text not null unique,
  purchase_order_id integer references purchase_orders(id),
  supplier_id integer not null references suppliers(id),
  status text not null default 'open',
  issue_date date not null default current_date,
  due_date date,
  ordered_qty numeric(14, 3) not null default 0,
  received_qty numeric(14, 3) not null default 0,
  total numeric(14, 2) not null default 0,
  paid numeric(14, 2) not null default 0,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists cash_movements (
  id serial primary key,
  folio text not null unique,
  mov_date date not null default current_date,
  kind text not null,
  counterparty text,
  invoice_id integer references invoices(id),
  supplier_bill_id integer references supplier_bills(id),
  amount numeric(14, 2) not null,
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists invoices_customer_idx on invoices (customer_id);
create index if not exists invoices_status_idx on invoices (status);
create index if not exists bills_supplier_idx on supplier_bills (supplier_id);
create index if not exists cash_date_idx on cash_movements (mov_date);

-- Catálogo Plein-like (aditivo, no pisa el seed previo)
insert into products (id, sku, name, variety, category, default_unit) values
  (6, 'PAP-MARA', 'Papaya', 'Maradol', 'Fruta', 'caja'),
  (7, 'ESP-ORG', 'Espárrago', 'Orgánico', 'Verdura', 'caja')
on conflict (sku) do nothing;

insert into pack_styles (id, product_id, name, unit_of_measure, net_weight, weight_unit, is_default) values
  (7, 6, 'Caja 35 lb', 'caja', 15.88, 'kg', true),
  (8, 7, 'Caja 11 lb', 'caja', 5.00, 'kg', true)
on conflict do nothing;

insert into suppliers (id, code, name, contact_name, phone, city, country, notes) values
  (4, 'PRO-004', 'Papayas & More', 'Samuel Ibarra', '520-300-3028', 'Nogales', 'México', 'Maradol / Tainung'),
  (5, 'PRO-005', 'Agrícola Omega', 'Juan Mercado', '667-100-2000', 'Culiacán', 'México', 'Espárrago y coles')
on conflict (code) do nothing;

insert into customers (id, code, name, contact_name, phone, city, payment_terms) values
  (4, 'CLI-004', 'Northgate Markets', 'Compras produce', '714-200-1100', 'Anaheim', 'Net 21'),
  (5, 'CLI-005', 'Crystal Valley', 'Accounts payable', '956-200-3300', 'McAllen', 'Net 14')
on conflict (code) do nothing;

insert into purchase_orders (id, po_number, supplier_id, status, order_date, expected_date, notes) values
  (3, 'OC-2608-022', 4, 'confirmed', '2026-08-18', '2026-08-21', 'Maradol semana 34 — pendiente de recepción con calidad')
on conflict (po_number) do nothing;

insert into purchase_order_lines (purchase_order_id, product_id, pack_style_id, quantity_ordered, quantity_received, unit, unit_cost)
select 3, 6, 7, 1100, 0, 'caja', 9.50
where not exists (
  select 1 from purchase_order_lines where purchase_order_id = 3 and product_id = 6
);

insert into sales_orders (id, so_number, customer_id, status, order_date, notes) values
  (3, 'OV-2608-060', 4, 'confirmed', '2026-08-18', 'PO cliente NGM238314 — papaya Maradol')
on conflict (so_number) do nothing;

insert into sales_order_lines (sales_order_id, product_id, quantity_ordered, quantity_shipped, unit, unit_price)
select 3, 6, 800, 0, 'caja', 14.00
where not exists (
  select 1 from sales_order_lines where sales_order_id = 3 and product_id = 6
);

-- Dinero de lo ya operado
insert into invoices (id, invoice_number, sales_order_id, customer_id, status, issue_date, due_date, subtotal, total, paid, notes) values
  (1, 'PP-2026-0001', 1, 1, 'partial', '2026-08-15', '2026-08-22', 1488.00, 1488.00, 800.00, 'Pedido semanal Mercado Central')
on conflict (invoice_number) do nothing;

insert into invoice_lines (invoice_id, product_id, description, quantity, unit, unit_price, amount)
select 1, 1, 'Aguacate Hass · Caja 10 kg', 60, 'caja', 24.80, 1488.00
where not exists (select 1 from invoice_lines where invoice_id = 1);

insert into supplier_bills (id, bill_number, purchase_order_id, supplier_id, status, issue_date, due_date, ordered_qty, received_qty, total, paid, notes) values
  (1, 'FAC-HA-011', 1, 1, 'partial', '2026-08-12', '2026-08-19', 240, 240, 4440.00, 2000.00, 'Hass semana 33')
on conflict (bill_number) do nothing;

insert into cash_movements (id, folio, mov_date, kind, counterparty, invoice_id, supplier_bill_id, amount, notes) values
  (1, 'MOV-001', '2026-08-01', 'ajuste', 'Chase JPM', null, null, 15000.00, 'Saldo inicial de caja'),
  (2, 'MOV-002', '2026-08-16', 'cobro', 'Mercado Central Norte', 1, null, 800.00, 'Abono PP-2026-0001'),
  (3, 'MOV-003', '2026-08-17', 'pago', 'Huerta Los Álamos', null, 1, -2000.00, 'Abono FAC-HA-011')
on conflict (folio) do nothing;

select setval('products_id_seq', (select max(id) from products));
select setval('pack_styles_id_seq', (select max(id) from pack_styles));
select setval('suppliers_id_seq', (select max(id) from suppliers));
select setval('customers_id_seq', (select max(id) from customers));
select setval('purchase_orders_id_seq', (select max(id) from purchase_orders));
select setval('sales_orders_id_seq', (select max(id) from sales_orders));
select setval('invoices_id_seq', (select coalesce(max(id), 1) from invoices));
select setval('supplier_bills_id_seq', (select coalesce(max(id), 1) from supplier_bills));
select setval('cash_movements_id_seq', (select coalesce(max(id), 1) from cash_movements));
