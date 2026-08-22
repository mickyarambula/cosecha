-- Opening cutover for Plein Produce LLC.
-- Source: V8 Cargas remaining (excl Programada) + Saldos as of 2026-06-30.
-- AR 673014.43 in 50 invoices (invoice_type=opening, not P&L sales).
-- AP 564670.16 in 52 vendor bills (no PO; ordered=received=0 so match is square).
-- Chase 19066.20 cash movement CORTE-CHASE. JEAMS liability 23030.33.
-- Equity plug 104380.14 so the balance sheet ties. YTD 2026 stays in V8/Drage.
-- Not imported: destinos, Pendientes extras, Programada PX-72775/PX-72868, full Chase history.

-- Chart of accounts: wipe demo $15,000, rename bank, add JEAMS, plug equity.
update gl_accounts set
  name = 'JP Morgan Chase',
  description = 'Operating account. Opening from V8 Saldos 30 Jun 2026; later Chase lines are not replayed.',
  tracking_start = '2026-06-30',
  starting_balance = 0
where number = '16000';

update gl_accounts set
  starting_balance = 0,
  tracking_start = '2026-06-30',
  description = 'Cash movements live on 16000 JP Morgan Chase.'
where number = '14000';

update gl_accounts set
  starting_balance = 104380.14,
  tracking_start = '2026-06-30',
  description = 'Equity plug so opening AR + Chase = AP + JEAMS + equity. Not historical retained earnings.'
where number = '30000';

insert into gl_accounts (number, name, description, statement, kind, subtype, parent_number, tracking_start, starting_balance, sort_order)
values (
  '20250',
  'JEAMS — Jeam Capital',
  'Loan from José / JEAMS as of V8 Saldos 30 Jun 2026. Liability, not P&L. Pocket only — not the full historical loan.',
  'balance', 'liability', 'Current > Loan', null, '2026-06-30',
  23030.33, 72
)
on conflict (number) do update set
  name = excluded.name,
  description = excluded.description,
  tracking_start = excluded.tracking_start,
  starting_balance = excluded.starting_balance;

update bank_accounts set
  name = 'Operating',
  bank_name = 'JP Morgan Chase',
  last4 = null,
  opening_balance = 0
where id = (select min(id) from bank_accounts);

insert into app_settings (key, value) values
  ('corte_as_of', '2026-06-30'),
  ('chase_balance_as_of', '2026-06-30'),
  ('jeams_balance_as_of', '2026-06-30'),
  ('chase_opening', '19066.20'),
  ('jeams_opening', '23030.33')
on conflict (key) do update set value = excluded.value;

-- Opening AR: remaining saldo as total, paid 0. Folio they already know = invoice_number.
insert into invoices (invoice_number, customer_id, status, issue_date, due_date, subtotal, total, paid, notes, invoice_type, sales_rep)
select
  '1367', c.id, 'open', '2026-01-08', '2026-01-29', 9579.50, 9579.50, 0,
  'Corte apertura 2026-06-30 · carga P-04 · Jack Fruit · Cerrada · remaining from Cargas (not full history). Papayas is customer and vendor — do not net.', 'opening', null
from customers c
where c.code = 'CLI-014'
  and not exists (select 1 from invoices where invoice_number = '1367');

insert into invoice_lines (invoice_id, product_id, description, quantity, unit, unit_price, amount)
select i.id, p.id,
  'Jack Fruit · Cerrada · carga P-04',
  1, 'lote', 9579.50, 9579.50
from invoices i
join products p on p.sku = 'JACK'
where i.invoice_number = '1367'
  and not exists (select 1 from invoice_lines l where l.invoice_id = i.id);

insert into invoices (invoice_number, customer_id, status, issue_date, due_date, subtotal, total, paid, notes, invoice_type, sales_rep)
select
  '1370', c.id, 'open', '2026-01-14', '2026-02-04', 7498.90, 7498.90, 0,
  'Corte apertura 2026-06-30 · carga P-07 · Jack Fruit · Cerrada · remaining from Cargas (not full history). Papayas is customer and vendor — do not net.', 'opening', null
from customers c
where c.code = 'CLI-014'
  and not exists (select 1 from invoices where invoice_number = '1370');

insert into invoice_lines (invoice_id, product_id, description, quantity, unit, unit_price, amount)
select i.id, p.id,
  'Jack Fruit · Cerrada · carga P-07',
  1, 'lote', 7498.90, 7498.90
from invoices i
join products p on p.sku = 'JACK'
where i.invoice_number = '1370'
  and not exists (select 1 from invoice_lines l where l.invoice_id = i.id);

insert into invoices (invoice_number, customer_id, status, issue_date, due_date, subtotal, total, paid, notes, invoice_type, sales_rep)
select
  '1375', c.id, 'open', '2026-02-02', '2026-02-23', 6975.70, 6975.70, 0,
  'Corte apertura 2026-06-30 · carga P-08 · Jack Fruit · Cerrada · remaining from Cargas (not full history). Papayas is customer and vendor — do not net.', 'opening', null
from customers c
where c.code = 'CLI-014'
  and not exists (select 1 from invoices where invoice_number = '1375');

insert into invoice_lines (invoice_id, product_id, description, quantity, unit, unit_price, amount)
select i.id, p.id,
  'Jack Fruit · Cerrada · carga P-08',
  1, 'lote', 6975.70, 6975.70
from invoices i
join products p on p.sku = 'JACK'
where i.invoice_number = '1375'
  and not exists (select 1 from invoice_lines l where l.invoice_id = i.id);

insert into invoices (invoice_number, customer_id, status, issue_date, due_date, subtotal, total, paid, notes, invoice_type, sales_rep)
select
  '1379', c.id, 'open', '2026-02-16', '2026-03-09', 5852.00, 5852.00, 0,
  'Corte apertura 2026-06-30 · carga P-09 · Jack Fruit · Cerrada · remaining from Cargas (not full history). Papayas is customer and vendor — do not net.', 'opening', null
from customers c
where c.code = 'CLI-014'
  and not exists (select 1 from invoices where invoice_number = '1379');

insert into invoice_lines (invoice_id, product_id, description, quantity, unit, unit_price, amount)
select i.id, p.id,
  'Jack Fruit · Cerrada · carga P-09',
  1, 'lote', 5852.00, 5852.00
from invoices i
join products p on p.sku = 'JACK'
where i.invoice_number = '1379'
  and not exists (select 1 from invoice_lines l where l.invoice_id = i.id);

insert into invoices (invoice_number, customer_id, status, issue_date, due_date, subtotal, total, paid, notes, invoice_type, sales_rep)
select
  '1395', c.id, 'open', '2026-02-24', '2026-03-17', 7498.00, 7498.00, 0,
  'Corte apertura 2026-06-30 · carga P-011 · Jack Fruit · Cerrada · remaining from Cargas (not full history). Papayas is customer and vendor — do not net.', 'opening', null
from customers c
where c.code = 'CLI-014'
  and not exists (select 1 from invoices where invoice_number = '1395');

insert into invoice_lines (invoice_id, product_id, description, quantity, unit, unit_price, amount)
select i.id, p.id,
  'Jack Fruit · Cerrada · carga P-011',
  1, 'lote', 7498.00, 7498.00
from invoices i
join products p on p.sku = 'JACK'
where i.invoice_number = '1395'
  and not exists (select 1 from invoice_lines l where l.invoice_id = i.id);

insert into invoices (invoice_number, customer_id, status, issue_date, due_date, subtotal, total, paid, notes, invoice_type, sales_rep)
select
  '1386', c.id, 'open', '2026-03-03', '2026-03-24', 8430.40, 8430.40, 0,
  'Corte apertura 2026-06-30 · carga P-014 · Jack Fruit · Cerrada · remaining from Cargas (not full history). Papayas is customer and vendor — do not net.', 'opening', null
from customers c
where c.code = 'CLI-014'
  and not exists (select 1 from invoices where invoice_number = '1386');

insert into invoice_lines (invoice_id, product_id, description, quantity, unit, unit_price, amount)
select i.id, p.id,
  'Jack Fruit · Cerrada · carga P-014',
  1, 'lote', 8430.40, 8430.40
from invoices i
join products p on p.sku = 'JACK'
where i.invoice_number = '1386'
  and not exists (select 1 from invoice_lines l where l.invoice_id = i.id);

insert into invoices (invoice_number, customer_id, status, issue_date, due_date, subtotal, total, paid, notes, invoice_type, sales_rep)
select
  '1387', c.id, 'open', '2026-03-11', '2026-04-01', 17243.10, 17243.10, 0,
  'Corte apertura 2026-06-30 · carga P-016 · Jack Fruit · Cerrada · remaining from Cargas (not full history). Papayas is customer and vendor — do not net.', 'opening', null
from customers c
where c.code = 'CLI-014'
  and not exists (select 1 from invoices where invoice_number = '1387');

insert into invoice_lines (invoice_id, product_id, description, quantity, unit, unit_price, amount)
select i.id, p.id,
  'Jack Fruit · Cerrada · carga P-016',
  1, 'lote', 17243.10, 17243.10
from invoices i
join products p on p.sku = 'JACK'
where i.invoice_number = '1387'
  and not exists (select 1 from invoice_lines l where l.invoice_id = i.id);

insert into invoices (invoice_number, customer_id, status, issue_date, due_date, subtotal, total, paid, notes, invoice_type, sales_rep)
select
  '1394', c.id, 'open', '2026-03-18', '2026-04-08', 18519.80, 18519.80, 0,
  'Corte apertura 2026-06-30 · carga P-018 · Jack Fruit · Cerrada · remaining from Cargas (not full history). Papayas is customer and vendor — do not net.', 'opening', null
from customers c
where c.code = 'CLI-014'
  and not exists (select 1 from invoices where invoice_number = '1394');

