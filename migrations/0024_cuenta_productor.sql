-- Sesión cuenta corriente del productor: Plein adelanta apoyos (flete, pick
-- and pack, semilla, efectivo) que se acumulan a lo largo de varias cargas y
-- se recuperan contra liquidaciones futuras.
--
-- Contabilidad: un adelanto es dinero que sale de caja y se vuelve cuenta por
-- cobrar al productor (activo) — NO es gasto, no toca expenses ni el P&L.
-- La recuperación es un cruce sin caja: baja la CxC al productor y baja la
-- CxP de la liquidación (supplier_bills.paid sube sin cash_movement).

create table if not exists grower_advances (
  id serial primary key,
  advance_number text not null unique,
  supplier_id integer not null references suppliers(id),
  -- Muchos adelantos no se ligan a ninguna carga; este campo es opcional.
  purchase_order_id integer references purchase_orders(id),
  advance_date date not null default current_date,
  concept text not null,
  amount numeric(14, 2) not null,
  -- Cuánto ya se recuperó contra liquidaciones. Saldo vivo = amount - recovered.
  -- Se actualiza SOLO con guarda atómica (recovered + x <= amount) para que
  -- sea imposible recuperar el mismo adelanto dos veces.
  recovered numeric(14, 2) not null default 0,
  cash_movement_id integer references cash_movements(id),
  notes text,
  cancelled_at timestamptz,
  cancelled_by text,
  cancel_reason text,
  created_at timestamptz not null default now()
);
create index if not exists gadv_supplier_idx on grower_advances (supplier_id);
create index if not exists gadv_po_idx on grower_advances (purchase_order_id);

-- Cada recuperación queda registrada contra la liquidación (bill) que la
-- absorbió: es el rastro que impide y detecta dobles recuperaciones.
create table if not exists grower_advance_applications (
  id serial primary key,
  advance_id integer not null references grower_advances(id),
  supplier_bill_id integer not null references supplier_bills(id),
  purchase_order_id integer references purchase_orders(id),
  amount numeric(14, 2) not null,
  created_at timestamptz not null default now()
);
create index if not exists gapp_advance_idx on grower_advance_applications (advance_id);
create index if not exists gapp_bill_idx on grower_advance_applications (supplier_bill_id);

-- Estado de cuenta del productor: link/documento compartible, mismo patrón
-- de token que facturas/OCs/OVs (0018).
alter table suppliers add column if not exists share_token text;
update suppliers set share_token = md5(random()::text || clock_timestamp()::text || id::text) || md5(random()::text || id::text)
  where share_token is null;
alter table suppliers alter column share_token set default (
  md5(random()::text || clock_timestamp()::text) || md5(random()::text || clock_timestamp()::text)
);

-- Balance: los adelantos vivos son un activo circulante propio, junto a AR.
insert into gl_accounts (number, name, description, statement, kind, subtype, parent_number, tracking_start, starting_balance, sort_order)
values ('12500', 'Advances to Growers', 'Apoyos adelantados a productores, recuperables contra liquidaciones', 'balance', 'asset', 'Current > AR', null, current_date, 0, 54)
on conflict (number) do nothing;
