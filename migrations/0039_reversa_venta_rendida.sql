-- Bloque C-2b — cancelación de venta ya rendida (rama reversa-venta-rendida).
-- Aditiva e idempotente. No toca opening, bills del corte ni CORTE-CHASE.
--
-- Hoy cancelar una venta borraba sus allocations: el cálculo vivo bajaba, el
-- documento congelado no, y el cruce de C-1a dejaba la carga sin poder emitir
-- complementarias nunca más. Desde aquí la cancelación dice la verdad: la
-- venta se canceló, las cajas volvieron, y la siguiente cuenta complementaria
-- rinde la reversa (con la comisión de vuelta) línea por línea.

-- Las allocations ya no se borran al cancelar: se marcan. Así la venta rendida
-- sigue existiendo para el cruce y la reversa sabe de qué venta viene.
alter table sale_line_allocations add column if not exists cancelled_at timestamptz;
alter table sale_line_allocations add column if not exists cancelled_by text;
create index if not exists sla_cancelled_idx on sale_line_allocations (cancelled_at);

-- Reversa congelada en la complementaria: la venta original, cuándo se
-- canceló y el monto en negativo. Texto copiado, como los demás detalles.
create table if not exists grower_settlement_supplement_reversals (
  id serial primary key,
  supplement_id integer not null references grower_settlement_supplements(id) on delete cascade,
  allocation_id integer references sale_line_allocations(id),
  rendered_in text not null,            -- LIQ-004 o LIQ-004-C1: dónde se había rendido
  so_number text,
  invoice_number text,
  customer_name text,
  lot_number text not null,
  shipped_at timestamptz,
  cancelled_at timestamptz,
  cancel_reason text,
  quantity numeric(14, 3) not null,
  unit text,
  unit_price numeric(12, 4),
  amount numeric(14, 2) not null        -- negativo
);
create index if not exists gsupr_supplement_idx on grower_settlement_supplement_reversals (supplement_id);

-- Cuadre por lote: las cajas que regresaron por la cancelación.
alter table grower_settlement_supplement_lots add column if not exists returned_qty numeric(14, 3);

-- Encabezado que se lee solo: cuánto se revirtió y cuántas cajas.
alter table grower_settlement_supplements add column if not exists reversal_total numeric(14, 2) not null default 0;
alter table grower_settlement_supplements add column if not exists reversal_units numeric(14, 3) not null default 0;
