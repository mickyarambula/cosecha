-- Plein live catalog. Wipes demo lots/orders/invoices. Skips invented destinos and revenue models.

truncate table
  pack_out_lines, pack_outs,
  waste_events,
  inventory_movements, inventory, lots,
  payment_applications, bank_lines, cash_movements,
  invoice_lines, invoices,
  supplier_bills,
  expense_po_links, expenses,
  reception_lines, receptions,
  sales_order_lines, sales_orders,
  purchase_order_lines, purchase_orders,
  customer_po_lines, customer_pos,
  party_skus, send_events,
  pack_styles, products,
  customers, suppliers
restart identity cascade;

-- Invented destinos from the other ERP. Keep own coolers + Bodega Nogales.
delete from locations where code in ('BOD-NGM', 'XD-PHR', 'BOD-MFE');

delete from value_lists where kind in ('empaque', 'calibre', 'grado');

update company_profile set
  email = 'miguelarambulam@gmail.com',
  phone = '668-222-2686',
  updated_at = now()
where id = 1;

-- Products
insert into products (id, sku, name, variety, category, default_unit) values (1, 'BANTHA', 'Banana Thai', null, 'Fruta', 'caja');
insert into products (id, sku, name, variety, category, default_unit) values (2, 'BELPEPRO', 'Bell Pepper Rojo', null, 'Verdura', 'caja');
insert into products (id, sku, name, variety, category, default_unit) values (3, 'BELPEPVE', 'Bell Pepper Verde', null, 'Verdura', 'caja');
insert into products (id, sku, name, variety, category, default_unit) values (4, 'BRUSPROR', 'Brussels Sprouts Organic', null, 'Verdura', 'caja');
insert into products (id, sku, name, variety, category, default_unit) values (5, 'COCPEL', 'Coco peludo', null, 'Fruta', 'caja');
insert into products (id, sku, name, variety, category, default_unit) values (6, 'COCVER', 'Coco verde', null, 'Fruta', 'caja');
insert into products (id, sku, name, variety, category, default_unit) values (7, 'COLDEBRU', 'Col de bruselas', null, 'Verdura', 'caja');
insert into products (id, sku, name, variety, category, default_unit) values (8, 'ESPA', 'Espárrago', null, 'Verdura', 'caja');
insert into products (id, sku, name, variety, category, default_unit) values (9, 'ESPORG', 'Espárrago Orgánico', null, 'Verdura', 'caja');
insert into products (id, sku, name, variety, category, default_unit) values (10, 'JACK', 'Jackfruit', null, 'Fruta', 'caja');
insert into products (id, sku, name, variety, category, default_unit) values (11, 'JALA', 'Jalapeño', null, 'Verdura', 'caja');
insert into products (id, sku, name, variety, category, default_unit) values (12, 'KABO', 'Kabocha', null, 'Verdura', 'caja');
insert into products (id, sku, name, variety, category, default_unit) values (13, 'LIMO', 'Limón', null, 'Fruta', 'caja');
insert into products (id, sku, name, variety, category, default_unit) values (14, 'LIMO-MEXI', 'Limón', 'Mexicano', 'Fruta', 'caja');
insert into products (id, sku, name, variety, category, default_unit) values (15, 'LIMO-PERS', 'Limón', 'Persa', 'Fruta', 'caja');
insert into products (id, sku, name, variety, category, default_unit) values (16, 'LYCH', 'Lychee', null, 'Fruta', 'caja');
insert into products (id, sku, name, variety, category, default_unit) values (17, 'MANG-ATAU', 'Mango', 'Ataulfo', 'Fruta', 'caja');
insert into products (id, sku, name, variety, category, default_unit) values (18, 'MANG-HADE', 'Mango', 'Haden', 'Fruta', 'caja');
insert into products (id, sku, name, variety, category, default_unit) values (19, 'MANG-KEIT', 'Mango', 'Keitt', 'Fruta', 'caja');
insert into products (id, sku, name, variety, category, default_unit) values (20, 'MANG-KENT', 'Mango', 'Kent', 'Fruta', 'caja');
insert into products (id, sku, name, variety, category, default_unit) values (21, 'MANG-MANI', 'Mango', 'Manila', 'Fruta', 'caja');
insert into products (id, sku, name, variety, category, default_unit) values (22, 'MANG-PALM', 'Mango', 'Palmer', 'Fruta', 'caja');
insert into products (id, sku, name, variety, category, default_unit) values (23, 'MANG-TOMM', 'Mango', 'Tommy Atkins', 'Fruta', 'caja');
insert into products (id, sku, name, variety, category, default_unit) values (24, 'MAIDUL-AMAR', 'Maíz dulce', 'Amarillo', 'Verdura', 'caja');
insert into products (id, sku, name, variety, category, default_unit) values (25, 'MAIDUL-BICO', 'Maíz dulce', 'Bicolor', 'Verdura', 'caja');
insert into products (id, sku, name, variety, category, default_unit) values (26, 'MAIDUL-BLAN', 'Maíz dulce', 'Blanco', 'Verdura', 'caja');
insert into products (id, sku, name, variety, category, default_unit) values (27, 'ORAHAB', 'Orange Habanero', null, 'Verdura', 'caja');
insert into products (id, sku, name, variety, category, default_unit) values (28, 'PAPA-FORM', 'Papaya', 'Formosa', 'Fruta', 'caja');
insert into products (id, sku, name, variety, category, default_unit) values (29, 'PAPA-INTE', 'Papaya', 'Intenzza', 'Fruta', 'caja');
insert into products (id, sku, name, variety, category, default_unit) values (30, 'PAPA-MARA', 'Papaya', 'Maradol', 'Fruta', 'caja');
insert into products (id, sku, name, variety, category, default_unit) values (31, 'PAPA-REDL', 'Papaya', 'Red Lady', 'Fruta', 'caja');
insert into products (id, sku, name, variety, category, default_unit) values (32, 'PAPA-TAIN', 'Papaya', 'Tainung', 'Fruta', 'caja');
insert into products (id, sku, name, variety, category, default_unit) values (33, 'PAPA-VEGA', 'Papaya', 'Vegas', 'Fruta', 'caja');
insert into products (id, sku, name, variety, category, default_unit) values (34, 'PLAMAC', 'Plátano Macho', null, 'Fruta', 'caja');
insert into products (id, sku, name, variety, category, default_unit) values (35, 'POBPEP', 'Poblano Pepper', null, 'Verdura', 'caja');
insert into products (id, sku, name, variety, category, default_unit) values (36, 'REDHAB', 'Red Habanero', null, 'Verdura', 'caja');
insert into products (id, sku, name, variety, category, default_unit) values (37, 'SWEBABBR', 'Sweet Baby Broccoli', null, 'Verdura', 'caja');
insert into products (id, sku, name, variety, category, default_unit) values (38, 'SWEBABBR-PANC', 'Sweet Baby Broccoli', 'Pancho', 'Verdura', 'caja');
insert into products (id, sku, name, variety, category, default_unit) values (39, 'TOMROM', 'Tomate roma', null, 'Verdura', 'caja');

