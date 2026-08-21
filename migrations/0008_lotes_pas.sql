-- Lotes ligados a OC, merma, hold/cierre y liquidación PAS (Price After Sale).

alter table lots add column if not exists purchase_order_id integer references purchase_orders(id);
alter table lots add column if not exists purchase_order_line_id integer references purchase_order_lines(id);
alter table lots add column if not exists held boolean not null default false;
alter table lots add column if not exists closed_at timestamptz;
alter table lots add column if not exists waste_qty numeric(14, 3) not null default 0;
alter table lots add column if not exists rts_qty numeric(14, 3) not null default 0;
alter table lots add column if not exists pallets numeric(12, 2);
alter table lots add column if not exists physical_qty numeric(14, 3);

create index if not exists lots_po_idx on lots (purchase_order_id);

update lots l
set purchase_order_id = m.reference_id
from inventory_movements m
where m.lot_id = l.id
  and m.reference_type = 'purchase_order'
  and m.reference_id is not null
  and l.purchase_order_id is null;

alter table pack_styles add column if not exists units_per_pallet numeric(12, 2);
alter table pack_styles add column if not exists units_per_layer numeric(12, 2);
alter table pack_styles add column if not exists weight_per_pallet numeric(12, 2);
alter table pack_styles add column if not exists weight_unit_pallet text not null default 'lb';

alter table purchase_orders add column if not exists costing_mode text not null default 'pas';
alter table purchase_orders add column if not exists target_profit_pct numeric(8, 4);
alter table purchase_orders add column if not exists vendor_share_level text not null default 'po';
alter table purchase_orders add column if not exists signed_off boolean not null default false;

alter table expenses add column if not exists alloc_by text not null default 'pallet';

create table if not exists waste_events (
  id serial primary key,
  lot_id integer not null references lots(id),
  quantity numeric(14, 3) not null,
  reason text not null,
  notes text,
  created_at timestamptz not null default now()
);
create index if not exists waste_lot_idx on waste_events (lot_id);

-- Pallet defaults for peppers / existing 25 lb-ish packs
update pack_styles set units_per_pallet = 56, weight_per_pallet = 1400, weight_unit_pallet = 'lb'
where unit_of_measure in ('caja', 'saco') and units_per_pallet is null and net_weight is not null;

-- Bell peppers (Silo PAS demo — Carrifoods)
insert into products (id, sku, name, variety, category, default_unit) values
  (8, 'BEL-RXL', 'Bell Pepper Red XL', 'XL', 'Verdura', 'caja'),
  (9, 'BEL-GXL', 'Bell Pepper Green XL', 'XL', 'Verdura', 'caja'),
  (10, 'BEL-GS', 'Bell Pepper Green S', 'S', 'Verdura', 'caja')
on conflict (sku) do nothing;

insert into pack_styles (product_id, name, unit_of_measure, net_weight, weight_unit, is_default, sku_code, empaque, calibre, units_per_pallet, weight_per_pallet, weight_unit_pallet)
select p.id, '25 lb', 'caja', 25, 'lb', true, v.sku, 'Carton', v.cal, 56, 1400, 'lb'
from (values
  ('BEL-RXL', 'BEL-RXL-25', 'XL'),
  ('BEL-GXL', 'BEL-GXL-25', 'XL'),
  ('BEL-GS',  'BEL-GS-25',  'S')
) as v(psku, sku, cal)
join products p on p.sku = v.psku
where not exists (select 1 from pack_styles where sku_code = v.sku);

-- Earlier PO with remaining Green XL (ATS 31)
insert into purchase_orders (po_number, supplier_id, status, order_date, expected_date, notes, costing_mode, order_type)
select 'OC-2608-002', s.id, 'received', '2026-06-03', '2026-06-03', 'Bell pepper Green XL — remaining on hand', 'pas', 'Delivery by vendor'
from suppliers s where s.code = 'PRO-006'
  and not exists (select 1 from purchase_orders where po_number = 'OC-2608-002');

