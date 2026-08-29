-- Sesión de limpieza: la temperatura es del producto, no del lugar. Antes
-- vivía pegada al nombre de la cámara ("Cámara 1 — 4°C"); ahora cada
-- ubicación guarda su propio set point (temperatura real de operación) y
-- cada producto guarda su rango recomendado, para poder avisar (sin
-- bloquear) cuando no coinciden al recibir.

alter table products add column if not exists storage_temp_min numeric(5, 1);
alter table products add column if not exists storage_temp_max numeric(5, 1);
alter table products add column if not exists storage_temp_unit text;

alter table locations add column if not exists set_point_temp numeric(5, 1);
alter table locations add column if not exists set_point_unit text;

-- Separa la temperatura del texto del nombre.
update locations set name = 'Cámara 1', set_point_temp = 4, set_point_unit = 'C' where code = 'CAM-01';
update locations set name = 'Cámara 2', set_point_temp = 8, set_point_unit = 'C' where code = 'CAM-02';

-- Rangos reales que dio Miguel, aplicados por nombre de producto (cubre
-- ambos catálogos — el genérico de 0003 y el real de Plein en 0014).
update products set storage_temp_min = 45, storage_temp_max = 50, storage_temp_unit = 'F' where name ilike 'papaya';
update products set storage_temp_min = 45, storage_temp_max = 48, storage_temp_unit = 'F' where name ilike 'bell pepper%';
update products set storage_temp_min = 7, storage_temp_max = 7, storage_temp_unit = 'C' where name ilike '%habanero%';
