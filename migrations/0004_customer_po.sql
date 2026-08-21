-- Customer PO is the door: client PO → sales order → purchase to grower.

create table if not exists customer_pos (
  id serial primary key,
  cpo_number text not null unique,
  customer_id integer not null references customers(id),
  customer_po_number text,
  po_date date not null default current_date,
  currency text not null default 'USD',
  attachment_url text,
  notes text,
  status text not null default 'open',
  created_at timestamptz not null default now()
);

create table if not exists customer_po_lines (
  id serial primary key,
  customer_po_id integer not null references customer_pos(id) on delete cascade,
  product_id integer not null references products(id),
  quantity numeric(14, 3) not null,
  unit text not null,
  unit_price numeric(12, 4),
  notes text
);

alter table sales_orders add column if not exists customer_po_id integer references customer_pos(id);
alter table purchase_orders add column if not exists sales_order_id integer references sales_orders(id);

create index if not exists cpo_customer_idx on customer_pos (customer_id);
create index if not exists cpo_status_idx on customer_pos (status);
create index if not exists so_cpo_idx on sales_orders (customer_po_id);
create index if not exists po_so_idx on purchase_orders (sales_order_id);

-- Playable: Northgate sent NGM247514. Convert it to an OV, then generate the grower PO.
insert into customer_pos (id, cpo_number, customer_id, customer_po_number, po_date, currency, notes, status)
values (1, 'CPO-2608-001', 4, 'NGM247514', '2026-07-20', 'USD', 'PO Northgate papaya Maradol 10 ct 36 lb', 'open')
on conflict (cpo_number) do nothing;

insert into customer_po_lines (customer_po_id, product_id, quantity, unit, unit_price)
select 1, 6, 1056, 'caja', 14.00
where not exists (select 1 from customer_po_lines where customer_po_id = 1);

select setval('customer_pos_id_seq', (select coalesce(max(id), 1) from customer_pos));