insert into invoice_lines (invoice_id, product_id, description, quantity, unit, unit_price, amount)
select i.id, p.id,
  'Jack Fruit · Cerrada · carga P-018',
  1, 'lote', 18519.80, 18519.80
from invoices i
join products p on p.sku = 'JACK'
where i.invoice_number = '1394'
  and not exists (select 1 from invoice_lines l where l.invoice_id = i.id);

insert into invoices (invoice_number, customer_id, status, issue_date, due_date, subtotal, total, paid, notes, invoice_type, sales_rep)
select
  '1401', c.id, 'open', '2026-03-25', '2026-04-15', 16977.30, 16977.30, 0,
  'Corte apertura 2026-06-30 · carga P-020 · Jack Fruit · Cerrada · remaining from Cargas (not full history). Papayas is customer and vendor — do not net.', 'opening', null
from customers c
where c.code = 'CLI-014'
  and not exists (select 1 from invoices where invoice_number = '1401');

insert into invoice_lines (invoice_id, product_id, description, quantity, unit, unit_price, amount)
select i.id, p.id,
  'Jack Fruit · Cerrada · carga P-020',
  1, 'lote', 16977.30, 16977.30
from invoices i
join products p on p.sku = 'JACK'
where i.invoice_number = '1401'
  and not exists (select 1 from invoice_lines l where l.invoice_id = i.id);

insert into invoices (invoice_number, customer_id, status, issue_date, due_date, subtotal, total, paid, notes, invoice_type, sales_rep)
select
  '1409', c.id, 'open', '2026-04-02', '2026-04-23', 18493.80, 18493.80, 0,
  'Corte apertura 2026-06-30 · carga P-023 · Jack Fruit · Cerrada · remaining from Cargas (not full history). Papayas is customer and vendor — do not net.', 'opening', null
from customers c
where c.code = 'CLI-014'
  and not exists (select 1 from invoices where invoice_number = '1409');

insert into invoice_lines (invoice_id, product_id, description, quantity, unit, unit_price, amount)
select i.id, p.id,
  'Jack Fruit · Cerrada · carga P-023',
  1, 'lote', 18493.80, 18493.80
from invoices i
join products p on p.sku = 'JACK'
where i.invoice_number = '1409'
  and not exists (select 1 from invoice_lines l where l.invoice_id = i.id);

insert into invoices (invoice_number, customer_id, status, issue_date, due_date, subtotal, total, paid, notes, invoice_type, sales_rep)
select
  '1413', c.id, 'open', '2026-04-07', '2026-04-28', 17681.50, 17681.50, 0,
  'Corte apertura 2026-06-30 · carga P-024 · Jack Fruit · Cerrada · remaining from Cargas (not full history). Papayas is customer and vendor — do not net.', 'opening', null
from customers c
where c.code = 'CLI-014'
  and not exists (select 1 from invoices where invoice_number = '1413');

insert into invoice_lines (invoice_id, product_id, description, quantity, unit, unit_price, amount)
select i.id, p.id,
  'Jack Fruit · Cerrada · carga P-024',
  1, 'lote', 17681.50, 17681.50
from invoices i
join products p on p.sku = 'JACK'
where i.invoice_number = '1413'
  and not exists (select 1 from invoice_lines l where l.invoice_id = i.id);

insert into invoices (invoice_number, customer_id, status, issue_date, due_date, subtotal, total, paid, notes, invoice_type, sales_rep)
select
  'FMU01', c.id, 'open', '2026-04-08', '2026-04-29', 10608.90, 10608.90, 0,
  'Corte apertura 2026-06-30 · carga P-025 · Jack Fruit · Cerrada · remaining from Cargas (not full history)', 'opening', null
from customers c
where c.code = 'CLI-011'
  and not exists (select 1 from invoices where invoice_number = 'FMU01');

insert into invoice_lines (invoice_id, product_id, description, quantity, unit, unit_price, amount)
select i.id, p.id,
  'Jack Fruit · Cerrada · carga P-025',
  1, 'lote', 10608.90, 10608.90
from invoices i
join products p on p.sku = 'JACK'
where i.invoice_number = 'FMU01'
  and not exists (select 1 from invoice_lines l where l.invoice_id = i.id);

insert into invoices (invoice_number, customer_id, status, issue_date, due_date, subtotal, total, paid, notes, invoice_type, sales_rep)
select
  'FMU02', c.id, 'open', '2026-04-10', '2026-05-01', 8715.60, 8715.60, 0,
  'Corte apertura 2026-06-30 · carga P-026 · Jack Fruit · Cerrada · remaining from Cargas (not full history)', 'opening', null
from customers c
where c.code = 'CLI-011'
  and not exists (select 1 from invoices where invoice_number = 'FMU02');

insert into invoice_lines (invoice_id, product_id, description, quantity, unit, unit_price, amount)
select i.id, p.id,
  'Jack Fruit · Cerrada · carga P-026',
  1, 'lote', 8715.60, 8715.60
from invoices i
join products p on p.sku = 'JACK'
where i.invoice_number = 'FMU02'
  and not exists (select 1 from invoice_lines l where l.invoice_id = i.id);

insert into invoices (invoice_number, customer_id, status, issue_date, due_date, subtotal, total, paid, notes, invoice_type, sales_rep)
select
  '1416', c.id, 'open', '2026-04-14', '2026-05-05', 17978.40, 17978.40, 0,
  'Corte apertura 2026-06-30 · carga P-027 · Jack Fruit · Cerrada · remaining from Cargas (not full history). Papayas is customer and vendor — do not net.', 'opening', null
from customers c
where c.code = 'CLI-014'
  and not exists (select 1 from invoices where invoice_number = '1416');

insert into invoice_lines (invoice_id, product_id, description, quantity, unit, unit_price, amount)
select i.id, p.id,
  'Jack Fruit · Cerrada · carga P-027',
  1, 'lote', 17978.40, 17978.40
from invoices i
join products p on p.sku = 'JACK'
where i.invoice_number = '1416'
  and not exists (select 1 from invoice_lines l where l.invoice_id = i.id);

insert into invoices (invoice_number, customer_id, status, issue_date, due_date, subtotal, total, paid, notes, invoice_type, sales_rep)
select
  '1421', c.id, 'open', '2026-04-20', '2026-05-12', 17398.85, 17398.85, 0,
  'Corte apertura 2026-06-30 · carga P-028 · Jack Fruit · Cerrada · remaining from Cargas (not full history). Papayas is customer and vendor — do not net.', 'opening', null
from customers c
where c.code = 'CLI-014'
  and not exists (select 1 from invoices where invoice_number = '1421');

insert into invoice_lines (invoice_id, product_id, description, quantity, unit, unit_price, amount)
select i.id, p.id,
  'Jack Fruit · Cerrada · carga P-028',
  1, 'lote', 17398.85, 17398.85
from invoices i
join products p on p.sku = 'JACK'
where i.invoice_number = '1421'
  and not exists (select 1 from invoice_lines l where l.invoice_id = i.id);

insert into invoices (invoice_number, customer_id, status, issue_date, due_date, subtotal, total, paid, notes, invoice_type, sales_rep)
select
  '1428', c.id, 'open', '2026-04-28', '2026-05-19', 18352.18, 18352.18, 0,
  'Corte apertura 2026-06-30 · carga P-029 · Jack Fruit · Cerrada · remaining from Cargas (not full history). Papayas is customer and vendor — do not net.', 'opening', null
from customers c
where c.code = 'CLI-014'
  and not exists (select 1 from invoices where invoice_number = '1428');

insert into invoice_lines (invoice_id, product_id, description, quantity, unit, unit_price, amount)
select i.id, p.id,
  'Jack Fruit · Cerrada · carga P-029',
  1, 'lote', 18352.18, 18352.18
from invoices i
join products p on p.sku = 'JACK'
where i.invoice_number = '1428'
  and not exists (select 1 from invoice_lines l where l.invoice_id = i.id);

insert into invoices (invoice_number, customer_id, status, issue_date, due_date, subtotal, total, paid, notes, invoice_type, sales_rep)
select
  '1438', c.id, 'open', '2026-05-04', '2026-05-26', 19177.74, 19177.74, 0,
  'Corte apertura 2026-06-30 · carga P-030 · Jack Fruit · Cerrada · remaining from Cargas (not full history). Papayas is customer and vendor — do not net.', 'opening', null
from customers c
where c.code = 'CLI-014'
  and not exists (select 1 from invoices where invoice_number = '1438');

insert into invoice_lines (invoice_id, product_id, description, quantity, unit, unit_price, amount)
select i.id, p.id,
  'Jack Fruit · Cerrada · carga P-030',
  1, 'lote', 19177.74, 19177.74
from invoices i
join products p on p.sku = 'JACK'
where i.invoice_number = '1438'
  and not exists (select 1 from invoice_lines l where l.invoice_id = i.id);

insert into invoices (invoice_number, customer_id, status, issue_date, due_date, subtotal, total, paid, notes, invoice_type, sales_rep)
select
  '1444', c.id, 'open', '2026-05-11', '2026-06-01', 17502.00, 17502.00, 0,
  'Corte apertura 2026-06-30 · carga P-031 · Jack Fruit · Cerrada · remaining from Cargas (not full history). Papayas is customer and vendor — do not net.', 'opening', null
from customers c
where c.code = 'CLI-014'
  and not exists (select 1 from invoices where invoice_number = '1444');

insert into invoice_lines (invoice_id, product_id, description, quantity, unit, unit_price, amount)
select i.id, p.id,
  'Jack Fruit · Cerrada · carga P-031',
  1, 'lote', 17502.00, 17502.00
from invoices i
join products p on p.sku = 'JACK'
where i.invoice_number = '1444'
  and not exists (select 1 from invoice_lines l where l.invoice_id = i.id);