-- SKUs (pack_styles)
insert into pack_styles (id, product_id, name, unit_of_measure, net_weight, weight_unit, is_default, sku_code, empaque, calibre, units_per_pallet) values (1, 30, 'Caja 6 ct', 'caja', 36, 'lb', true, 'PAPA-MARA-CAJA-6CT', 'Caja', '6 ct', 48);
insert into pack_styles (id, product_id, name, unit_of_measure, net_weight, weight_unit, is_default, sku_code, empaque, calibre, units_per_pallet) values (2, 30, 'Caja 8 ct', 'caja', 36, 'lb', false, 'PAPA-MARA-CAJA-8CT', 'Caja', '8 ct', 48);
insert into pack_styles (id, product_id, name, unit_of_measure, net_weight, weight_unit, is_default, sku_code, empaque, calibre, units_per_pallet) values (3, 30, 'Caja 9 ct', 'caja', 36, 'lb', false, 'PAPA-MARA-CAJA-9CT', 'Caja', '9 ct', 48);
insert into pack_styles (id, product_id, name, unit_of_measure, net_weight, weight_unit, is_default, sku_code, empaque, calibre, units_per_pallet) values (4, 30, 'Caja 10 ct', 'caja', 36, 'lb', false, 'PAPA-MARA-CAJA-10CT', 'Caja', '10 ct', 48);
insert into pack_styles (id, product_id, name, unit_of_measure, net_weight, weight_unit, is_default, sku_code, empaque, calibre, units_per_pallet) values (5, 30, 'Caja 12 ct', 'caja', 36, 'lb', false, 'PAPA-MARA-CAJA-12CT', 'Caja', '12 ct', 48);
insert into pack_styles (id, product_id, name, unit_of_measure, net_weight, weight_unit, is_default, sku_code, empaque, calibre, units_per_pallet) values (6, 30, 'Caja 35 lb loose', 'caja', 35, 'lb', false, 'PAPA-MARA-CAJA-35LBLOOSE', 'Caja', '35 lb loose', 48);
insert into pack_styles (id, product_id, name, unit_of_measure, net_weight, weight_unit, is_default, sku_code, empaque, calibre, units_per_pallet) values (7, 30, 'Caja 40 lb loose', 'caja', 40, 'lb', false, 'PAPA-MARA-CAJA-40LBLOOSE', 'Caja', '40 lb loose', 48);
insert into pack_styles (id, product_id, name, unit_of_measure, net_weight, weight_unit, is_default, sku_code, empaque, calibre, units_per_pallet) values (8, 10, 'Caja 1 ct', 'caja', 35, 'lb', true, 'JACK-CAJA-1CT', 'Caja', '1 ct', 48);
insert into pack_styles (id, product_id, name, unit_of_measure, net_weight, weight_unit, is_default, sku_code, empaque, calibre, units_per_pallet) values (9, 10, 'Caja 2 ct', 'caja', 35, 'lb', false, 'JACK-CAJA-2CT', 'Caja', '2 ct', 48);
insert into pack_styles (id, product_id, name, unit_of_measure, net_weight, weight_unit, is_default, sku_code, empaque, calibre, units_per_pallet) values (10, 10, 'Caja 3 ct', 'caja', 35, 'lb', false, 'JACK-CAJA-3CT', 'Caja', '3 ct', 48);
insert into pack_styles (id, product_id, name, unit_of_measure, net_weight, weight_unit, is_default, sku_code, empaque, calibre, units_per_pallet) values (11, 10, 'Caja 4 ct', 'caja', 35, 'lb', false, 'JACK-CAJA-4CT', 'Caja', '4 ct', 48);
insert into pack_styles (id, product_id, name, unit_of_measure, net_weight, weight_unit, is_default, sku_code, empaque, calibre, units_per_pallet) values (12, 10, 'Caja 35 lb loose', 'caja', 35, 'lb', false, 'JACK-CAJA-35LBLOOSE', 'Caja', '35 lb loose', 48);
insert into pack_styles (id, product_id, name, unit_of_measure, net_weight, weight_unit, is_default, sku_code, empaque, calibre, units_per_pallet) values (13, 10, 'Caja 40 lb loose', 'caja', 40, 'lb', false, 'JACK-CAJA-40LBLOOSE', 'Caja', '40 lb loose', 48);
insert into pack_styles (id, product_id, name, unit_of_measure, net_weight, weight_unit, is_default, sku_code, empaque, calibre, units_per_pallet) values (14, 1, 'Caja Clusters', 'caja', 34, 'lb', true, 'BANTHA-CAJA-CLUSTERS', 'Caja', 'Clusters', 48);
insert into pack_styles (id, product_id, name, unit_of_measure, net_weight, weight_unit, is_default, sku_code, empaque, calibre, units_per_pallet) values (15, 6, 'Caja 9 ct', 'caja', 25, 'lb', true, 'COCVER-CAJA-9CT', 'Caja', '9 ct', 80);
insert into pack_styles (id, product_id, name, unit_of_measure, net_weight, weight_unit, is_default, sku_code, empaque, calibre, units_per_pallet) values (16, 6, 'Caja entero granel', 'caja', 40, 'lb', false, 'COCVER-CAJA-ENTEROGRANEL', 'Caja', 'entero granel', 64);
insert into pack_styles (id, product_id, name, unit_of_measure, net_weight, weight_unit, is_default, sku_code, empaque, calibre, units_per_pallet) values (17, 6, 'Caja 9 ct pelado', 'caja', 20, 'lb', false, 'COCVER-CAJA-9CTPELADO', 'Caja', '9 ct pelado', 96);
insert into pack_styles (id, product_id, name, unit_of_measure, net_weight, weight_unit, is_default, sku_code, empaque, calibre, units_per_pallet) values (18, 5, 'Caja Jumbo', 'caja', 40, 'lb', true, 'COCPEL-CAJA-JUMBO', 'Caja', 'Jumbo', 50);
insert into pack_styles (id, product_id, name, unit_of_measure, net_weight, weight_unit, is_default, sku_code, empaque, calibre, units_per_pallet) values (19, 5, 'Saco granel 50 lb', 'saco', 50, 'lb', false, 'COCPEL-SACO-GRANEL50LB', 'Saco', 'granel 50 lb', 40);
insert into pack_styles (id, product_id, name, unit_of_measure, net_weight, weight_unit, is_default, sku_code, empaque, calibre, units_per_pallet) values (20, 5, 'Saco Table Top', 'saco', 25, 'lb', false, 'COCPEL-SACO-TABLETOP', 'Saco', 'Table Top', 70);
insert into pack_styles (id, product_id, name, unit_of_measure, net_weight, weight_unit, is_default, sku_code, empaque, calibre, units_per_pallet) values (21, 3, 'Caja Jumbo/XL', 'caja', 25, 'lb', true, 'BELPEPVE-CAJA-JUMBOXL', 'Caja', 'Jumbo/XL', 72);
insert into pack_styles (id, product_id, name, unit_of_measure, net_weight, weight_unit, is_default, sku_code, empaque, calibre, units_per_pallet) values (22, 3, 'Caja Large', 'caja', 25, 'lb', false, 'BELPEPVE-CAJA-LARGE', 'Caja', 'Large', 72);
insert into pack_styles (id, product_id, name, unit_of_measure, net_weight, weight_unit, is_default, sku_code, empaque, calibre, units_per_pallet) values (23, 3, 'Caja Medium', 'caja', 25, 'lb', false, 'BELPEPVE-CAJA-MEDIUM', 'Caja', 'Medium', 72);
insert into pack_styles (id, product_id, name, unit_of_measure, net_weight, weight_unit, is_default, sku_code, empaque, calibre, units_per_pallet) values (24, 11, 'Caja Medium', 'caja', 25, 'lb', true, 'JALA-CAJA-MEDIUM', 'Caja', 'Medium', 64);
insert into pack_styles (id, product_id, name, unit_of_measure, net_weight, weight_unit, is_default, sku_code, empaque, calibre, units_per_pallet) values (25, 11, 'Caja Large', 'caja', 35, 'lb', false, 'JALA-CAJA-LARGE', 'Caja', 'Large', 64);
insert into pack_styles (id, product_id, name, unit_of_measure, net_weight, weight_unit, is_default, sku_code, empaque, calibre, units_per_pallet) values (26, 11, 'Caja granel 40 lb', 'caja', 40, 'lb', false, 'JALA-CAJA-GRANEL40LB', 'Caja', 'granel 40 lb', 64);
insert into pack_styles (id, product_id, name, unit_of_measure, net_weight, weight_unit, is_default, sku_code, empaque, calibre, units_per_pallet) values (27, 2, 'Caja 11 lb invernadero', 'caja', 11, 'lb', true, 'BELPEPRO-CAJA-11LBINVERNADERO', 'Caja', '11 lb invernadero', 120);
insert into pack_styles (id, product_id, name, unit_of_measure, net_weight, weight_unit, is_default, sku_code, empaque, calibre, units_per_pallet) values (28, 2, 'Caja XL', 'caja', 25, 'lb', false, 'BELPEPRO-CAJA-XL', 'Caja', 'XL', 72);
insert into pack_styles (id, product_id, name, unit_of_measure, net_weight, weight_unit, is_default, sku_code, empaque, calibre, units_per_pallet) values (29, 2, 'Caja Large', 'caja', 25, 'lb', false, 'BELPEPRO-CAJA-LARGE', 'Caja', 'Large', 72);
insert into pack_styles (id, product_id, name, unit_of_measure, net_weight, weight_unit, is_default, sku_code, empaque, calibre, units_per_pallet) values (30, 15, 'Caja 110 ct', 'caja', 40, 'lb', true, 'LIMO-PERS-CAJA-110CT', 'Caja', '110 ct', 60);
insert into pack_styles (id, product_id, name, unit_of_measure, net_weight, weight_unit, is_default, sku_code, empaque, calibre, units_per_pallet) values (31, 15, 'Caja 150 ct', 'caja', 40, 'lb', false, 'LIMO-PERS-CAJA-150CT', 'Caja', '150 ct', 60);
insert into pack_styles (id, product_id, name, unit_of_measure, net_weight, weight_unit, is_default, sku_code, empaque, calibre, units_per_pallet) values (32, 15, 'Caja 175 ct', 'caja', 40, 'lb', false, 'LIMO-PERS-CAJA-175CT', 'Caja', '175 ct', 60);
insert into pack_styles (id, product_id, name, unit_of_measure, net_weight, weight_unit, is_default, sku_code, empaque, calibre, units_per_pallet) values (33, 15, 'Caja 200 ct', 'caja', 40, 'lb', false, 'LIMO-PERS-CAJA-200CT', 'Caja', '200 ct', 60);
insert into pack_styles (id, product_id, name, unit_of_measure, net_weight, weight_unit, is_default, sku_code, empaque, calibre, units_per_pallet) values (34, 15, 'Caja 230 ct', 'caja', 40, 'lb', false, 'LIMO-PERS-CAJA-230CT', 'Caja', '230 ct', 60);
insert into pack_styles (id, product_id, name, unit_of_measure, net_weight, weight_unit, is_default, sku_code, empaque, calibre, units_per_pallet) values (35, 15, 'Caja 250 ct', 'caja', 40, 'lb', false, 'LIMO-PERS-CAJA-250CT', 'Caja', '250 ct', 60);
insert into pack_styles (id, product_id, name, unit_of_measure, net_weight, weight_unit, is_default, sku_code, empaque, calibre, units_per_pallet) values (36, 15, 'Caja 54 ct', 'caja', 10, 'lb', false, 'LIMO-PERS-CAJA-54CT', 'Caja', '54 ct', 150);
insert into pack_styles (id, product_id, name, unit_of_measure, net_weight, weight_unit, is_default, sku_code, empaque, calibre, units_per_pallet) values (37, 15, 'Caja 12x2 lb malla', 'caja', 24, 'lb', false, 'LIMO-PERS-CAJA-12X2LBMALLA', 'Caja', '12x2 lb malla', 90);
insert into pack_styles (id, product_id, name, unit_of_measure, net_weight, weight_unit, is_default, sku_code, empaque, calibre, units_per_pallet) values (38, 7, 'Caja 1 lb bag', 'caja', 12, 'lb', true, 'COLDEBRU-CAJA-1LBBAG', 'Caja', '1 lb bag', 80);
insert into pack_styles (id, product_id, name, unit_of_measure, net_weight, weight_unit, is_default, sku_code, empaque, calibre, units_per_pallet) values (39, 7, 'Caja 2 lb bag', 'caja', 16, 'lb', false, 'COLDEBRU-CAJA-2LBBAG', 'Caja', '2 lb bag', 60);
insert into pack_styles (id, product_id, name, unit_of_measure, net_weight, weight_unit, is_default, sku_code, empaque, calibre, units_per_pallet) values (40, 7, 'Caja 5 lb club', 'caja', 20, 'lb', false, 'COLDEBRU-CAJA-5LBCLUB', 'Caja', '5 lb club', 48);
insert into pack_styles (id, product_id, name, unit_of_measure, net_weight, weight_unit, is_default, sku_code, empaque, calibre, units_per_pallet) values (41, 7, 'Caja granel', 'caja', 25, 'lb', false, 'COLDEBRU-CAJA-GRANEL', 'Caja', 'granel', 48);
insert into pack_styles (id, product_id, name, unit_of_measure, net_weight, weight_unit, is_default, sku_code, empaque, calibre, units_per_pallet) values (42, 7, 'Bolsa limpio y recortado', 'caja', 10, 'lb', false, 'COLDEBRU-BOLSA-LIMPIOYRECORTADO', 'Bolsa', 'limpio y recortado', 80);
insert into pack_styles (id, product_id, name, unit_of_measure, net_weight, weight_unit, is_default, sku_code, empaque, calibre, units_per_pallet) values (43, 7, 'Bolsa mitades', 'caja', 10, 'lb', false, 'COLDEBRU-BOLSA-MITADES', 'Bolsa', 'mitades', 80);
insert into pack_styles (id, product_id, name, unit_of_measure, net_weight, weight_unit, is_default, sku_code, empaque, calibre, units_per_pallet) values (44, 36, 'Caja granel 8 lb', 'caja', 8, 'lb', true, 'REDHAB-CAJA-GRANEL8LB', 'Caja', 'granel 8 lb', 120);
insert into pack_styles (id, product_id, name, unit_of_measure, net_weight, weight_unit, is_default, sku_code, empaque, calibre, units_per_pallet) values (45, 36, 'Caja granel 25 lb', 'caja', 25, 'lb', false, 'REDHAB-CAJA-GRANEL25LB', 'Caja', 'granel 25 lb', 72);
insert into pack_styles (id, product_id, name, unit_of_measure, net_weight, weight_unit, is_default, sku_code, empaque, calibre, units_per_pallet) values (46, 36, 'Caja 10 lb', 'caja', 10, 'lb', false, 'REDHAB-CAJA-10LB', 'Caja', '10 lb', 100);
insert into pack_styles (id, product_id, name, unit_of_measure, net_weight, weight_unit, is_default, sku_code, empaque, calibre, units_per_pallet) values (47, 27, 'Caja granel 8 lb', 'caja', 8, 'lb', true, 'ORAHAB-CAJA-GRANEL8LB', 'Caja', 'granel 8 lb', 120);
insert into pack_styles (id, product_id, name, unit_of_measure, net_weight, weight_unit, is_default, sku_code, empaque, calibre, units_per_pallet) values (48, 27, 'Caja granel 25 lb', 'caja', 25, 'lb', false, 'ORAHAB-CAJA-GRANEL25LB', 'Caja', 'granel 25 lb', 72);
insert into pack_styles (id, product_id, name, unit_of_measure, net_weight, weight_unit, is_default, sku_code, empaque, calibre, units_per_pallet) values (49, 27, 'Caja 10 lb', 'caja', 10, 'lb', false, 'ORAHAB-CAJA-10LB', 'Caja', '10 lb', 100);
insert into pack_styles (id, product_id, name, unit_of_measure, net_weight, weight_unit, is_default, sku_code, empaque, calibre, units_per_pallet) values (50, 12, 'Caja 6-9 ct', 'caja', 35, 'lb', true, 'KABO-CAJA-69CT', 'Caja', '6-9 ct', 48);
insert into pack_styles (id, product_id, name, unit_of_measure, net_weight, weight_unit, is_default, sku_code, empaque, calibre, units_per_pallet) values (51, 12, 'Caja 9-12 ct', 'caja', 35, 'lb', false, 'KABO-CAJA-912CT', 'Caja', '9-12 ct', 48);
insert into pack_styles (id, product_id, name, unit_of_measure, net_weight, weight_unit, is_default, sku_code, empaque, calibre, units_per_pallet) values (52, 8, 'Caja 11x1 lb', 'caja', 11, 'lb', true, 'ESPA-CAJA-11X1LB', 'Caja', '11x1 lb', 120);
insert into pack_styles (id, product_id, name, unit_of_measure, net_weight, weight_unit, is_default, sku_code, empaque, calibre, units_per_pallet) values (53, 8, 'Caja 12x1 lb', 'caja', 12, 'lb', false, 'ESPA-CAJA-12X1LB', 'Caja', '12x1 lb', 120);
insert into pack_styles (id, product_id, name, unit_of_measure, net_weight, weight_unit, is_default, sku_code, empaque, calibre, units_per_pallet) values (54, 8, 'Caja 8x2 lb', 'caja', 16, 'lb', false, 'ESPA-CAJA-8X2LB', 'Caja', '8x2 lb', 80);
insert into pack_styles (id, product_id, name, unit_of_measure, net_weight, weight_unit, is_default, sku_code, empaque, calibre, units_per_pallet) values (55, 8, 'Caja 12x12 oz', 'caja', 9, 'lb', false, 'ESPA-CAJA-12X12OZ', 'Caja', '12x12 oz', 120);
insert into pack_styles (id, product_id, name, unit_of_measure, net_weight, weight_unit, is_default, sku_code, empaque, calibre, units_per_pallet) values (56, 8, 'Caja 28x8 oz', 'caja', 14, 'lb', false, 'ESPA-CAJA-28X8OZ', 'Caja', '28x8 oz', 100);
insert into pack_styles (id, product_id, name, unit_of_measure, net_weight, weight_unit, is_default, sku_code, empaque, calibre, units_per_pallet) values (57, 8, 'Caja 5 lb club', 'caja', 20, 'lb', false, 'ESPA-CAJA-5LBCLUB', 'Caja', '5 lb club', 50);
insert into pack_styles (id, product_id, name, unit_of_measure, net_weight, weight_unit, is_default, sku_code, empaque, calibre, units_per_pallet) values (58, 8, 'Caja granel 11 lb', 'caja', 11, 'lb', false, 'ESPA-CAJA-GRANEL11LB', 'Caja', 'granel 11 lb', 120);
insert into pack_styles (id, product_id, name, unit_of_measure, net_weight, weight_unit, is_default, sku_code, empaque, calibre, units_per_pallet) values (59, 8, 'Caja granel 28 lb', 'caja', 28, 'lb', false, 'ESPA-CAJA-GRANEL28LB', 'Caja', 'granel 28 lb', 50);
insert into pack_styles (id, product_id, name, unit_of_measure, net_weight, weight_unit, is_default, sku_code, empaque, calibre, units_per_pallet) values (60, 8, 'Bolsa tips & cuts', 'caja', 5, 'lb', false, 'ESPA-BOLSA-TIPSCUTS', 'Bolsa', 'tips & cuts', 120);
insert into pack_styles (id, product_id, name, unit_of_measure, net_weight, weight_unit, is_default, sku_code, empaque, calibre, units_per_pallet) values (61, 8, 'Bolsa pelado', 'caja', 5, 'lb', false, 'ESPA-BOLSA-PELADO', 'Bolsa', 'pelado', 120);
insert into pack_styles (id, product_id, name, unit_of_measure, net_weight, weight_unit, is_default, sku_code, empaque, calibre, units_per_pallet) values (62, 35, 'Caja Large', 'caja', 22, 'lb', true, 'POBPEP-CAJA-LARGE', 'Caja', 'Large', 80);
insert into pack_styles (id, product_id, name, unit_of_measure, net_weight, weight_unit, is_default, sku_code, empaque, calibre, units_per_pallet) values (63, 35, 'Caja Medium', 'caja', 22, 'lb', false, 'POBPEP-CAJA-MEDIUM', 'Caja', 'Medium', 80);
insert into pack_styles (id, product_id, name, unit_of_measure, net_weight, weight_unit, is_default, sku_code, empaque, calibre, units_per_pallet) values (64, 9, 'Caja 11x1 lb', 'caja', 11, 'lb', true, 'ESPORG-CAJA-11X1LB', 'Caja', '11x1 lb', 120);
insert into pack_styles (id, product_id, name, unit_of_measure, net_weight, weight_unit, is_default, sku_code, empaque, calibre, units_per_pallet) values (65, 9, 'Caja 12x12 oz', 'caja', 9, 'lb', false, 'ESPORG-CAJA-12X12OZ', 'Caja', '12x12 oz', 120);
insert into pack_styles (id, product_id, name, unit_of_measure, net_weight, weight_unit, is_default, sku_code, empaque, calibre, units_per_pallet) values (66, 9, 'Caja granel 11 lb', 'caja', 11, 'lb', false, 'ESPORG-CAJA-GRANEL11LB', 'Caja', 'granel 11 lb', 120);
insert into pack_styles (id, product_id, name, unit_of_measure, net_weight, weight_unit, is_default, sku_code, empaque, calibre, units_per_pallet) values (67, 9, 'Caja granel 28 lb', 'caja', 28, 'lb', false, 'ESPORG-CAJA-GRANEL28LB', 'Caja', 'granel 28 lb', 50);
insert into pack_styles (id, product_id, name, unit_of_measure, net_weight, weight_unit, is_default, sku_code, empaque, calibre, units_per_pallet) values (68, 17, 'Caja 16 ct', 'caja', 4, 'kg', true, 'MANG-ATAU-CAJA-16CT', 'Caja', '16 ct', 240);
insert into pack_styles (id, product_id, name, unit_of_measure, net_weight, weight_unit, is_default, sku_code, empaque, calibre, units_per_pallet) values (69, 17, 'Caja 18 ct', 'caja', 4, 'kg', false, 'MANG-ATAU-CAJA-18CT', 'Caja', '18 ct', 240);
insert into pack_styles (id, product_id, name, unit_of_measure, net_weight, weight_unit, is_default, sku_code, empaque, calibre, units_per_pallet) values (70, 17, 'Caja 20 ct', 'caja', 4, 'kg', false, 'MANG-ATAU-CAJA-20CT', 'Caja', '20 ct', 240);
insert into pack_styles (id, product_id, name, unit_of_measure, net_weight, weight_unit, is_default, sku_code, empaque, calibre, units_per_pallet) values (71, 20, 'Caja 8 ct', 'caja', 4, 'kg', true, 'MANG-KENT-CAJA-8CT', 'Caja', '8 ct', 240);
insert into pack_styles (id, product_id, name, unit_of_measure, net_weight, weight_unit, is_default, sku_code, empaque, calibre, units_per_pallet) values (72, 20, 'Caja 9 ct', 'caja', 4, 'kg', false, 'MANG-KENT-CAJA-9CT', 'Caja', '9 ct', 240);
insert into pack_styles (id, product_id, name, unit_of_measure, net_weight, weight_unit, is_default, sku_code, empaque, calibre, units_per_pallet) values (73, 20, 'Caja 10 ct', 'caja', 4, 'kg', false, 'MANG-KENT-CAJA-10CT', 'Caja', '10 ct', 240);
insert into pack_styles (id, product_id, name, unit_of_measure, net_weight, weight_unit, is_default, sku_code, empaque, calibre, units_per_pallet) values (74, 19, 'Caja 8 ct', 'caja', 4, 'kg', true, 'MANG-KEIT-CAJA-8CT', 'Caja', '8 ct', 240);
insert into pack_styles (id, product_id, name, unit_of_measure, net_weight, weight_unit, is_default, sku_code, empaque, calibre, units_per_pallet) values (75, 19, 'Caja 9 ct', 'caja', 4, 'kg', false, 'MANG-KEIT-CAJA-9CT', 'Caja', '9 ct', 240);
insert into pack_styles (id, product_id, name, unit_of_measure, net_weight, weight_unit, is_default, sku_code, empaque, calibre, units_per_pallet) values (76, 23, 'Caja 8 ct', 'caja', 4, 'kg', true, 'MANG-TOMM-CAJA-8CT', 'Caja', '8 ct', 240);
insert into pack_styles (id, product_id, name, unit_of_measure, net_weight, weight_unit, is_default, sku_code, empaque, calibre, units_per_pallet) values (77, 23, 'Caja 9 ct', 'caja', 4, 'kg', false, 'MANG-TOMM-CAJA-9CT', 'Caja', '9 ct', 240);
insert into pack_styles (id, product_id, name, unit_of_measure, net_weight, weight_unit, is_default, sku_code, empaque, calibre, units_per_pallet) values (78, 39, 'Caja XL', 'caja', 25, 'lb', true, 'TOMROM-CAJA-XL', 'Caja', 'XL', 80);
insert into pack_styles (id, product_id, name, unit_of_measure, net_weight, weight_unit, is_default, sku_code, empaque, calibre, units_per_pallet) values (79, 39, 'Caja Large', 'caja', 25, 'lb', false, 'TOMROM-CAJA-LARGE', 'Caja', 'Large', 80);
insert into pack_styles (id, product_id, name, unit_of_measure, net_weight, weight_unit, is_default, sku_code, empaque, calibre, units_per_pallet) values (80, 39, 'Caja Medium', 'caja', 25, 'lb', false, 'TOMROM-CAJA-MEDIUM', 'Caja', 'Medium', 80);
insert into pack_styles (id, product_id, name, unit_of_measure, net_weight, weight_unit, is_default, sku_code, empaque, calibre, units_per_pallet) values (81, 16, 'Caja granel 10 lb', 'caja', 10, 'lb', true, 'LYCH-CAJA-GRANEL10LB', 'Caja', 'granel 10 lb', 100);
insert into pack_styles (id, product_id, name, unit_of_measure, net_weight, weight_unit, is_default, sku_code, empaque, calibre, units_per_pallet) values (82, 16, 'Caja 5 lb', 'caja', 5, 'lb', false, 'LYCH-CAJA-5LB', 'Caja', '5 lb', 150);
insert into pack_styles (id, product_id, name, unit_of_measure, net_weight, weight_unit, is_default, sku_code, empaque, calibre, units_per_pallet) values (83, 16, 'Caja 12x1 lb clamshell', 'caja', 12, 'lb', false, 'LYCH-CAJA-12X1LBCLAMSHELL', 'Caja', '12x1 lb clamshell', 90);
insert into pack_styles (id, product_id, name, unit_of_measure, net_weight, weight_unit, is_default, sku_code, empaque, calibre, units_per_pallet) values (84, 34, 'Caja 50 lb', 'caja', 50, 'lb', true, 'PLAMAC-CAJA-50LB', 'Caja', '50 lb', 40);
insert into pack_styles (id, product_id, name, unit_of_measure, net_weight, weight_unit, is_default, sku_code, empaque, calibre, units_per_pallet) values (85, 34, 'Caja Select', 'caja', 50, 'lb', false, 'PLAMAC-CAJA-SELECT', 'Caja', 'Select', 40);
insert into pack_styles (id, product_id, name, unit_of_measure, net_weight, weight_unit, is_default, sku_code, empaque, calibre, units_per_pallet) values (86, 32, 'Caja 5 ct', 'caja', 36, 'lb', true, 'PAPA-TAIN-CAJA-5CT', 'Caja', '5 ct', 48);
insert into pack_styles (id, product_id, name, unit_of_measure, net_weight, weight_unit, is_default, sku_code, empaque, calibre, units_per_pallet) values (87, 32, 'Caja 6 ct', 'caja', 36, 'lb', false, 'PAPA-TAIN-CAJA-6CT', 'Caja', '6 ct', 48);
insert into pack_styles (id, product_id, name, unit_of_measure, net_weight, weight_unit, is_default, sku_code, empaque, calibre, units_per_pallet) values (88, 32, 'Caja 8 ct', 'caja', 36, 'lb', false, 'PAPA-TAIN-CAJA-8CT', 'Caja', '8 ct', 48);
insert into pack_styles (id, product_id, name, unit_of_measure, net_weight, weight_unit, is_default, sku_code, empaque, calibre, units_per_pallet) values (89, 28, 'Caja 6 ct', 'caja', 36, 'lb', true, 'PAPA-FORM-CAJA-6CT', 'Caja', '6 ct', 48);
insert into pack_styles (id, product_id, name, unit_of_measure, net_weight, weight_unit, is_default, sku_code, empaque, calibre, units_per_pallet) values (90, 28, 'Caja 8 ct', 'caja', 36, 'lb', false, 'PAPA-FORM-CAJA-8CT', 'Caja', '8 ct', 48);
insert into pack_styles (id, product_id, name, unit_of_measure, net_weight, weight_unit, is_default, sku_code, empaque, calibre, units_per_pallet) values (91, 28, 'Caja 9 ct', 'caja', 36, 'lb', false, 'PAPA-FORM-CAJA-9CT', 'Caja', '9 ct', 48);
insert into pack_styles (id, product_id, name, unit_of_measure, net_weight, weight_unit, is_default, sku_code, empaque, calibre, units_per_pallet) values (92, 31, 'Caja 9 ct', 'caja', 36, 'lb', true, 'PAPA-REDL-CAJA-9CT', 'Caja', '9 ct', 48);
insert into pack_styles (id, product_id, name, unit_of_measure, net_weight, weight_unit, is_default, sku_code, empaque, calibre, units_per_pallet) values (93, 31, 'Caja 10 ct', 'caja', 36, 'lb', false, 'PAPA-REDL-CAJA-10CT', 'Caja', '10 ct', 48);
insert into pack_styles (id, product_id, name, unit_of_measure, net_weight, weight_unit, is_default, sku_code, empaque, calibre, units_per_pallet) values (94, 31, 'Caja 12 ct', 'caja', 36, 'lb', false, 'PAPA-REDL-CAJA-12CT', 'Caja', '12 ct', 48);
insert into pack_styles (id, product_id, name, unit_of_measure, net_weight, weight_unit, is_default, sku_code, empaque, calibre, units_per_pallet) values (95, 21, 'Caja 14 ct', 'caja', 4, 'kg', true, 'MANG-MANI-CAJA-14CT', 'Caja', '14 ct', 240);
insert into pack_styles (id, product_id, name, unit_of_measure, net_weight, weight_unit, is_default, sku_code, empaque, calibre, units_per_pallet) values (96, 21, 'Caja 16 ct', 'caja', 4, 'kg', false, 'MANG-MANI-CAJA-16CT', 'Caja', '16 ct', 240);
insert into pack_styles (id, product_id, name, unit_of_measure, net_weight, weight_unit, is_default, sku_code, empaque, calibre, units_per_pallet) values (97, 21, 'Caja 18 ct', 'caja', 4, 'kg', false, 'MANG-MANI-CAJA-18CT', 'Caja', '18 ct', 240);
insert into pack_styles (id, product_id, name, unit_of_measure, net_weight, weight_unit, is_default, sku_code, empaque, calibre, units_per_pallet) values (98, 18, 'Caja 8 ct', 'caja', 4, 'kg', true, 'MANG-HADE-CAJA-8CT', 'Caja', '8 ct', 240);
insert into pack_styles (id, product_id, name, unit_of_measure, net_weight, weight_unit, is_default, sku_code, empaque, calibre, units_per_pallet) values (99, 18, 'Caja 9 ct', 'caja', 4, 'kg', false, 'MANG-HADE-CAJA-9CT', 'Caja', '9 ct', 240);
insert into pack_styles (id, product_id, name, unit_of_measure, net_weight, weight_unit, is_default, sku_code, empaque, calibre, units_per_pallet) values (100, 18, 'Caja 10 ct', 'caja', 4, 'kg', false, 'MANG-HADE-CAJA-10CT', 'Caja', '10 ct', 240);
insert into pack_styles (id, product_id, name, unit_of_measure, net_weight, weight_unit, is_default, sku_code, empaque, calibre, units_per_pallet) values (101, 22, 'Caja 7 ct', 'caja', 4, 'kg', true, 'MANG-PALM-CAJA-7CT', 'Caja', '7 ct', 240);
insert into pack_styles (id, product_id, name, unit_of_measure, net_weight, weight_unit, is_default, sku_code, empaque, calibre, units_per_pallet) values (102, 22, 'Caja 8 ct', 'caja', 4, 'kg', false, 'MANG-PALM-CAJA-8CT', 'Caja', '8 ct', 240);
insert into pack_styles (id, product_id, name, unit_of_measure, net_weight, weight_unit, is_default, sku_code, empaque, calibre, units_per_pallet) values (103, 22, 'Caja 9 ct', 'caja', 4, 'kg', false, 'MANG-PALM-CAJA-9CT', 'Caja', '9 ct', 240);
insert into pack_styles (id, product_id, name, unit_of_measure, net_weight, weight_unit, is_default, sku_code, empaque, calibre, units_per_pallet) values (104, 25, 'Caja 48 ct (4 doc)', 'caja', 45, 'lb', true, 'MAIDUL-BICO-CAJA-48CT4DOC', 'Caja', '48 ct (4 doc)', 48);
insert into pack_styles (id, product_id, name, unit_of_measure, net_weight, weight_unit, is_default, sku_code, empaque, calibre, units_per_pallet) values (105, 25, 'Caja 54 ct (4.5 doc)', 'caja', 50, 'lb', false, 'MAIDUL-BICO-CAJA-54CT45DOC', 'Caja', '54 ct (4.5 doc)', 48);
insert into pack_styles (id, product_id, name, unit_of_measure, net_weight, weight_unit, is_default, sku_code, empaque, calibre, units_per_pallet) values (106, 24, 'Caja 48 ct (4 doc)', 'caja', 45, 'lb', true, 'MAIDUL-AMAR-CAJA-48CT4DOC', 'Caja', '48 ct (4 doc)', 48);
insert into pack_styles (id, product_id, name, unit_of_measure, net_weight, weight_unit, is_default, sku_code, empaque, calibre, units_per_pallet) values (107, 24, 'Caja 54 ct (4.5 doc)', 'caja', 50, 'lb', false, 'MAIDUL-AMAR-CAJA-54CT45DOC', 'Caja', '54 ct (4.5 doc)', 48);
insert into pack_styles (id, product_id, name, unit_of_measure, net_weight, weight_unit, is_default, sku_code, empaque, calibre, units_per_pallet) values (108, 26, 'Caja 48 ct (4 doc)', 'caja', 45, 'lb', true, 'MAIDUL-BLAN-CAJA-48CT4DOC', 'Caja', '48 ct (4 doc)', 48);
insert into pack_styles (id, product_id, name, unit_of_measure, net_weight, weight_unit, is_default, sku_code, empaque, calibre, units_per_pallet) values (109, 26, 'Caja 54 ct (4.5 doc)', 'caja', 50, 'lb', false, 'MAIDUL-BLAN-CAJA-54CT45DOC', 'Caja', '54 ct (4.5 doc)', 48);
insert into pack_styles (id, product_id, name, unit_of_measure, net_weight, weight_unit, is_default, sku_code, empaque, calibre, units_per_pallet) values (110, 14, 'Caja granel 40 lb', 'caja', 40, 'lb', true, 'LIMO-MEXI-CAJA-GRANEL40LB', 'Caja', 'granel 40 lb', 60);
insert into pack_styles (id, product_id, name, unit_of_measure, net_weight, weight_unit, is_default, sku_code, empaque, calibre, units_per_pallet) values (111, 14, 'Caja 10 lb', 'caja', 10, 'lb', false, 'LIMO-MEXI-CAJA-10LB', 'Caja', '10 lb', 150);
insert into pack_styles (id, product_id, name, unit_of_measure, net_weight, weight_unit, is_default, sku_code, empaque, calibre, units_per_pallet) values (112, 37, 'Caja 18 ct iced', 'caja', 12, 'lb', true, 'SWEBABBR-CAJA-18CTICED', 'Caja', '18 ct iced', 80);
insert into pack_styles (id, product_id, name, unit_of_measure, net_weight, weight_unit, is_default, sku_code, empaque, calibre, units_per_pallet) values (113, 37, 'Caja 14x8 oz', 'caja', 7, 'lb', false, 'SWEBABBR-CAJA-14X8OZ', 'Caja', '14x8 oz', 132);
insert into pack_styles (id, product_id, name, unit_of_measure, net_weight, weight_unit, is_default, sku_code, empaque, calibre, units_per_pallet) values (114, 37, 'Caja 4x4 lb club', 'caja', 16, 'lb', false, 'SWEBABBR-CAJA-4X4LBCLUB', 'Caja', '4x4 lb club', 50);
insert into pack_styles (id, product_id, name, unit_of_measure, net_weight, weight_unit, is_default, sku_code, empaque, calibre, units_per_pallet) values (115, 37, 'Caja loose 10 lb', 'caja', 10, 'lb', false, 'SWEBABBR-CAJA-LOOSE10LB', 'Caja', 'loose 10 lb', 80);
insert into pack_styles (id, product_id, name, unit_of_measure, net_weight, weight_unit, is_default, sku_code, empaque, calibre, units_per_pallet) values (116, 37, 'Caja loose 20 lb', 'caja', 20, 'lb', false, 'SWEBABBR-CAJA-LOOSE20LB', 'Caja', 'loose 20 lb', 35);
insert into pack_styles (id, product_id, name, unit_of_measure, net_weight, weight_unit, is_default, sku_code, empaque, calibre, units_per_pallet) values (117, 8, 'Caja 11 LB', 'caja', 11, 'lb', false, 'ESPA-CAJA-11LB', 'Caja', '11 LB', 120);
insert into pack_styles (id, product_id, name, unit_of_measure, net_weight, weight_unit, is_default, sku_code, empaque, calibre, units_per_pallet) values (118, 29, 'Caja 6 ct', 'caja', 36, 'lb', true, 'PAPA-INTE-CAJA-6CT', 'Caja', '6 ct', 48);
insert into pack_styles (id, product_id, name, unit_of_measure, net_weight, weight_unit, is_default, sku_code, empaque, calibre, units_per_pallet) values (119, 29, 'Caja 7 ct', 'caja', 36, 'lb', false, 'PAPA-INTE-CAJA-7CT', 'Caja', '7 ct', 48);
insert into pack_styles (id, product_id, name, unit_of_measure, net_weight, weight_unit, is_default, sku_code, empaque, calibre, units_per_pallet) values (120, 29, 'Caja 8 ct', 'caja', 36, 'lb', false, 'PAPA-INTE-CAJA-8CT', 'Caja', '8 ct', 48);
insert into pack_styles (id, product_id, name, unit_of_measure, net_weight, weight_unit, is_default, sku_code, empaque, calibre, units_per_pallet) values (121, 29, 'Caja 9 ct', 'caja', 36, 'lb', false, 'PAPA-INTE-CAJA-9CT', 'Caja', '9 ct', 48);
insert into pack_styles (id, product_id, name, unit_of_measure, net_weight, weight_unit, is_default, sku_code, empaque, calibre, units_per_pallet) values (122, 29, 'Caja 12 ct', 'caja', 36, 'lb', false, 'PAPA-INTE-CAJA-12CT', 'Caja', '12 ct', 48);
insert into pack_styles (id, product_id, name, unit_of_measure, net_weight, weight_unit, is_default, sku_code, empaque, calibre, units_per_pallet) values (123, 29, 'Caja 10 ct', 'caja', 36, 'lb', false, 'PAPA-INTE-CAJA-10CT', 'Caja', '10 ct', 48);
insert into pack_styles (id, product_id, name, unit_of_measure, net_weight, weight_unit, is_default, sku_code, empaque, calibre, units_per_pallet) values (124, 32, 'Caja 7 ct', 'caja', 36, 'lb', false, 'PAPA-TAIN-CAJA-7CT', 'Caja', '7 ct', 48);
insert into pack_styles (id, product_id, name, unit_of_measure, net_weight, weight_unit, is_default, sku_code, empaque, calibre, units_per_pallet) values (125, 32, 'Caja 9 ct', 'caja', 36, 'lb', false, 'PAPA-TAIN-CAJA-9CT', 'Caja', '9 ct', 48);
insert into pack_styles (id, product_id, name, unit_of_measure, net_weight, weight_unit, is_default, sku_code, empaque, calibre, units_per_pallet) values (126, 32, 'Caja 10 ct', 'caja', 36, 'lb', false, 'PAPA-TAIN-CAJA-10CT', 'Caja', '10 ct', 48);
insert into pack_styles (id, product_id, name, unit_of_measure, net_weight, weight_unit, is_default, sku_code, empaque, calibre, units_per_pallet) values (127, 32, 'Caja 12 ct', 'caja', 36, 'lb', false, 'PAPA-TAIN-CAJA-12CT', 'Caja', '12 ct', 48);
insert into pack_styles (id, product_id, name, unit_of_measure, net_weight, weight_unit, is_default, sku_code, empaque, calibre, units_per_pallet) values (128, 33, 'Caja 6 ct', 'caja', 36, 'lb', true, 'PAPA-VEGA-CAJA-6CT', 'Caja', '6 ct', 48);
insert into pack_styles (id, product_id, name, unit_of_measure, net_weight, weight_unit, is_default, sku_code, empaque, calibre, units_per_pallet) values (129, 33, 'Caja 7 ct', 'caja', 36, 'lb', false, 'PAPA-VEGA-CAJA-7CT', 'Caja', '7 ct', 48);
insert into pack_styles (id, product_id, name, unit_of_measure, net_weight, weight_unit, is_default, sku_code, empaque, calibre, units_per_pallet) values (130, 33, 'Caja 8 ct', 'caja', 36, 'lb', false, 'PAPA-VEGA-CAJA-8CT', 'Caja', '8 ct', 48);
insert into pack_styles (id, product_id, name, unit_of_measure, net_weight, weight_unit, is_default, sku_code, empaque, calibre, units_per_pallet) values (131, 33, 'Caja 9 ct', 'caja', 36, 'lb', false, 'PAPA-VEGA-CAJA-9CT', 'Caja', '9 ct', 48);
insert into pack_styles (id, product_id, name, unit_of_measure, net_weight, weight_unit, is_default, sku_code, empaque, calibre, units_per_pallet) values (132, 33, 'Caja 10 ct', 'caja', 36, 'lb', false, 'PAPA-VEGA-CAJA-10CT', 'Caja', '10 ct', 31);
insert into pack_styles (id, product_id, name, unit_of_measure, net_weight, weight_unit, is_default, sku_code, empaque, calibre, units_per_pallet) values (133, 33, 'Caja 12 ct', 'caja', 36, 'lb', false, 'PAPA-VEGA-CAJA-12CT', 'Caja', '12 ct', 48);
insert into pack_styles (id, product_id, name, unit_of_measure, net_weight, weight_unit, is_default, sku_code, empaque, calibre, units_per_pallet) values (134, 38, 'Caja 18 ct iced', 'caja', 12, 'lb', true, 'SWEBABBR-PANC-CAJA-18CTICED', 'Caja', '18 ct iced', 80);
insert into pack_styles (id, product_id, name, unit_of_measure, net_weight, weight_unit, is_default, sku_code, empaque, calibre, units_per_pallet) values (135, 38, 'Caja 20 lb loose', 'caja', 20, 'lb', false, 'SWEBABBR-PANC-CAJA-20LBLOOSE', 'Caja', '20 lb loose', 35);
insert into pack_styles (id, product_id, name, unit_of_measure, net_weight, weight_unit, is_default, sku_code, empaque, calibre, units_per_pallet) values (136, 38, 'Caja 14x8 oz', 'caja', 7, 'lb', false, 'SWEBABBR-PANC-CAJA-14X8OZ', 'Caja', '14x8 oz', 132);
insert into pack_styles (id, product_id, name, unit_of_measure, net_weight, weight_unit, is_default, sku_code, empaque, calibre, units_per_pallet) values (137, 30, 'Caja 7 ct', 'caja', 36, 'lb', false, 'PAPA-MARA-CAJA-7CT', 'Caja', '7 ct', 48);
insert into pack_styles (id, product_id, name, unit_of_measure, net_weight, weight_unit, is_default, sku_code, empaque, calibre, units_per_pallet) values (138, 9, 'Caja 11 LB', 'caja', 11, 'lb', false, 'ESPORG-CAJA-11LB', 'Caja', '11 LB', 120);
insert into pack_styles (id, product_id, name, unit_of_measure, net_weight, weight_unit, is_default, sku_code, empaque, calibre, units_per_pallet) values (139, 4, 'Caja 15x2lb', 'caja', 30, 'lb', true, 'BRUSPROR-CAJA-15X2LB', 'Caja', '15x2lb', null);
insert into pack_styles (id, product_id, name, unit_of_measure, net_weight, weight_unit, is_default, sku_code, empaque, calibre, units_per_pallet) values (140, 4, 'Caja 10 lb', 'caja', 10, 'lb', false, 'BRUSPROR-CAJA-10LB', 'Caja', '10 lb', null);
insert into pack_styles (id, product_id, name, unit_of_measure, net_weight, weight_unit, is_default, sku_code, empaque, calibre, units_per_pallet) values (141, 4, 'Caja 16x1lb', 'caja', 16, 'lb', false, 'BRUSPROR-CAJA-16X1LB', 'Caja', '16x1lb', null);
insert into pack_styles (id, product_id, name, unit_of_measure, net_weight, weight_unit, is_default, sku_code, empaque, calibre, units_per_pallet) values (142, 4, 'Caja 18x1lb', 'caja', 18, 'lb', false, 'BRUSPROR-CAJA-18X1LB', 'Caja', '18x1lb', null);
insert into pack_styles (id, product_id, name, unit_of_measure, net_weight, weight_unit, is_default, sku_code, empaque, calibre, units_per_pallet) values (143, 4, 'Caja Mesh', 'caja', null, 'lb', false, 'BRUSPROR-CAJA-MESH', 'Caja', 'Mesh', null);
insert into pack_styles (id, product_id, name, unit_of_measure, net_weight, weight_unit, is_default, sku_code, empaque, calibre, units_per_pallet) values (144, 36, 'Caja 8 lb', 'caja', 8, 'lb', false, 'REDHAB-CAJA-8LB', 'Caja', '8 lb', 100);
insert into pack_styles (id, product_id, name, unit_of_measure, net_weight, weight_unit, is_default, sku_code, empaque, calibre, units_per_pallet) values (145, 27, 'Caja 8 lb', 'caja', 8, 'lb', false, 'ORAHAB-CAJA-8LB', 'Caja', '8 lb', 100);
insert into pack_styles (id, product_id, name, unit_of_measure, net_weight, weight_unit, is_default, sku_code, empaque, calibre, units_per_pallet) values (146, 4, 'Caja 25 lb', 'caja', 25, 'lb', false, 'BRUSPROR-CAJA-25LB', 'Caja', '25 lb', 60);
insert into pack_styles (id, product_id, name, unit_of_measure, net_weight, weight_unit, is_default, sku_code, empaque, calibre, units_per_pallet) values (147, 13, 'Caja std', 'caja', 25, 'lb', true, 'LIMO-CAJA-STD', 'Caja', 'std', 60);