insert into purchase_order_lines (purchase_order_id, product_id, pack_style_id, quantity_ordered, quantity_received, unit, unit_cost, pallets, units_per_pallet, origin_country)
select po.id, p.id, ps.id, 56, 56, 'caja', 0, 1, 56, 'MX'
from purchase_orders po
join products p on p.sku = 'BEL-GXL'
join pack_styles ps on ps.sku_code = 'BEL-GXL-25'
where po.po_number = 'OC-2608-002'
  and not exists (select 1 from purchase_order_lines where purchase_order_id = po.id);

insert into lots (lot_number, product_id, supplier_id, pack_style_id, purchase_order_id, original_qty, current_qty, unit, unit_cost, received_date, pack_date, origin_country, status, quality_state, pallets)
select '2-BEL-1', p.id, s.id, ps.id, po.id, 56, 31, 'caja', 0, '2026-06-03', '2026-06-03', 'MX', 'active', 'sano', 1
from products p
join pack_styles ps on ps.sku_code = 'BEL-GXL-25'
join suppliers s on s.code = 'PRO-006'
join purchase_orders po on po.po_number = 'OC-2608-002'
where p.sku = 'BEL-GXL'
  and not exists (select 1 from lots where lot_number = '2-BEL-1');

insert into inventory (lot_id, location_id, quantity)
select l.id, 1, 31 from lots l where l.lot_number = '2-BEL-1'
on conflict (lot_id, location_id) do nothing;

insert into inventory_movements (lot_id, location_id, movement_type, quantity, unit, reference_type, reference_id, notes, created_at)
select l.id, 1, 'receive', 56, 'caja', 'purchase_order', po.id, 'Recepción Carrifoods PO 2', '2026-06-03 10:00:00+00'
from lots l join purchase_orders po on po.po_number = 'OC-2608-002'
where l.lot_number = '2-BEL-1'
  and not exists (select 1 from inventory_movements where lot_id = l.id and movement_type = 'receive');

-- PAS PO #4 Carrifoods — 1,120 units, $3,300 expenses, fully sold
insert into purchase_orders (po_number, supplier_id, status, order_date, expected_date, notes, costing_mode, order_type, bol)
select 'OC-2608-004', s.id, 'received', '2026-06-04', '2026-06-04', 'Bell peppers PAS — Carrifoods', 'pas', 'Delivery by vendor', null
from suppliers s where s.code = 'PRO-006'
  and not exists (select 1 from purchase_orders where po_number = 'OC-2608-004');

insert into purchase_order_lines (purchase_order_id, product_id, pack_style_id, quantity_ordered, quantity_received, unit, unit_cost, pallets, units_per_pallet, origin_country)
select po.id, p.id, ps.id, v.qty, v.qty, 'caja', 0, v.pallets, 56, v.origin
from purchase_orders po
join (values
  ('BEL-RXL', 'BEL-RXL-25', 112, 2,  'MX'),
  ('BEL-GXL', 'BEL-GXL-25', 896, 16, 'MX'),
  ('BEL-GS',  'BEL-GS-25',  112, 2,  'MX')
) as v(psku, sku, qty, pallets, origin) on true
join products p on p.sku = v.psku
join pack_styles ps on ps.sku_code = v.sku
where po.po_number = 'OC-2608-004'
  and not exists (
    select 1 from purchase_order_lines l
    where l.purchase_order_id = po.id and l.product_id = p.id
  );

insert into lots (lot_number, product_id, supplier_id, pack_style_id, purchase_order_id, original_qty, current_qty, unit, unit_cost, received_date, pack_date, origin_country, status, quality_state, pallets)
select v.lot, p.id, s.id, ps.id, po.id, v.qty, 0, 'caja', 0, '2026-06-04', '2026-06-04', v.origin, 'depleted', 'sano', v.pallets
from (values
  ('4-BEL-1', 'BEL-RXL', 'BEL-RXL-25', 112, 2,  'MX'),
  ('4-BEL-2', 'BEL-GXL', 'BEL-GXL-25', 896, 16, 'MX'),
  ('4-BEL-3', 'BEL-GS',  'BEL-GS-25',  112, 2,  'MX')
) as v(lot, psku, sku, qty, pallets, origin)
join products p on p.sku = v.psku
join pack_styles ps on ps.sku_code = v.sku
join suppliers s on s.code = 'PRO-006'
join purchase_orders po on po.po_number = 'OC-2608-004'
where not exists (select 1 from lots where lot_number = v.lot);