insert into invoices (invoice_number, customer_id, status, issue_date, due_date, subtotal, total, paid, notes, invoice_type, sales_rep)
select
  '1449', c.id, 'open', '2026-05-19', '2026-06-09', 15532.00, 15532.00, 0,
  'Corte apertura 2026-06-30 · carga P-033 · Jack Fruit · Cerrada · remaining from Cargas (not full history). Papayas is customer and vendor — do not net.', 'opening', null
from customers c
where c.code = 'CLI-014'
  and not exists (select 1 from invoices where invoice_number = '1449');

insert into invoice_lines (invoice_id, product_id, description, quantity, unit, unit_price, amount)
select i.id, p.id,
  'Jack Fruit · Cerrada · carga P-033',
  1, 'lote', 15532.00, 15532.00
from invoices i
join products p on p.sku = 'JACK'
where i.invoice_number = '1449'
  and not exists (select 1 from invoice_lines l where l.invoice_id = i.id);

insert into invoices (invoice_number, customer_id, status, issue_date, due_date, subtotal, total, paid, notes, invoice_type, sales_rep)
select
  '1454', c.id, 'open', '2026-05-26', '2026-06-16', 15012.78, 15012.78, 0,
  'Corte apertura 2026-06-30 · carga P-039 · Jack Fruit · Cerrada · remaining from Cargas (not full history). Papayas is customer and vendor — do not net.', 'opening', null
from customers c
where c.code = 'CLI-014'
  and not exists (select 1 from invoices where invoice_number = '1454');

insert into invoice_lines (invoice_id, product_id, description, quantity, unit, unit_price, amount)
select i.id, p.id,
  'Jack Fruit · Cerrada · carga P-039',
  1, 'lote', 15012.78, 15012.78
from invoices i
join products p on p.sku = 'JACK'
where i.invoice_number = '1454'
  and not exists (select 1 from invoice_lines l where l.invoice_id = i.id);

insert into invoices (invoice_number, customer_id, status, issue_date, due_date, subtotal, total, paid, notes, invoice_type, sales_rep)
select
  '1459', c.id, 'open', '2026-06-02', '2026-06-23', 20483.28, 20483.28, 0,
  'Corte apertura 2026-06-30 · carga P-043 · Jack Fruit · Cerrada · remaining from Cargas (not full history). Papayas is customer and vendor — do not net.', 'opening', null
from customers c
where c.code = 'CLI-014'
  and not exists (select 1 from invoices where invoice_number = '1459');

insert into invoice_lines (invoice_id, product_id, description, quantity, unit, unit_price, amount)
select i.id, p.id,
  'Jack Fruit · Cerrada · carga P-043',
  1, 'lote', 20483.28, 20483.28
from invoices i
join products p on p.sku = 'JACK'
where i.invoice_number = '1459'
  and not exists (select 1 from invoice_lines l where l.invoice_id = i.id);

insert into invoices (invoice_number, customer_id, status, issue_date, due_date, subtotal, total, paid, notes, invoice_type, sales_rep)
select
  'P00128', c.id, 'open', '2026-06-02', '2026-06-23', 8870.40, 8870.40, 0,
  'Corte apertura 2026-06-30 · carga P-044 · Papaya · Cerrada · remaining from Cargas (not full history). Papayas is customer and vendor — do not net.', 'opening', null
from customers c
where c.code = 'CLI-016'
  and not exists (select 1 from invoices where invoice_number = 'P00128');

insert into invoice_lines (invoice_id, product_id, description, quantity, unit, unit_price, amount)
select i.id, p.id,
  'Papaya · Cerrada · carga P-044',
  1, 'lote', 8870.40, 8870.40
from invoices i
join products p on p.sku = 'PAPA-MARA'
where i.invoice_number = 'P00128'
  and not exists (select 1 from invoice_lines l where l.invoice_id = i.id);

insert into invoices (invoice_number, customer_id, status, issue_date, due_date, subtotal, total, paid, notes, invoice_type, sales_rep)
select
  '1481', c.id, 'open', '2026-06-10', '2026-07-21', 14138.29, 14138.29, 0,
  'Corte apertura 2026-06-30 · carga P-049 · Jack Fruit · Cerrada · remaining from Cargas (not full history). Papayas is customer and vendor — do not net.', 'opening', null
from customers c
where c.code = 'CLI-014'
  and not exists (select 1 from invoices where invoice_number = '1481');

insert into invoice_lines (invoice_id, product_id, description, quantity, unit, unit_price, amount)
select i.id, p.id,
  'Jack Fruit · Cerrada · carga P-049',
  1, 'lote', 14138.29, 14138.29
from invoices i
join products p on p.sku = 'JACK'
where i.invoice_number = '1481'
  and not exists (select 1 from invoice_lines l where l.invoice_id = i.id);

insert into invoices (invoice_number, customer_id, status, issue_date, due_date, subtotal, total, paid, notes, invoice_type, sales_rep)
select
  'P00130', c.id, 'open', '2026-06-17', '2026-07-09', 8870.40, 8870.40, 0,
  'Corte apertura 2026-06-30 · carga P-053 · Jack Fruit · Cerrada · remaining from Cargas (not full history). Papayas is customer and vendor — do not net.', 'opening', null
from customers c
where c.code = 'CLI-016'
  and not exists (select 1 from invoices where invoice_number = 'P00130');

insert into invoice_lines (invoice_id, product_id, description, quantity, unit, unit_price, amount)
select i.id, p.id,
  'Jack Fruit · Cerrada · carga P-053',
  1, 'lote', 8870.40, 8870.40
from invoices i
join products p on p.sku = 'JACK'
where i.invoice_number = 'P00130'
  and not exists (select 1 from invoice_lines l where l.invoice_id = i.id);

insert into invoices (invoice_number, customer_id, status, issue_date, due_date, subtotal, total, paid, notes, invoice_type, sales_rep)
select
  '1470', c.id, 'open', '2026-06-17', '2026-07-08', 20473.00, 20473.00, 0,
  'Corte apertura 2026-06-30 · carga P-054 · Jack Fruit · Cerrada · remaining from Cargas (not full history). Papayas is customer and vendor — do not net.', 'opening', null
from customers c
where c.code = 'CLI-014'
  and not exists (select 1 from invoices where invoice_number = '1470');

insert into invoice_lines (invoice_id, product_id, description, quantity, unit, unit_price, amount)
select i.id, p.id,
  'Jack Fruit · Cerrada · carga P-054',
  1, 'lote', 20473.00, 20473.00
from invoices i
join products p on p.sku = 'JACK'
where i.invoice_number = '1470'
  and not exists (select 1 from invoice_lines l where l.invoice_id = i.id);

insert into invoices (invoice_number, customer_id, status, issue_date, due_date, subtotal, total, paid, notes, invoice_type, sales_rep)
select
  '1475', c.id, 'open', '2026-06-24', '2026-07-17', 15139.20, 15139.20, 0,
  'Corte apertura 2026-06-30 · carga P-059 · Jack Fruit · Cerrada · remaining from Cargas (not full history). Papayas is customer and vendor — do not net.', 'opening', null
from customers c
where c.code = 'CLI-014'
  and not exists (select 1 from invoices where invoice_number = '1475');

insert into invoice_lines (invoice_id, product_id, description, quantity, unit, unit_price, amount)
select i.id, p.id,
  'Jack Fruit · Cerrada · carga P-059',
  1, 'lote', 15139.20, 15139.20
from invoices i
join products p on p.sku = 'JACK'
where i.invoice_number = '1475'
  and not exists (select 1 from invoice_lines l where l.invoice_id = i.id);

insert into invoices (invoice_number, customer_id, status, issue_date, due_date, subtotal, total, paid, notes, invoice_type, sales_rep)
select
  '24', c.id, 'open', '2026-06-24', '2026-07-17', 450.00, 450.00, 0,
  'Corte apertura 2026-06-30 · carga P-060 · Coco verde · Cerrada · remaining from Cargas (not full history)', 'opening', null
from customers c
where c.code = 'CLI-003'
  and not exists (select 1 from invoices where invoice_number = '24');

insert into invoice_lines (invoice_id, product_id, description, quantity, unit, unit_price, amount)
select i.id, p.id,
  'Coco verde · Cerrada · carga P-060',
  1, 'lote', 450.00, 450.00
from invoices i
join products p on p.sku = 'COCVER'
where i.invoice_number = '24'
  and not exists (select 1 from invoice_lines l where l.invoice_id = i.id);

insert into invoices (invoice_number, customer_id, status, issue_date, due_date, subtotal, total, paid, notes, invoice_type, sales_rep)
select
  '1465', c.id, 'open', '2026-06-30', '2026-07-28', 16629.98, 16629.98, 0,
  'Corte apertura 2026-06-30 · carga P-063 · Jack Fruit · Cerrada · remaining from Cargas (not full history). Papayas is customer and vendor — do not net.', 'opening', null
from customers c
where c.code = 'CLI-014'
  and not exists (select 1 from invoices where invoice_number = '1465');

insert into invoice_lines (invoice_id, product_id, description, quantity, unit, unit_price, amount)
select i.id, p.id,
  'Jack Fruit · Cerrada · carga P-063',
  1, 'lote', 16629.98, 16629.98
from invoices i
join products p on p.sku = 'JACK'
where i.invoice_number = '1465'
  and not exists (select 1 from invoice_lines l where l.invoice_id = i.id);

insert into invoices (invoice_number, customer_id, status, issue_date, due_date, subtotal, total, paid, notes, invoice_type, sales_rep)
select
  '1001', c.id, 'open', '2026-07-06', '2026-07-27', 13000.00, 13000.00, 0,
  'Corte apertura 2026-06-30 · carga P-065 · Kabocha · Consignacion · remaining from Cargas (not full history)', 'opening', null