-- Vendors
insert into suppliers (id, code, name, contact_name, phone, city, country, notes, email, es_proveedor, es_cliente) values (1, 'PRO-001', 'Acesoria Rendon', null, null, null, null, null, null, true, false);
insert into suppliers (id, code, name, contact_name, phone, city, country, notes, email, es_proveedor, es_cliente) values (2, 'PRO-002', 'Agricola El Sagrado', null, null, null, null, null, null, true, false);
insert into suppliers (id, code, name, contact_name, phone, city, country, notes, email, es_proveedor, es_cliente) values (3, 'PRO-003', 'Agricola Omega', 'Brianda Ayala', '526644955956', 'Guaymas', 'México', 'Producto; Agricultor', 'brianda@ayalaproduce.com', true, false);
insert into suppliers (id, code, name, contact_name, phone, city, country, notes, email, es_proveedor, es_cliente) values (4, 'PRO-004', 'Agricooling', 'Luis Gonzalez', '5209805584', 'Nogales', 'USA', 'Servicio', 'lgonzalez@agripacking.net', true, false);
insert into suppliers (id, code, name, contact_name, phone, city, country, notes, email, es_proveedor, es_cliente) values (5, 'PRO-005', 'Agrofepac SA DE CV', 'Eduardo', '523112704917', 'San Blas, Nayarit', null, null, 'agrofepaclogistica@gmail.com', true, false);
insert into suppliers (id, code, name, contact_name, phone, city, country, notes, email, es_proveedor, es_cliente) values (6, 'PRO-006', 'Akambarhu Hortalizas', null, null, null, null, 'Producto', null, true, false);
insert into suppliers (id, code, name, contact_name, phone, city, country, notes, email, es_proveedor, es_cliente) values (7, 'PRO-007', 'Alexia Romandia', 'Alexia Romandia', '5205286520', 'New York', 'USA', null, 'alexiaromandia@gmail.com', true, false);
insert into suppliers (id, code, name, contact_name, phone, city, country, notes, email, es_proveedor, es_cliente) values (8, 'PRO-008', 'Aruba Vegetable Seed Company, LLC', 'Rene', '8315957500', null, 'USA', 'Semilla', 'rene@arubaseed.com', true, false);
insert into suppliers (id, code, name, contact_name, phone, city, country, notes, email, es_proveedor, es_cliente) values (9, 'PRO-009', 'Baja Plants', 'Erika Lizeth Vargas', '527352205815', 'Ensenada', 'México', 'Invernadero', 'lizethvargas@bajaplants.com.mx', true, false);
insert into suppliers (id, code, name, contact_name, phone, city, country, notes, email, es_proveedor, es_cliente) values (10, 'PRO-010', 'BBA Logistics', 'Roxana Estefania Macias', '17024886878', 'Los Mochis', 'México', 'Logistica', 'r.macias@traxion.global', true, false);
insert into suppliers (id, code, name, contact_name, phone, city, country, notes, email, es_proveedor, es_cliente) values (11, 'PRO-011', 'Candy Fresh LLC', 'Dulce Fernandez', '9566810251', 'Pharr', 'USA', 'Producto', 'candyfreshllc@gmail.com', true, true);
insert into suppliers (id, code, name, contact_name, phone, city, country, notes, email, es_proveedor, es_cliente) values (12, 'PRO-012', 'Cargoldmex', null, null, null, null, null, null, true, false);
insert into suppliers (id, code, name, contact_name, phone, city, country, notes, email, es_proveedor, es_cliente) values (13, 'PRO-013', 'Carrifoods USA Corp.', 'Carolina Ticante', '522283119014', 'Houston', 'USA', 'Producto', 'admin@carrifoods.com', true, true);
insert into suppliers (id, code, name, contact_name, phone, city, country, notes, email, es_proveedor, es_cliente) values (14, 'PRO-014', 'Celulosa Corrugados', 'Luis Roman', '526681503433', 'Navojoa', 'México', null, 'biotec2rr@gmail.com', true, false);
insert into suppliers (id, code, name, contact_name, phone, city, country, notes, email, es_proveedor, es_cliente) values (15, 'PRO-015', 'Colimones', null, null, null, null, 'Producto', null, true, false);
insert into suppliers (id, code, name, contact_name, phone, city, country, notes, email, es_proveedor, es_cliente) values (16, 'PRO-016', 'Cornejos Horticola', 'Rigoberto Cornejos', '526441594637', 'Navojoa', 'México', 'Producto', 'rigo.cm@gmail.com', true, false);
insert into suppliers (id, code, name, contact_name, phone, city, country, notes, email, es_proveedor, es_cliente) values (17, 'PRO-017', 'Costa Tropical', null, null, null, null, null, null, true, false);
insert into suppliers (id, code, name, contact_name, phone, city, country, notes, email, es_proveedor, es_cliente) values (18, 'PRO-018', 'Drage CPA PLLC', 'Jon Drage', '4073610069', 'Miami', 'USA', 'Financiero', 'Contador Jon', true, false);
insert into suppliers (id, code, name, contact_name, phone, city, country, notes, email, es_proveedor, es_cliente) values (19, 'PRO-019', 'EF International', null, null, null, null, 'Producto', null, true, false);
insert into suppliers (id, code, name, contact_name, phone, city, country, notes, email, es_proveedor, es_cliente) values (20, 'PRO-020', 'Lam Produce', null, null, null, null, null, null, true, false);
insert into suppliers (id, code, name, contact_name, phone, city, country, notes, email, es_proveedor, es_cliente) values (21, 'PRO-021', 'Las Brisas Produce', 'Raiza Chacon', '523231046774', 'San Blas', 'México', 'Producto', 'raizachacon2@gmail.com', true, false);
insert into suppliers (id, code, name, contact_name, phone, city, country, notes, email, es_proveedor, es_cliente) values (22, 'PRO-022', 'Luis Alvarez', null, '1 956 862-3819', null, null, null, null, true, false);
insert into suppliers (id, code, name, contact_name, phone, city, country, notes, email, es_proveedor, es_cliente) values (23, 'PRO-023', 'Pampa Store', 'Mercedes Piccone', '52 612 167 2857', null, 'México', 'Agricultor; Producto', 'mercedesp@pampastore.com', true, false);
insert into suppliers (id, code, name, contact_name, phone, city, country, notes, email, es_proveedor, es_cliente) values (24, 'PRO-024', 'Papayas & More, LLC', 'Luis Anguiano', '9562124258', 'McAllen', 'USA', 'Agricultor; Producto', 'luis@papayasandmore.com', true, true);
insert into suppliers (id, code, name, contact_name, phone, city, country, notes, email, es_proveedor, es_cliente) values (25, 'PRO-025', 'Primus Organics', null, null, null, null, null, null, true, false);
insert into suppliers (id, code, name, contact_name, phone, city, country, notes, email, es_proveedor, es_cliente) values (26, 'PRO-026', 'Rogugo Agropecuaria', null, null, null, null, 'Producto', null, true, false);
insert into suppliers (id, code, name, contact_name, phone, city, country, notes, email, es_proveedor, es_cliente) values (27, 'PRO-027', 'Sandra Zamora Insurance Agency', 'Sandra Zamora', '9565851984', 'Mission', 'USA', 'Seguros', 'szinsurance@yahoo.com', true, false);
insert into suppliers (id, code, name, contact_name, phone, city, country, notes, email, es_proveedor, es_cliente) values (28, 'PRO-028', 'Santana Agricola', null, null, null, null, null, null, true, false);
insert into suppliers (id, code, name, contact_name, phone, city, country, notes, email, es_proveedor, es_cliente) values (29, 'PRO-029', 'Suarez Brokerage', 'Nayra Gallego', '15206047394', 'Nogales', 'USA', 'Aduanal', 'nayra@suarezbrokers.com', true, false);
insert into suppliers (id, code, name, contact_name, phone, city, country, notes, email, es_proveedor, es_cliente) values (30, 'PRO-030', 'Succar Farms', null, null, null, null, null, null, true, false);
insert into suppliers (id, code, name, contact_name, phone, city, country, notes, email, es_proveedor, es_cliente) values (31, 'PRO-031', 'Tierra selecta', 'Alonso', '5548667529', 'McAllen', 'USA', 'Producto', 'alonso@natura-alimentos.com.mx', true, true);
insert into suppliers (id, code, name, contact_name, phone, city, country, notes, email, es_proveedor, es_cliente) values (32, 'PRO-032', 'Zira Foods', null, null, null, null, null, null, true, false);

