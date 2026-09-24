-- 0053: seguridad para arrancar (24 Sep 2026).
--
-- Dos cosas contra intrusos, ninguna mueve dinero:
--
-- 1. Límite de intentos al iniciar sesión, GUARDADO EN LA BASE. Hasta hoy el
--    límite vivía en la memoria de cada servidor: en Vercel cada petición
--    puede caer en un servidor distinto, así que alguien probando contraseñas
--    casi nunca chocaba con él. Con la tabla, el conteo es uno solo para
--    todos. La tabla es la que pide Better Auth (`rateLimit`: key, count,
--    lastRequest en milisegundos).
--
-- 2. Claves de las ligas públicas (factura, orden, liquidación, cuenta del
--    productor) hechas con el generador aleatorio SEGURO de Postgres
--    (`gen_random_uuid`, 244 bits) en vez de `md5(random())`, que no está
--    hecho para secretos. Y se regeneran todas las que ya existen: ninguna
--    liga real se ha mandado todavía (producción no tiene operación viva),
--    así que no se rompe nada que alguien esté usando. Las facturas del corte
--    solo cambian de clave; su contenido no se toca.
--
-- Aditiva: una tabla nueva y defaults nuevos. No toca montos, facturas
-- opening (salvo su clave de liga), bills del corte, CORTE-CHASE ni
-- liquidaciones emitidas (salvo su clave de liga).

-- ── 1. Límite de intentos ───────────────────────────────────────────────
create table if not exists "rateLimit" (
  "id" text not null primary key,
  "key" text not null unique,
  "count" integer not null,
  "lastRequest" bigint not null
);

-- ── 2. Claves de ligas públicas ─────────────────────────────────────────
alter table invoices                      alter column share_token set default (replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', ''));
alter table purchase_orders               alter column share_token set default (replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', ''));
alter table sales_orders                  alter column share_token set default (replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', ''));
alter table suppliers                     alter column share_token set default (replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', ''));
alter table grower_settlements            alter column share_token set default (replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', ''));
alter table grower_settlement_supplements alter column share_token set default (replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', ''));

update invoices                      set share_token = replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
update purchase_orders               set share_token = replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
update sales_orders                  set share_token = replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
update suppliers                     set share_token = replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
update grower_settlements            set share_token = replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
update grower_settlement_supplements set share_token = replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
