-- Bloque C-1a — liquidación complementaria (rama congelamiento-liquidacion).
--
-- Una LIQ- emitida no congela la carga (AUDITORIA-2026-09-03, hallazgo 8):
-- después de rendir cuentas se venden las cajas que quedaron pendientes,
-- llegan gastos tarde, se destruye parte del remanente. Nada de eso le llega
-- al productor. La complementaria es un documento nuevo (LIQ-004-C1, -C2…)
-- que cuelga SIEMPRE del padre y rinde solo lo ocurrido en su ventana
-- (period_start, period_end]: del created_at del padre o de la complementaria
-- anterior hasta su propia emisión. Línea por línea, para que Miguel pueda
-- explicarle al productor de dónde salió cada peso.
--
-- Aditiva e idempotente salvo el reemplazo autorizado del índice único de
-- grower_payables (al final, con chequeo previo). No toca opening, bills del
-- corte, CORTE-CHASE ni grower_settlements_po_idx. SQL en inglés, UI en español.

-- Chequeo previo: la migración no arranca si grower_payables ya tuviera dos
-- remisiones para la misma liquidación (imposible hoy por el índice viejo,
-- pero el error debe decir cuáles son, no solo "could not create unique index").
do $$
declare
  dups text;
begin
  select string_agg(format('%s (%s filas)', coalesce(gs.settlement_number, 'settlement_id ' || d.settlement_id::text), d.n), ', ')
    into dups
  from (
    select settlement_id, count(*) as n from grower_payables group by settlement_id having count(*) > 1
  ) d
  left join grower_settlements gs on gs.id = d.settlement_id;
  if dups is not null then
    raise exception '0037: grower_payables tiene más de una remisión (REM-) para la misma liquidación: %. Cada liquidación debe tener una sola remisión. Corrige esas filas antes de aplicar esta migración.', dups;
  end if;
end $$;

create table if not exists grower_settlement_supplements (
  id serial primary key,
  settlement_id integer not null references grower_settlements(id),   -- siempre el padre
  sequence integer not null,
  supplement_number text not null unique,                             -- LIQ-004-C1
  purchase_order_id integer not null references purchase_orders(id),
  supplier_id integer not null references suppliers(id),
  deal_type text not null,
  commission_type text,                       -- copiados del padre, no vivos
  commission_rate numeric(12, 4),
  issue_date date not null default current_date,
  period_start timestamptz not null,          -- created_at del padre o de la anterior
  period_end timestamptz not null,            -- = created_at propio
  sold_units numeric(14, 3) not null default 0,
  revenue numeric(14, 2) not null default 0,
  grower_expenses numeric(14, 2) not null default 0,
  commission numeric(14, 2) not null default 0,
  shrink_compensation numeric(14, 2) not null default 0,
  plein_purchase_total numeric(14, 2) not null default 0,
  net_to_grower numeric(14, 2) not null default 0,     -- puede ser negativo
  advance_recovered numeric(14, 2) not null default 0,
  final_payment numeric(14, 2) not null default 0,     -- >= 0
  balance_due numeric(14, 2) not null default 0,       -- neto negativo → ADE- sin caja
  prior_net numeric(14, 2) not null default 0,         -- ya rendido: padre + anteriores
  received_qty numeric(14, 3),                         -- base del embarque (5 %)
  destroyed_equiv_qty numeric(14, 3),                  -- destruido en esta ventana
  destroyed_cum_equiv_qty numeric(14, 3),              -- acumulado padre + anteriores + esta
  destroyed_cum_pct numeric(8, 4),
  certificate_id integer references destruction_certificates(id),
  certificate_number text,
  certificate_date date,
  grower_payable_id integer references grower_payables(id),   -- REM- (comisión pura)
  supplier_bill_id integer references supplier_bills(id),     -- FAC- (consignación)
  advance_id integer references grower_advances(id),          -- ADE- sin caja
  share_token text not null default (md5(random()::text || clock_timestamp()::text) || md5(random()::text || clock_timestamp()::text)),
  created_by text,
  created_at timestamptz not null default now()
);
create unique index if not exists gsup_settlement_seq_idx on grower_settlement_supplements (settlement_id, sequence);
create index if not exists gsup_po_idx on grower_settlement_supplements (purchase_order_id);
create index if not exists gsup_supplier_idx on grower_settlement_supplements (supplier_id);

