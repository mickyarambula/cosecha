-- Destinos (SHIP TO) y vocabularios de empaque/calibre/grado.

alter table locations add column if not exists city text;
alter table locations add column if not exists owner_kind text not null default 'propia';
alter table locations add column if not exists contact_name text;
alter table locations add column if not exists notes text;

update locations set city = 'Nogales', owner_kind = 'propia' where code in ('CAM-01', 'CAM-02', 'EMP-01', 'BOD-NOG');
update locations set city = 'McAllen', owner_kind = 'propia' where code = 'BOD-MFE';

insert into locations (code, name, location_type, city, owner_kind, notes) values
  ('BOD-NGM', 'Northgate DC Anaheim', 'bodega', 'Anaheim', 'cliente', 'Entrega directa al DC de Northgate'),
  ('XD-PHR', 'Cross-dock Pharr', 'cross_dock', 'Pharr', 'propia', 'Cruce Texas — no se almacena')
on conflict (code) do nothing;

create table if not exists value_lists (
  id serial primary key,
  kind text not null,
  value text not null,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  unique (kind, value)
);

insert into value_lists (kind, value, sort_order) values
  ('empaque', 'Carton', 1),
  ('empaque', 'Clamshell', 2),
  ('empaque', 'Plastic Crate', 3),
  ('empaque', 'Caja', 4),
  ('calibre', '7 ct', 7),
  ('calibre', '8 ct', 8),
  ('calibre', '9 ct', 9),
  ('calibre', '10 ct', 10),
  ('calibre', '12 ct', 12),
  ('calibre', '14 ct', 14),
  ('calibre', '16 ct', 16),
  ('calibre', '18 ct', 18),
  ('grado', 'Fancy', 1),
  ('grado', 'Choice', 2),
  ('grado', 'Extra', 3),
  ('grado', 'Primera', 4)
on conflict (kind, value) do nothing;

select setval('locations_id_seq', (select coalesce(max(id), 1) from locations));
select setval('value_lists_id_seq', (select coalesce(max(id), 1) from value_lists));
