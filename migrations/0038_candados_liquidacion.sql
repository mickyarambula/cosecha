-- Bloque C-2a/C-2c — candados de la carga liquidada (rama candados-liquidacion).
-- Aditiva e idempotente. No toca opening, bills del corte, CORTE-CHASE ni
-- ningún índice. SQL en inglés, UI en español.

-- Marca de congelado: se enciende al emitir la LIQ y nunca se apaga (no existe
-- cancelar una liquidación; cancelar la OC queda bloqueado). No reusa signed_off.
alter table purchase_orders add column if not exists liquidated_at timestamptz;
alter table purchase_orders add column if not exists liquidated_by text;
-- Relleno para bases que ya tengan liquidaciones (producción hoy no tiene).
update purchase_orders po
   set liquidated_at = gs.created_at, liquidated_by = gs.created_by
  from grower_settlements gs
 where gs.purchase_order_id = po.id and po.liquidated_at is null;

-- Ajuste a favor del productor: la salida de los candados de dinero (un gasto
-- rendido de más, cancelado, desligado o que en realidad absorbe Plein).
-- Motivo obligatorio (mismo criterio que la merma). Entra a la siguiente
-- cuenta complementaria como renglón a favor del productor; no toca la base
-- de la comisión. Se deshace mientras ninguna complementaria lo haya rendido.
create table if not exists grower_adjustments (
  id serial primary key,
  purchase_order_id integer not null references purchase_orders(id),
  supplier_id integer not null references suppliers(id),
  amount numeric(14, 2) not null,                       -- siempre a favor del productor
  reason text not null,
  expense_id integer references expenses(id),           -- gasto rendido que corrige, si aplica
  supplement_id integer references grower_settlement_supplements(id),  -- se llena al rendir
  created_by text,
  created_at timestamptz not null default now(),
  cancelled_at timestamptz,
  cancelled_by text,
  cancel_reason text
);
create index if not exists grower_adjustments_po_idx on grower_adjustments (purchase_order_id);

-- Detalle congelado en la complementaria (texto copiado, como los demás).
create table if not exists grower_settlement_supplement_adjustments (
  id serial primary key,
  supplement_id integer not null references grower_settlement_supplements(id) on delete cascade,
  adjustment_id integer references grower_adjustments(id),
  expense_number text,
  reason text not null,
  amount numeric(14, 2) not null
);
create index if not exists gsupa_supplement_idx on grower_settlement_supplement_adjustments (supplement_id);

-- El encabezado de la complementaria se sigue leyendo solo:
-- neto = ingreso − gastos − comisión + merma pagada + compra Plein + ajustes.
alter table grower_settlement_supplements add column if not exists adjustment_total numeric(14, 2) not null default 0;