from customers c
where c.code = 'CLI-004'
  and not exists (select 1 from invoices where invoice_number = '1001');

insert into invoice_lines (invoice_id, product_id, description, quantity, unit, unit_price, amount)
select i.id, p.id,
  'Kabocha · Consignacion · carga P-065',
  1, 'lote', 13000.00, 13000.00
from invoices i
join products p on p.sku = 'KABO'
where i.invoice_number = '1001'
  and not exists (select 1 from invoice_lines l where l.invoice_id = i.id);

insert into invoices (invoice_number, customer_id, status, issue_date, due_date, subtotal, total, paid, notes, invoice_type, sales_rep)
select
  '1495', c.id, 'open', '2026-07-07', '2026-07-29', 15254.73, 15254.73, 0,
  'Corte apertura 2026-06-30 · carga P-067 · Jack Fruit · Cerrada · remaining from Cargas (not full history). Papayas is customer and vendor — do not net.', 'opening', null
from customers c
where c.code = 'CLI-014'
  and not exists (select 1 from invoices where invoice_number = '1495');

insert into invoice_lines (invoice_id, product_id, description, quantity, unit, unit_price, amount)
select i.id, p.id,
  'Jack Fruit · Cerrada · carga P-067',
  1, 'lote', 15254.73, 15254.73
from invoices i
join products p on p.sku = 'JACK'
where i.invoice_number = '1495'
  and not exists (select 1 from invoice_lines l where l.invoice_id = i.id);

insert into invoices (invoice_number, customer_id, status, issue_date, due_date, subtotal, total, paid, notes, invoice_type, sales_rep)
select
  '1002', c.id, 'open', '2026-07-09', '2026-07-30', 12900.00, 12900.00, 0,
  'Corte apertura 2026-06-30 · carga P-069 · Kabocha · Consignacion · remaining from Cargas (not full history)', 'opening', null
from customers c
where c.code = 'CLI-004'
  and not exists (select 1 from invoices where invoice_number = '1002');

insert into invoice_lines (invoice_id, product_id, description, quantity, unit, unit_price, amount)
select i.id, p.id,
  'Kabocha · Consignacion · carga P-069',
  1, 'lote', 12900.00, 12900.00
from invoices i
join products p on p.sku = 'KABO'
where i.invoice_number = '1002'
  and not exists (select 1 from invoice_lines l where l.invoice_id = i.id);

insert into invoices (invoice_number, customer_id, status, issue_date, due_date, subtotal, total, paid, notes, invoice_type, sales_rep)
select
  '1491', c.id, 'open', '2026-07-13', '2026-08-05', 15320.94, 15320.94, 0,
  'Corte apertura 2026-06-30 · carga P-072 · Jack Fruit · Cerrada · remaining from Cargas (not full history). Papayas is customer and vendor — do not net.', 'opening', null
from customers c
where c.code = 'CLI-014'
  and not exists (select 1 from invoices where invoice_number = '1491');

insert into invoice_lines (invoice_id, product_id, description, quantity, unit, unit_price, amount)
select i.id, p.id,
  'Jack Fruit · Cerrada · carga P-072',
  1, 'lote', 15320.94, 15320.94
from invoices i
join products p on p.sku = 'JACK'
where i.invoice_number = '1491'
  and not exists (select 1 from invoice_lines l where l.invoice_id = i.id);

insert into invoices (invoice_number, customer_id, status, issue_date, due_date, subtotal, total, paid, notes, invoice_type, sales_rep)
select
  'AX0012', c.id, 'open', '2026-07-14', '2026-08-04', 45.00, 45.00, 0,
  'Corte apertura 2026-06-30 · carga P-073 · Col de bruselas · Cerrada · remaining from Cargas (not full history)', 'opening', null
from customers c
where c.code = 'CLI-001'
  and not exists (select 1 from invoices where invoice_number = 'AX0012');

insert into invoice_lines (invoice_id, product_id, description, quantity, unit, unit_price, amount)
select i.id, p.id,
  'Col de bruselas · Cerrada · carga P-073',
  1, 'lote', 45.00, 45.00
from invoices i
join products p on p.sku = 'COLDEBRU'
where i.invoice_number = 'AX0012'
  and not exists (select 1 from invoice_lines l where l.invoice_id = i.id);

insert into invoices (invoice_number, customer_id, status, issue_date, due_date, subtotal, total, paid, notes, invoice_type, sales_rep)
select
  '36521', c.id, 'open', '2026-07-22', '2026-08-12', 6088.00, 6088.00, 0,
  'Corte apertura 2026-06-30 · carga P-076 · Habanero Rojo · Cerrada · remaining from Cargas (not full history)', 'opening', null
from customers c
where c.code = 'CLI-004'
  and not exists (select 1 from invoices where invoice_number = '36521');

insert into invoice_lines (invoice_id, product_id, description, quantity, unit, unit_price, amount)
select i.id, p.id,
  'Habanero Rojo · Cerrada · carga P-076',
  1, 'lote', 6088.00, 6088.00
from invoices i
join products p on p.sku = 'REDHAB'
where i.invoice_number = '36521'
  and not exists (select 1 from invoice_lines l where l.invoice_id = i.id);

insert into invoices (invoice_number, customer_id, status, issue_date, due_date, subtotal, total, paid, notes, invoice_type, sales_rep)
select
  '1505', c.id, 'open', '2026-07-22', '2026-08-12', 16062.70, 16062.70, 0,
  'Corte apertura 2026-06-30 · carga P-077 · Jack Fruit · Cerrada · remaining from Cargas (not full history). Papayas is customer and vendor — do not net.', 'opening', null
from customers c
where c.code = 'CLI-014'
  and not exists (select 1 from invoices where invoice_number = '1505');

insert into invoice_lines (invoice_id, product_id, description, quantity, unit, unit_price, amount)
select i.id, p.id,
  'Jack Fruit · Cerrada · carga P-077',
  1, 'lote', 16062.70, 16062.70
from invoices i
join products p on p.sku = 'JACK'
where i.invoice_number = '1505'
  and not exists (select 1 from invoice_lines l where l.invoice_id = i.id);

insert into invoices (invoice_number, customer_id, status, issue_date, due_date, subtotal, total, paid, notes, invoice_type, sales_rep)
select
  'NGM247514', c.id, 'open', '2026-07-24', '2026-08-14', 23232.00, 23232.00, 0,
  'Corte apertura 2026-06-30 · carga P-078 · Papaya · Cerrada · remaining from Cargas (not full history). Papayas is customer and vendor — do not net.', 'opening', null
from customers c
where c.code = 'CLI-013'
  and not exists (select 1 from invoices where invoice_number = 'NGM247514');

insert into invoice_lines (invoice_id, product_id, description, quantity, unit, unit_price, amount)
select i.id, p.id,
  'Papaya · Cerrada · carga P-078',
  1, 'lote', 23232.00, 23232.00
from invoices i
join products p on p.sku = 'PAPA-MARA'
where i.invoice_number = 'NGM247514'
  and not exists (select 1 from invoice_lines l where l.invoice_id = i.id);

insert into invoices (invoice_number, customer_id, status, issue_date, due_date, subtotal, total, paid, notes, invoice_type, sales_rep)
select
  'AX0013', c.id, 'open', '2026-07-24', '2026-08-14', 500.00, 500.00, 0,
  'Corte apertura 2026-06-30 · carga P-079 · Col de bruselas · Cerrada · remaining from Cargas (not full history)', 'opening', null
from customers c
where c.code = 'CLI-001'
  and not exists (select 1 from invoices where invoice_number = 'AX0013');

insert into invoice_lines (invoice_id, product_id, description, quantity, unit, unit_price, amount)
select i.id, p.id,
  'Col de bruselas · Cerrada · carga P-079',
  1, 'lote', 500.00, 500.00
from invoices i
join products p on p.sku = 'COLDEBRU'
where i.invoice_number = 'AX0013'
  and not exists (select 1 from invoice_lines l where l.invoice_id = i.id);

insert into invoices (invoice_number, customer_id, status, issue_date, due_date, subtotal, total, paid, notes, invoice_type, sales_rep)
select
  'PX-72589', c.id, 'open', '2026-07-24', '2026-08-14', 15600.00, 15600.00, 0,
  'Corte apertura 2026-06-30 · carga P-080 · Esparrago Organico · Cerrada · remaining from Cargas (not full history)', 'opening', null
from customers c
where c.code = 'CLI-006'
  and not exists (select 1 from invoices where invoice_number = 'PX-72589');

insert into invoice_lines (invoice_id, product_id, description, quantity, unit, unit_price, amount)
select i.id, p.id,
  'Esparrago Organico · Cerrada · carga P-080',
  1, 'lote', 15600.00, 15600.00
from invoices i
join products p on p.sku = 'ESPORG'
where i.invoice_number = 'PX-72589'
  and not exists (select 1 from invoice_lines l where l.invoice_id = i.id);

insert into invoices (invoice_number, customer_id, status, issue_date, due_date, subtotal, total, paid, notes, invoice_type, sales_rep)
select
  'AX0014', c.id, 'open', '2026-07-24', '2026-08-14', 720.60, 720.60, 0,
  'Corte apertura 2026-06-30 · carga P-081 · Col de bruselas · Cerrada · remaining from Cargas (not full history)', 'opening', null
from customers c
where c.code = 'CLI-001'
  and not exists (select 1 from invoices where invoice_number = 'AX0014');

insert into invoice_lines (invoice_id, product_id, description, quantity, unit, unit_price, amount)
select i.id, p.id,
  'Col de bruselas · Cerrada · carga P-081',
  1, 'lote', 720.60, 720.60
from invoices i
join products p on p.sku = 'COLDEBRU'
where i.invoice_number = 'AX0014'
  and not exists (select 1 from invoice_lines l where l.invoice_id = i.id);

