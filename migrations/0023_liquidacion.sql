-- Sesión liquidación: la liquidación al productor deja de ser un retro-cálculo
-- por % objetivo y pasa a la secuencia real de Plein:
--   ingreso de la venta − gastos que se le descuentan al productor − comisión
--   de Plein = neto al productor.
--
-- 1) Comisión por trato. Tres tipos, con default en el proveedor y editable
--    por carga en la OC:
--    per_unit    → monto fijo por caja vendida
--    gross_pct   → % del ingreso bruto
--    net_pct     → % de lo que queda después de gastos del productor
alter table suppliers add column if not exists commission_type text;
alter table suppliers add column if not exists commission_rate numeric(12, 4);
alter table purchase_orders add column if not exists commission_type text;
alter table purchase_orders add column if not exists commission_rate numeric(12, 4);

-- 2) Cada gasto ligado a la carga declara quién lo absorbe:
--    'grower' → se le descuenta al productor en la liquidación
--    'plein'  → lo absorbe Plein (default: no se le cobra al productor nada
--    que no esté marcado explícitamente)
alter table expenses add column if not exists charged_to text not null default 'plein';

-- 3) Atribución de ingreso por lote. Hasta hoy sales_order_lines.lot_id era
-- una sola columna que cada despacho sobreescribía: si una línea salía de dos
-- lotes, todo el ingreso caía en el último. Esta tabla registra de qué lote
-- salió cada caja realmente.
create table if not exists sale_line_allocations (
  id serial primary key,
  sales_order_line_id integer not null references sales_order_lines(id),
  lot_id integer not null references lots(id),
  quantity numeric(14, 3) not null,
  created_at timestamptz not null default now()
);
create index if not exists sla_line_idx on sale_line_allocations (sales_order_line_id);
create index if not exists sla_lot_idx on sale_line_allocations (lot_id);

-- Backfill: las líneas existentes despachadas de un solo lote se migran tal
-- cual. Las que ya se surtieron de varios lotes antes de esta migración no
-- son recuperables (el dato se perdió al sobreescribir lot_id) — quedan
-- atribuidas al último lote, igual que hoy.
insert into sale_line_allocations (sales_order_line_id, lot_id, quantity)
select sol.id, sol.lot_id, sol.quantity_shipped
from sales_order_lines sol
where sol.lot_id is not null and sol.quantity_shipped > 0
  and not exists (
    select 1 from sale_line_allocations a where a.sales_order_line_id = sol.id
  );
