-- Documentos completos (AUDITORIA-2026-09-03, hallazgos 9 y 10).
-- Aditiva: columnas nullable, sin drops ni renames. No toca documentos ya
-- emitidos (una factura vieja conserva su descripción tal como se imprimió).

-- Factura: la línea recuerda el empaque/calibre exacto que se vendió, para
-- que el SKU impreso sea el del pack (PAPA-MARA-CAJA-6CT) y no el del producto.
alter table invoice_lines add column if not exists pack_style_id integer references pack_styles(id);

-- BOL por embarque: cada despacho dice en qué camión salió. Sin esto el BOL
-- imprimía todas las líneas de la orden a cantidad pedida.
alter table sale_line_allocations add column if not exists shipment_id integer references shipments(id);
create index if not exists sla_shipment_idx on sale_line_allocations (shipment_id);

-- Fecha de emisión congelada del BOL: reimprimir devuelve la misma fecha.
alter table shipments add column if not exists bol_issued_at timestamptz;
