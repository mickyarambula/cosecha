-- Sesión aduanal (Fase A): catálogos de cruce transfronterizo y la tabla de
-- embarques. Hoy todo este dato (agencia aduanal, transportista, placas,
-- chofer, SCAC/CAAT, incoterm, PACA) vive en papel y se pierde.
--
-- Reglas: aditiva (tablas nuevas y columnas nullable), idempotente, no toca
-- opening ni CORTE-CHASE. SQL en inglés, UI en español (convención del repo).

-- ── Agencias aduanales (MX y US) ────────────────────────────────────────────
-- supplier_id liga opcionalmente con el proveedor que ya existe para pagarle
-- (Suárez Brokerage ya es PRO-029); puede quedar vacío.
create table if not exists customs_brokers (
  id serial primary key,
  name text not null,
  country text not null default 'MX',
  license_number text,
  contact_name text,
  phone text,
  email text,
  supplier_id integer references suppliers(id),
  notes text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- ── Puntos de cruce (garita MX / garita US) ────────────────────────────────
create table if not exists border_crossings (
  id serial primary key,
  name text not null unique,
  port_mx text,
  port_us text,
  state_mx text,
  state_us text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- ── Transportistas y su flota ──────────────────────────────────────────────
create table if not exists carriers (
  id serial primary key,
  name text not null,
  country text,
  scac text,
  caat text,
  contact_name text,
  phone text,
  supplier_id integer references suppliers(id),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists carrier_units (
  id serial primary key,
  carrier_id integer not null references carriers(id),
  unit_type text not null default 'camion', -- 'camion' | 'remolque'
  plates text not null,
  economic_number text,
  make_model text,
  model_year integer,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists carrier_units_carrier_idx on carrier_units(carrier_id);

create table if not exists drivers (
  id serial primary key,
  carrier_id integer not null references carriers(id),
  name text not null,
  license_number text,
  license_state text,
  phone text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists drivers_carrier_idx on drivers(carrier_id);

-- ── Embarques ──────────────────────────────────────────────────────────────
-- tipo 'entrada' cuelga de la OC; 'salida' cuelga de la OV (no existe tabla
-- de despacho: la salida se embarca desde la orden de venta). Sin constraint
-- único sobre la orden: una OC puede llegar en dos camiones y una OV puede
-- salir en dos días. Qué líneas/lotes viajan en cuál camión es hueco conocido
-- (va con el desglose por pallet, otra sesión). BOL y factura del productor
-- siguen viviendo en la OC — no se duplican aquí; solo se agrega el
-- manifiesto. La temperatura se guarda con la unidad tal como la escribió el
-- proveedor (45F-48F en el manifiesto de Cornejos, 7°C en el BOL de
-- CarriFoods): nada de conversiones por atrás.
create table if not exists shipments (
  id serial primary key,
  shipment_number text not null unique,
  shipment_type text not null default 'entrada', -- 'entrada' | 'salida'
  purchase_order_id integer references purchase_orders(id),
  sales_order_id integer references sales_orders(id),
  carrier_id integer references carriers(id),
  truck_unit_id integer references carrier_units(id),
  trailer_unit_id integer references carrier_units(id),
  driver_id integer references drivers(id),
  temp_min numeric(5, 1),
  temp_max numeric(5, 1),
  temp_unit text, -- 'F' | 'C'
  load_time text, -- hora de embarque 'HH:MM'
  ship_date date,
  seals text,     -- sellos, texto libre (van varios)
  notes text,
  -- solo entrada (nullable; la UI los oculta en salidas)
  customs_broker_mx_id integer references customs_brokers(id),
  reference_mx text, -- pedimento
  customs_broker_us_id integer references customs_brokers(id),
  reference_us text, -- entry number
  border_crossing_id integer references border_crossings(id),
  crossing_date date,
  incoterm text,
  incoterm_place text,
  manifest_number text,
  -- 'pendiente' | 'en_transito' | 'cruzado' | 'entregado'
  -- ('cruzado' no aplica a salidas: flete doméstico; la UI no lo ofrece)
  status text not null default 'pendiente',
  created_by text,
  created_at timestamptz not null default now()
);
create index if not exists shipments_po_idx on shipments(purchase_order_id);
create index if not exists shipments_so_idx on shipments(sales_order_id);

-- ── Contrapartes: PACA / EIN-RFC / país ────────────────────────────────────
-- suppliers ya tiene country; a customers le faltaba.
alter table suppliers add column if not exists paca_number text;
alter table suppliers add column if not exists ein_rfc text;
alter table customers add column if not exists paca_number text;
alter table customers add column if not exists ein_rfc text;
alter table customers add column if not exists country text;

-- ── Semillas: solo lo estable ──────────────────────────────────────────────
-- Cruces fronterizos e incoterms. Transportistas, unidades, choferes y
-- agencias NO se siembran: Miguel los captura a mano para probar el ABM.
insert into border_crossings (name, port_mx, port_us, state_mx, state_us) values
  ('Nogales', 'Nogales', 'Nogales', 'Sonora', 'Arizona'),
  ('Reynosa - Pharr', 'Reynosa', 'Pharr', 'Tamaulipas', 'Texas'),
  ('Tijuana - Otay Mesa', 'Tijuana', 'Otay Mesa', 'Baja California', 'California'),
  ('Nuevo Laredo - Laredo', 'Nuevo Laredo', 'Laredo', 'Tamaulipas', 'Texas'),
  ('San Luis Río Colorado - San Luis', 'San Luis Río Colorado', 'San Luis', 'Sonora', 'Arizona')
on conflict (name) do nothing;

insert into value_lists (kind, value, sort_order) values
  ('incoterm', 'EXW', 1),
  ('incoterm', 'FCA', 2),
  ('incoterm', 'FOB', 3),
  ('incoterm', 'CFR', 4),
  ('incoterm', 'CIF', 5),
  ('incoterm', 'DAP', 6),
  ('incoterm', 'DDP', 7)
on conflict (kind, value) do nothing;