insert into inventory (lot_id, location_id, quantity)
select l.id, 1, 0 from lots l where l.lot_number in ('4-BEL-1','4-BEL-2','4-BEL-3')
on conflict (lot_id, location_id) do nothing;

insert into inventory_movements (lot_id, location_id, movement_type, quantity, unit, reference_type, reference_id, notes, created_at)
select l.id, 1, 'receive', l.original_qty, 'caja', 'purchase_order', po.id, 'Recepción Carrifoods PO 4', '2026-06-04 10:35:00+00'
from lots l
join purchase_orders po on po.po_number = 'OC-2608-004'
where l.lot_number in ('4-BEL-1','4-BEL-2','4-BEL-3')
  and not exists (select 1 from inventory_movements m where m.lot_id = l.id and m.movement_type = 'receive');

insert into receptions (purchase_order_id, received_date, inspection_type, notes)
select po.id, '2026-06-04', 'Ninguna', 'Received in full'
from purchase_orders po where po.po_number = 'OC-2608-004'
  and not exists (select 1 from receptions r where r.purchase_order_id = po.id);

-- Expenses $3,300 distributed by pallet ($165 / pallet × 20)
insert into expenses (expense_number, category, supplier_id, purchase_order_id, quantity, unit_cost, amount, payable, status, issue_date, paid, notes, alloc_by)
select 'EXP-2608-010', 'Quality Control', s.id, po.id, 1, 100, 100, true, 'open', '2026-06-04', 0, 'QC on PO 4', 'pallet'
from purchase_orders po join suppliers s on s.code = 'PRO-006'
where po.po_number = 'OC-2608-004'
  and not exists (select 1 from expenses where expense_number = 'EXP-2608-010');

insert into expenses (expense_number, category, supplier_id, purchase_order_id, quantity, unit_cost, amount, payable, status, issue_date, paid, notes, alloc_by)
select 'EXP-2608-011', 'Freight', s.id, po.id, 1, 3000, 3000, true, 'open', '2026-06-04', 0, 'Freight $165/pallet', 'pallet'
from purchase_orders po join suppliers s on s.code = 'PRO-006'
where po.po_number = 'OC-2608-004'
  and not exists (select 1 from expenses where expense_number = 'EXP-2608-011');

insert into expenses (expense_number, category, supplier_id, purchase_order_id, quantity, unit_cost, amount, payable, status, issue_date, paid, notes, alloc_by)
select 'EXP-2608-012', 'Inspection Services', s.id, po.id, 1, 200, 200, true, 'open', '2026-06-04', 0, 'Inspection services', 'pallet'
from purchase_orders po join suppliers s on s.code = 'PRO-006'
where po.po_number = 'OC-2608-004'
  and not exists (select 1 from expenses where expense_number = 'EXP-2608-012');

-- Alpine Fresh sales that empty PO 4 lots (revenue $14,504)
insert into sales_orders (so_number, customer_id, status, order_date, ship_date, notes)
select 'OV-23946', c.id, 'completed', '2026-06-04', '2026-06-04', 'Bell peppers — Alpine Fresh'
from customers c where c.name = 'Alpine Fresh'
  and not exists (select 1 from sales_orders where so_number = 'OV-23946');

