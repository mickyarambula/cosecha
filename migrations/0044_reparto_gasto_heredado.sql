-- Hallazgo 14: repara el dato viejo antes de que empiece a moverse.
--
-- Hasta ahora ninguna consulta de dinero leía expense_po_links.amount_applied,
-- así que cada liga nacía con el monto COMPLETO del gasto: un flete de $1,000
-- ligado a dos cargas quedó guardado como $1,000 en las DOS filas. Eso era
-- inofensivo mientras nadie las leyera — la liquidación cobraba el gasto entero
-- a la carga de expenses.purchase_order_id y cero a la otra (el defecto).
--
-- Desde el bloque que acompaña esta migración, la liquidación SÍ lee esas
-- filas. Sin reparar el dato, la segunda carga pasaría de cobrar $0 a cobrar
-- $1,000 sola: el mismo flete cobrado dos veces, a dos productores distintos.
--
-- La reparación deja EXACTAMENTE lo que el sistema cobraba hasta hoy: el monto
-- completo en la carga principal y cero en las demás. Desde ahí, Miguel
-- reparte a mano en Finanzas → Gastos → el gasto → Reparto entre cargas.
-- Solo toca gastos cuyas ligas suman de más; los repartos correctos no se mueven.
update expense_po_links x
set amount_applied = case when x.purchase_order_id = p.primary_po then p.amount else 0 end
from (
  select e.id as expense_id,
         e.amount,
         coalesce(
           e.purchase_order_id,
           (select min(y.purchase_order_id) from expense_po_links y where y.expense_id = e.id)
         ) as primary_po
  from expenses e
  where (
    select coalesce(sum(z.amount_applied), 0) from expense_po_links z where z.expense_id = e.id
  ) > e.amount + 0.01
) p
where x.expense_id = p.expense_id;
