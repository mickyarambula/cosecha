-- Bloque 0: que el P&L reparta los gastos por PARTIDA, no por una lista fija.
--
-- Hasta hoy había CUATRO listas de categorías de gasto que no coincidían: el
-- catálogo real (`money_concepts`), el mapeo editable (`gl_mappings`, sembrado
-- en inglés en `0009`), la lista escrita a mano de la pantalla de Cuentas, y
-- un switch dentro de `getFinancials`. Casi todo el catálogo real de Miguel
-- —Aduanas, In & out, Reempaque, Renta, Viáticos, Nómina…— no estaba en
-- ninguna de las tres últimas, así que caía en el cajón "59999 General".
--
-- El código ya resuelve la cuenta con tres escapes: la cuenta capturada en el
-- gasto, el mapeo de su concepto, y el mapeo de su PARTIDA. Esta migración
-- siembra el tercero, que es el que cubre el catálogo entero y hace que un
-- concepto nuevo nazca clasificado en vez de caer al cajón.
--
-- Las cinco partidas son las del libro V8 de Miguel. Decisiones suyas del
-- 19 Sep 2026: Costo va a costo de lo vendido; el flete conserva su renglón
-- propio; y las cuatro partidas de gasto tienen cuenta propia, no "General".
--
-- Solo DATOS: no crea ni altera tablas ni columnas. No toca el corte, ni
-- facturas opening, ni CORTE-CHASE, ni una liquidación emitida. No mueve un
-- solo peso — redistribuye entre cuentas lo que ya estaba sumado.

-- ── 1. Las cuatro cuentas que faltaban ──────────────────────────────────
-- Sin ellas, nómina, viáticos, renta e intereses comparten un solo renglón
-- "General" y el P&L no dice en qué se va el dinero. El reparto de indirectos
-- además necesita nómina y financiero separados: son bolsas distintas con
-- criterios de reparto distintos.
insert into gl_accounts (number, name, description, statement, kind, subtype, parent_number, tracking_start, starting_balance, sort_order) values
  ('52500', 'Nómina',                 'Sueldos de ventas, compras y administración', 'income', 'expense', 'Expense', null, '2026-08-19', 0, 37),
  ('56000', 'Gastos de venta',        'Viáticos, publicidad y demás gasto comercial', 'income', 'expense', 'Expense', null, '2026-08-19', 0, 38),
  ('57000', 'Gastos administrativos', 'Renta, asesoría, certificados, seguros, servicios', 'income', 'expense', 'Expense', null, '2026-08-19', 0, 39),
  ('58000', 'Gastos financieros',     'Cobros bancarios, intereses y costo del dinero', 'income', 'expense', 'Expense', null, '2026-08-19', 0, 40)
on conflict (number) do nothing;

-- El cajón es lo último que se lee en un P&L; hasta hoy quedaba en medio.
update gl_accounts set sort_order = 45 where number = '59999' and sort_order = 39;

-- ── 2. Cada partida a su cuenta ─────────────────────────────────────────
-- Esto es lo que cubre el catálogo entero. Un concepto nuevo que Miguel
-- agregue dentro de una partida hereda su cuenta automáticamente.
insert into gl_mappings (map_key, account_number) values
  ('partida:Costo',                '50000'),
  ('partida:Gasto Nómina',         '52500'),
  ('partida:Gasto de Venta',       '56000'),
  ('partida:Gasto Administrativo', '57000'),
  ('partida:Gasto Financiero',     '58000')
on conflict (map_key) do update set account_number = excluded.account_number;

-- ── 2b. Los conceptos clavados al cajón se sueltan ──────────────────────
-- La siembra de `0009` mandó cinco conceptos directo a "59999 General"
-- porque en ese momento era la única cuenta que existía para ellos. Ahora esa
-- fila ya no ayuda: es un mapeo POR CONCEPTO, que gana sobre la partida, así
-- que clavaría "Servicios de inspección" y "Control de calidad" en el cajón
-- aunque su partida (Gasto Administrativo) ya tenga casa propia. El cajón es
-- el último escape automático: no hace falta apuntarle a propósito.
delete from gl_mappings
 where account_number = '59999'
   and map_key in ('Inspection Services', 'Quality Control', 'Advertising',
                   'Commissions and fees', 'Disposal fees');

-- Y dos filas más de `0009` que estaban INERTES y que este bloque activaría
-- sin que nadie lo decidiera. `currentOf` nunca leía `gl_mappings`, así que
-- estas dos nunca se usaron: un gasto con esas categorías caía en el cajón.
-- Al encender el escape por concepto empezarían a mandar, y una de ellas
-- cruza a COSTO, que es arriba de la utilidad bruta:
--   · 'Cost of Labor' → 50000. Nadie decidió que la mano de obra fuera costo
--     de lo vendido; no está en el catálogo de Miguel y vuelve al cajón.
--   · 'Equipment' → 53000. Está en el catálogo bajo Gasto Administrativo, así
--     que sin esta fila sigue a su partida (57000), igual que Renta o Asesoría.
delete from gl_mappings where map_key in ('Cost of Labor', 'Equipment');

-- ── 3. La excepción del flete ───────────────────────────────────────────
-- "Fletes" vive bajo la partida Costo, así que sin esta línea se iría a
-- 50000 junto con aduanas y reempaque. Miguel decidió que conserve su renglón
-- propio, y así queda igual que "Freight" (inglés), que ya apuntaba a 51000
-- desde `0009` — los dos nombres, el mismo concepto, la misma cuenta.
-- Y con él, los otros tres conceptos en español que vivían SOLO dentro de ese
-- switch: el código los reconocía a mano y `gl_mappings` nunca los tuvo. Al
-- quitar la lista a fuego se habrían ido a su partida, cambiando en silencio
-- dónde aparecen hoy. Aquí quedan escritos, que es donde debieron estar
-- siempre. Dos de ellos ("Fletes", "Seguros") están en `money_concepts` y se
-- editan desde la pantalla de Cuentas; los otros dos son nombres heredados que
-- no están en el catálogo — la pantalla los muestra aparte, como heredados.
insert into gl_mappings (map_key, account_number) values
  ('Fletes',                             '51000'),
  ('Seguros',                            '55000'),
  ('Cuotas y suscripciones',             '53000'),
  ('Honorarios legales y profesionales', '55000')
on conflict (map_key) do update set account_number = excluded.account_number;

-- ── 4. El candado de "Materia prima" ────────────────────────────────────
-- El costo de la fruta en Cosecha viene de la ORDEN DE COMPRA y ya llega al
-- P&L por `lots.unit_cost` (cuenta 50000). Si además alguien lo captura como
-- gasto, esa fruta se cuenta DOS VECES.
--
-- "Materia prima" vive bajo la partida Costo, así que sin esta línea heredaría
-- 50000 y el doble conteo pasaría en silencio. Se manda al cajón a propósito:
-- ahí se ve, y el aviso del P&L ("cayeron en General") lo señala solo. No es
-- un mapeo "correcto" — es una alarma. Ese concepto no debe usarse como gasto
-- en Cosecha.
insert into gl_mappings (map_key, account_number) values
  ('Materia prima', '59999')
on conflict (map_key) do update set account_number = excluded.account_number;
