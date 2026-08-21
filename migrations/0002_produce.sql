-- Cosecha: produce operations schema (unowned, single-tenant)

create table if not exists products (
  id serial primary key,
  sku text not null unique,
  name text not null,
  variety text,
  category text,
  default_unit text not null default 'caja',
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists pack_styles (
  id serial primary key,
  product_id integer not null references products(id) on delete cascade,
  name text not null,
  unit_of_measure text not null,
  net_weight numeric(12, 3),
  weight_unit text not null default 'kg',
  is_default boolean not null default false
);

create table if not exists suppliers (
  id serial primary key,
  code text not null unique,
  name text not null,
  contact_name text,
  phone text,
  city text,
  country text,
  notes text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists customers (
  id serial primary key,
  code text not null unique,
  name text not null,
  contact_name text,
  phone text,
  city text,
  payment_terms text,
  notes text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists locations (
  id serial primary key,
  code text not null unique,
  name text not null,
  location_type text not null default 'camara',
  is_active boolean not null default true
);

create table if not exists lots (
  id serial primary key,
  lot_number text not null unique,
  product_id integer not null references products(id),
  supplier_id integer references suppliers(id),
  pack_style_id integer references pack_styles(id),
  original_qty numeric(14, 3) not null,
  current_qty numeric(14, 3) not null,
  unit text not null,
  unit_cost numeric(12, 4),
  received_date date,
  pack_date date,
  best_by_date date,
  grade text,
  origin_farm text,
  origin_country text,
  quality_notes text,
  status text not null default 'active',
  created_at timestamptz not null default now()
);

create table if not exists inventory (
  id serial primary key,
  lot_id integer not null references lots(id) on delete cascade,
  location_id integer not null references locations(id),
  quantity numeric(14, 3) not null default 0,
  unique (lot_id, location_id)
);

create table if not exists inventory_movements (
  id serial primary key,
  lot_id integer not null references lots(id),
  location_id integer references locations(id),
  movement_type text not null,
  quantity numeric(14, 3) not null,
  unit text not null,
  reference_type text,
  reference_id integer,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists purchase_orders (
  id serial primary key,
  po_number text not null unique,
  supplier_id integer not null references suppliers(id),
  status text not null default 'draft',
  order_date date not null default current_date,
  expected_date date,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists purchase_order_lines (
  id serial primary key,
  purchase_order_id integer not null references purchase_orders(id) on delete cascade,
  product_id integer not null references products(id),
  pack_style_id integer references pack_styles(id),
  quantity_ordered numeric(14, 3) not null,
  quantity_received numeric(14, 3) not null default 0,
  unit text not null,
  unit_cost numeric(12, 4)
);

create table if not exists sales_orders (
  id serial primary key,
  so_number text not null unique,
  customer_id integer not null references customers(id),
  status text not null default 'draft',
  order_date date not null default current_date,
  ship_date date,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists sales_order_lines (
  id serial primary key,
  sales_order_id integer not null references sales_orders(id) on delete cascade,
  product_id integer not null references products(id),
  lot_id integer references lots(id),
  quantity_ordered numeric(14, 3) not null,
  quantity_shipped numeric(14, 3) not null default 0,
  unit text not null,
  unit_price numeric(12, 4)
);

create index if not exists lots_product_idx on lots (product_id);
create index if not exists lots_status_idx on lots (status);
create index if not exists inventory_lot_idx on inventory (lot_id);
create index if not exists movements_lot_idx on inventory_movements (lot_id);

-- Seed demo catalog so the app is usable on first open
insert into products (id, sku, name, variety, category, default_unit) values
  (1, 'AGU-HASS', 'Aguacate', 'Hass', 'Fruta', 'caja'),
  (2, 'TOM-ROMA', 'Tomate', 'Roma', 'Verdura', 'caja'),
  (3, 'FRE-SWEET', 'Fresa', 'Sweet Charlie', 'Fruta', 'caja'),
  (4, 'LIM-PERS', 'Limón', 'Persa', 'Cítrico', 'caja'),
  (5, 'CEB-BLAN', 'Cebolla', 'Blanca', 'Verdura', 'saco')
on conflict (sku) do nothing;

insert into pack_styles (id, product_id, name, unit_of_measure, net_weight, weight_unit, is_default) values
  (1, 1, 'Caja 10 kg', 'caja', 10, 'kg', true),
  (2, 1, 'Caja 25 lb', 'caja', 11.34, 'kg', false),
  (3, 2, 'Caja 11 kg', 'caja', 11, 'kg', true),
  (4, 3, 'Caja 4.5 kg', 'caja', 4.5, 'kg', true),
  (5, 4, 'Caja 18 kg', 'caja', 18, 'kg', true),
  (6, 5, 'Saco 25 kg', 'saco', 25, 'kg', true)
on conflict do nothing;

insert into suppliers (id, code, name, contact_name, phone, city, country, notes) values
  (1, 'PRO-001', 'Huerta Los Álamos', 'Marta Ríos', '555-0141', 'Uruapan', 'México', 'Hass exportable'),
  (2, 'PRO-002', 'Campo Verde SPR', 'Luis Peña', '555-0188', 'Sinaloa', 'México', 'Tomate y cebolla'),
  (3, 'PRO-003', 'Berries del Pacífico', 'Ana Solís', '555-0220', 'Jalisco', 'México', 'Fresa y berries')
on conflict (code) do nothing;

insert into customers (id, code, name, contact_name, phone, city, payment_terms) values
  (1, 'CLI-001', 'Mercado Central Norte', 'Jorge Díaz', '555-1001', 'CDMX', 'Net 7'),
  (2, 'CLI-002', 'Fresh Hub Distribución', 'Paula Neri', '555-1002', 'Monterrey', 'Net 14'),
  (3, 'CLI-003', 'Retail Valle', 'Elena Cruz', '555-1003', 'Guadalajara', 'COD')
on conflict (code) do nothing;

insert into locations (id, code, name, location_type) values
  (1, 'CAM-01', 'Cámara 1 — 4°C', 'camara'),
  (2, 'CAM-02', 'Cámara 2 — 8°C', 'camara'),
  (3, 'EMP-01', 'Área de empaque', 'empaque')
on conflict (code) do nothing;

insert into lots (id, lot_number, product_id, supplier_id, pack_style_id, original_qty, current_qty, unit, unit_cost, received_date, pack_date, best_by_date, grade, origin_farm, origin_country, status) values
  (1, 'LOT-2608-001', 1, 1, 1, 240, 180, 'caja', 18.50, '2026-08-12', '2026-08-11', '2026-08-26', 'Fancy', 'Huerta Los Álamos', 'México', 'active'),
  (2, 'LOT-2608-002', 1, 1, 1, 120, 120, 'caja', 17.80, '2026-08-18', '2026-08-17', '2026-09-01', 'Choice', 'Huerta Los Álamos', 'México', 'active'),
  (3, 'LOT-2608-003', 2, 2, 3, 200, 95, 'caja', 9.40, '2026-08-10', '2026-08-09', '2026-08-22', 'Roma 5x6', 'Campo Verde', 'México', 'active'),
  (4, 'LOT-2608-004', 3, 3, 4, 80, 28, 'caja', 22.00, '2026-08-16', '2026-08-16', '2026-08-21', 'Extra', 'Berries del Pacífico', 'México', 'active'),
  (5, 'LOT-2608-005', 4, 2, 5, 60, 60, 'caja', 12.10, '2026-08-19', '2026-08-18', '2026-09-10', 'Primera', 'Campo Verde', 'México', 'active'),
  (6, 'LOT-2608-006', 5, 2, 6, 40, 40, 'saco', 8.75, '2026-08-14', '2026-08-13', '2026-10-01', 'Jumbo', 'Campo Verde', 'México', 'active')
on conflict (lot_number) do nothing;

insert into inventory (lot_id, location_id, quantity) values
  (1, 1, 180),
  (2, 1, 120),
  (3, 2, 95),
  (4, 1, 28),
  (5, 2, 60),
  (6, 3, 40)
on conflict do nothing;

insert into inventory_movements (lot_id, location_id, movement_type, quantity, unit, reference_type, notes, created_at) values
  (1, 1, 'receive', 240, 'caja', 'purchase_order', 'Recepción inicial', '2026-08-12 09:00:00+00'),
  (1, 1, 'ship', -60, 'caja', 'sales_order', 'Despacho Mercado Central', '2026-08-15 14:00:00+00'),
  (3, 2, 'receive', 200, 'caja', 'purchase_order', 'Recepción tomate', '2026-08-10 08:30:00+00'),
  (3, 2, 'ship', -105, 'caja', 'sales_order', 'Despacho Fresh Hub', '2026-08-14 11:00:00+00'),
  (4, 1, 'receive', 80, 'caja', 'purchase_order', 'Fresa extra', '2026-08-16 07:45:00+00'),
  (4, 1, 'ship', -52, 'caja', 'sales_order', 'Retail Valle', '2026-08-17 16:20:00+00');

insert into purchase_orders (id, po_number, supplier_id, status, order_date, expected_date, notes) values
  (1, 'OC-2608-011', 1, 'completed', '2026-08-11', '2026-08-12', 'Hass semana 33'),
  (2, 'OC-2608-018', 3, 'confirmed', '2026-08-19', '2026-08-21', 'Fresa pendiente de arribo')
on conflict (po_number) do nothing;

insert into purchase_order_lines (purchase_order_id, product_id, pack_style_id, quantity_ordered, quantity_received, unit, unit_cost) values
  (1, 1, 1, 240, 240, 'caja', 18.50),
  (2, 3, 4, 50, 0, 'caja', 21.50);

insert into sales_orders (id, so_number, customer_id, status, order_date, ship_date, notes) values
  (1, 'OV-2608-044', 1, 'completed', '2026-08-14', '2026-08-15', 'Pedido semanal'),
  (2, 'OV-2608-051', 2, 'confirmed', '2026-08-19', null, 'Pendiente de surtir')
on conflict (so_number) do nothing;

insert into sales_order_lines (sales_order_id, product_id, lot_id, quantity_ordered, quantity_shipped, unit, unit_price) values
  (1, 1, 1, 60, 60, 'caja', 24.80),
  (2, 2, 3, 40, 0, 'caja', 13.20),
  (2, 5, 6, 10, 0, 'saco', 12.00);

select setval('products_id_seq', (select max(id) from products));
select setval('pack_styles_id_seq', (select max(id) from pack_styles));
select setval('suppliers_id_seq', (select max(id) from suppliers));
select setval('customers_id_seq', (select max(id) from customers));
select setval('locations_id_seq', (select max(id) from locations));
select setval('lots_id_seq', (select max(id) from lots));
select setval('purchase_orders_id_seq', (select max(id) from purchase_orders));
select setval('sales_orders_id_seq', (select max(id) from sales_orders));
