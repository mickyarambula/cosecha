-- Sesión de afinación del CPO: catálogo real de destinos de entrega por
-- cliente (la sección "Addresses" de Contacts era un mockup sin datos, y
-- "Delivery Routes" es el catálogo de ubicaciones de almacén/inventario —
-- ninguno servía como libreta de direcciones del cliente).

create table if not exists customer_locations (
  id serial primary key,
  customer_id integer not null references customers(id),
  label text,
  address_line text not null,
  city text,
  state text,
  zip text,
  receiving_instructions text,
  is_default boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists customer_locations_customer_idx on customer_locations(customer_id);

alter table customer_pos add column if not exists ship_to_location_id integer references customer_locations(id);
alter table customer_pos add column if not exists payment_terms text;

alter table sales_orders add column if not exists ship_to_location_id integer references customer_locations(id);
alter table sales_orders add column if not exists payment_terms text;
