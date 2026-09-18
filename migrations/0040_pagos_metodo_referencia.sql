-- Pagos que cuadran (AUDITORIA-2026-09-03, hallazgos 3 y 4).
-- Método (ACH, cheque, efectivo…) y referencia (número de cheque / depósito
-- Chase) del cobro o pago como campos propios, no dentro de las notas.
-- Aditiva: sin drops, sin renames, no toca filas existentes (CORTE-CHASE igual).
alter table cash_movements add column if not exists method text;
alter table cash_movements add column if not exists reference text;
