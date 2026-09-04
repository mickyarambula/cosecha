-- Rama fix-facturacion-creditos — Bug A de AUDITORIA-2026-09-03 (hallazgos 2 y 22).
--
-- Hasta hoy el folio se calculaba leyendo "la última fila por id cuyo folio
-- empiece con el prefijo" y sumando 1. Eso falla de tres formas:
--   · prefijos anidados: PP-2026- también abarca PP-2026-CR-001, así que tras
--     la primera nota de crédito la siguiente factura repite PP-2026-0002;
--   · orden de emisión distinto al de inserción (el BOL se numera al imprimir,
--     no al capturar el embarque), así que "último por id" no es "último
--     emitido" y BOL-002 se repite;
--   · dos capturas al mismo tiempo calculan el mismo número.
--
-- Un contador por serie. La serie ES el prefijo completo (PP-2026- y
-- PP-2026-CR- son contadores distintos). El servidor lo incrementa con un
-- update ... returning (atómico) y verifica que el folio no exista antes de
-- devolverlo. Los prefijos NO cambian y ningún folio emitido se renumera: cada
-- serie se siembra con el número MÁS ALTO que ya exista con el patrón anclado
-- ^PREFIJO\d+$ (PP-2026-CR-001 no cuenta para PP-2026-; FAC-HA-011 no cuenta
-- para FAC-). Las series dinámicas (PP-AAAA-, PP-AAAA-CR-, CPO-AAMM-,
-- LOT-AAMM-, RPK-aammdd-, lotes por carga "22-PAP-") se siembran con la misma
-- regla en el servidor la primera vez que se usan.
--
-- Aditiva e idempotente. No toca opening, bills del corte ni CORTE-CHASE.

create table if not exists folio_counters (
  series text primary key,
  last_value bigint not null default 0,
  updated_at timestamptz not null default now()
);

insert into folio_counters (series, last_value)
select 'SKU-', coalesce(max(substring(sku from '^SKU-(\d+)$')::bigint), 0) from products
on conflict (series) do nothing;

insert into folio_counters (series, last_value)
select 'PRO-', coalesce(max(substring(code from '^PRO-(\d+)$')::bigint), 0) from suppliers
on conflict (series) do nothing;

insert into folio_counters (series, last_value)
select 'CLI-', coalesce(max(substring(code from '^CLI-(\d+)$')::bigint), 0) from customers
on conflict (series) do nothing;

insert into folio_counters (series, last_value)
select 'CAM-', coalesce(max(substring(code from '^CAM-(\d+)$')::bigint), 0) from locations
on conflict (series) do nothing;

insert into folio_counters (series, last_value)
select 'BOD-', coalesce(max(substring(code from '^BOD-(\d+)$')::bigint), 0) from locations
on conflict (series) do nothing;

insert into folio_counters (series, last_value)
select 'XD-', coalesce(max(substring(code from '^XD-(\d+)$')::bigint), 0) from locations
on conflict (series) do nothing;

insert into folio_counters (series, last_value)
select 'EMP-', coalesce(max(substring(code from '^EMP-(\d+)$')::bigint), 0) from locations
on conflict (series) do nothing;

insert into folio_counters (series, last_value)
select 'OC-', coalesce(max(substring(po_number from '^OC-(\d+)$')::bigint), 0) from purchase_orders
on conflict (series) do nothing;

insert into folio_counters (series, last_value)
select 'OV-', coalesce(max(substring(so_number from '^OV-(\d+)$')::bigint), 0) from sales_orders
on conflict (series) do nothing;

insert into folio_counters (series, last_value)
select 'EMB-', coalesce(max(substring(shipment_number from '^EMB-(\d+)$')::bigint), 0) from shipments
on conflict (series) do nothing;

insert into folio_counters (series, last_value)
select 'BOL-', coalesce(max(substring(bol_number from '^BOL-(\d+)$')::bigint), 0) from shipments
on conflict (series) do nothing;

insert into folio_counters (series, last_value)
select 'LIQ-', coalesce(max(substring(settlement_number from '^LIQ-(\d+)$')::bigint), 0) from grower_settlements
on conflict (series) do nothing;

insert into folio_counters (series, last_value)
select 'REM-', coalesce(max(substring(payable_number from '^REM-(\d+)$')::bigint), 0) from grower_payables
on conflict (series) do nothing;

insert into folio_counters (series, last_value)
select 'ADE-', coalesce(max(substring(advance_number from '^ADE-(\d+)$')::bigint), 0) from grower_advances
on conflict (series) do nothing;

insert into folio_counters (series, last_value)
select 'MOV-', coalesce(max(substring(folio from '^MOV-(\d+)$')::bigint), 0) from cash_movements
on conflict (series) do nothing;

insert into folio_counters (series, last_value)
select 'EXP-', coalesce(max(substring(expense_number from '^EXP-(\d+)$')::bigint), 0) from expenses
on conflict (series) do nothing;

insert into folio_counters (series, last_value)
select 'FAC-', coalesce(max(substring(bill_number from '^FAC-(\d+)$')::bigint), 0) from supplier_bills
on conflict (series) do nothing;

insert into folio_counters (series, last_value)
select 'RPK-', coalesce(max(substring(pack_number from '^RPK-(\d+)$')::bigint), 0) from pack_outs
on conflict (series) do nothing;
