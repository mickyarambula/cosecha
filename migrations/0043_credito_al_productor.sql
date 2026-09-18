-- C-1b: notas de crédito atribuidas al productor, con causa.
-- (AUDITORIA-2026-09-03, Área de mejora #1 — la última puerta abierta.)
--
-- Hoy la nota de crédito al cliente vive sola en cuentas por cobrar: la
-- liquidación lee el ingreso de los despachos (cajas × precio) y nunca mira
-- las facturas, así que si el cliente rechaza fruta que venía mal del
-- productor, el golpe se lo come Plein entero. Estas tablas permiten decir a
-- qué CARGA pertenece cada crédito y de QUIÉN fue la culpa; cuando es del
-- productor le baja el neto (y la base de su comisión, decisión de Miguel del
-- 18 Sep 2026) en la liquidación, o en una complementaria si ya se emitió.
--
-- Aditiva: tablas y columnas nuevas, nullable o con default. No toca el
-- corte, ni facturas existentes, ni una liquidación ya emitida.

-- ── Atribución viva ────────────────────────────────────────────────────────
-- Una fila por (nota de crédito × carga). Un crédito que abarca cajas de dos
-- cargas se parte en dos filas; la suma nunca puede pasar del total del
-- crédito. cause='plein' se guarda igual (deja el rastro de que se decidió
-- que lo absorbe Plein) pero no toca el neto del productor.
create table if not exists grower_credit_attributions (
  id serial primary key,
  invoice_id integer not null references invoices(id),          -- la nota de crédito (invoice_type='credit')
  parent_invoice_id integer references invoices(id),            -- la factura de venta que corrige
  purchase_order_id integer not null references purchase_orders(id),
  supplier_id integer not null references suppliers(id),
  lot_id integer references lots(id),                           -- opcional: el lote culpable
  cause text not null,                                          -- 'grower' | 'plein'
  reason text not null,                                         -- PACA pide justificar cada peso
  amount numeric(14, 2) not null,                               -- positivo; lo que se le carga al productor
  settlement_id integer references grower_settlements(id),      -- rendido en la LIQ padre
  supplement_id integer references grower_settlement_supplements(id), -- o en una complementaria
  created_by text,
  created_at timestamptz not null default now(),
  cancelled_at timestamptz,
  cancelled_by text,
  cancel_reason text
);
create index if not exists gca_po_idx on grower_credit_attributions (purchase_order_id);
create index if not exists gca_invoice_idx on grower_credit_attributions (invoice_id);

-- ── Detalle congelado en la liquidación padre ─────────────────────────────
create table if not exists grower_settlement_credits (
  id serial primary key,
  settlement_id integer not null references grower_settlements(id) on delete cascade,
  attribution_id integer references grower_credit_attributions(id),
  invoice_number text,          -- folio de la nota de crédito
  parent_invoice_number text,   -- factura que corrige
  customer_name text,
  so_number text,
  lot_number text,
  credit_type text,             -- devolucion | merma | precio
  cause text not null,
  reason text not null,
  amount numeric(14, 2) not null
);
create index if not exists gsc_settlement_idx on grower_settlement_credits (settlement_id);

-- ── Detalle congelado en la complementaria ────────────────────────────────
create table if not exists grower_settlement_supplement_credits (
  id serial primary key,
  supplement_id integer not null references grower_settlement_supplements(id) on delete cascade,
  attribution_id integer references grower_credit_attributions(id),
  invoice_number text,
  parent_invoice_number text,
  customer_name text,
  so_number text,
  lot_number text,
  credit_type text,
  cause text not null,
  reason text not null,
  amount numeric(14, 2) not null
);
create index if not exists gsupc_supplement_idx on grower_settlement_supplement_credits (supplement_id);

-- El encabezado de los dos documentos se sigue leyendo solo:
-- neto = ingreso − gastos − comisión + merma pagada + compra Plein + ajustes − créditos.
alter table grower_settlements add column if not exists credit_total numeric(14, 2) not null default 0;
alter table grower_settlement_supplements add column if not exists credit_total numeric(14, 2) not null default 0;