insert into invoices (invoice_number, customer_id, status, issue_date, due_date, subtotal, total, paid, notes, invoice_type, sales_rep)
select
  'AX0015', c.id, 'open', '2026-07-24', '2026-08-14', 808.38, 808.38, 0,
  'Corte apertura 2026-06-30 · carga P-082 · Col de bruselas · Cerrada · remaining from Cargas (not full history)', 'opening', null
from customers c
where c.code = 'CLI-001'
  and not exists (select 1 from invoices where invoice_number = 'AX0015');

insert into invoice_lines (invoice_id, product_id, description, quantity, unit, unit_price, amount)
select i.id, p.id,
  'Col de bruselas · Cerrada · carga P-082',
  1, 'lote', 808.38, 808.38
from invoices i
join products p on p.sku = 'COLDEBRU'
where i.invoice_number = 'AX0015'
  and not exists (select 1 from invoice_lines l where l.invoice_id = i.id);

insert into invoices (invoice_number, customer_id, status, issue_date, due_date, subtotal, total, paid, notes, invoice_type, sales_rep)
select
  'PX-72648', c.id, 'open', '2026-07-25', '2026-08-15', 9360.00, 9360.00, 0,
  'Corte apertura 2026-06-30 · carga P-083 · Esparrago Organico · Cerrada · remaining from Cargas (not full history)', 'opening', null
from customers c
where c.code = 'CLI-006'
  and not exists (select 1 from invoices where invoice_number = 'PX-72648');

insert into invoice_lines (invoice_id, product_id, description, quantity, unit, unit_price, amount)
select i.id, p.id,
  'Esparrago Organico · Cerrada · carga P-083',
  1, 'lote', 9360.00, 9360.00
from invoices i
join products p on p.sku = 'ESPORG'
where i.invoice_number = 'PX-72648'
  and not exists (select 1 from invoice_lines l where l.invoice_id = i.id);

insert into invoices (invoice_number, customer_id, status, issue_date, due_date, subtotal, total, paid, notes, invoice_type, sales_rep)
select
  '36522', c.id, 'open', '2026-07-29', '2026-08-19', 3456.00, 3456.00, 0,
  'Corte apertura 2026-06-30 · carga P-084 · Habanero Rojo · Cerrada · remaining from Cargas (not full history)', 'opening', null
from customers c
where c.code = 'CLI-004'
  and not exists (select 1 from invoices where invoice_number = '36522');

insert into invoice_lines (invoice_id, product_id, description, quantity, unit, unit_price, amount)
select i.id, p.id,
  'Habanero Rojo · Cerrada · carga P-084',
  1, 'lote', 3456.00, 3456.00
from invoices i
join products p on p.sku = 'REDHAB'
where i.invoice_number = '36522'
  and not exists (select 1 from invoice_lines l where l.invoice_id = i.id);

insert into invoices (invoice_number, customer_id, status, issue_date, due_date, subtotal, total, paid, notes, invoice_type, sales_rep)
select
  'PX-72650', c.id, 'open', '2026-07-30', '2026-08-20', 24960.00, 24960.00, 0,
  'Corte apertura 2026-06-30 · carga P-085 · Esparrago Organico · Cerrada · remaining from Cargas (not full history)', 'opening', null
from customers c
where c.code = 'CLI-006'
  and not exists (select 1 from invoices where invoice_number = 'PX-72650');

insert into invoice_lines (invoice_id, product_id, description, quantity, unit, unit_price, amount)
select i.id, p.id,
  'Esparrago Organico · Cerrada · carga P-085',
  1, 'lote', 24960.00, 24960.00
from invoices i
join products p on p.sku = 'ESPORG'
where i.invoice_number = 'PX-72650'
  and not exists (select 1 from invoice_lines l where l.invoice_id = i.id);

insert into invoices (invoice_number, customer_id, status, issue_date, due_date, subtotal, total, paid, notes, invoice_type, sales_rep)
select
  '1520', c.id, 'open', '2026-08-04', '2026-08-25', 18443.08, 18443.08, 0,
  'Corte apertura 2026-06-30 · carga P-086 · Jack Fruit · Cerrada · remaining from Cargas (not full history). Papayas is customer and vendor — do not net.', 'opening', null
from customers c
where c.code = 'CLI-014'
  and not exists (select 1 from invoices where invoice_number = '1520');

insert into invoice_lines (invoice_id, product_id, description, quantity, unit, unit_price, amount)
select i.id, p.id,
  'Jack Fruit · Cerrada · carga P-086',
  1, 'lote', 18443.08, 18443.08
from invoices i
join products p on p.sku = 'JACK'
where i.invoice_number = '1520'
  and not exists (select 1 from invoice_lines l where l.invoice_id = i.id);

insert into invoices (invoice_number, customer_id, status, issue_date, due_date, subtotal, total, paid, notes, invoice_type, sales_rep)
select
  'PX-72306', c.id, 'open', '2026-08-06', '2026-08-27', 12690.00, 12690.00, 0,
  'Corte apertura 2026-06-30 · carga P-087 · Col de bruselas · Cerrada · remaining from Cargas (not full history)', 'opening', null
from customers c
where c.code = 'CLI-006'
  and not exists (select 1 from invoices where invoice_number = 'PX-72306');

insert into invoice_lines (invoice_id, product_id, description, quantity, unit, unit_price, amount)
select i.id, p.id,
  'Col de bruselas · Cerrada · carga P-087',
  1, 'lote', 12690.00, 12690.00
from invoices i
join products p on p.sku = 'COLDEBRU'
where i.invoice_number = 'PX-72306'
  and not exists (select 1 from invoice_lines l where l.invoice_id = i.id);

insert into invoices (invoice_number, customer_id, status, issue_date, due_date, subtotal, total, paid, notes, invoice_type, sales_rep)
select
  'PX-72715', c.id, 'open', '2026-08-06', '2026-08-27', 24960.00, 24960.00, 0,
  'Corte apertura 2026-06-30 · carga P-088 · Esparrago Organico · Cerrada · remaining from Cargas (not full history)', 'opening', null
from customers c
where c.code = 'CLI-006'
  and not exists (select 1 from invoices where invoice_number = 'PX-72715');

insert into invoice_lines (invoice_id, product_id, description, quantity, unit, unit_price, amount)
select i.id, p.id,
  'Esparrago Organico · Cerrada · carga P-088',
  1, 'lote', 24960.00, 24960.00
from invoices i
join products p on p.sku = 'ESPORG'
where i.invoice_number = 'PX-72715'
  and not exists (select 1 from invoice_lines l where l.invoice_id = i.id);

insert into invoices (invoice_number, customer_id, status, issue_date, due_date, subtotal, total, paid, notes, invoice_type, sales_rep)
select
  'NGM248545', c.id, 'open', '2026-08-06', '2026-08-27', 22176.00, 22176.00, 0,
  'Corte apertura 2026-06-30 · carga P-089 · Papaya · Rechazo · remaining from Cargas (not full history). Papayas is customer and vendor — do not net.', 'opening', null
from customers c
where c.code = 'CLI-013'
  and not exists (select 1 from invoices where invoice_number = 'NGM248545');

insert into invoice_lines (invoice_id, product_id, description, quantity, unit, unit_price, amount)
select i.id, p.id,
  'Papaya · Rechazo · carga P-089',
  1, 'lote', 22176.00, 22176.00
from invoices i
join products p on p.sku = 'PAPA-MARA'
where i.invoice_number = 'NGM248545'
  and not exists (select 1 from invoice_lines l where l.invoice_id = i.id);

insert into invoices (invoice_number, customer_id, status, issue_date, due_date, subtotal, total, paid, notes, invoice_type, sales_rep)
select
  '36223', c.id, 'open', '2026-08-07', '2026-08-28', 6294.00, 6294.00, 0,
  'Corte apertura 2026-06-30 · carga P-090 · Habanero Naranja · Entregada · remaining from Cargas (not full history)', 'opening', null
from customers c
where c.code = 'CLI-004'
  and not exists (select 1 from invoices where invoice_number = '36223');

insert into invoice_lines (invoice_id, product_id, description, quantity, unit, unit_price, amount)
select i.id, p.id,
  'Habanero Naranja · Entregada · carga P-090',
  1, 'lote', 6294.00, 6294.00
from invoices i
join products p on p.sku = 'ORAHAB'
where i.invoice_number = '36223'
  and not exists (select 1 from invoice_lines l where l.invoice_id = i.id);

insert into invoices (invoice_number, customer_id, status, issue_date, due_date, subtotal, total, paid, notes, invoice_type, sales_rep)
select
  'PX-72774', c.id, 'open', '2026-08-12', '2026-09-02', 34560.00, 34560.00, 0,
  'Corte apertura 2026-06-30 · carga P-091 · Esparrago Organico · En Camino · remaining from Cargas (not full history)', 'opening', null
from customers c
where c.code = 'CLI-006'
  and not exists (select 1 from invoices where invoice_number = 'PX-72774');

insert into invoice_lines (invoice_id, product_id, description, quantity, unit, unit_price, amount)
select i.id, p.id,
  'Esparrago Organico · En Camino · carga P-091',
  1, 'lote', 34560.00, 34560.00
from invoices i
join products p on p.sku = 'ESPORG'
where i.invoice_number = 'PX-72774'
  and not exists (select 1 from invoice_lines l where l.invoice_id = i.id);

insert into invoices (invoice_number, customer_id, status, issue_date, due_date, subtotal, total, paid, notes, invoice_type, sales_rep)
select
  '1525', c.id, 'open', '2026-08-12', '2026-09-02', 16500.00, 16500.00, 0,
  'Corte apertura 2026-06-30 · carga P-092 · Jack Fruit · En Camino · remaining from Cargas (not full history). Papayas is customer and vendor — do not net.', 'opening', null
