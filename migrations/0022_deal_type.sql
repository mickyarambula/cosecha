-- Sesión modalidad: el tipo de trato deja de "emerger" de si se capturó
-- costo o no, y se vuelve un campo explícito y obligatorio en la OC.
-- firme: precio cerrado, costo conocido al recibir.
-- consignacion: sin precio al recibir; el costo nace en cero y se define
--   al liquidar, después de vender.
-- comision: Plein no compra ni toma título — el costo se queda en cero
--   permanentemente (no es un dato faltante).
-- No toca ninguna OC del corte (no hay OCs del corte — verificado: las
-- únicas inserciones a purchase_orders viven en 0002/0003/0008, datos de
-- catálogo/demo, no en las migraciones de apertura 0015/0016).

alter table purchase_orders add column if not exists deal_type text;

update purchase_orders set deal_type = case
  when exists (
    select 1 from purchase_order_lines l
    where l.purchase_order_id = purchase_orders.id and l.unit_cost > 0
  ) then 'firme'
  else 'consignacion'
end
where deal_type is null;

alter table purchase_orders alter column deal_type set default 'firme';
alter table purchase_orders alter column deal_type set not null;
