-- "Que la captura no mienta" (AUDITORIA-2026-09-03, hallazgo 18).
--
-- La pantalla de Nueva orden de venta captura tipo de orden, fecha de
-- recolección y ruta de entrega, pero no existía dónde guardarlos: se perdían
-- al guardar, y la lista y el detalle imprimían "Entrega a cliente" fijo
-- aunque hubieras elegido Recolección.
--
-- `requested_date` ya existía desde migrations/0020; solo faltaban estas tres.
-- Aditiva: columnas nuevas, todas opcionales. No toca filas ni el corte.
alter table sales_orders add column if not exists order_type text;
alter table sales_orders add column if not exists pickup_date date;
alter table sales_orders add column if not exists delivery_route text;