from customers c
where c.code = 'CLI-014'
  and not exists (select 1 from invoices where invoice_number = '1525');

insert into invoice_lines (invoice_id, product_id, description, quantity, unit, unit_price, amount)
select i.id, p.id,
  'Jack Fruit · En Camino · carga P-092',
  1, 'lote', 16500.00, 16500.00
from invoices i
join products p on p.sku = 'JACK'
where i.invoice_number = '1525'
  and not exists (select 1 from invoice_lines l where l.invoice_id = i.id);

-- Opening AP: remaining saldo as total, paid 0. Same folio as bill_number.
insert into supplier_bills (bill_number, supplier_id, status, issue_date, due_date, ordered_qty, received_qty, total, paid, notes)
select
  '1361', s.id, 'open', '2025-12-19', '2026-01-09', 0, 0, 16500.00, 0,
  'Corte apertura 2026-06-30 · carga P-02 · Jack Fruit · Cerrada · remaining from Cargas (not full history). Papayas is customer and vendor — do not net.'
from suppliers s
where s.code = 'PRO-024'
  and not exists (select 1 from supplier_bills where bill_number = '1361');

insert into supplier_bills (bill_number, supplier_id, status, issue_date, due_date, ordered_qty, received_qty, total, paid, notes)
select
  '1364', s.id, 'open', '2025-12-24', '2026-01-14', 0, 0, 14794.44, 0,
  'Corte apertura 2026-06-30 · carga P-03 · Jack Fruit · Cerrada · remaining from Cargas (not full history). Papayas is customer and vendor — do not net.'
from suppliers s
where s.code = 'PRO-024'
  and not exists (select 1 from supplier_bills where bill_number = '1364');

insert into supplier_bills (bill_number, supplier_id, status, issue_date, due_date, ordered_qty, received_qty, total, paid, notes)
select
  '1367', s.id, 'open', '2026-01-08', '2026-01-29', 0, 0, 21360.05, 0,
  'Corte apertura 2026-06-30 · carga P-04 · Jack Fruit · Cerrada · remaining from Cargas (not full history). Papayas is customer and vendor — do not net.'
from suppliers s
where s.code = 'PRO-024'
  and not exists (select 1 from supplier_bills where bill_number = '1367');

insert into supplier_bills (bill_number, supplier_id, status, issue_date, due_date, ordered_qty, received_qty, total, paid, notes)
select
  '1370', s.id, 'open', '2026-01-14', '2026-02-04', 0, 0, 17585.60, 0,
  'Corte apertura 2026-06-30 · carga P-07 · Jack Fruit · Cerrada · remaining from Cargas (not full history). Papayas is customer and vendor — do not net.'
from suppliers s
where s.code = 'PRO-024'
  and not exists (select 1 from supplier_bills where bill_number = '1370');

insert into supplier_bills (bill_number, supplier_id, status, issue_date, due_date, ordered_qty, received_qty, total, paid, notes)
select
  '1375', s.id, 'open', '2026-02-02', '2026-02-23', 0, 0, 6657.38, 0,
  'Corte apertura 2026-06-30 · carga P-08 · Jack Fruit · Cerrada · remaining from Cargas (not full history). Papayas is customer and vendor — do not net.'
from suppliers s
where s.code = 'PRO-021'
  and not exists (select 1 from supplier_bills where bill_number = '1375');

insert into supplier_bills (bill_number, supplier_id, status, issue_date, due_date, ordered_qty, received_qty, total, paid, notes)
select
  '1379', s.id, 'open', '2026-02-16', '2026-03-09', 0, 0, 6066.50, 0,
  'Corte apertura 2026-06-30 · carga P-09 · Jack Fruit · Cerrada · remaining from Cargas (not full history). Papayas is customer and vendor — do not net.'
from suppliers s
where s.code = 'PRO-021'
  and not exists (select 1 from supplier_bills where bill_number = '1379');

insert into supplier_bills (bill_number, supplier_id, status, issue_date, due_date, ordered_qty, received_qty, total, paid, notes)
select
  'NGM236396', s.id, 'open', '2026-02-20', '2026-03-13', 0, 0, 24816.00, 0,
  'Corte apertura 2026-06-30 · carga P-010 · Papaya · Cerrada · remaining from Cargas (not full history). Papayas is customer and vendor — do not net.'
from suppliers s
where s.code = 'PRO-024'
  and not exists (select 1 from supplier_bills where bill_number = 'NGM236396');

insert into supplier_bills (bill_number, supplier_id, status, issue_date, due_date, ordered_qty, received_qty, total, paid, notes)
select
  '1395', s.id, 'open', '2026-02-24', '2026-03-17', 0, 0, 6354.04, 0,
  'Corte apertura 2026-06-30 · carga P-011 · Jack Fruit · Cerrada · remaining from Cargas (not full history). Papayas is customer and vendor — do not net.'
from suppliers s
where s.code = 'PRO-021'
  and not exists (select 1 from supplier_bills where bill_number = '1395');

insert into supplier_bills (bill_number, supplier_id, status, issue_date, due_date, ordered_qty, received_qty, total, paid, notes)
select
  'NGM237088', s.id, 'open', '2026-02-28', '2026-03-21', 0, 0, 22704.00, 0,
  'Corte apertura 2026-06-30 · carga P-012 · Papaya · Cerrada · remaining from Cargas (not full history). Papayas is customer and vendor — do not net.'
from suppliers s
where s.code = 'PRO-024'
  and not exists (select 1 from supplier_bills where bill_number = 'NGM237088');

insert into supplier_bills (bill_number, supplier_id, status, issue_date, due_date, ordered_qty, received_qty, total, paid, notes)
select
  '1386', s.id, 'open', '2026-03-03', '2026-03-24', 0, 0, 6871.81, 0,
  'Corte apertura 2026-06-30 · carga P-014 · Jack Fruit · Cerrada · remaining from Cargas (not full history). Papayas is customer and vendor — do not net.'
from suppliers s
where s.code = 'PRO-021'
  and not exists (select 1 from supplier_bills where bill_number = '1386');

insert into supplier_bills (bill_number, supplier_id, status, issue_date, due_date, ordered_qty, received_qty, total, paid, notes)
select
  'NGM237688', s.id, 'open', '2026-03-09', '2026-03-30', 0, 0, 22704.00, 0,
  'Corte apertura 2026-06-30 · carga P-015 · Papaya · Cerrada · remaining from Cargas (not full history). Papayas is customer and vendor — do not net.'
from suppliers s
where s.code = 'PRO-024'
  and not exists (select 1 from supplier_bills where bill_number = 'NGM237688');

insert into supplier_bills (bill_number, supplier_id, status, issue_date, due_date, ordered_qty, received_qty, total, paid, notes)
select
  '1387', s.id, 'open', '2026-03-11', '2026-04-01', 0, 0, 6678.68, 0,
  'Corte apertura 2026-06-30 · carga P-016 · Jack Fruit · Cerrada · remaining from Cargas (not full history). Papayas is customer and vendor — do not net.'
from suppliers s
where s.code = 'PRO-021'
  and not exists (select 1 from supplier_bills where bill_number = '1387');

insert into supplier_bills (bill_number, supplier_id, status, issue_date, due_date, ordered_qty, received_qty, total, paid, notes)
select
  'NGM238314', s.id, 'open', '2026-03-18', '2026-04-08', 0, 0, 20592.00, 0,
  'Corte apertura 2026-06-30 · carga P-017 · Papaya · Cerrada · remaining from Cargas (not full history). Papayas is customer and vendor — do not net.'
from suppliers s
where s.code = 'PRO-024'
  and not exists (select 1 from supplier_bills where bill_number = 'NGM238314');

insert into supplier_bills (bill_number, supplier_id, status, issue_date, due_date, ordered_qty, received_qty, total, paid, notes)
select
  '1394', s.id, 'open', '2026-03-18', '2026-04-08', 0, 0, 7182.92, 0,
  'Corte apertura 2026-06-30 · carga P-018 · Jack Fruit · Cerrada · remaining from Cargas (not full history). Papayas is customer and vendor — do not net.'
from suppliers s
where s.code = 'PRO-021'
  and not exists (select 1 from supplier_bills where bill_number = '1394');

insert into supplier_bills (bill_number, supplier_id, status, issue_date, due_date, ordered_qty, received_qty, total, paid, notes)
select
  '1401', s.id, 'open', '2026-03-25', '2026-04-15', 0, 0, 6324.96, 0,
  'Corte apertura 2026-06-30 · carga P-020 · Jack Fruit · Cerrada · remaining from Cargas (not full history). Papayas is customer and vendor — do not net.'
from suppliers s
where s.code = 'PRO-021'
  and not exists (select 1 from supplier_bills where bill_number = '1401');

insert into supplier_bills (bill_number, supplier_id, status, issue_date, due_date, ordered_qty, received_qty, total, paid, notes)
select
  '2381', s.id, 'open', '2026-03-30', '2026-04-20', 0, 0, 19000.00, 0,
  'Corte apertura 2026-06-30 · carga P-022 · Papaya · Cerrada · remaining from Cargas (not full history). Papayas is customer and vendor — do not net.'
from suppliers s
where s.code = 'PRO-024'
  and not exists (select 1 from supplier_bills where bill_number = '2381');

insert into supplier_bills (bill_number, supplier_id, status, issue_date, due_date, ordered_qty, received_qty, total, paid, notes)
select
  '1409', s.id, 'open', '2026-04-02', '2026-04-23', 0, 0, 6650.64, 0,
  'Corte apertura 2026-06-30 · carga P-023 · Jack Fruit · Cerrada · remaining from Cargas (not full history). Papayas is customer and vendor — do not net.'
from suppliers s
where s.code = 'PRO-021'
  and not exists (select 1 from supplier_bills where bill_number = '1409');

