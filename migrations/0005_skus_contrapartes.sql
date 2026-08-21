-- SKU = producto × empaque × calibre. Contraparte puede ser proveedor y cliente.

alter table pack_styles add column if not exists sku_code text;
alter table pack_styles add column if not exists empaque text;
alter table pack_styles add column if not exists calibre text;

create unique index if not exists pack_sku_code_uidx on pack_styles (sku_code) where sku_code is not null;

alter table customer_po_lines add column if not exists pack_style_id integer references pack_styles(id);
alter table sales_order_lines add column if not exists pack_style_id integer references pack_styles(id);

alter table suppliers add column if not exists es_proveedor boolean not null default true;
alter table suppliers add column if not exists es_cliente boolean not null default false;
alter table suppliers add column if not exists linked_customer_id integer references customers(id);

alter table customers add column if not exists es_cliente boolean not null default true;
alter table customers add column if not exists es_proveedor boolean not null default false;
alter table customers add column if not exists linked_supplier_id integer references suppliers(id);

-- Pack 7 (semilla papaya) es el SKU que pide Northgate: Carton 10 ct.
update pack_styles
set name = 'Carton 10 ct',
    sku_code = 'PAP-CARTON-10CT',
    empaque = 'Carton',
    calibre = '10 ct',
    net_weight = 35,
    weight_unit = 'lb',
    is_default = true
where id = 7;

insert into pack_styles (product_id, name, unit_of_measure, net_weight, weight_unit, is_default, sku_code, empaque, calibre)
select 6, v.name, 'caja', v.w, 'lb', false, v.sku, v.emp, v.cal
from (values
  ('Carton 7 ct',  40, 'PAP-CARTON-7CT',  'Carton', '7 ct'),
  ('Carton 8 ct',  38, 'PAP-CARTON-8CT',  'Carton', '8 ct'),
  ('Carton 9 ct',  36, 'PAP-CARTON-9CT',  'Carton', '9 ct'),
  ('Carton 12 ct', 35, 'PAP-CARTON-12CT', 'Carton', '12 ct'),
  ('Carton 14 ct', 35, 'PAP-CARTON-14CT', 'Carton', '14 ct'),
  ('Carton 16 ct', 35, 'PAP-CARTON-16CT', 'Carton', '16 ct'),
  ('Carton 18 ct', 35, 'PAP-CARTON-18CT', 'Carton', '18 ct'),
  ('Clamshell 7 ct',  2, 'PAP-CLAM-7CT',  'Clamshell', '7 ct'),
  ('Clamshell 8 ct',  2, 'PAP-CLAM-8CT',  'Clamshell', '8 ct'),
  ('Clamshell 9 ct',  2, 'PAP-CLAM-9CT',  'Clamshell', '9 ct'),
  ('Clamshell 10 ct', 2, 'PAP-CLAM-10CT', 'Clamshell', '10 ct'),
  ('Clamshell 12 ct', 2, 'PAP-CLAM-12CT', 'Clamshell', '12 ct'),
  ('Clamshell 14 ct', 2, 'PAP-CLAM-14CT', 'Clamshell', '14 ct'),
  ('Clamshell 16 ct', 2, 'PAP-CLAM-16CT', 'Clamshell', '16 ct'),
  ('Clamshell 18 ct', 2, 'PAP-CLAM-18CT', 'Clamshell', '18 ct'),
  ('Plastic Crate 7 ct',  22, 'PAP-CRATE-7CT',  'Plastic Crate', '7 ct'),
  ('Plastic Crate 8 ct',  22, 'PAP-CRATE-8CT',  'Plastic Crate', '8 ct'),
  ('Plastic Crate 9 ct',  22, 'PAP-CRATE-9CT',  'Plastic Crate', '9 ct'),
  ('Plastic Crate 10 ct', 22, 'PAP-CRATE-10CT', 'Plastic Crate', '10 ct'),
  ('Plastic Crate 12 ct', 22, 'PAP-CRATE-12CT', 'Plastic Crate', '12 ct'),
  ('Plastic Crate 14 ct', 22, 'PAP-CRATE-14CT', 'Plastic Crate', '14 ct'),
  ('Plastic Crate 16 ct', 22, 'PAP-CRATE-16CT', 'Plastic Crate', '16 ct'),
  ('Plastic Crate 18 ct', 22, 'PAP-CRATE-18CT', 'Plastic Crate', '18 ct')
) as v(name, w, sku, emp, cal)
where not exists (select 1 from pack_styles where sku_code = v.sku);

update pack_styles ps
set sku_code = p.sku
from products p
where p.id = ps.product_id and ps.is_default and ps.sku_code is null;

update customer_po_lines set pack_style_id = 7
where product_id = 6 and pack_style_id is null;

update sales_order_lines set pack_style_id = 7
where product_id = 6 and pack_style_id is null;

update purchase_order_lines set pack_style_id = 7
where product_id = 6 and pack_style_id is null;

-- Papayas & More vende y compra (grower dual).
insert into customers (id, code, name, contact_name, phone, city, payment_terms, notes, es_cliente, es_proveedor)
values (6, 'CLI-006', 'Papayas & More', 'Samuel Ibarra', '520-300-3028', 'Nogales', 'Net 14', 'Grower que también compra', true, true)
on conflict (code) do nothing;

update suppliers
set es_cliente = true,
    linked_customer_id = (select id from customers where code = 'CLI-006')
where code = 'PRO-004';

update customers
set es_proveedor = true,
    linked_supplier_id = (select id from suppliers where code = 'PRO-004')
where code = 'CLI-006';

insert into locations (code, name, location_type) values
  ('BOD-MFE', 'Bodega McAllen', 'bodega'),
  ('BOD-NOG', 'Bodega Nogales', 'bodega')
on conflict (code) do nothing;

select setval('pack_styles_id_seq', (select coalesce(max(id), 1) from pack_styles));
select setval('customers_id_seq', (select coalesce(max(id), 1) from customers));
select setval('locations_id_seq', (select coalesce(max(id), 1) from locations));
