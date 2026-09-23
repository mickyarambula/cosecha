-- 0051: el diferencial cambiario al pagar (peso–dólar, parte B).
--
-- La parte A (0050) dejó la factura del proveedor y el gasto CONGELADOS en
-- pesos al TC pactado. Al pagar, Plein manda dólares desde Chase y el banco
-- convierte a su TC del día: los dólares que salen de Chase ya no son los
-- mismos que se abonan a la factura. La diferencia es resultado cambiario de
-- Plein — nunca del productor (decisión de Miguel, 19 Sep 2026: le pactaste un
-- precio en pesos, el riesgo del dólar es tuyo).
--
-- Miguel, 22 Sep 2026: hoy paga desde Chase y el banco convierte. Una cuenta
-- en pesos o una casa de cambio pueden darse; entran como parte C sin rehacer
-- esto, porque aquí se guarda el TC real de cada pago, venga de donde venga.
--
--   · `paid_fx`: los pesos ya pagados de la deuda. Cuando llega al total en
--     pesos, el documento cierra completo — los centavos de redondeo van al
--     resultado cambiario, no se quedan como saldo de $0.03.
--   · `cash_movements.amount` sigue siendo lo que salió de Chase (dólares);
--     `amount_fx` / `fx_rate` son los pesos y el TC del banco; `fx_result` es
--     la diferencia en dólares (+ ganancia, − pérdida).
--   · `payment_applications` lleva lo mismo por documento, porque un pago de
--     gastos puede cubrir varios a la vez.
--
-- Aditiva: columnas nuevas (los `default 0` son ciertos — nada existente se
-- pagó con pesos) y una cuenta nueva. No mueve un solo dólar. No toca
-- facturas opening, bills del corte, CORTE-CHASE ni liquidaciones emitidas.
-- Aprobada por Miguel el 22 Sep 2026.
alter table supplier_bills       add column if not exists paid_fx numeric(14,2) not null default 0;
alter table expenses             add column if not exists paid_fx numeric(14,2) not null default 0;
alter table cash_movements       add column if not exists amount_fx numeric(14,2);
alter table cash_movements       add column if not exists fx_rate numeric(12,6);
alter table cash_movements       add column if not exists fx_result numeric(14,2) not null default 0;
alter table payment_applications add column if not exists amount_fx numeric(14,2);
alter table payment_applications add column if not exists fx_rate numeric(12,6);
alter table payment_applications add column if not exists fx_result numeric(14,2) not null default 0;

insert into gl_accounts (number, name, description, statement, kind, subtype, parent_number, tracking_start, starting_balance, sort_order)
values ('58100', 'Resultado cambiario',
        'Lo que se movió el dólar entre pactar en pesos y pagar. Negativo = ganancia, positivo = pérdida.',
        'income', 'expense', 'Expense', null, '2026-08-19', 0, 41)
on conflict (number) do nothing;

insert into gl_mappings (map_key, account_number) values ('fx_result', '58100')
on conflict (map_key) do update set account_number = excluded.account_number;