insert into supplier_bills (bill_number, supplier_id, status, issue_date, due_date, ordered_qty, received_qty, total, paid, notes)
select
  '1413', s.id, 'open', '2026-04-07', '2026-04-28', 0, 0, 6516.44, 0,
  'Corte apertura 2026-06-30 · carga P-024 · Jack Fruit · Cerrada · remaining from Cargas (not full history). Papayas is customer and vendor — do not net.'
from suppliers s
where s.code = 'PRO-021'
  and not exists (select 1 from supplier_bills where bill_number = '1413');

insert into supplier_bills (bill_number, supplier_id, status, issue_date, due_date, ordered_qty, received_qty, total, paid, notes)
select
  'FMU01', s.id, 'open', '2026-04-08', '2026-04-29', 0, 0, 422.40, 0,
  'Corte apertura 2026-06-30 · carga P-025 · Jack Fruit · Cerrada · remaining from Cargas (not full history)'
from suppliers s
where s.code = 'PRO-021'
  and not exists (select 1 from supplier_bills where bill_number = 'FMU01');

insert into supplier_bills (bill_number, supplier_id, status, issue_date, due_date, ordered_qty, received_qty, total, paid, notes)
select
  '1416', s.id, 'open', '2026-04-14', '2026-05-05', 0, 0, 6666.23, 0,
  'Corte apertura 2026-06-30 · carga P-027 · Jack Fruit · Cerrada · remaining from Cargas (not full history). Papayas is customer and vendor — do not net.'
from suppliers s
where s.code = 'PRO-021'
  and not exists (select 1 from supplier_bills where bill_number = '1416');

insert into supplier_bills (bill_number, supplier_id, status, issue_date, due_date, ordered_qty, received_qty, total, paid, notes)
select
  '1421', s.id, 'open', '2026-04-20', '2026-05-12', 0, 0, 5621.21, 0,
  'Corte apertura 2026-06-30 · carga P-028 · Jack Fruit · Cerrada · remaining from Cargas (not full history). Papayas is customer and vendor — do not net.'
from suppliers s
where s.code = 'PRO-021'
  and not exists (select 1 from supplier_bills where bill_number = '1421');

insert into supplier_bills (bill_number, supplier_id, status, issue_date, due_date, ordered_qty, received_qty, total, paid, notes)
select
  '1428', s.id, 'open', '2026-04-28', '2026-05-19', 0, 0, 6111.97, 0,
  'Corte apertura 2026-06-30 · carga P-029 · Jack Fruit · Cerrada · remaining from Cargas (not full history). Papayas is customer and vendor — do not net.'
from suppliers s
where s.code = 'PRO-021'
  and not exists (select 1 from supplier_bills where bill_number = '1428');

insert into supplier_bills (bill_number, supplier_id, status, issue_date, due_date, ordered_qty, received_qty, total, paid, notes)
select
  '1438', s.id, 'open', '2026-05-04', '2026-05-26', 0, 0, 6433.24, 0,
  'Corte apertura 2026-06-30 · carga P-030 · Jack Fruit · Cerrada · remaining from Cargas (not full history). Papayas is customer and vendor — do not net.'
from suppliers s
where s.code = 'PRO-021'
  and not exists (select 1 from supplier_bills where bill_number = '1438');

insert into supplier_bills (bill_number, supplier_id, status, issue_date, due_date, ordered_qty, received_qty, total, paid, notes)
select
  '1444', s.id, 'open', '2026-05-11', '2026-06-01', 0, 0, 5655.18, 0,
  'Corte apertura 2026-06-30 · carga P-031 · Jack Fruit · Cerrada · remaining from Cargas (not full history). Papayas is customer and vendor — do not net.'
from suppliers s
where s.code = 'PRO-021'
  and not exists (select 1 from supplier_bills where bill_number = '1444');

insert into supplier_bills (bill_number, supplier_id, status, issue_date, due_date, ordered_qty, received_qty, total, paid, notes)
select
  'NGM242574', s.id, 'open', '2026-05-18', '2026-06-08', 0, 0, 18966.00, 0,
  'Corte apertura 2026-06-30 · carga P-032 · Papaya · Cerrada · remaining from Cargas (not full history). Papayas is customer and vendor — do not net.'
from suppliers s
where s.code = 'PRO-024'
  and not exists (select 1 from supplier_bills where bill_number = 'NGM242574');

insert into supplier_bills (bill_number, supplier_id, status, issue_date, due_date, ordered_qty, received_qty, total, paid, notes)
select
  '1449', s.id, 'open', '2026-05-19', '2026-06-09', 0, 0, 5754.96, 0,
  'Corte apertura 2026-06-30 · carga P-033 · Jack Fruit · Cerrada · remaining from Cargas (not full history). Papayas is customer and vendor — do not net.'
from suppliers s
where s.code = 'PRO-021'
  and not exists (select 1 from supplier_bills where bill_number = '1449');

insert into supplier_bills (bill_number, supplier_id, status, issue_date, due_date, ordered_qty, received_qty, total, paid, notes)
select
  '1454', s.id, 'open', '2026-05-26', '2026-06-16', 0, 0, 5277.79, 0,
  'Corte apertura 2026-06-30 · carga P-039 · Jack Fruit · Cerrada · remaining from Cargas (not full history). Papayas is customer and vendor — do not net.'
from suppliers s
where s.code = 'PRO-021'
  and not exists (select 1 from supplier_bills where bill_number = '1454');

insert into supplier_bills (bill_number, supplier_id, status, issue_date, due_date, ordered_qty, received_qty, total, paid, notes)
select
  '1459', s.id, 'open', '2026-06-02', '2026-06-23', 0, 0, 6499.68, 0,
  'Corte apertura 2026-06-30 · carga P-043 · Jack Fruit · Cerrada · remaining from Cargas (not full history). Papayas is customer and vendor — do not net.'
from suppliers s
where s.code = 'PRO-021'
  and not exists (select 1 from supplier_bills where bill_number = '1459');

insert into supplier_bills (bill_number, supplier_id, status, issue_date, due_date, ordered_qty, received_qty, total, paid, notes)
select
  'P00128', s.id, 'open', '2026-06-02', '2026-06-23', 0, 0, 7850.00, 0,
  'Corte apertura 2026-06-30 · carga P-044 · Papaya · Cerrada · remaining from Cargas (not full history). Papayas is customer and vendor — do not net.'
from suppliers s
where s.code = 'PRO-024'
  and not exists (select 1 from supplier_bills where bill_number = 'P00128');

insert into supplier_bills (bill_number, supplier_id, status, issue_date, due_date, ordered_qty, received_qty, total, paid, notes)
select
  '1481', s.id, 'open', '2026-06-10', '2026-07-21', 0, 0, 5448.35, 0,
  'Corte apertura 2026-06-30 · carga P-049 · Jack Fruit · Cerrada · remaining from Cargas (not full history). Papayas is customer and vendor — do not net.'
from suppliers s
where s.code = 'PRO-021'
  and not exists (select 1 from supplier_bills where bill_number = '1481');

insert into supplier_bills (bill_number, supplier_id, status, issue_date, due_date, ordered_qty, received_qty, total, paid, notes)
select
  'P00130', s.id, 'open', '2026-06-17', '2026-07-09', 0, 0, 7850.00, 0,
  'Corte apertura 2026-06-30 · carga P-053 · Jack Fruit · Cerrada · remaining from Cargas (not full history). Papayas is customer and vendor — do not net.'
from suppliers s
where s.code = 'PRO-024'
  and not exists (select 1 from supplier_bills where bill_number = 'P00130');

insert into supplier_bills (bill_number, supplier_id, status, issue_date, due_date, ordered_qty, received_qty, total, paid, notes)
select
  '1470', s.id, 'open', '2026-06-17', '2026-07-08', 0, 0, 13075.96, 0,
  'Corte apertura 2026-06-30 · carga P-054 · Jack Fruit · Cerrada · remaining from Cargas (not full history). Papayas is customer and vendor — do not net.'
from suppliers s
where s.code = 'PRO-021'
  and not exists (select 1 from supplier_bills where bill_number = '1470');

insert into supplier_bills (bill_number, supplier_id, status, issue_date, due_date, ordered_qty, received_qty, total, paid, notes)
select
  '1475', s.id, 'open', '2026-06-24', '2026-07-17', 0, 0, 6023.10, 0,
  'Corte apertura 2026-06-30 · carga P-059 · Jack Fruit · Cerrada · remaining from Cargas (not full history). Papayas is customer and vendor — do not net.'
from suppliers s
where s.code = 'PRO-021'
  and not exists (select 1 from supplier_bills where bill_number = '1475');

insert into supplier_bills (bill_number, supplier_id, status, issue_date, due_date, ordered_qty, received_qty, total, paid, notes)
select
  '1465', s.id, 'open', '2026-06-30', '2026-07-28', 0, 0, 6737.45, 0,
  'Corte apertura 2026-06-30 · carga P-063 · Jack Fruit · Cerrada · remaining from Cargas (not full history). Papayas is customer and vendor — do not net.'
from suppliers s
where s.code = 'PRO-021'
  and not exists (select 1 from supplier_bills where bill_number = '1465');

insert into supplier_bills (bill_number, supplier_id, status, issue_date, due_date, ordered_qty, received_qty, total, paid, notes)
select
  '1495', s.id, 'open', '2026-07-07', '2026-07-29', 0, 0, 14504.38, 0,
  'Corte apertura 2026-06-30 · carga P-067 · Jack Fruit · Cerrada · remaining from Cargas (not full history). Papayas is customer and vendor — do not net.'
from suppliers s
where s.code = 'PRO-021'
  and not exists (select 1 from supplier_bills where bill_number = '1495');

