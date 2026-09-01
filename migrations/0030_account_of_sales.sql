-- Sesión account of sales: la liquidación al productor se vuelve un documento
-- EMITIDO Y CONGELADO (mismo criterio que factura y BOL) — define cuánto se le
-- paga al productor, así que no puede cambiar después de emitido. Hasta hoy
-- todo se recalculaba al vuelo en loadSettlement; eso sigue vivo para la
-- pantalla, pero el documento sale de este snapshot.
--
-- Aplica a consignación y comisión pura. NO aplica a firme (ahí Plein compró
-- y paga contra bill).
--
-- Reglas: aditiva, idempotente, no toca opening ni CORTE-CHASE, no toca el
-- camino de bill de consignación. SQL en inglés, UI en español.

create table if not exists grower_settlements (
  id serial primary key,
  settlement_number text not null unique,
  purchase_order_id integer not null references purchase_orders(id),
  supplier_id integer not null references suppliers(id),
  deal_type text not null,
  commission_type text,
  commission_rate numeric(12, 4),
  issue_date date not null default current_date,
  -- Montos congelados al emitir — reimprimir devuelve esto, no recalcula.
  sold_units numeric(14, 3) not null default 0,
  revenue numeric(14, 2) not null default 0,
  grower_expenses numeric(14, 2) not null default 0,
  commission numeric(14, 2) not null default 0,
  net_to_grower numeric(14, 2) not null default 0,
  advance_recovered numeric(14, 2) not null default 0,
  final_payment numeric(14, 2) not null default 0,
  -- Documento compartible, mismo patrón de token que facturas/OCs/OVs (0018).
  share_token text not null default (md5(random()::text || clock_timestamp()::text) || md5(random()::text || clock_timestamp()::text)),
  created_by text,
  created_at timestamptz not null default now()
);
-- Una liquidación por carga: emitir dos veces es imposible por esquema.
create unique index if not exists grower_settlements_po_idx
  on grower_settlements (purchase_order_id);
create index if not exists grower_settlements_supplier_idx
  on grower_settlements (supplier_id);

-- Desglose por lote tal como salió impreso. Los textos se congelan (nombre de
-- producto, calibre) para que una edición futura del catálogo no reescriba un
-- documento ya entregado. remaining_qty alimenta el aviso de "quedaban cajas
-- sin vender al emitir".
create table if not exists grower_settlement_lots (
  id serial primary key,
  settlement_id integer not null references grower_settlements(id) on delete cascade,
  lot_id integer references lots(id),
  lot_number text not null,
  product_name text not null,
  calibre text,
  sold_qty numeric(14, 3) not null default 0,
  unit text,
  unit_price numeric(12, 4),
  revenue numeric(14, 2) not null default 0,
  remaining_qty numeric(14, 3) not null default 0
);
create index if not exists gsl_settlement_idx on grower_settlement_lots (settlement_id);

-- Gastos del productor congelados por concepto, tal como se descontaron.
create table if not exists grower_settlement_expenses (
  id serial primary key,
  settlement_id integer not null references grower_settlements(id) on delete cascade,
  category text not null,
  notes text,
  amount numeric(14, 2) not null
);
create index if not exists gse_settlement_idx on grower_settlement_expenses (settlement_id);

-- Recuperación de adelantos APLICADA POR LA LIQUIDACIÓN (comisión pura, donde
-- no existe bill). Es el rastro de auditoría de la ruta nueva — hermana de
-- grower_advance_applications (ruta bill), que queda intacta. La guarda contra
-- doble recuperación NO vive aquí: vive en el update condicional sobre
-- grower_advances.recovered, que ambas rutas comparten.
create table if not exists settlement_advance_applications (
  id serial primary key,
  advance_id integer not null references grower_advances(id),
  settlement_id integer not null references grower_settlements(id),
  purchase_order_id integer references purchase_orders(id),
  amount numeric(14, 2) not null,
  created_at timestamptz not null default now()
);
create index if not exists saa_advance_idx on settlement_advance_applications (advance_id);
create index if not exists saa_settlement_idx on settlement_advance_applications (settlement_id);
