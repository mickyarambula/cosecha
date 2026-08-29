-- Sesión de correcciones 2: los gastos se pueden corregir y cancelar dejando
-- rastro, y un gasto capturado desde una OC queda realmente ligado a ella.

-- Cancelación con rastro (mismo patrón que grower_advances.cancelled_at).
alter table expenses add column if not exists cancelled_at timestamptz;
alter table expenses add column if not exists cancel_reason text;

-- Un gasto se relacionaba con su OC por dos caminos distintos: la columna
-- expenses.purchase_order_id (la que escribe la captura y la que lee la
-- liquidación) y la tabla expense_po_links (la que lee el detalle del gasto).
-- La captura nunca escribía la segunda, así que el gasto se veía "Not
-- connected to a PO" aunque sí estuviera prorrateado. Se rellena el historial.
insert into expense_po_links (expense_id, purchase_order_id, amount_applied)
select e.id, e.purchase_order_id, e.amount
from expenses e
where e.purchase_order_id is not null
on conflict (expense_id, purchase_order_id) do nothing;
