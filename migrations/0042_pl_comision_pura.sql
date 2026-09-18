-- Hallazgo 6 (AUDITORIA-2026-09-03): en comisión pura el P&L se quedaba con
-- el dinero del productor. Plein vende fruta que nunca fue suya: la venta
-- bruta sí es su ingreso facturado (y su CxC), pero la parte del productor
-- tiene que salir como costo, o la utilidad queda inflada por ese monto y el
-- Balance no cuadra contra el pasivo 21000 "por remitir".
--
-- Decisión de producto de Miguel (18 Sep 2026, opción B): venta bruta +
-- renglón "Remitido al productor". Sólo comisión pura — en consignación Plein
-- sí compra la fruta y ese costo ya vive en lots.unit_cost (cuenta 50000).
--
-- Aditiva: una cuenta contable nueva. No toca saldos ni el corte.
insert into gl_accounts (number, name, description, statement, kind, subtype, parent_number, tracking_start, starting_balance, sort_order)
values (
  '50100',
  'Remitido al productor',
  'Neto al productor de cargas a comisión pura ya liquidadas (LIQ- y sus complementarias). Plein nunca tomó título de esa fruta: la venta bruta entra al ingreso y esta cuenta saca la parte que es del productor. Su contrapartida en el Balance es la 21000.',
  'income',
  'cogs',
  'COGS',
  null,
  current_date,
  0,
  22
)
on conflict (number) do nothing;