insert into sales_order_lines (sales_order_id, product_id, lot_id, pack_style_id, quantity_ordered, quantity_shipped, unit, unit_price)
select so.id, l.product_id, l.id, l.pack_style_id, v.qty, v.qty, 'caja', v.price
from sales_orders so
join (values
  ('4-BEL-1', 112, 9.00),
  ('4-BEL-2', 224, 19.00),
  ('4-BEL-2', 672, 12.00),
  ('4-BEL-3',  56, 15.00),
  ('4-BEL-3',  56,  6.00)
) as v(lot, qty, price) on true
join lots l on l.lot_number = v.lot
where so.so_number = 'OV-23946'
  and not exists (
    select 1 from sales_order_lines sl
    where sl.sales_order_id = so.id and sl.lot_id = l.id and sl.unit_price = v.price
  );

insert into inventory_movements (lot_id, location_id, movement_type, quantity, unit, reference_type, reference_id, notes, created_at)
select l.id, 1, 'ship', -v.qty, 'caja', 'sales_order', so.id, 'Despacho Alpine Fresh', '2026-06-04 16:00:00+00'
from sales_orders so
join (values
  ('4-BEL-1', 112),
  ('4-BEL-2', 896),
  ('4-BEL-3', 112)
) as v(lot, qty) on true
join lots l on l.lot_number = v.lot
where so.so_number = 'OV-23946'
  and not exists (select 1 from inventory_movements m where m.lot_id = l.id and m.movement_type = 'ship');

-- Partial ship from leftover lot so ATS = 31
insert into sales_orders (so_number, customer_id, status, order_date, ship_date, notes)
select 'OV-23940', c.id, 'completed', '2026-06-03', '2026-06-03', 'Green XL partial'
from customers c where c.name = 'Alpine Fresh'
  and not exists (select 1 from sales_orders where so_number = 'OV-23940');

insert into sales_order_lines (sales_order_id, product_id, lot_id, pack_style_id, quantity_ordered, quantity_shipped, unit, unit_price)
select so.id, l.product_id, l.id, l.pack_style_id, 25, 25, 'caja', 14.00
from sales_orders so
join lots l on l.lot_number = '2-BEL-1'
where so.so_number = 'OV-23940'
  and not exists (select 1 from sales_order_lines sl where sl.sales_order_id = so.id and sl.lot_id = l.id);

insert into inventory_movements (lot_id, location_id, movement_type, quantity, unit, reference_type, reference_id, notes, created_at)
select l.id, 1, 'ship', -25, 'caja', 'sales_order', so.id, 'Despacho parcial', '2026-06-03 15:00:00+00'
from lots l
join sales_orders so on so.so_number = 'OV-23940'
where l.lot_number = '2-BEL-1'
  and not exists (select 1 from inventory_movements m where m.lot_id = l.id and m.movement_type = 'ship');

insert into invoices (invoice_number, sales_order_id, customer_id, status, issue_date, due_date, subtotal, total, paid, notes)
select 'PP-2026-0005', so.id, so.customer_id, 'open', '2026-06-04', '2026-06-18', 14504.00, 14504.00, 0, 'Alpine Fresh peppers PO 4'
from sales_orders so where so.so_number = 'OV-23946'
  and not exists (select 1 from invoices where invoice_number = 'PP-2026-0005');

select setval('products_id_seq', (select coalesce(max(id), 1) from products));
select setval('pack_styles_id_seq', (select coalesce(max(id), 1) from pack_styles));
select setval('purchase_orders_id_seq', (select coalesce(max(id), 1) from purchase_orders));
select setval('purchase_order_lines_id_seq', (select coalesce(max(id), 1) from purchase_order_lines));
select setval('lots_id_seq', (select coalesce(max(id), 1) from lots));
select setval('sales_orders_id_seq', (select coalesce(max(id), 1) from sales_orders));
select setval('sales_order_lines_id_seq', (select coalesce(max(id), 1) from sales_order_lines));
select setval('expenses_id_seq', (select coalesce(max(id), 1) from expenses));
select setval('invoices_id_seq', (select coalesce(max(id), 1) from invoices));
select setval('receptions_id_seq', (select coalesce(max(id), 1) from receptions));
