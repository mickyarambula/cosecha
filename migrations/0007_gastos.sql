-- Gastos / cargos no-inventario ligados a la OC (flete, cajas, inspección).

alter table purchase_orders add column if not exists order_type text not null default 'entrega';
alter table purchase_orders add column if not exists bol text;
alter table purchase_orders add column if not exists vendor_invoice text;
alter table purchase_orders add column if not exists shipping_ref text;

alter table purchase_order_lines add column if not exists pallets numeric(12, 2);
alter table purchase_order_lines add column if not exists units_per_pallet numeric(12, 2);
alter table purchase_order_lines add column if not exists origin_country text;

create table if not exists expenses (
  id serial primary key,
  expense_number text not null unique,
  category text not null,
  supplier_id integer not null references suppliers(id),
  purchase_order_id integer references purchase_orders(id),
  quantity numeric(14, 3),
  unit_cost numeric(12, 4),
  amount numeric(12, 2) not null,
  invoice_number text,
  payable boolean not null default true,
  status text not null default 'open',
  issue_date date not null default current_date,
  paid numeric(12, 2) not null default 0,
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists exp_po_idx on expenses (purchase_order_id);
create index if not exists exp_sup_idx on expenses (supplier_id);
create index if not exists exp_status_idx on expenses (status);

alter table cash_movements add column if not exists expense_id integer references expenses(id);


insert into suppliers (id, code, name, contact_name, phone, city, country, notes, es_proveedor, es_cliente)
values (6, 'PRO-006', 'Carrifoods USA Corp', 'AP', '956-400-1000', 'McAllen', 'USA', 'Inspección y servicios', true, true)
on conflict (code) do nothing;

insert into customers (code, name, contact_name, phone, city, payment_terms, linked_supplier_id, es_proveedor, es_cliente)
select 'CLI-009', 'Carrifoods USA Corp', 'AP', '956-400-1000', 'McAllen', 'Net 14', s.id, true, true
from suppliers s where s.code = 'PRO-006'
  and not exists (select 1 from customers where name = 'Carrifoods USA Corp');

insert into customers (code, name, contact_name, phone, city, payment_terms, es_cliente)
select 'CLI-007', 'Alpine Fresh', 'Compras', '305-200-0100', 'Miami', 'Net 14', true
where not exists (select 1 from customers where name = 'Alpine Fresh');

insert into customers (code, name, contact_name, phone, city, payment_terms, es_cliente)
select 'CLI-008', 'Freshmex USA', 'Produce', '956-200-2200', 'Hidalgo', 'Net 21', true
where not exists (select 1 from customers where name = 'Freshmex USA');

insert into expenses (id, expense_number, category, supplier_id, purchase_order_id, quantity, unit_cost, amount, payable, status, issue_date, notes)
select 1, 'EXP-2608-001', 'Inspección', 6, po.id, 1, 100, 100, true, 'open', '2026-08-18', 'Inspección USDA papaya OC-2608-022'
from purchase_orders po where po.po_number = 'OC-2608-022'
  and not exists (select 1 from expenses where expense_number = 'EXP-2608-001');

insert into expenses (id, expense_number, category, supplier_id, purchase_order_id, quantity, unit_cost, amount, payable, status, issue_date, notes)
select 2, 'EXP-2608-002', 'Cajas/empaque', s.id, po.id, 48, 1, 48, true, 'open', '2026-08-18', 'Cajas para OC-2608-022'
from purchase_orders po
join suppliers s on s.code = 'PRO-004'
where po.po_number = 'OC-2608-022'
  and not exists (select 1 from expenses where expense_number = 'EXP-2608-002');

select setval('suppliers_id_seq', (select coalesce(max(id), 1) from suppliers));
select setval('customers_id_seq', (select coalesce(max(id), 1) from customers));
select setval('expenses_id_seq', (select coalesce(max(id), 1) from expenses));