-- Cuadre por lote de la ventana: abre con lo pendiente del documento anterior
-- y cierra con lo que sigue pendiente para la siguiente complementaria.
create table if not exists grower_settlement_supplement_lots (
  id serial primary key,
  supplement_id integer not null references grower_settlement_supplements(id) on delete cascade,
  lot_id integer references lots(id),
  lot_number text not null,
  product_name text not null,
  calibre text,
  unit text,
  origin text not null,                       -- 'pending' | 'repack' | 'reception'
  opening_pending numeric(14, 3) not null default 0,
  sold_qty numeric(14, 3) not null default 0,
  revenue numeric(14, 2) not null default 0,
  waste_qty numeric(14, 3) not null default 0,
  repacked_out_qty numeric(14, 3) not null default 0,
  destroyed_qty numeric(14, 3) not null default 0,
  plein_bought_qty numeric(14, 3) not null default 0,
  closing_pending numeric(14, 3) not null default 0
);
create index if not exists gsupl_supplement_idx on grower_settlement_supplement_lots (supplement_id);

-- Línea por línea: cada despacho que entró, con su OV, factura y cliente.
create table if not exists grower_settlement_supplement_sales (
  id serial primary key,
  supplement_id integer not null references grower_settlement_supplements(id) on delete cascade,
  allocation_id integer references sale_line_allocations(id),
  lot_number text not null,
  so_number text,
  invoice_number text,
  customer_name text,
  shipped_at timestamptz,
  quantity numeric(14, 3) not null,
  unit text,
  unit_price numeric(12, 4),
  amount numeric(14, 2) not null
);
create index if not exists gsups_supplement_idx on grower_settlement_supplement_sales (supplement_id);

create table if not exists grower_settlement_supplement_expenses (
  id serial primary key,
  supplement_id integer not null references grower_settlement_supplements(id) on delete cascade,
  expense_id integer references expenses(id),
  expense_number text,
  category text not null,
  notes text,
  issue_date date,
  amount numeric(14, 2) not null
);
create index if not exists gsupe_supplement_idx on grower_settlement_supplement_expenses (supplement_id);

create table if not exists grower_settlement_supplement_shrinks (
  id serial primary key,
  supplement_id integer not null references grower_settlement_supplements(id) on delete cascade,
  pack_out_id integer references pack_outs(id),
  pack_number text not null,
  pack_date date,
  source_lots text,
  shrink_qty numeric(14, 3) not null default 0,
  shrink_unit text,
  charged_to text not null,
  reason text,
  unit_price numeric(14, 4),
  amount numeric(14, 2) not null default 0
);
create index if not exists gsupsh_supplement_idx on grower_settlement_supplement_shrinks (supplement_id);

-- Destruido / comprado por Plein sobre cajas pendientes, después de la LIQ.
create table if not exists grower_settlement_supplement_dispositions (
  id serial primary key,
  supplement_id integer not null references grower_settlement_supplements(id) on delete cascade,
  disposition_id integer references lot_dispositions(id),
  lot_number text not null,
  product_name text not null,
  calibre text,
  kind text not null,
  quantity numeric(14, 3) not null,
  unit text,
  reason text,
  unit_price numeric(14, 4),
  amount numeric(14, 2) not null default 0,
  origin_equiv_qty numeric(14, 3)
);
create index if not exists gsupd_supplement_idx on grower_settlement_supplement_dispositions (supplement_id);

-- Ligas hacia la complementaria (todas nullable).
alter table grower_advances add column if not exists supplement_id integer references grower_settlement_supplements(id);
alter table settlement_advance_applications add column if not exists supplement_id integer references grower_settlement_supplements(id);
alter table supplier_bills add column if not exists supplement_id integer references grower_settlement_supplements(id);
alter table lot_dispositions add column if not exists supplement_id integer references grower_settlement_supplements(id);
-- Cruce de dinero hacia adelante: las LIQ emitidas desde hoy guardan qué gasto
-- congelaron, para detectar ediciones posteriores gasto por gasto.
alter table grower_settlement_expenses add column if not exists expense_id integer references expenses(id);

-- Reemplazo autorizado del índice único de grower_payables (Bloque C-1a).
-- Orden a propósito: primero nacen los índices nuevos (si alguna fila los
-- violara, la transacción aborta aquí y el viejo sigue en pie); el viejo se
-- quita al final. No borra datos ni cambia tipos: el índice nuevo es más
-- permisivo (una REM- por liquidación Y una por complementaria).
alter table grower_payables add column if not exists supplement_id integer references grower_settlement_supplements(id);
create unique index if not exists grower_payables_parent_idx
  on grower_payables (settlement_id) where supplement_id is null;
create unique index if not exists grower_payables_supplement_idx
  on grower_payables (supplement_id) where supplement_id is not null;
drop index if exists grower_payables_settlement_idx;
