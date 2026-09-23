-- 0050: moneda y tipo de cambio en los documentos de compra (peso–dólar, parte A).
--
-- Plein compra en PESOS y lleva libros en DÓLARES, y hasta hoy el ERP no tenía
-- moneda en ningún documento de dinero: Miguel convertía de cabeza y dos
-- documentos de la misma carga salían con tipos de cambio distintos (el 17.23
-- del cotizador contra el 17.35 del análisis de costos). Sobre un margen neto
-- de 5.3 %, un peso de movimiento en el dólar se come el 24 % de la utilidad
-- de una carga — y no quedaba registrado en ningún lado.
--
-- El molde viene del motor de Azagro (Decisiones 76-81 de ese proyecto),
-- INVERTIDO: allá los libros van en pesos y el dólar es lo extranjero; aquí
-- es al revés. Las columnas que SUMAN se quedan en dólares — CxP, P&L,
-- Balance y las anclas no cambian de unidad. Lo nuevo es el registro del
-- original en pesos (`*_fx`) y del tipo de cambio con que se convirtió
-- (`fx_rate` / `fx_agreed`: pesos por dólar, p. ej. 17.23).
--
-- Reglas que viven en el servidor, no aquí:
--   · Un documento en pesos SIN tipo de cambio no se guarda. Nunca se inventa.
--   · La factura del proveedor se congela al TC pactado de su carga
--     (`fx_agreed`); no se revalúa, porque `saldo = total − paid` no se toca.
--   · Un solo TC pactado por carga: los documentos de esa carga lo proponen.
--
-- Aditiva: columnas nullable o con default 'USD'. El default declara en qué
-- moneda están los documentos que ya existen —incluidas las 62 facturas del
-- corte— y lo que declara es cierto: están en dólares. No mueve un solo peso
-- ni un solo dólar. Miguel lo aprobó a conciencia el 22 Sep 2026.
alter table suppliers            add column if not exists currency text;                       -- moneda de pago default; en blanco = sin default
alter table purchase_orders      add column if not exists currency text not null default 'USD';
alter table purchase_orders      add column if not exists fx_rate numeric(12,6);               -- TC pactado de la carga
alter table purchase_order_lines add column if not exists unit_cost_fx numeric(14,4);          -- precio original por unidad, en pesos
alter table supplier_bills       add column if not exists currency text not null default 'USD';
alter table supplier_bills       add column if not exists total_fx numeric(14,2);              -- los pesos que se deben
alter table supplier_bills       add column if not exists fx_agreed numeric(12,6);             -- el TC congelado
alter table expenses             add column if not exists currency text not null default 'USD';
alter table expenses             add column if not exists amount_fx numeric(14,2);
alter table expenses             add column if not exists fx_rate numeric(12,6);
alter table grower_advances      add column if not exists currency text not null default 'USD';
alter table grower_advances      add column if not exists amount_fx numeric(14,2);
alter table grower_advances      add column if not exists fx_rate numeric(12,6);
