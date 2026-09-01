-- Sesión BOL: el BOL propio de Plein, emitido al despachar una venta (embarque
-- de salida). Es un documento DISTINTO de purchase_orders.bol — ese es el BOL
-- del transportista capturado en la recepción de entrada y no se toca.
--
-- Reglas: aditiva (dos columnas nullable), idempotente, no toca opening ni
-- CORTE-CHASE. SQL en inglés, UI en español (convención del repo).

-- Folio propio (BOL-001, BOL-002…), generado con nextCode la primera vez que
-- se imprime; reimprimir no genera folio nuevo (mismo patrón que la factura).
alter table shipments add column if not exists bol_number text;

-- Conteo de pallets de salida capturado a mano. NO es el desglose por pallet
-- (pallets.sales_order_id sigue sin usarse — sesión futura); es solo el número
-- que el BOL imprime en sus totales.
alter table shipments add column if not exists pallet_count integer;

-- Un folio no se repite. Índice parcial: los embarques sin BOL (todas las
-- entradas, y salidas aún no impresas) quedan fuera.
create unique index if not exists shipments_bol_number_idx
  on shipments (bol_number) where bol_number is not null;
