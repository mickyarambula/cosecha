-- Área de mejora #3 (AUDITORIA-2026-09-03): devoluciones y rechazos del cliente.
--
-- Hoy un reclamo del cliente solo puede terminar en una nota de crédito: el
-- dinero baja, pero la fruta no existe en ningún lado. Nadie sabe si esas
-- cajas regresaron a la cámara, si se destruyeron, ni con qué papel — que es
-- justo lo que PACA pide documentar. `lots.rts_qty` existe desde la migración
-- 0008 y nunca tuvo quién la escribiera.
--
-- El modelo, decidido con Miguel el 19 Sep 2026:
--   · La fruta y el dinero salen de UNA sola captura, así no se contradicen.
--   · La fruta que vuelve buena nace como lote NUEVO marcado "devuelto", con
--     el costo y la carga del original — no se revuelve con fruta que nunca
--     salió de la cámara.
--   · La culpa se decide caso por caso (productor o Plein), igual que en la
--     nota de crédito, y por ese mismo camino viaja el dinero: en consignación
--     y comisión la atribución (C-1b) le baja el neto al productor cuando la
--     fruta llegó mal, y no le baja nada cuando el error fue de Plein.
--   · Cuarto destino: "no regresó" — el camión se rechazó en destino y la
--     fruta se vendió allá, se donó o se tiró sin volver a Nogales.
--
-- Todo aditivo: tablas nuevas y columnas con default. No toca el corte, ni
-- facturas opening, ni CORTE-CHASE, ni una liquidación emitida.

-- ── El documento de la devolución ────────────────────────────────────────
create table if not exists customer_returns (
  id serial primary key,
  return_number text not null unique,                   -- DEV-001
  sales_order_id integer not null references sales_orders(id),
  customer_id integer not null references customers(id),
  invoice_id integer references invoices(id),           -- la factura que se corrige
  credit_invoice_id integer references invoices(id),    -- la nota de crédito que nació
  return_date date not null,
  claim_reference text,                                 -- folio del reclamo del cliente
  inspection_type text,                                 -- USDA / Federal-Estatal / Propia / Ninguna
  inspection_folio text,
  notes text,
  credit_total numeric(14, 2) not null default 0,
  created_by text,
  created_at timestamptz not null default now(),
  cancelled_at timestamptz,
  cancelled_by text,
  cancel_reason text
);
create index if not exists customer_returns_so_idx on customer_returns (sales_order_id);
create index if not exists customer_returns_customer_idx on customer_returns (customer_id);

-- ── Cada renglón: cuántas cajas, de qué lote, a dónde va y de quién fue ──
create table if not exists customer_return_lines (
  id serial primary key,
  return_id integer not null references customer_returns(id) on delete cascade,
  sales_order_line_id integer not null references sales_order_lines(id),
  allocation_id integer not null references sale_line_allocations(id),
  lot_id integer not null references lots(id),          -- el lote que surtió esas cajas
  quantity numeric(14, 3) not null,
  unit text,
  -- 'restock'      → vuelve al inventario como lote nuevo marcado devuelto
  -- 'destroyed'    → se destruye, con motivo y certificado
  -- 'not_returned' → nunca volvió a Nogales (vendida en destino, donada, tirada)
  destination text not null,
  new_lot_id integer references lots(id),               -- el lote devuelto que nace
  destroy_reason text,                                  -- obligatorio si se destruye
  destroy_certificate text,                             -- folio del certificado (PACA)
  not_returned_detail text,                             -- qué pasó con ella allá
  salvage_amount numeric(14, 2) not null default 0,     -- lo que se recuperó en destino
  cause text not null,                                  -- 'grower' | 'plein'
  reason text not null,                                 -- motivo, obligatorio
  credit_per_unit numeric(14, 4) not null default 0,
  credit_amount numeric(14, 2) not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists customer_return_lines_return_idx on customer_return_lines (return_id);
create index if not exists customer_return_lines_alloc_idx on customer_return_lines (allocation_id);
create index if not exists customer_return_lines_lot_idx on customer_return_lines (lot_id);

-- ── Lo devuelto sale del costo de venta sin borrar lo que se facturó ─────
-- El ingreso del productor se lee de `quantity × precio` y NO se toca: lo que
-- decide si él absorbe el golpe es la atribución de la nota de crédito, no el
-- hecho físico de que la caja volviera. Pero el COSTO sí tiene que salir: esas
-- cajas están otra vez en la cámara, y cobrarlas como vendidas y tenerlas en
-- inventario al mismo tiempo las contaría dos veces.
alter table sale_line_allocations add column if not exists returned_qty numeric(14, 3) not null default 0;

-- ── El lote devuelto sabe de dónde viene ─────────────────────────────────
alter table lots add column if not exists returned_from_lot_id integer references lots(id);
create index if not exists lots_returned_from_idx on lots (returned_from_lot_id);