insert into supplier_bills (bill_number, supplier_id, status, issue_date, due_date, ordered_qty, received_qty, total, paid, notes)
select
  'PX-72329', s.id, 'open', '2026-07-08', '2026-07-29', 0, 0, 18000.00, 0,
  'Corte apertura 2026-06-30 · carga P-068 · Esparrago Organico · Cerrada · remaining from Cargas (not full history)'
from suppliers s
where s.code = 'PRO-023'
  and not exists (select 1 from supplier_bills where bill_number = 'PX-72329');

insert into supplier_bills (bill_number, supplier_id, status, issue_date, due_date, ordered_qty, received_qty, total, paid, notes)
select
  '1491', s.id, 'open', '2026-07-13', '2026-08-05', 0, 0, 5763.70, 0,
  'Corte apertura 2026-06-30 · carga P-072 · Jack Fruit · Cerrada · remaining from Cargas (not full history). Papayas is customer and vendor — do not net.'
from suppliers s
where s.code = 'PRO-021'
  and not exists (select 1 from supplier_bills where bill_number = '1491');

insert into supplier_bills (bill_number, supplier_id, status, issue_date, due_date, ordered_qty, received_qty, total, paid, notes)
select
  'PX-72494', s.id, 'open', '2026-07-15', '2026-08-05', 0, 0, 120.00, 0,
  'Corte apertura 2026-06-30 · carga P-074 · Esparrago Organico · Cerrada · remaining from Cargas (not full history)'
from suppliers s
where s.code = 'PRO-023'
  and not exists (select 1 from supplier_bills where bill_number = 'PX-72494');

insert into supplier_bills (bill_number, supplier_id, status, issue_date, due_date, ordered_qty, received_qty, total, paid, notes)
select
  '36521', s.id, 'open', '2026-07-22', '2026-08-12', 0, 0, 533.00, 0,
  'Corte apertura 2026-06-30 · carga P-076 · Habanero Rojo · Cerrada · remaining from Cargas (not full history)'
from suppliers s
where s.code = 'PRO-013'
  and not exists (select 1 from supplier_bills where bill_number = '36521');

insert into supplier_bills (bill_number, supplier_id, status, issue_date, due_date, ordered_qty, received_qty, total, paid, notes)
select
  '1505', s.id, 'open', '2026-07-22', '2026-08-12', 0, 0, 16080.29, 0,
  'Corte apertura 2026-06-30 · carga P-077 · Jack Fruit · Cerrada · remaining from Cargas (not full history). Papayas is customer and vendor — do not net.'
from suppliers s
where s.code = 'PRO-021'
  and not exists (select 1 from supplier_bills where bill_number = '1505');

insert into supplier_bills (bill_number, supplier_id, status, issue_date, due_date, ordered_qty, received_qty, total, paid, notes)
select
  'NGM247514', s.id, 'open', '2026-07-24', '2026-08-14', 0, 0, 22704.00, 0,
  'Corte apertura 2026-06-30 · carga P-078 · Papaya · Cerrada · remaining from Cargas (not full history). Papayas is customer and vendor — do not net.'
from suppliers s
where s.code = 'PRO-024'
  and not exists (select 1 from supplier_bills where bill_number = 'NGM247514');

insert into supplier_bills (bill_number, supplier_id, status, issue_date, due_date, ordered_qty, received_qty, total, paid, notes)
select
  'PX-72589', s.id, 'open', '2026-07-24', '2026-08-14', 0, 0, 9775.00, 0,
  'Corte apertura 2026-06-30 · carga P-080 · Esparrago Organico · Cerrada · remaining from Cargas (not full history)'
from suppliers s
where s.code = 'PRO-023'
  and not exists (select 1 from supplier_bills where bill_number = 'PX-72589');

insert into supplier_bills (bill_number, supplier_id, status, issue_date, due_date, ordered_qty, received_qty, total, paid, notes)
select
  'PX-72648', s.id, 'open', '2026-07-25', '2026-08-15', 0, 0, 90.00, 0,
  'Corte apertura 2026-06-30 · carga P-083 · Esparrago Organico · Cerrada · remaining from Cargas (not full history)'
from suppliers s
where s.code = 'PRO-023'
  and not exists (select 1 from supplier_bills where bill_number = 'PX-72648');

insert into supplier_bills (bill_number, supplier_id, status, issue_date, due_date, ordered_qty, received_qty, total, paid, notes)
select
  '36522', s.id, 'open', '2026-07-29', '2026-08-19', 0, 0, 2904.00, 0,
  'Corte apertura 2026-06-30 · carga P-084 · Habanero Rojo · Cerrada · remaining from Cargas (not full history)'
from suppliers s
where s.code = 'PRO-013'
  and not exists (select 1 from supplier_bills where bill_number = '36522');

insert into supplier_bills (bill_number, supplier_id, status, issue_date, due_date, ordered_qty, received_qty, total, paid, notes)
select
  'PX-72650', s.id, 'open', '2026-07-30', '2026-08-20', 0, 0, 240.00, 0,
  'Corte apertura 2026-06-30 · carga P-085 · Esparrago Organico · Cerrada · remaining from Cargas (not full history)'
from suppliers s
where s.code = 'PRO-023'
  and not exists (select 1 from supplier_bills where bill_number = 'PX-72650');

insert into supplier_bills (bill_number, supplier_id, status, issue_date, due_date, ordered_qty, received_qty, total, paid, notes)
select
  '1520', s.id, 'open', '2026-08-04', '2026-08-25', 0, 0, 6578.91, 0,
  'Corte apertura 2026-06-30 · carga P-086 · Jack Fruit · Cerrada · remaining from Cargas (not full history). Papayas is customer and vendor — do not net.'
from suppliers s
where s.code = 'PRO-021'
  and not exists (select 1 from supplier_bills where bill_number = '1520');

insert into supplier_bills (bill_number, supplier_id, status, issue_date, due_date, ordered_qty, received_qty, total, paid, notes)
select
  'PX-72306', s.id, 'open', '2026-08-06', '2026-08-27', 0, 0, 12372.75, 0,
  'Corte apertura 2026-06-30 · carga P-087 · Col de bruselas · Cerrada · remaining from Cargas (not full history)'
from suppliers s
where s.code = 'PRO-003'
  and not exists (select 1 from supplier_bills where bill_number = 'PX-72306');

insert into supplier_bills (bill_number, supplier_id, status, issue_date, due_date, ordered_qty, received_qty, total, paid, notes)
select
  'PX-72715', s.id, 'open', '2026-08-06', '2026-08-27', 0, 0, 24240.00, 0,
  'Corte apertura 2026-06-30 · carga P-088 · Esparrago Organico · Cerrada · remaining from Cargas (not full history)'
from suppliers s
where s.code = 'PRO-023'
  and not exists (select 1 from supplier_bills where bill_number = 'PX-72715');

insert into supplier_bills (bill_number, supplier_id, status, issue_date, due_date, ordered_qty, received_qty, total, paid, notes)
select
  'NGM248545', s.id, 'open', '2026-08-06', '2026-08-27', 0, 0, 19698.00, 0,
  'Corte apertura 2026-06-30 · carga P-089 · Papaya · Rechazo · remaining from Cargas (not full history). Papayas is customer and vendor — do not net.'
from suppliers s
where s.code = 'PRO-024'
  and not exists (select 1 from supplier_bills where bill_number = 'NGM248545');

insert into supplier_bills (bill_number, supplier_id, status, issue_date, due_date, ordered_qty, received_qty, total, paid, notes)
select
  '36223', s.id, 'open', '2026-08-07', '2026-08-28', 0, 0, 6836.50, 0,
  'Corte apertura 2026-06-30 · carga P-090 · Habanero Naranja · Entregada · remaining from Cargas (not full history)'
from suppliers s
where s.code = 'PRO-013'
  and not exists (select 1 from supplier_bills where bill_number = '36223');

insert into supplier_bills (bill_number, supplier_id, status, issue_date, due_date, ordered_qty, received_qty, total, paid, notes)
select
  'PX-72774', s.id, 'open', '2026-08-12', '2026-09-02', 0, 0, 34080.00, 0,
  'Corte apertura 2026-06-30 · carga P-091 · Esparrago Organico · En Camino · remaining from Cargas (not full history)'
from suppliers s
where s.code = 'PRO-023'
  and not exists (select 1 from supplier_bills where bill_number = 'PX-72774');

insert into supplier_bills (bill_number, supplier_id, status, issue_date, due_date, ordered_qty, received_qty, total, paid, notes)
select
  '1525', s.id, 'open', '2026-08-12', '2026-09-02', 0, 0, 16396.65, 0,
  'Corte apertura 2026-06-30 · carga P-092 · Jack Fruit · En Camino · remaining from Cargas (not full history). Papayas is customer and vendor — do not net.'
from suppliers s
where s.code = 'PRO-021'
  and not exists (select 1 from supplier_bills where bill_number = '1525');

insert into cash_movements (folio, mov_date, kind, counterparty, amount, notes)
select 'CORTE-CHASE', '2026-06-30', 'ajuste', 'JP Morgan Chase',
  19066.20,
  'Opening cash from V8 Saldos as of 30 Jun 2026. Chase movements after that date are not replayed. Replace with today from the bank when you have it.'
where not exists (select 1 from cash_movements where folio = 'CORTE-CHASE');

select setval('invoices_id_seq', (select coalesce(max(id),1) from invoices));
select setval('invoice_lines_id_seq', (select coalesce(max(id),1) from invoice_lines));
select setval('supplier_bills_id_seq', (select coalesce(max(id),1) from supplier_bills));
select setval('cash_movements_id_seq', (select coalesce(max(id),1) from cash_movements));
select setval('gl_accounts_id_seq', (select coalesce(max(id),1) from gl_accounts));
select setval('bank_accounts_id_seq', (select coalesce(max(id),1) from bank_accounts));