-- Customers
insert into customers (id, code, name, contact_name, phone, city, payment_terms, email, es_cliente, es_proveedor) values (1, 'CLI-001', 'Alpine Fresh', 'Juan Pablo', '6681894888', 'Miami', 'Net 30', 'jpgonzalezruis@alpinefresh.com', true, false);
insert into customers (id, code, name, contact_name, phone, city, payment_terms, email, es_cliente, es_proveedor) values (2, 'CLI-002', 'Candy Fresh LLC', 'Dulce Fernandez', '9566810251', 'Pharr', 'COD', 'candyfreshllc@gmail.com', true, true);
insert into customers (id, code, name, contact_name, phone, city, payment_terms, email, es_cliente, es_proveedor) values (3, 'CLI-003', 'Carrifoods USA Corp.', 'Carolina Ticante', '522283119014', 'Houston', 'Net 30', 'admin@carrifoods.com', true, true);
insert into customers (id, code, name, contact_name, phone, city, payment_terms, email, es_cliente, es_proveedor) values (4, 'CLI-004', 'Cri International, Inc.', 'Peter Won', '5713345177', 'Centreville', 'Net 30', null, true, false);
insert into customers (id, code, name, contact_name, phone, city, payment_terms, email, es_cliente, es_proveedor) values (5, 'CLI-005', 'Crown Jewels Produce', 'Alejandro Bours', '1 (520) 470-9567', 'Nogales', 'Net 21', 'alejandro@crownjewelsproduce.com', true, false);
insert into customers (id, code, name, contact_name, phone, city, payment_terms, email, es_cliente, es_proveedor) values (6, 'CLI-006', 'Crystal Valley Foods', 'Jose Hidalgo', '9542327193', 'Miami, FL', 'COD', 'jose@crystalvalleyfoods.com', true, false);
insert into customers (id, code, name, contact_name, phone, city, payment_terms, email, es_cliente, es_proveedor) values (7, 'CLI-007', 'Exp Group, LLC', null, '1 805 295-3995', null, 'COD', null, true, false);
insert into customers (id, code, name, contact_name, phone, city, payment_terms, email, es_cliente, es_proveedor) values (8, 'CLI-008', 'Familia productora de occidente', null, null, null, 'COD', null, true, false);
insert into customers (id, code, name, contact_name, phone, city, payment_terms, email, es_cliente, es_proveedor) values (9, 'CLI-009', 'Fresh Global Produce', null, '52 462 6214359', null, 'COD', null, true, false);
insert into customers (id, code, name, contact_name, phone, city, payment_terms, email, es_cliente, es_proveedor) values (10, 'CLI-010', 'Fresh Produce Industry, LLC', null, null, null, 'COD', null, true, false);
insert into customers (id, code, name, contact_name, phone, city, payment_terms, email, es_cliente, es_proveedor) values (11, 'CLI-011', 'Freshmexusa, LLC.', 'Nestor Garcia', '3233993159', 'Whittier', 'COD', 'nestor@freshmexusa.com', true, false);
insert into customers (id, code, name, contact_name, phone, city, payment_terms, email, es_cliente, es_proveedor) values (12, 'CLI-012', 'Marquez Produce, Inc.', null, '1 213 761-0071', 'Los Angeles, CA', 'COD', 'bmarquez@marquez-produce.com', true, false);
insert into customers (id, code, name, contact_name, phone, city, payment_terms, email, es_cliente, es_proveedor) values (13, 'CLI-013', 'Northgate Markets', null, '1 714 412-3392', 'Los Angeles', 'Net 21', 'juan.rivas@northgatemarkets.com', true, false);
insert into customers (id, code, name, contact_name, phone, city, payment_terms, email, es_cliente, es_proveedor) values (14, 'CLI-014', 'Papayas & More, LLC', 'Luis Anguiano', '9562124258', 'McAllen', 'Net 30', 'luis@papayasandmore.com', true, true);
insert into customers (id, code, name, contact_name, phone, city, payment_terms, email, es_cliente, es_proveedor) values (15, 'CLI-015', 'Rodriguez Produce', null, '1 704 287-7178', null, 'COD', null, true, false);
insert into customers (id, code, name, contact_name, phone, city, payment_terms, email, es_cliente, es_proveedor) values (16, 'CLI-016', 'Royal Halo LLC', 'Ricardo Hernandez', '7736763514', 'Wilmington', 'COD', 'rick@royalhalo.com', true, false);
insert into customers (id, code, name, contact_name, phone, city, payment_terms, email, es_cliente, es_proveedor) values (17, 'CLI-017', 'Tierra selecta', 'Alonso', '5548667529', 'McAllen', 'COD', 'alonso@natura-alimentos.com.mx', true, true);

