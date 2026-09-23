-- 0052: nómina (MODELO-NEGOCIO.md § 7).
--
-- En el periodo del libro V8 la nómina son 13 registros por $42,145 que viven
-- solo en el registro de Chase: sin empleado, sin periodo y sin una fila que
-- el P&L pueda leer ni que después se pueda prorratear a las cargas. Meterla
-- como gasto suelto obligaría a inventar un proveedor "Nómina" (la tabla de
-- gastos exige proveedor) y nacería "por pagar": las cuentas por pagar
-- brincarían de $570,097.56 a $612,242.56 por dinero que ya salió.
--
-- Decisiones de Miguel (19 Sep 2026):
--   · Bruto y deducciones por separado, aunque hoy solo tenga el neto a la
--     mano: el P&L quiere el costo completo. El neto es lo que sale de Chase.
--   · Nunca se le cobra a un productor. Sin excepción: estas tablas no tienen
--     camino a `expenses`, `expense_po_links` ni a una liquidación.
--   · Las que ya salieron por Chase nacen marcadas "ya pagadas".
--   · No se inventa un proveedor "Nómina": camino propio.
--
--   · `employees` es personal, no acceso al sistema (`staff` sigue siendo
--     quién entra a Cosecha). Nace VACÍA: nombres, áreas y sueldos los
--     captura Miguel — no se siembra ninguno.
--   · `payroll_periods` es el periodo con su folio (NOM-001). Borrador
--     mientras se captura; al cerrarlo entra al P&L por su fecha de fin.
--     `paid_at` + `pay_mode` dicen cómo se pagó: 'chase' deja movimientos en
--     Tesorería (uno por empleado, con la fecha real del banco); 'outside'
--     es "ya se pagó y Chase ya lo refleja" (antes del corte del 19 Ago 2026,
--     o capturado a mano en Tesorería) y no mueve la caja.
--   · `payroll_lines` es un renglón por empleado, con su nombre y partida
--     congelados en el momento (si el empleado cambia de área, el periodo
--     viejo no se reescribe). `net = gross − deductions`, calculado en el
--     servidor.
--   · La cuenta de sueldos YA existe: 52500 "Nómina" (bloque 0, migración
--     0048). El mapeo `payroll` deja cambiarla desde Cuentas, como `fx_result`.
--   · Dos cuentas de pasivo nuevas, con el mismo patrón que la 21000 (0032):
--     el saldo se lee en vivo de `payroll_periods`, nunca se suma a la 20100
--     — la 20100 es el ancla del corte y no se toca.
--       20300 Nómina por pagar        neto de periodos cerrados sin pagar
--       20350 Retenciones de nómina   deducciones retenidas, por enterar
--
-- Reglas que viven en el servidor, no aquí: `status` ∈ draft | closed |
-- cancelled; `pay_mode` ∈ chase | outside; un pago por Chase exige fecha ≥ la
-- del corte (antes, ese dinero ya está en el saldo de apertura); cancelar un
-- periodo pagado por Chase pide cancelar primero su pago; BORRAR limpia
-- periodos y renglones pero conserva a los empleados (son catálogo).
--
-- Aditiva: tres tablas nuevas, dos cuentas y un mapeo. No mueve un solo
-- dólar. No toca facturas opening, bills del corte, CORTE-CHASE ni
-- liquidaciones emitidas. Aprobada por Miguel el 22 Sep 2026.

-- ── 1. Empleados (catálogo; sobrevive a BORRAR) ─────────────────────────
create table if not exists employees (
  id serial primary key,
  name text not null,
  department_id integer references departments(id),   -- área (catálogo de departamentos)
  position text,                                       -- puesto
  payroll_concept text,                                -- partida del V8: Nomina Ventas / Compras / Admin (money_concepts)
  hired_at date,                                       -- fecha de alta
  base_gross numeric(14, 2),                           -- sueldo bruto por periodo, solo para precargar; en blanco hasta capturarlo
  is_active boolean not null default true,
  notes text,
  created_by text,
  created_at timestamptz not null default now()
);

create index if not exists emp_department_idx on employees (department_id);

-- ── 2. Periodos de nómina ───────────────────────────────────────────────
create table if not exists payroll_periods (
  id serial primary key,
  period_number text not null unique,                  -- NOM-001
  period_start date not null,
  period_end date not null,                            -- fecha con la que entra al P&L
  status text not null default 'draft',                -- draft | closed | cancelled
  paid_at date,                                        -- día en que salió el dinero (null = por pagar)
  pay_mode text,                                       -- chase | outside
  method text,
  reference text,
  notes text,
  created_by text,
  closed_at timestamptz,
  closed_by text,
  cancelled_at timestamptz,
  cancelled_by text,
  cancel_reason text,
  created_at timestamptz not null default now()
);

create index if not exists prp_status_idx on payroll_periods (status);
create index if not exists prp_period_end_idx on payroll_periods (period_end);

-- ── 3. Renglones: un empleado por periodo ───────────────────────────────
create table if not exists payroll_lines (
  id serial primary key,
  period_id integer not null references payroll_periods(id) on delete cascade,
  employee_id integer not null references employees(id),
  employee_name text not null,                         -- congelado al capturar
  concept text,                                        -- partida congelada al capturar
  gross numeric(14, 2) not null default 0,             -- bruto: el costo en el P&L
  deductions numeric(14, 2) not null default 0,        -- lo retenido al empleado
  net numeric(14, 2) not null default 0,               -- bruto − deducciones: lo que sale de Chase
  notes text,
  cash_movement_id integer references cash_movements(id),  -- el movimiento de Tesorería que lo pagó
  unique (period_id, employee_id)
);

create index if not exists prl_period_idx on payroll_lines (period_id);
create index if not exists prl_employee_idx on payroll_lines (employee_id);
create index if not exists prl_cash_idx on payroll_lines (cash_movement_id);

-- ── 4. Cuentas de pasivo y mapeo de la cuenta de sueldos ───────────────
insert into gl_accounts (number, name, description, statement, kind, subtype, parent_number, tracking_start, starting_balance, sort_order) values
  ('20300', 'Nómina por pagar',      'Neto de periodos de nómina cerrados que todavía no salen de Chase (payroll_periods)', 'balance', 'liability', 'Current > Payroll', null, '2026-08-19', 0, 73),
  ('20350', 'Retenciones de nómina', 'Deducciones retenidas a los empleados en periodos cerrados, pendientes de enterar',  'balance', 'liability', 'Current > Payroll', null, '2026-08-19', 0, 74)
on conflict (number) do nothing;

-- La 21000 (productores en tránsito) se recorre para que los pasivos de
-- nómina queden juntos después de la 20250 (JEAMS, 72) y antes que ella.
update gl_accounts set sort_order = 75 where number = '21000' and sort_order = 73;

-- A qué cuenta de gasto va la nómina. Cuentas → Automatizaciones la puede
-- cambiar; si la mapeada no existe, el P&L cae a la partida y luego al cajón.
insert into gl_mappings (map_key, account_number) values ('payroll', '52500')
on conflict (map_key) do nothing;
