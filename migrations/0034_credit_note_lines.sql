-- Rama fix-facturacion-creditos — Bug B de AUDITORIA-2026-09-03 (hallazgos 1 y 46).
--
-- La nota de crédito pasa a acreditar exactamente lo capturado y a saber a qué
-- factura pertenece (invoices.parent_invoice_id ya existe desde 0009; hasta
-- hoy nadie lo llenaba). El tipo de crédito que el modal siempre mostró
-- (devolución / merma o rechazo / ajuste de precio) por fin se guarda, por
-- línea, para que salga impreso y quede el rastro de por qué se acreditó.
--
-- 'devolucion' NO regresa fruta al inventario: ese flujo (devoluciones y
-- rechazos del cliente) es la mejora 3 de la auditoría, fuera de este alcance.
--
-- Aditiva e idempotente. No toca opening, bills del corte ni CORTE-CHASE.

alter table invoice_lines add column if not exists credit_type text;