-- Dual customer/vendor links
update customers set linked_supplier_id = 11 where id = 2;
update suppliers set linked_customer_id = 2 where id = 11;
update customers set linked_supplier_id = 13 where id = 3;
update suppliers set linked_customer_id = 3 where id = 13;
update customers set linked_supplier_id = 24 where id = 14;
update suppliers set linked_customer_id = 14 where id = 24;
update customers set linked_supplier_id = 31 where id = 17;
update suppliers set linked_customer_id = 17 where id = 31;

-- Preferred SKUs on vendors
insert into party_skus (party_kind, party_id, pack_style_id, notes) select 'vendor', 21, ps.id, 'Grown / packed by this vendor' from pack_styles ps where ps.product_id in (1) on conflict do nothing;
insert into party_skus (party_kind, party_id, pack_style_id, notes) select 'vendor', 21, ps.id, 'Grown / packed by this vendor' from pack_styles ps where ps.product_id in (10) on conflict do nothing;
insert into party_skus (party_kind, party_id, pack_style_id, notes) select 'vendor', 24, ps.id, 'Grown / packed by this vendor' from pack_styles ps where ps.product_id in (28, 29, 30, 31, 32, 33) on conflict do nothing;
insert into party_skus (party_kind, party_id, pack_style_id, notes) select 'vendor', 12, ps.id, 'Grown / packed by this vendor' from pack_styles ps where ps.product_id in (8) on conflict do nothing;
insert into party_skus (party_kind, party_id, pack_style_id, notes) select 'vendor', 23, ps.id, 'Grown / packed by this vendor' from pack_styles ps where ps.product_id in (8) on conflict do nothing;
insert into party_skus (party_kind, party_id, pack_style_id, notes) select 'vendor', 13, ps.id, 'Grown / packed by this vendor' from pack_styles ps where ps.product_id in (36) on conflict do nothing;
insert into party_skus (party_kind, party_id, pack_style_id, notes) select 'vendor', 13, ps.id, 'Grown / packed by this vendor' from pack_styles ps where ps.product_id in (27) on conflict do nothing;
insert into party_skus (party_kind, party_id, pack_style_id, notes) select 'vendor', 3, ps.id, 'Grown / packed by this vendor' from pack_styles ps where ps.product_id in (4) on conflict do nothing;
insert into party_skus (party_kind, party_id, pack_style_id, notes) select 'vendor', 13, ps.id, 'Grown / packed by this vendor' from pack_styles ps where ps.product_id in (13, 14, 15) on conflict do nothing;

