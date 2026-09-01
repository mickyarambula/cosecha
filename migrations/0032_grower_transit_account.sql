-- Cuenta de pasivo para el dinero de productores en tránsito (comisión pura).
-- Mismo patrón que la 12500 de adelantos (0024): la cuenta vive en el catálogo
-- y su saldo se alimenta en vivo de grower_payables al leer el reporte — no se
-- suma a la 20100 (Accounts Payable), porque no es compra a proveedor.
insert into gl_accounts (number, name, description, statement, kind, subtype, parent_number, tracking_start, starting_balance, sort_order)
values ('21000', 'Grower Funds in Transit', 'Dinero de cargas a comisión pura ya liquidadas, por remitir al productor (grower_payables)', 'balance', 'liability', 'Current > Growers', null, current_date, 0, 73)
on conflict (number) do nothing;
