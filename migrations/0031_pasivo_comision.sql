-- Rama pasivo-comision-pura. Dos cosas, ambas aditivas e idempotentes.
--
-- Parte 1 — Bills del corte marcadas de forma confiable.
-- Hoy cancelSupplierBill las protege solo por la convención
-- "purchase_order_id is null ⇒ es del corte". Funciona porque el corte es lo
-- único sin OC, pero es implícito y frágil si algún día nace otra bill sin OC.
-- Marca explícita con el mismo criterio que invoices.invoice_type='opening'.
-- Columna nullable: las bills del flujo normal quedan con bill_type null.
alter table supplier_bills add column if not exists bill_type text;

update supplier_bills
set bill_type = 'opening'
where bill_type is null
  and purchase_order_id is null
  and notes like 'Corte apertura%';

-- Parte 2 — Pasivo de comisión pura: dinero del productor en tránsito.
-- Al emitir la liquidación de una carga a comisión, Plein queda debiendo el
-- final_payment al productor. NO es una compra (Plein nunca toma título de la
-- fruta — createBillFromPO lo bloquea a propósito), así que no es una
-- supplier_bill: es un pasivo propio, "por remitir al productor".
-- Una por liquidación (índice único) — la liquidación es inmutable, su pasivo
-- también nace una sola vez.
create table if not exists grower_payables (
  id serial primary key,
  payable_number text not null unique,
  settlement_id integer not null references grower_settlements(id),
  purchase_order_id integer not null references purchase_orders(id),
  supplier_id integer not null references suppliers(id),
  status text not null default 'open',
  issue_date date not null default current_date,
  total numeric(14, 2) not null default 0,
  paid numeric(14, 2) not null default 0,
  notes text,
  created_at timestamptz not null default now()
);
create unique index if not exists grower_payables_settlement_idx
  on grower_payables (settlement_id);
create index if not exists grower_payables_supplier_idx
  on grower_payables (supplier_id);

-- El pago de la remisión escribe cash_movements como cualquier otro pago;
-- esta FK es su vínculo directo (misma familia que invoice_id /
-- supplier_bill_id / expense_id).
alter table cash_movements add column if not exists grower_payable_id integer references grower_payables(id);
