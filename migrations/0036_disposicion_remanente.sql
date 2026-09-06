-- Rama disposicion-remanente — bloque B (PACA 7 CFR 46).
-- En consignación y comisión pura hay que rendir cuentas del 100 % de lo
-- recibido: cada caja que no se vendió termina en uno de tres destinos —
-- pendiente de venta (sigue viva, se liquida en una cuenta posterior),
-- destruida (con motivo; certificado oficial si lo destruido llega o pasa del
-- 5 % del embarque) o comprada por Plein (a precio de mercado, sin comisión).
-- Aditiva e idempotente: tablas nuevas y columnas nullable. No toca opening,
-- bills del corte ni CORTE-CHASE.

-- Lo que se decide por cada lote con remanente, ANTES de emitir. Se puede
-- cancelar mientras la liquidación no esté emitida: el renglón se queda con
-- cancelled_at (rastro), nunca se borra.
create table if not exists lot_dispositions (
  id serial primary key,
  lot_id integer not null references lots(id),
  purchase_order_id integer not null references purchase_orders(id),
  kind text not null,                          -- 'pending_sale' | 'destroyed' | 'plein_purchase'
  quantity numeric(14, 3) not null,
  unit text,
  reason text,                                 -- destroyed: obligatorio (lo exige el servidor)
  unit_price numeric(14, 4),                   -- plein_purchase
  amount numeric(14, 2),                       -- plein_purchase: quantity × unit_price
  origin_equiv_qty numeric(14, 3),             -- cajas equivalentes en el lote recibido (base del 5 %)
  new_lot_id integer references lots(id),      -- plein_purchase: el lote propio de Plein que nace
  settlement_id integer references grower_settlements(id),  -- se llena al emitir
  created_by text,
  created_at timestamptz not null default now(),
  cancelled_at timestamptz,
  cancelled_by text,
  cancel_reason text
);
create index if not exists lot_dispositions_lot_idx on lot_dispositions (lot_id);
create index if not exists lot_dispositions_po_idx on lot_dispositions (purchase_order_id);

-- Contadores en el lote (el cuadre por lote se lee de aquí) y el lote propio
-- de Plein: owner_kind = 'plein' es fruta que Plein le compró al productor;
-- no tiene carga y no entra a ninguna liquidación.
alter table lots add column if not exists destroyed_qty numeric(14, 3);
alter table lots add column if not exists plein_bought_qty numeric(14, 3);
alter table lots add column if not exists owner_kind text;
alter table lots add column if not exists disposition_id integer references lot_dispositions(id);

-- Certificado oficial cuando lo destruido llega o pasa del 5 % del embarque.
-- Ligado a la carga porque se necesita ANTES de emitir. El archivo vive en
-- bytea, mismo patrón que customer_pos.attachment_data.
create table if not exists destruction_certificates (
  id serial primary key,
  purchase_order_id integer not null references purchase_orders(id),
  certificate_number text not null,
  certificate_date date,
  issuer text,
  filename text,
  mime text,
  data bytea,
  created_by text,
  created_at timestamptz not null default now()
);
create index if not exists destruction_certificates_po_idx on destruction_certificates (purchase_order_id);

-- Snapshot al emitir: un renglón por disposición (pendientes incluidas), con
-- texto copiado — una edición futura no reescribe un documento entregado.
create table if not exists grower_settlement_dispositions (
  id serial primary key,
  settlement_id integer not null references grower_settlements(id) on delete cascade,
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
create index if not exists gsd_settlement_idx on grower_settlement_dispositions (settlement_id);

-- Cabecera congelada: base del 5 %, lo destruido (en cajas equivalentes de
-- origen), el %, si la cuenta salió parcial y el certificado tal como estaba.
alter table grower_settlements add column if not exists received_qty numeric(14, 3);
alter table grower_settlements add column if not exists destroyed_equiv_qty numeric(14, 3);
alter table grower_settlements add column if not exists destroyed_pct numeric(8, 4);
alter table grower_settlements add column if not exists plein_purchase_total numeric(14, 2);
alter table grower_settlements add column if not exists is_partial boolean;
alter table grower_settlements add column if not exists certificate_id integer references destruction_certificates(id);
alter table grower_settlements add column if not exists certificate_number text;
alter table grower_settlements add column if not exists certificate_date date;

-- Renglón por lote congelado: el cuadre completo en la unidad del lote.
-- recibidas = vendidas + merma de bodega + a reempaque + destruidas +
-- compradas por Plein + pendientes de venta.
alter table grower_settlement_lots add column if not exists waste_qty numeric(14, 3);
alter table grower_settlement_lots add column if not exists waste_reason text;
alter table grower_settlement_lots add column if not exists destroyed_qty numeric(14, 3);
alter table grower_settlement_lots add column if not exists plein_bought_qty numeric(14, 3);
alter table grower_settlement_lots add column if not exists pending_qty numeric(14, 3);
alter table grower_settlement_lots add column if not exists original_qty numeric(14, 3);
