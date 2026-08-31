-- Sesión pallets: estructura real de pallets por carga. Hoy el "pallet" es
-- solo un número por línea de la OC (0007) — no existe dónde decir qué lleva
-- cada pallet, ni soportar el pallet mixto del manifiesto real de Cornejos
-- (pallet 25: LARGE 18 + MEDIUM 29; pallet 26: JUMBO 25 + CHOICE MEDIUM 11).
--
-- Reglas: aditiva (tablas nuevas), idempotente, no toca opening ni
-- CORTE-CHASE. SQL en inglés, UI en español (convención del repo).
--
-- Modelo: un pallet pertenece a una orden (OC hoy; sales_order_id queda
-- listo para pallets de salida en otra sesión, mismo patrón que shipments).
-- Cada pallet tiene 1..N renglones; el renglón apunta a la LÍNEA de la
-- orden (el calibre vive en el SKU de la línea) — así el cuadre es
-- aritmética exacta contra las cajas de la carga y un pallet no puede
-- inventar un calibre que la carga no trae. El pallet mixto es simplemente
-- un pallet con dos renglones, no un caso especial.
--
-- "CHOICE MEDIUM COLOR" del manifiesto NO es un calibre nuevo: en los
-- totales cuenta como CHOICE MEDIUM. Va en `note` del renglón.
--
-- Sin CHECK constraints (convención): el candado de "la línea pertenece a
-- la misma orden que el pallet" vive en los server fns.

create table if not exists pallets (
  id serial primary key,
  purchase_order_id integer references purchase_orders(id),
  sales_order_id integer references sales_orders(id),
  -- posición en la carga, 1..N como en el manifiesto; se renumera al borrar
  pallet_number integer not null,
  notes text,
  created_at timestamptz not null default now()
);
create unique index if not exists pallets_po_number_idx
  on pallets (purchase_order_id, pallet_number) where purchase_order_id is not null;
create unique index if not exists pallets_so_number_idx
  on pallets (sales_order_id, pallet_number) where sales_order_id is not null;

create table if not exists pallet_lines (
  id serial primary key,
  pallet_id integer not null references pallets(id) on delete cascade,
  -- entrada: línea de la OC (requerida por el server fn para pallets de OC)
  purchase_order_line_id integer references purchase_order_lines(id),
  -- salida (sesión futura): línea de la OV
  sales_order_line_id integer references sales_order_lines(id),
  cases numeric(12, 2) not null,
  note text -- matiz del manifiesto ("COLOR"), no un calibre nuevo
);
create index if not exists pallet_lines_pallet_idx on pallet_lines (pallet_id);
create index if not exists pallet_lines_po_line_idx on pallet_lines (purchase_order_line_id);