-- Vocabularies
insert into value_lists (kind, value, sort_order) values ('empaque', 'Saco', 0) on conflict (kind, value) do nothing;
insert into value_lists (kind, value, sort_order) values ('empaque', 'Caja', 1) on conflict (kind, value) do nothing;
insert into value_lists (kind, value, sort_order) values ('empaque', 'Bin', 2) on conflict (kind, value) do nothing;
insert into value_lists (kind, value, sort_order) values ('empaque', 'Manojo', 3) on conflict (kind, value) do nothing;
insert into value_lists (kind, value, sort_order) values ('empaque', 'Bolsa', 4) on conflict (kind, value) do nothing;
insert into value_lists (kind, value, sort_order) values ('empaque', 'Clamshell', 5) on conflict (kind, value) do nothing;
insert into value_lists (kind, value, sort_order) values ('calibre', '1 ct', 0) on conflict (kind, value) do nothing;
insert into value_lists (kind, value, sort_order) values ('calibre', '2 ct', 0) on conflict (kind, value) do nothing;
insert into value_lists (kind, value, sort_order) values ('calibre', '3 ct', 0) on conflict (kind, value) do nothing;
insert into value_lists (kind, value, sort_order) values ('calibre', '4 ct', 0) on conflict (kind, value) do nothing;
insert into value_lists (kind, value, sort_order) values ('calibre', '5 ct', 0) on conflict (kind, value) do nothing;
insert into value_lists (kind, value, sort_order) values ('calibre', '6 ct', 0) on conflict (kind, value) do nothing;
insert into value_lists (kind, value, sort_order) values ('calibre', '7 ct', 0) on conflict (kind, value) do nothing;
insert into value_lists (kind, value, sort_order) values ('calibre', '8 ct', 0) on conflict (kind, value) do nothing;
insert into value_lists (kind, value, sort_order) values ('calibre', '9 ct', 0) on conflict (kind, value) do nothing;
insert into value_lists (kind, value, sort_order) values ('calibre', '10 ct', 0) on conflict (kind, value) do nothing;
insert into value_lists (kind, value, sort_order) values ('calibre', '12 ct', 0) on conflict (kind, value) do nothing;
insert into value_lists (kind, value, sort_order) values ('calibre', '14 ct', 0) on conflict (kind, value) do nothing;
insert into value_lists (kind, value, sort_order) values ('calibre', '16 ct', 0) on conflict (kind, value) do nothing;
insert into value_lists (kind, value, sort_order) values ('calibre', '18 ct', 0) on conflict (kind, value) do nothing;
insert into value_lists (kind, value, sort_order) values ('calibre', '20 ct', 0) on conflict (kind, value) do nothing;
insert into value_lists (kind, value, sort_order) values ('calibre', '6-9 ct', 0) on conflict (kind, value) do nothing;
insert into value_lists (kind, value, sort_order) values ('calibre', '9-12 ct', 0) on conflict (kind, value) do nothing;
insert into value_lists (kind, value, sort_order) values ('calibre', '110 ct', 0) on conflict (kind, value) do nothing;
insert into value_lists (kind, value, sort_order) values ('calibre', '150 ct', 0) on conflict (kind, value) do nothing;
insert into value_lists (kind, value, sort_order) values ('calibre', '175 ct', 0) on conflict (kind, value) do nothing;
insert into value_lists (kind, value, sort_order) values ('calibre', '200 ct', 0) on conflict (kind, value) do nothing;
insert into value_lists (kind, value, sort_order) values ('calibre', '230 ct', 0) on conflict (kind, value) do nothing;
insert into value_lists (kind, value, sort_order) values ('calibre', '250 ct', 0) on conflict (kind, value) do nothing;
insert into value_lists (kind, value, sort_order) values ('calibre', '54 ct', 0) on conflict (kind, value) do nothing;
insert into value_lists (kind, value, sort_order) values ('calibre', 'Small', 0) on conflict (kind, value) do nothing;
insert into value_lists (kind, value, sort_order) values ('calibre', 'Medium', 0) on conflict (kind, value) do nothing;
insert into value_lists (kind, value, sort_order) values ('calibre', 'Large', 0) on conflict (kind, value) do nothing;
insert into value_lists (kind, value, sort_order) values ('calibre', 'XL', 0) on conflict (kind, value) do nothing;
insert into value_lists (kind, value, sort_order) values ('calibre', 'Jumbo', 0) on conflict (kind, value) do nothing;
insert into value_lists (kind, value, sort_order) values ('calibre', 'Jumbo/XL', 0) on conflict (kind, value) do nothing;
insert into value_lists (kind, value, sort_order) values ('calibre', 'Select', 0) on conflict (kind, value) do nothing;
insert into value_lists (kind, value, sort_order) values ('calibre', 'Mesh', 0) on conflict (kind, value) do nothing;
insert into value_lists (kind, value, sort_order) values ('calibre', 'Clusters', 0) on conflict (kind, value) do nothing;
insert into value_lists (kind, value, sort_order) values ('calibre', 'Table Top', 0) on conflict (kind, value) do nothing;
insert into value_lists (kind, value, sort_order) values ('calibre', '5 lb', 0) on conflict (kind, value) do nothing;
insert into value_lists (kind, value, sort_order) values ('calibre', '8 lb', 0) on conflict (kind, value) do nothing;
insert into value_lists (kind, value, sort_order) values ('calibre', '10 lb', 0) on conflict (kind, value) do nothing;
insert into value_lists (kind, value, sort_order) values ('calibre', '11 LB', 0) on conflict (kind, value) do nothing;
insert into value_lists (kind, value, sort_order) values ('calibre', '25 lb', 0) on conflict (kind, value) do nothing;
insert into value_lists (kind, value, sort_order) values ('calibre', '50 lb', 0) on conflict (kind, value) do nothing;
insert into value_lists (kind, value, sort_order) values ('calibre', '1 lb bag', 0) on conflict (kind, value) do nothing;
insert into value_lists (kind, value, sort_order) values ('calibre', '2 lb bag', 0) on conflict (kind, value) do nothing;
insert into value_lists (kind, value, sort_order) values ('calibre', '5 lb club', 0) on conflict (kind, value) do nothing;
insert into value_lists (kind, value, sort_order) values ('calibre', '4x4 lb club', 0) on conflict (kind, value) do nothing;
insert into value_lists (kind, value, sort_order) values ('calibre', '11x1 lb', 0) on conflict (kind, value) do nothing;
insert into value_lists (kind, value, sort_order) values ('calibre', '12x1 lb', 0) on conflict (kind, value) do nothing;
insert into value_lists (kind, value, sort_order) values ('calibre', '8x2 lb', 0) on conflict (kind, value) do nothing;
insert into value_lists (kind, value, sort_order) values ('calibre', '12x12 oz', 0) on conflict (kind, value) do nothing;
insert into value_lists (kind, value, sort_order) values ('calibre', '28x8 oz', 0) on conflict (kind, value) do nothing;
insert into value_lists (kind, value, sort_order) values ('calibre', '14x8 oz', 0) on conflict (kind, value) do nothing;
insert into value_lists (kind, value, sort_order) values ('calibre', '15x2lb', 0) on conflict (kind, value) do nothing;
insert into value_lists (kind, value, sort_order) values ('calibre', '16x1lb', 0) on conflict (kind, value) do nothing;
insert into value_lists (kind, value, sort_order) values ('calibre', '18x1lb', 0) on conflict (kind, value) do nothing;
insert into value_lists (kind, value, sort_order) values ('calibre', '12x2 lb malla', 0) on conflict (kind, value) do nothing;
insert into value_lists (kind, value, sort_order) values ('calibre', '12x1 lb clamshell', 0) on conflict (kind, value) do nothing;
insert into value_lists (kind, value, sort_order) values ('calibre', '18 ct iced', 0) on conflict (kind, value) do nothing;
insert into value_lists (kind, value, sort_order) values ('calibre', 'loose 10 lb', 0) on conflict (kind, value) do nothing;
insert into value_lists (kind, value, sort_order) values ('calibre', 'loose 20 lb', 0) on conflict (kind, value) do nothing;
insert into value_lists (kind, value, sort_order) values ('calibre', '20 lb loose', 0) on conflict (kind, value) do nothing;
insert into value_lists (kind, value, sort_order) values ('calibre', '35 lb loose', 0) on conflict (kind, value) do nothing;
insert into value_lists (kind, value, sort_order) values ('calibre', '40 lb loose', 0) on conflict (kind, value) do nothing;
insert into value_lists (kind, value, sort_order) values ('calibre', '11 lb invernadero', 0) on conflict (kind, value) do nothing;
insert into value_lists (kind, value, sort_order) values ('calibre', '9 ct pelado', 0) on conflict (kind, value) do nothing;
insert into value_lists (kind, value, sort_order) values ('calibre', 'mitades', 0) on conflict (kind, value) do nothing;
insert into value_lists (kind, value, sort_order) values ('calibre', 'pelado', 0) on conflict (kind, value) do nothing;
insert into value_lists (kind, value, sort_order) values ('calibre', 'tips & cuts', 0) on conflict (kind, value) do nothing;
insert into value_lists (kind, value, sort_order) values ('calibre', '48 ct (4 doc)', 0) on conflict (kind, value) do nothing;
insert into value_lists (kind, value, sort_order) values ('calibre', '54 ct (4.5 doc)', 0) on conflict (kind, value) do nothing;
insert into value_lists (kind, value, sort_order) values ('calibre', '4', 1) on conflict (kind, value) do nothing;
insert into value_lists (kind, value, sort_order) values ('calibre', '5', 2) on conflict (kind, value) do nothing;
insert into value_lists (kind, value, sort_order) values ('calibre', '6', 3) on conflict (kind, value) do nothing;
insert into value_lists (kind, value, sort_order) values ('calibre', '8', 4) on conflict (kind, value) do nothing;
insert into value_lists (kind, value, sort_order) values ('calibre', '9', 5) on conflict (kind, value) do nothing;
insert into value_lists (kind, value, sort_order) values ('calibre', '12', 6) on conflict (kind, value) do nothing;
insert into value_lists (kind, value, sort_order) values ('calibre', 'Mix', 7) on conflict (kind, value) do nothing;
insert into value_lists (kind, value, sort_order) values ('grado', '1', 1) on conflict (kind, value) do nothing;
insert into value_lists (kind, value, sort_order) values ('grado', '2', 2) on conflict (kind, value) do nothing;
insert into value_lists (kind, value, sort_order) values ('grado', 'Fancy', 3) on conflict (kind, value) do nothing;

select setval('products_id_seq', (select coalesce(max(id),1) from products));
select setval('pack_styles_id_seq', (select coalesce(max(id),1) from pack_styles));
select setval('suppliers_id_seq', (select coalesce(max(id),1) from suppliers));
select setval('customers_id_seq', (select coalesce(max(id),1) from customers));
select setval('value_lists_id_seq', (select coalesce(max(id),1) from value_lists));
select setval('locations_id_seq', (select coalesce(max(id),1) from locations));
select setval('party_skus_id_seq', (select coalesce(max(id),1) from party_skus));
