-- Sesión CPO: fecha de entrega solicitada, adjunto real (bytea, no liga),
-- y rechazo con motivo para customer_pos. attachment_url queda en la tabla
-- por compatibilidad con filas viejas, pero de aquí en adelante el archivo
-- vive en la base (attachment_data), no en una URL externa.

alter table customer_pos add column if not exists requested_date date;
alter table customer_pos add column if not exists attachment_filename text;
alter table customer_pos add column if not exists attachment_mime text;
alter table customer_pos add column if not exists attachment_data bytea;
alter table customer_pos add column if not exists rejected_at timestamptz;
alter table customer_pos add column if not exists rejected_by text;
alter table customer_pos add column if not exists rejected_reason text;

alter table sales_orders add column if not exists requested_date date;
