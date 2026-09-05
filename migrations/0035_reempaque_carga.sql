-- Rama reempaque-liquidacion — hallazgo 5 de AUDITORIA-2026-09-03.
-- PACA 7 CFR 46: el reempaque de fruta consignada es re-sorting /
-- reconditioning. Hay que registrar de qué carga viene, las cantidades
-- perdidas, la fecha y la justificación de la pérdida, y no se pueden agrupar
-- ventas de distintos consignadores (el servidor exige una sola OC por
-- reempaque). Aditiva e idempotente. No toca opening, bills del corte ni
-- CORTE-CHASE.

-- El reempaque sabe de qué carga es. La liquidación lee la merma por carga.
alter table pack_outs add column if not exists purchase_order_id integer references purchase_orders(id);
create index if not exists pack_outs_po_idx on pack_outs (purchase_order_id);

-- Entró, salió, diferencia. shrink_unit: 'caja' si origen y destino son el
-- mismo SKU; 'lb' si cambió la presentación (convertido con units.ts o
-- capturado a mano cuando el catálogo no trae peso neto).
alter table pack_outs add column if not exists consumed_qty numeric(14, 3);
alter table pack_outs add column if not exists produced_qty numeric(14, 3);
alter table pack_outs add column if not exists shrink_qty numeric(14, 3);
alter table pack_outs add column if not exists shrink_unit text;
-- 'grower' | 'plein'. El servidor lo exige cuando shrink_qty > 0.
alter table pack_outs add column if not exists shrink_charged_to text;
alter table pack_outs add column if not exists shrink_reason text;

-- Snapshot de la merma en el account of sales. Cuando la absorbe Plein, el
-- productor cobra esas cajas: unit_price es el promedio realizado de esa
-- fruta al emitir (o el capturado a mano si no hubo ventas) y amount el
-- dinero congelado. Cuando la absorbe el productor, unit_price queda nulo y
-- amount en 0: el renglón informa cantidad y motivo, sin monto.
create table if not exists grower_settlement_shrinks (
  id serial primary key,
  settlement_id integer not null references grower_settlements(id) on delete cascade,
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
create index if not exists gss_settlement_idx on grower_settlement_shrinks (settlement_id);

-- Total congelado de la compensación por merma en la cabecera, para que la
-- fórmula impresa (ingreso - gastos - comisión + merma pagada = neto) se
-- reproduzca sin sumar renglones: un renglón perdido cambiaría el neto
-- impreso sin que nadie lo note.
alter table grower_settlements add column if not exists shrink_compensation numeric(14, 2) not null default 0;

-- El renglón por lote cuadra y reporta lo que el productor entregó:
-- product_name/calibre guardan el producto de ORIGEN; packed_as el SKU del
-- hijo (informativo); repacked_out_qty las cajas que salieron a reempaque
-- desde este lote; repacked_from la lista congelada de lotes origen.
alter table grower_settlement_lots add column if not exists repacked_out_qty numeric(14, 3);
alter table grower_settlement_lots add column if not exists repacked_from text;
alter table grower_settlement_lots add column if not exists packed_as text;
