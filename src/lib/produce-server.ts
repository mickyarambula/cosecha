import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getSql } from "@/lib/db";
import { addDaysISO, num, termsDays, todayISO } from "@/lib/utils";

function n(v: unknown) {
  return num(v);
}

async function nextCode(
  sql: Awaited<ReturnType<typeof getSql>>,
  table: string,
  column: string,
  prefix: string,
  pad = 3,
) {
  const rows = await sql.query<{ c: string }>(
    `select ${column} as c from ${table} where ${column} like $1 order by id desc limit 1`,
    [`${prefix}%`],
  );
  const last = rows[0]?.c ?? "";
  const match = last.match(/(\d+)$/);
  const next = (match ? Number(match[1]) : 0) + 1;
  return `${prefix}${String(next).padStart(pad, "0")}`;
}

function lotPrefix() {
  const d = new Date();
  return `LOT-${String(d.getFullYear()).slice(2)}${String(d.getMonth() + 1).padStart(2, "0")}-`;
}

function moneyStatus(total: number, paid: number) {
  if (paid >= total - 0.009) return "paid";
  if (paid > 0.009) return "partial";
  return "open";
}

async function insertLot(
  sql: Awaited<ReturnType<typeof getSql>>,
  args: {
    product_id: number;
    supplier_id: number;
    pack_style_id: number | null;
    qty: number;
    unit: string;
    unit_cost: unknown;
    location_id: number;
    quality_state: string;
    quality_note: string | null;
    poId: number;
    grade?: string | null;
    notes?: string | null;
  },
) {
  const lot_number = await nextCode(sql, "lots", "lot_number", lotPrefix());
  const today = todayISO();
  const lotRows = await sql.query<{ id: number }>(
    `insert into lots (lot_number, product_id, supplier_id, pack_style_id, original_qty, current_qty, unit, unit_cost,
                       received_date, pack_date, quality_state, quality_note, grade, origin_country, status)
     values ($1,$2,$3,$4,$5,$5,$6,$7,$8,$8,$9,$10,$11,'México','active') returning id`,
    [
      lot_number,
      args.product_id,
      args.supplier_id,
      args.pack_style_id,
      args.qty,
      args.unit,
      args.unit_cost,
      today,
      args.quality_state,
      args.quality_note,
      args.grade ?? null,
    ],
  );
  const lotId = lotRows[0].id;
  await sql.query(
    `insert into inventory (lot_id, location_id, quantity) values ($1,$2,$3)
     on conflict (lot_id, location_id) do update set quantity = inventory.quantity + excluded.quantity`,
    [lotId, args.location_id, args.qty],
  );
  await sql.query(
    `insert into inventory_movements (lot_id, location_id, movement_type, quantity, unit, reference_type, reference_id, notes)
     values ($1,$2,'receive',$3,$4,'purchase_order',$5,$6)`,
    [lotId, args.location_id, args.qty, args.unit, args.poId, args.notes ?? "Recepción PACA"],
  );
  return { lotId, lot_number };
}

export const getDashboard = createServerFn({ method: "GET" }).handler(async () => {
  const sql = await getSql();
  const [counts] = await sql.query<{
    products: number;
    lots: number;
    suppliers: number;
    customers: number;
    pos: number;
    sos: number;
    cpos: number;
    retenidos: number;
  }>(`
    select
      (select count(*)::int from products where is_active) as products,
      (select count(*)::int from lots where status = 'active') as lots,
      (select count(*)::int from suppliers where is_active) as suppliers,
      (select count(*)::int from customers where is_active) as customers,
      (select count(*)::int from purchase_orders) as pos,
      (select count(*)::int from sales_orders) as sos,
      (select count(*)::int from customer_pos where status = 'open') as cpos,
      (select count(*)::int from lots where status = 'active' and current_qty > 0 and quality_state <> 'sano') as retenidos
  `);

  const aging = await sql.query<{
    id: number;
    lot_number: string;
    product_name: string;
    current_qty: string;
    unit: string;
    best_by_date: string | null;
    received_date: string | null;
    unit_cost: string | null;
    quality_state: string;
  }>(`
    select l.id, l.lot_number, p.name as product_name, l.current_qty::text, l.unit,
           l.best_by_date::text, l.received_date::text, l.unit_cost::text,
           coalesce(l.quality_state, 'sano') as quality_state
    from lots l
    join products p on p.id = l.product_id
    where l.status = 'active' and l.current_qty > 0
    order by case when l.quality_state <> 'sano' then 0 else 1 end,
             coalesce(l.best_by_date, '2099-01-01') asc
    limit 8
  `);

  const inventoryValue = await sql.query<{ value: string }>(`
    select coalesce(sum(current_qty * coalesce(unit_cost, 0)), 0)::text as value
    from lots where status = 'active'
  `);

  const moneyRow = await sql.query<{ cxc: string; cxp: string; cash: string }>(`
    select
      (select coalesce(sum(total - paid), 0)::text from invoices where status <> 'cancelled') as cxc,
      (select coalesce(sum(total - paid), 0)::text from supplier_bills where status <> 'cancelled') as cxp,
      (select coalesce(sum(amount), 0)::text from cash_movements) as cash
  `);

  const openSales = await sql.query<{ so_number: string; customer: string; status: string; order_date: string }>(`
    select s.so_number, c.name as customer, s.status, s.order_date::text
    from sales_orders s join customers c on c.id = s.customer_id
    where s.status in ('draft', 'confirmed', 'partial')
    order by s.id desc limit 5
  `);

  const alerts = await sql.query<{ kind: string; title: string; detail: string; href: string }>(`
    select 'cpo' as kind,
           cpo.cpo_number as title,
           (c.name || ' · ' || coalesce(cpo.customer_po_number, 'sin N° cliente') || ' · por convertir') as detail,
           '/cpo' as href
    from customer_pos cpo join customers c on c.id = cpo.customer_id
    where cpo.status = 'open'
    union all
    select 'calidad' as kind,
           l.lot_number as title,
           (p.name || ' · ' || coalesce(l.quality_state, 'retenido')) as detail,
           '/inventario' as href
    from lots l join products p on p.id = l.product_id
    where l.status = 'active' and l.current_qty > 0 and coalesce(l.quality_state, 'sano') <> 'sano'
    union all
    select 'cxc', i.invoice_number,
           (c.name || ' · vence ' || coalesce(i.due_date::text, '—')),
           '/cxc'
    from invoices i join customers c on c.id = i.customer_id
    where i.status <> 'cancelled' and i.total - i.paid > 0.009
      and i.due_date is not null and i.due_date < current_date
    union all
    select 'compra', po.po_number,
           (s.name || ' · pendiente de recepción'),
           '/compras'
    from purchase_orders po join suppliers s on s.id = po.supplier_id
    where po.status in ('confirmed', 'partial', 'draft')
    limit 8
  `);

  return {
    counts: counts ?? { products: 0, lots: 0, suppliers: 0, customers: 0, pos: 0, sos: 0, cpos: 0, retenidos: 0 },
    inventoryValue: n(inventoryValue[0]?.value),
    cxc: n(moneyRow[0]?.cxc),
    cxp: n(moneyRow[0]?.cxp),
    cash: n(moneyRow[0]?.cash),
    aging: aging.map((r) => ({
      ...r,
      current_qty: n(r.current_qty),
      unit_cost: n(r.unit_cost),
    })),
    openSales,
    alerts,
  };
});

export const listProducts = createServerFn({ method: "GET" }).handler(async () => {
  const sql = await getSql();
  const products = await sql.query<{
    id: number;
    sku: string;
    name: string;
    variety: string | null;
    category: string | null;
    default_unit: string;
    is_active: boolean;
  }>(`select id, sku, name, variety, category, default_unit, is_active from products order by name`);
  const packs = await sql.query<{
    id: number;
    product_id: number;
    name: string;
    unit_of_measure: string;
    net_weight: string | null;
    weight_unit: string;
    is_default: boolean;
  }>(`select id, product_id, name, unit_of_measure, net_weight::text, weight_unit, is_default from pack_styles order by id`);
  return products.map((p) => ({
    ...p,
    packs: packs
      .filter((k) => k.product_id === p.id)
      .map((k) => ({ ...k, net_weight: k.net_weight == null ? null : n(k.net_weight) })),
  }));
});

export const createProduct = createServerFn({ method: "POST" })
  .validator(
    z.object({
      sku: z.string().optional(),
      name: z.string().min(1),
      variety: z.string().optional(),
      category: z.string().optional(),
      default_unit: z.string().default("caja"),
      pack_name: z.string().optional(),
      net_weight: z.number().optional(),
    }),
  )
  .handler(async ({ data }) => {
    const sql = await getSql();
    const sku = data.sku?.trim() || (await nextCode(sql, "products", "sku", "SKU-"));
    const rows = await sql.query<{ id: number }>(
      `insert into products (sku, name, variety, category, default_unit)
       values ($1,$2,$3,$4,$5) returning id`,
      [sku, data.name.trim(), data.variety || null, data.category || null, data.default_unit],
    );
    const id = rows[0].id;
    const packName = data.pack_name?.trim() || `Caja ${data.default_unit}`;
    await sql.query(
      `insert into pack_styles (product_id, name, unit_of_measure, net_weight, is_default)
       values ($1,$2,$3,$4,true)`,
      [id, packName, data.default_unit, data.net_weight ?? null],
    );
    return { id, sku };
  });

export const listSuppliers = createServerFn({ method: "GET" }).handler(async () => {
  const sql = await getSql();
  return sql.query<{
    id: number;
    code: string;
    name: string;
    contact_name: string | null;
    phone: string | null;
    city: string | null;
    country: string | null;
    notes: string | null;
    is_active: boolean;
  }>(`select id, code, name, contact_name, phone, city, country, notes, is_active from suppliers order by name`);
});

export const createSupplier = createServerFn({ method: "POST" })
  .validator(
    z.object({
      name: z.string().min(1),
      contact_name: z.string().optional(),
      phone: z.string().optional(),
      city: z.string().optional(),
      country: z.string().optional(),
      notes: z.string().optional(),
    }),
  )
  .handler(async ({ data }) => {
    const sql = await getSql();
    const code = await nextCode(sql, "suppliers", "code", "PRO-");
    const rows = await sql.query<{ id: number }>(
      `insert into suppliers (code, name, contact_name, phone, city, country, notes)
       values ($1,$2,$3,$4,$5,$6,$7) returning id`,
      [code, data.name.trim(), data.contact_name || null, data.phone || null, data.city || null, data.country || null, data.notes || null],
    );
    return { id: rows[0].id, code };
  });

export const listCustomers = createServerFn({ method: "GET" }).handler(async () => {
  const sql = await getSql();
  return sql.query<{
    id: number;
    code: string;
    name: string;
    contact_name: string | null;
    phone: string | null;
    city: string | null;
    payment_terms: string | null;
    notes: string | null;
    is_active: boolean;
  }>(`select id, code, name, contact_name, phone, city, payment_terms, notes, is_active from customers order by name`);
});

export const createCustomer = createServerFn({ method: "POST" })
  .validator(
    z.object({
      name: z.string().min(1),
      contact_name: z.string().optional(),
      phone: z.string().optional(),
      city: z.string().optional(),
      payment_terms: z.string().optional(),
      notes: z.string().optional(),
    }),
  )
  .handler(async ({ data }) => {
    const sql = await getSql();
    const code = await nextCode(sql, "customers", "code", "CLI-");
    const rows = await sql.query<{ id: number }>(
      `insert into customers (code, name, contact_name, phone, city, payment_terms, notes)
       values ($1,$2,$3,$4,$5,$6,$7) returning id`,
      [code, data.name.trim(), data.contact_name || null, data.phone || null, data.city || null, data.payment_terms || null, data.notes || null],
    );
    return { id: rows[0].id, code };
  });

export const listLocations = createServerFn({ method: "GET" }).handler(async () => {
  const sql = await getSql();
  return sql.query<{ id: number; code: string; name: string; location_type: string }>(
    `select id, code, name, location_type from locations where is_active order by id`,
  );
});

export const createLocation = createServerFn({ method: "POST" })
  .validator(z.object({ name: z.string().min(1), location_type: z.string().default("camara") }))
  .handler(async ({ data }) => {
    const sql = await getSql();
    const code = await nextCode(sql, "locations", "code", "UBI-");
    const rows = await sql.query<{ id: number }>(
      `insert into locations (code, name, location_type) values ($1,$2,$3) returning id`,
      [code, data.name.trim(), data.location_type],
    );
    return { id: rows[0].id, code };
  });

export type LotRow = {
  id: number;
  lot_number: string;
  product_id: number;
  product_name: string;
  sku: string;
  supplier_name: string | null;
  pack_name: string | null;
  original_qty: number;
  current_qty: number;
  unit: string;
  unit_cost: number;
  received_date: string | null;
  pack_date: string | null;
  best_by_date: string | null;
  grade: string | null;
  origin_farm: string | null;
  origin_country: string | null;
  status: string;
  quality_state: string;
  quality_note: string | null;
  asignable: boolean;
  locations: { location_id: number; location_name: string; quantity: number }[];
};

export const listLots = createServerFn({ method: "GET" }).handler(async () => {
  const sql = await getSql();
  const lots = await sql.query<{
    id: number;
    lot_number: string;
    product_id: number;
    product_name: string;
    sku: string;
    supplier_name: string | null;
    pack_name: string | null;
    original_qty: string;
    current_qty: string;
    unit: string;
    unit_cost: string | null;
    received_date: string | null;
    pack_date: string | null;
    best_by_date: string | null;
    grade: string | null;
    origin_farm: string | null;
    origin_country: string | null;
    status: string;
    quality_state: string;
    quality_note: string | null;
  }>(`
    select l.id, l.lot_number, l.product_id, p.name as product_name, p.sku,
           s.name as supplier_name, ps.name as pack_name,
           l.original_qty::text, l.current_qty::text, l.unit, l.unit_cost::text,
           l.received_date::text, l.pack_date::text, l.best_by_date::text,
           l.grade, l.origin_farm, l.origin_country, l.status,
           coalesce(l.quality_state, 'sano') as quality_state, l.quality_note
    from lots l
    join products p on p.id = l.product_id
    left join suppliers s on s.id = l.supplier_id
    left join pack_styles ps on ps.id = l.pack_style_id
    order by l.id desc
  `);
  const inv = await sql.query<{ lot_id: number; location_id: number; location_name: string; quantity: string }>(`
    select i.lot_id, i.location_id, loc.name as location_name, i.quantity::text
    from inventory i join locations loc on loc.id = i.location_id
    where i.quantity > 0
  `);
  return lots.map((l) => ({
    ...l,
    original_qty: n(l.original_qty),
    current_qty: n(l.current_qty),
    unit_cost: n(l.unit_cost),
    asignable: l.status === "active" && n(l.current_qty) > 0 && (l.quality_state || "sano") === "sano",
    locations: inv
      .filter((i) => i.lot_id === l.id)
      .map((i) => ({
        location_id: i.location_id,
        location_name: i.location_name,
        quantity: n(i.quantity),
      })),
  })) satisfies LotRow[];
});

export const getLotTrace = createServerFn({ method: "GET" })
  .validator(z.object({ lotId: z.number() }))
  .handler(async ({ data }) => {
    const sql = await getSql();
    const movements = await sql.query<{
      id: number;
      movement_type: string;
      quantity: string;
      unit: string;
      location_name: string | null;
      reference_type: string | null;
      notes: string | null;
      created_at: string;
    }>(
      `
      select m.id, m.movement_type, m.quantity::text, m.unit, loc.name as location_name,
             m.reference_type, m.notes, m.created_at::text
      from inventory_movements m
      left join locations loc on loc.id = m.location_id
      where m.lot_id = $1
      order by m.id
    `,
      [data.lotId],
    );
    const sales = await sql.query<{ so_number: string; customer: string; qty: string; unit_price: string | null }>(
      `
      select so.so_number, c.name as customer, sol.quantity_shipped::text as qty, sol.unit_price::text
      from sales_order_lines sol
      join sales_orders so on so.id = sol.sales_order_id
      join customers c on c.id = so.customer_id
      where sol.lot_id = $1 and sol.quantity_shipped > 0
    `,
      [data.lotId],
    );
    return {
      movements: movements.map((m) => ({ ...m, quantity: n(m.quantity) })),
      sales: sales.map((s) => ({ ...s, qty: n(s.qty), unit_price: n(s.unit_price) })),
    };
  });

export const setLotQuality = createServerFn({ method: "POST" })
  .validator(
    z.object({
      lot_id: z.number(),
      quality_state: z.enum(["sano", "retenido", "castigado", "destruido"]),
      quality_note: z.string().optional(),
    }),
  )
  .handler(async ({ data }) => {
    const sql = await getSql();
    const [lot] = await sql.query<{ id: number; lot_number: string }>(`select id, lot_number from lots where id = $1`, [
      data.lot_id,
    ]);
    if (!lot) throw new Error("Lote no encontrado");
    await sql.query(`update lots set quality_state = $1, quality_note = $2 where id = $3`, [
      data.quality_state,
      data.quality_note?.trim() || null,
      data.lot_id,
    ]);
    return { lot_number: lot.lot_number, quality_state: data.quality_state };
  });

export const listPurchaseOrders = createServerFn({ method: "GET" }).handler(async () => {
  const sql = await getSql();
  const orders = await sql.query<{
    id: number;
    po_number: string;
    supplier_id: number;
    supplier_name: string;
    status: string;
    order_date: string;
    expected_date: string | null;
    notes: string | null;
    sales_order_id: number | null;
    so_number: string | null;
  }>(`
    select po.id, po.po_number, po.supplier_id, s.name as supplier_name, po.status,
           po.order_date::text, po.expected_date::text, po.notes, po.sales_order_id, so.so_number
    from purchase_orders po join suppliers s on s.id = po.supplier_id
    left join sales_orders so on so.id = po.sales_order_id
    order by po.id desc
  `);
  const lines = await sql.query<{
    id: number;
    purchase_order_id: number;
    product_id: number;
    product_name: string;
    pack_style_id: number | null;
    quantity_ordered: string;
    quantity_received: string;
    unit: string;
    unit_cost: string | null;
  }>(`
    select l.id, l.purchase_order_id, l.product_id, p.name as product_name, l.pack_style_id,
           l.quantity_ordered::text, l.quantity_received::text, l.unit, l.unit_cost::text
    from purchase_order_lines l join products p on p.id = l.product_id
  `);
  const recs = await sql.query<{
    id: number;
    purchase_order_id: number;
    received_date: string;
    result: string;
    quantity: string;
    lot_sano: string | null;
    lot_retenido: string | null;
    product_name: string;
    warning: string | null;
  }>(`
    select r.id, r.purchase_order_id, r.received_date::text, rl.result, rl.quantity::text,
           ls.lot_number as lot_sano, lr.lot_number as lot_retenido, p.name as product_name, r.warning
    from receptions r
    join reception_lines rl on rl.reception_id = r.id
    join purchase_order_lines pol on pol.id = rl.purchase_order_line_id
    join products p on p.id = pol.product_id
    left join lots ls on ls.id = rl.lot_sano_id
    left join lots lr on lr.id = rl.lot_retenido_id
    order by r.id
  `);
  const bills = await sql.query<{ purchase_order_id: number; bill_number: string; status: string }>(
    `select purchase_order_id, bill_number, status from supplier_bills where purchase_order_id is not null`,
  );
  return orders.map((o) => ({
    ...o,
    bill: bills.find((b) => b.purchase_order_id === o.id) ?? null,
    receptions: recs
      .filter((r) => r.purchase_order_id === o.id)
      .map((r) => ({ ...r, quantity: n(r.quantity) })),
    lines: lines
      .filter((l) => l.purchase_order_id === o.id)
      .map((l) => ({
        ...l,
        quantity_ordered: n(l.quantity_ordered),
        quantity_received: n(l.quantity_received),
        unit_cost: n(l.unit_cost),
      })),
  }));
});

export const createPurchaseOrder = createServerFn({ method: "POST" })
  .validator(
    z.object({
      supplier_id: z.number(),
      expected_date: z.string().optional(),
      notes: z.string().optional(),
      sales_order_id: z.number().optional(),
      lines: z
        .array(
          z.object({
            product_id: z.number(),
            pack_style_id: z.number().optional(),
            quantity_ordered: z.number().positive(),
            unit: z.string(),
            unit_cost: z.number().optional(),
          }),
        )
        .min(1),
    }),
  )
  .handler(async ({ data }) => {
    const sql = await getSql();
    const po_number = await nextCode(sql, "purchase_orders", "po_number", "OC-");
    const rows = await sql.query<{ id: number }>(
      `insert into purchase_orders (po_number, supplier_id, status, expected_date, notes, sales_order_id)
       values ($1,$2,'confirmed',$3,$4,$5) returning id`,
      [po_number, data.supplier_id, data.expected_date || null, data.notes || null, data.sales_order_id ?? null],
    );
    const id = rows[0].id;
    for (const line of data.lines) {
      await sql.query(
        `insert into purchase_order_lines (purchase_order_id, product_id, pack_style_id, quantity_ordered, unit, unit_cost)
         values ($1,$2,$3,$4,$5,$6)`,
        [id, line.product_id, line.pack_style_id ?? null, line.quantity_ordered, line.unit, line.unit_cost ?? null],
      );
    }
    return { id, po_number };
  });

export const receiveMerchandise = createServerFn({ method: "POST" })
  .validator(
    z.object({
      purchase_order_id: z.number(),
      location_id: z.number(),
      received_date: z.string().optional(),
      inspection_type: z.string().default("Ninguna"),
      inspection_folio: z.string().optional(),
      unloaded: z.boolean().default(true),
      notes: z.string().optional(),
      lines: z
        .array(
          z.object({
            line_id: z.number(),
            result: z.enum(["Aceptada", "Aceptada con incidencia", "Rechazada"]),
            quantity: z.number().positive(),
            affected_qty: z.number().optional(),
            defect_type: z.string().optional(),
            defect_reason: z.string().optional(),
            notes: z.string().optional(),
          }),
        )
        .min(1),
    }),
  )
  .handler(async ({ data }) => {
    const sql = await getSql();
    const [po] = await sql.query<{ id: number; po_number: string; supplier_id: number }>(
      `select id, po_number, supplier_id from purchase_orders where id = $1`,
      [data.purchase_order_id],
    );
    if (!po) throw new Error("Orden de compra no encontrada");

    for (const line of data.lines) {
      if (line.result === "Rechazada" && !line.defect_reason) {
        throw new Error("El rechazo exige un motivo");
      }
      if (line.result === "Aceptada con incidencia") {
        if (!(n(line.affected_qty) > 0)) throw new Error("Captura cuánto viene afectado");
        if (n(line.affected_qty) > line.quantity + 1e-9) throw new Error("Lo afectado no puede ser mayor que lo recibido");
        if (!line.defect_reason) throw new Error("La incidencia exige un motivo");
      }
    }

    const rejectedUnloaded = data.unloaded && data.lines.some((l) => l.result === "Rechazada");
    const warning = rejectedUnloaded
      ? "La carga ya se descargó y hay rechazo. Bajo PACA, documenta fotos, certificado y aviso al vendedor; el rechazo con mercancía descargada no se esconde."
      : null;

    const recRows = await sql.query<{ id: number }>(
      `insert into receptions (purchase_order_id, received_date, inspection_type, inspection_folio, unloaded, notes, warning)
       values ($1,$2,$3,$4,$5,$6,$7) returning id`,
      [
        data.purchase_order_id,
        data.received_date || todayISO(),
        data.inspection_type || "Ninguna",
        data.inspection_folio || null,
        data.unloaded,
        data.notes || null,
        warning,
      ],
    );
    const receptionId = recRows[0].id;
    const created: {
      result: string;
      lot_sano_folio?: string;
      cantidad_sana?: number;
      lot_retenido_folio?: string;
      cantidad_retenida?: number;
    }[] = [];

    for (const recLine of data.lines) {
      const [line] = await sql.query<{
        id: number;
        product_id: number;
        pack_style_id: number | null;
        quantity_ordered: string;
        quantity_received: string;
        unit: string;
        unit_cost: string | null;
      }>(
        `select id, product_id, pack_style_id, quantity_ordered::text, quantity_received::text, unit, unit_cost::text
         from purchase_order_lines where id = $1 and purchase_order_id = $2`,
        [recLine.line_id, data.purchase_order_id],
      );
      if (!line) throw new Error("Línea de compra no encontrada");
      const pending = n(line.quantity_ordered) - n(line.quantity_received);

      let lotSanoId: number | null = null;
      let lotRetId: number | null = null;
      let qtyIntoStock = 0;
      const note = recLine.defect_reason
        ? `${recLine.result} — ${recLine.defect_reason}`
        : recLine.result;

      if (recLine.result === "Rechazada") {
        if (Math.abs(recLine.quantity - pending) > 0.01 && recLine.quantity > pending + 0.0001) {
          throw new Error("El rechazo es por la línea completa pendiente");
        }
        created.push({ result: recLine.result });
      } else if (recLine.result === "Aceptada") {
        if (recLine.quantity > pending + 0.0001) throw new Error("Cantidad mayor a lo pendiente");
        const lot = await insertLot(sql, {
          product_id: line.product_id,
          supplier_id: po.supplier_id,
          pack_style_id: line.pack_style_id,
          qty: recLine.quantity,
          unit: line.unit,
          unit_cost: line.unit_cost,
          location_id: data.location_id,
          quality_state: "sano",
          quality_note: null,
          poId: po.id,
          notes: "Recepción aceptada",
        });
        lotSanoId = lot.lotId;
        qtyIntoStock = recLine.quantity;
        created.push({ result: recLine.result, lot_sano_folio: lot.lot_number, cantidad_sana: recLine.quantity });
      } else {
        if (recLine.quantity > pending + 0.0001) throw new Error("Cantidad mayor a lo pendiente");
        const affected = n(recLine.affected_qty);
        const sanoQty = recLine.quantity - affected;
        if (sanoQty > 0.0001) {
          const lot = await insertLot(sql, {
            product_id: line.product_id,
            supplier_id: po.supplier_id,
            pack_style_id: line.pack_style_id,
            qty: sanoQty,
            unit: line.unit,
            unit_cost: line.unit_cost,
            location_id: data.location_id,
            quality_state: "sano",
            quality_note: null,
            poId: po.id,
            notes: "Parte sana de recepción con incidencia",
          });
          lotSanoId = lot.lotId;
          created.push({
            result: recLine.result,
            lot_sano_folio: lot.lot_number,
            cantidad_sana: sanoQty,
          });
        }
        const ret = await insertLot(sql, {
          product_id: line.product_id,
          supplier_id: po.supplier_id,
          pack_style_id: line.pack_style_id,
          qty: affected,
          unit: line.unit,
          unit_cost: line.unit_cost,
          location_id: data.location_id,
          quality_state: "retenido",
          quality_note: note,
          poId: po.id,
          notes: note,
        });
        lotRetId = ret.lotId;
        const last = created[created.length - 1];
        if (last && last.result === recLine.result && !last.lot_retenido_folio) {
          last.lot_retenido_folio = ret.lot_number;
          last.cantidad_retenida = affected;
        } else {
          created.push({
            result: recLine.result,
            lot_retenido_folio: ret.lot_number,
            cantidad_retenida: affected,
          });
        }
        qtyIntoStock = recLine.quantity;
      }

      await sql.query(
        `insert into reception_lines (reception_id, purchase_order_line_id, result, quantity, affected_qty, defect_type, defect_reason, lot_sano_id, lot_retenido_id, notes)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
        [
          receptionId,
          recLine.line_id,
          recLine.result,
          recLine.result === "Rechazada" ? pending : recLine.quantity,
          recLine.result === "Aceptada con incidencia" ? n(recLine.affected_qty) : null,
          recLine.defect_type || null,
          recLine.defect_reason || null,
          lotSanoId,
          lotRetId,
          recLine.notes || null,
        ],
      );

      if (qtyIntoStock > 0) {
        await sql.query(`update purchase_order_lines set quantity_received = quantity_received + $1 where id = $2`, [
          qtyIntoStock,
          recLine.line_id,
        ]);
      }
    }

    const [pend] = await sql.query<{ pending: string }>(
      `select coalesce(sum(quantity_ordered - quantity_received),0)::text as pending
       from purchase_order_lines where purchase_order_id = $1`,
      [data.purchase_order_id],
    );
    const status = n(pend?.pending) <= 0 ? "completed" : "partial";
    await sql.query(`update purchase_orders set status = $1 where id = $2`, [status, data.purchase_order_id]);

    return { receptionId, status, warning, lineas: created, po_number: po.po_number };
  });

export const listSalesOrders = createServerFn({ method: "GET" }).handler(async () => {
  const sql = await getSql();
  const orders = await sql.query<{
    id: number;
    so_number: string;
    customer_id: number;
    customer_name: string;
    payment_terms: string | null;
    status: string;
    order_date: string;
    ship_date: string | null;
    notes: string | null;
    customer_po_id: number | null;
    cpo_number: string | null;
    customer_po_number: string | null;
  }>(`
    select so.id, so.so_number, so.customer_id, c.name as customer_name, c.payment_terms, so.status,
           so.order_date::text, so.ship_date::text, so.notes, so.customer_po_id,
           cpo.cpo_number, cpo.customer_po_number
    from sales_orders so join customers c on c.id = so.customer_id
    left join customer_pos cpo on cpo.id = so.customer_po_id
    order by so.id desc
  `);
  const lines = await sql.query<{
    id: number;
    sales_order_id: number;
    product_id: number;
    product_name: string;
    lot_id: number | null;
    lot_number: string | null;
    quantity_ordered: string;
    quantity_shipped: string;
    unit: string;
    unit_price: string | null;
    unit_cost: string | null;
  }>(`
    select l.id, l.sales_order_id, l.product_id, p.name as product_name, l.lot_id,
           lots.lot_number, l.quantity_ordered::text, l.quantity_shipped::text, l.unit,
           l.unit_price::text, lots.unit_cost::text
    from sales_order_lines l
    join products p on p.id = l.product_id
    left join lots on lots.id = l.lot_id
  `);
  const invoices = await sql.query<{ sales_order_id: number; invoice_number: string; status: string; id: number }>(
    `select id, sales_order_id, invoice_number, status from invoices where sales_order_id is not null`,
  );
  const purchased = await sql.query<{ sales_order_id: number; product_id: number; qty: string }>(`
    select po.sales_order_id, l.product_id, coalesce(sum(l.quantity_ordered), 0)::text as qty
    from purchase_orders po
    join purchase_order_lines l on l.purchase_order_id = po.id
    where po.sales_order_id is not null
    group by po.sales_order_id, l.product_id
  `);
  const linkedPos = await sql.query<{ id: number; po_number: string; sales_order_id: number }>(
    `select id, po_number, sales_order_id from purchase_orders where sales_order_id is not null`,
  );
  return orders.map((o) => ({
    ...o,
    invoice: invoices.find((i) => i.sales_order_id === o.id) ?? null,
    purchases: linkedPos.filter((p) => p.sales_order_id === o.id),
    lines: lines
      .filter((l) => l.sales_order_id === o.id)
      .map((l) => {
        const required = n(l.quantity_ordered);
        const allocated = n(l.quantity_shipped);
        const bought = n(purchased.find((p) => p.sales_order_id === o.id && p.product_id === l.product_id)?.qty);
        return {
          ...l,
          quantity_ordered: required,
          quantity_shipped: allocated,
          unit_price: n(l.unit_price),
          unit_cost: n(l.unit_cost),
          required,
          allocated,
          purchased: bought,
          open: Math.max(required - allocated, 0),
        };
      }),
  }));
});

export const createSalesOrder = createServerFn({ method: "POST" })
  .validator(
    z.object({
      customer_id: z.number(),
      notes: z.string().optional(),
      customer_po_id: z.number().optional(),
      lines: z
        .array(
          z.object({
            product_id: z.number(),
            lot_id: z.number().optional(),
            quantity_ordered: z.number().positive(),
            unit: z.string(),
            unit_price: z.number().optional(),
          }),
        )
        .min(1),
    }),
  )
  .handler(async ({ data }) => {
    const sql = await getSql();
    const so_number = await nextCode(sql, "sales_orders", "so_number", "OV-");
    const rows = await sql.query<{ id: number }>(
      `insert into sales_orders (so_number, customer_id, status, notes, customer_po_id)
       values ($1,$2,'confirmed',$3,$4) returning id`,
      [so_number, data.customer_id, data.notes || null, data.customer_po_id ?? null],
    );
    const id = rows[0].id;
    for (const line of data.lines) {
      await sql.query(
        `insert into sales_order_lines (sales_order_id, product_id, lot_id, quantity_ordered, unit, unit_price)
         values ($1,$2,$3,$4,$5,$6)`,
        [id, line.product_id, line.lot_id ?? null, line.quantity_ordered, line.unit, line.unit_price ?? null],
      );
    }
    return { id, so_number };
  });

export const listCustomerPOs = createServerFn({ method: "GET" }).handler(async () => {
  const sql = await getSql();
  const orders = await sql.query<{
    id: number;
    cpo_number: string;
    customer_id: number;
    customer_name: string;
    customer_po_number: string | null;
    po_date: string;
    currency: string;
    attachment_url: string | null;
    notes: string | null;
    status: string;
    so_id: number | null;
    so_number: string | null;
  }>(`
    select cpo.id, cpo.cpo_number, cpo.customer_id, c.name as customer_name, cpo.customer_po_number,
           cpo.po_date::text, cpo.currency, cpo.attachment_url, cpo.notes, cpo.status,
           (select so.id from sales_orders so where so.customer_po_id = cpo.id order by so.id desc limit 1) as so_id,
           (select so.so_number from sales_orders so where so.customer_po_id = cpo.id order by so.id desc limit 1) as so_number
    from customer_pos cpo
    join customers c on c.id = cpo.customer_id
    order by cpo.id desc
  `);
  const lines = await sql.query<{
    id: number;
    customer_po_id: number;
    product_id: number;
    product_name: string;
    quantity: string;
    unit: string;
    unit_price: string | null;
    notes: string | null;
  }>(`
    select l.id, l.customer_po_id, l.product_id, p.name as product_name,
           l.quantity::text, l.unit, l.unit_price::text, l.notes
    from customer_po_lines l join products p on p.id = l.product_id
  `);
  return orders.map((o) => ({
    ...o,
    lines: lines
      .filter((l) => l.customer_po_id === o.id)
      .map((l) => ({ ...l, quantity: n(l.quantity), unit_price: n(l.unit_price) })),
  }));
});

export const createCustomerPO = createServerFn({ method: "POST" })
  .validator(
    z.object({
      customer_id: z.number(),
      customer_po_number: z.string().optional(),
      po_date: z.string().optional(),
      currency: z.string().default("USD"),
      attachment_url: z.string().optional(),
      notes: z.string().optional(),
      lines: z
        .array(
          z.object({
            product_id: z.number(),
            quantity: z.number().positive(),
            unit: z.string(),
            unit_price: z.number().optional(),
            notes: z.string().optional(),
          }),
        )
        .min(1),
    }),
  )
  .handler(async ({ data }) => {
    const sql = await getSql();
    const d = new Date();
    const prefix = `CPO-${String(d.getFullYear()).slice(2)}${String(d.getMonth() + 1).padStart(2, "0")}-`;
    const cpo_number = await nextCode(sql, "customer_pos", "cpo_number", prefix);
    const rows = await sql.query<{ id: number }>(
      `insert into customer_pos (cpo_number, customer_id, customer_po_number, po_date, currency, attachment_url, notes, status)
       values ($1,$2,$3,$4,$5,$6,$7,'open') returning id`,
      [
        cpo_number,
        data.customer_id,
        data.customer_po_number?.trim() || null,
        data.po_date || todayISO(),
        data.currency || "USD",
        data.attachment_url?.trim() || null,
        data.notes || null,
      ],
    );
    const id = rows[0].id;
    for (const line of data.lines) {
      await sql.query(
        `insert into customer_po_lines (customer_po_id, product_id, quantity, unit, unit_price, notes)
         values ($1,$2,$3,$4,$5,$6)`,
        [id, line.product_id, line.quantity, line.unit, line.unit_price ?? null, line.notes || null],
      );
    }
    return { id, cpo_number };
  });

export const convertCustomerPOToSO = createServerFn({ method: "POST" })
  .validator(z.object({ customer_po_id: z.number() }))
  .handler(async ({ data }) => {
    const sql = await getSql();
    const [cpo] = await sql.query<{
      id: number;
      cpo_number: string;
      customer_id: number;
      customer_po_number: string | null;
      status: string;
      notes: string | null;
    }>(`select id, cpo_number, customer_id, customer_po_number, status, notes from customer_pos where id = $1`, [
      data.customer_po_id,
    ]);
    if (!cpo) throw new Error("Customer PO no encontrado");
    if (cpo.status === "converted") {
      const [existing] = await sql.query<{ so_number: string }>(
        `select so_number from sales_orders where customer_po_id = $1 order by id desc limit 1`,
        [cpo.id],
      );
      throw new Error(`Este PO ya se convirtió${existing ? ` a ${existing.so_number}` : ""}`);
    }
    if (cpo.status !== "open") throw new Error("Solo se convierten POs abiertos");

    const lines = await sql.query<{
      product_id: number;
      quantity: string;
      unit: string;
      unit_price: string | null;
    }>(`select product_id, quantity::text, unit, unit_price::text from customer_po_lines where customer_po_id = $1`, [
      cpo.id,
    ]);
    if (!lines.length) throw new Error("El Customer PO no tiene líneas");

    const so_number = await nextCode(sql, "sales_orders", "so_number", "OV-");
    const note = [`Desde ${cpo.cpo_number}`, cpo.customer_po_number ? `PO cliente ${cpo.customer_po_number}` : null, cpo.notes]
      .filter(Boolean)
      .join(" · ");
    const rows = await sql.query<{ id: number }>(
      `insert into sales_orders (so_number, customer_id, status, notes, customer_po_id)
       values ($1,$2,'confirmed',$3,$4) returning id`,
      [so_number, cpo.customer_id, note, cpo.id],
    );
    const id = rows[0].id;
    for (const line of lines) {
      await sql.query(
        `insert into sales_order_lines (sales_order_id, product_id, quantity_ordered, unit, unit_price)
         values ($1,$2,$3,$4,$5)`,
        [id, line.product_id, n(line.quantity), line.unit, n(line.unit_price) || null],
      );
    }
    await sql.query(`update customer_pos set status = 'converted' where id = $1`, [cpo.id]);
    return { id, so_number, cpo_number: cpo.cpo_number };
  });

export const createPurchaseFromSO = createServerFn({ method: "POST" })
  .validator(
    z.object({
      sales_order_id: z.number(),
      supplier_id: z.number(),
      unit_cost: z.number().positive(),
      notes: z.string().optional(),
    }),
  )
  .handler(async ({ data }) => {
    const sql = await getSql();
    const [so] = await sql.query<{ id: number; so_number: string }>(
      `select id, so_number from sales_orders where id = $1`,
      [data.sales_order_id],
    );
    if (!so) throw new Error("Orden de venta no encontrada");

    const lines = await sql.query<{
      product_id: number;
      product_name: string;
      quantity_ordered: string;
      unit: string;
    }>(
      `select l.product_id, p.name as product_name, l.quantity_ordered::text, l.unit
       from sales_order_lines l join products p on p.id = l.product_id
       where l.sales_order_id = $1`,
      [data.sales_order_id],
    );
    if (!lines.length) throw new Error("La venta no tiene líneas");

    const bought = await sql.query<{ product_id: number; qty: string }>(
      `select l.product_id, coalesce(sum(l.quantity_ordered),0)::text as qty
       from purchase_orders po
       join purchase_order_lines l on l.purchase_order_id = po.id
       where po.sales_order_id = $1
       group by l.product_id`,
      [data.sales_order_id],
    );

    const toBuy = lines
      .map((l) => {
        const already = n(bought.find((b) => b.product_id === l.product_id)?.qty);
        return { ...l, remaining: n(l.quantity_ordered) - already };
      })
      .filter((l) => l.remaining > 0.0001);
    if (!toBuy.length) throw new Error("Esta venta ya tiene compra por todo lo pedido");

    const po_number = await nextCode(sql, "purchase_orders", "po_number", "OC-");
    const rows = await sql.query<{ id: number }>(
      `insert into purchase_orders (po_number, supplier_id, status, notes, sales_order_id)
       values ($1,$2,'confirmed',$3,$4) returning id`,
      [po_number, data.supplier_id, data.notes || `Generada desde ${so.so_number}`, so.id],
    );
    const id = rows[0].id;
    for (const line of toBuy) {
      const [pack] = await sql.query<{ id: number }>(
        `select id from pack_styles where product_id = $1 order by is_default desc, id limit 1`,
        [line.product_id],
      );
      await sql.query(
        `insert into purchase_order_lines (purchase_order_id, product_id, pack_style_id, quantity_ordered, unit, unit_cost)
         values ($1,$2,$3,$4,$5,$6)`,
        [id, line.product_id, pack?.id ?? null, line.remaining, line.unit, data.unit_cost],
      );
    }
    return { id, po_number, so_number: so.so_number };
  });

export const shipSalesLine = createServerFn({ method: "POST" })
  .validator(
    z.object({
      line_id: z.number(),
      quantity: z.number().positive(),
      lot_id: z.number(),
      location_id: z.number(),
    }),
  )
  .handler(async ({ data }) => {
    const sql = await getSql();
    const [line] = await sql.query<{
      id: number;
      sales_order_id: number;
      product_id: number;
      quantity_ordered: string;
      quantity_shipped: string;
      unit: string;
    }>(`select id, sales_order_id, product_id, quantity_ordered::text, quantity_shipped::text, unit from sales_order_lines where id = $1`, [
      data.line_id,
    ]);
    if (!line) throw new Error("Línea no encontrada");
    const remaining = n(line.quantity_ordered) - n(line.quantity_shipped);
    if (data.quantity > remaining + 0.0001) throw new Error("Cantidad mayor a lo pendiente");

    const [lot] = await sql.query<{ product_id: number; current_qty: string; quality_state: string; lot_number: string }>(
      `select product_id, current_qty::text, coalesce(quality_state, 'sano') as quality_state, lot_number from lots where id = $1`,
      [data.lot_id],
    );
    if (!lot || lot.product_id !== line.product_id) throw new Error("El lote no corresponde al producto");
    if (lot.quality_state !== "sano") {
      throw new Error(
        `No se puede despachar el lote ${lot.lot_number}: está ${lot.quality_state}. Libéralo a Sano en Inventario.`,
      );
    }

    const [inv] = await sql.query<{ quantity: string }>(
      `select quantity::text from inventory where lot_id = $1 and location_id = $2`,
      [data.lot_id, data.location_id],
    );
    if (!inv || n(inv.quantity) < data.quantity) throw new Error("Stock insuficiente en esa ubicación");

    await sql.query(`update inventory set quantity = quantity - $1 where lot_id = $2 and location_id = $3`, [
      data.quantity,
      data.lot_id,
      data.location_id,
    ]);
    await sql.query(
      `update lots set current_qty = current_qty - $1, status = case when current_qty - $1 <= 0 then 'depleted' else status end where id = $2`,
      [data.quantity, data.lot_id],
    );
    await sql.query(
      `insert into inventory_movements (lot_id, location_id, movement_type, quantity, unit, reference_type, reference_id, notes)
       values ($1,$2,'ship',$3,$4,'sales_order',$5,'Despacho de venta')`,
      [data.lot_id, data.location_id, -data.quantity, line.unit, line.sales_order_id],
    );
    await sql.query(`update sales_order_lines set quantity_shipped = quantity_shipped + $1, lot_id = $2 where id = $3`, [
      data.quantity,
      data.lot_id,
      data.line_id,
    ]);

    const [so] = await sql.query<{ pending: string }>(
      `select coalesce(sum(quantity_ordered - quantity_shipped),0)::text as pending from sales_order_lines where sales_order_id = $1`,
      [line.sales_order_id],
    );
    const status = n(so?.pending) <= 0 ? "completed" : "partial";
    await sql.query(`update sales_orders set status = $1, ship_date = coalesce(ship_date, $2) where id = $3`, [
      status,
      todayISO(),
      line.sales_order_id,
    ]);
    return { status };
  });

export const createInvoiceFromSO = createServerFn({ method: "POST" })
  .validator(z.object({ sales_order_id: z.number() }))
  .handler(async ({ data }) => {
    const sql = await getSql();
    const [existing] = await sql.query<{ invoice_number: string }>(
      `select invoice_number from invoices where sales_order_id = $1`,
      [data.sales_order_id],
    );
    if (existing) throw new Error(`Esta venta ya tiene factura ${existing.invoice_number}`);

    const [so] = await sql.query<{
      id: number;
      so_number: string;
      customer_id: number;
      payment_terms: string | null;
      status: string;
    }>(
      `select so.id, so.so_number, so.customer_id, c.payment_terms, so.status
       from sales_orders so join customers c on c.id = so.customer_id where so.id = $1`,
      [data.sales_order_id],
    );
    if (!so) throw new Error("Orden de venta no encontrada");

    const lines = await sql.query<{
      product_id: number;
      product_name: string;
      quantity_ordered: string;
      quantity_shipped: string;
      unit: string;
      unit_price: string | null;
    }>(
      `select l.product_id, p.name as product_name, l.quantity_ordered::text, l.quantity_shipped::text, l.unit, l.unit_price::text
       from sales_order_lines l join products p on p.id = l.product_id where l.sales_order_id = $1`,
      [data.sales_order_id],
    );
    const billable = lines
      .map((l) => ({
        ...l,
        qty: n(l.quantity_shipped) > 0 ? n(l.quantity_shipped) : n(l.quantity_ordered),
        unit_price: n(l.unit_price),
      }))
      .filter((l) => l.qty > 0 && l.unit_price > 0);
    if (!billable.length) throw new Error("No hay líneas con precio para facturar. Despacha o captura precio.");

    const subtotal = billable.reduce((s, l) => s + l.qty * l.unit_price, 0);
    const issue = todayISO();
    const due = addDaysISO(issue, termsDays(so.payment_terms));
    const year = issue.slice(0, 4);
    const invoice_number = await nextCode(sql, "invoices", "invoice_number", `PP-${year}-`, 4);

    const rows = await sql.query<{ id: number }>(
      `insert into invoices (invoice_number, sales_order_id, customer_id, status, issue_date, due_date, subtotal, total, paid, notes)
       values ($1,$2,$3,'open',$4,$5,$6,$6,0,$7) returning id`,
      [invoice_number, so.id, so.customer_id, issue, due, subtotal, `Factura de ${so.so_number}`],
    );
    const id = rows[0].id;
    for (const l of billable) {
      await sql.query(
        `insert into invoice_lines (invoice_id, product_id, description, quantity, unit, unit_price, amount)
         values ($1,$2,$3,$4,$5,$6,$7)`,
        [id, l.product_id, l.product_name, l.qty, l.unit, l.unit_price, l.qty * l.unit_price],
      );
    }
    return { id, invoice_number, total: subtotal, due_date: due };
  });

export const createBillFromPO = createServerFn({ method: "POST" })
  .validator(z.object({ purchase_order_id: z.number() }))
  .handler(async ({ data }) => {
    const sql = await getSql();
    const [existing] = await sql.query<{ bill_number: string }>(
      `select bill_number from supplier_bills where purchase_order_id = $1`,
      [data.purchase_order_id],
    );
    if (existing) throw new Error(`Esta compra ya tiene factura ${existing.bill_number}`);

    const [po] = await sql.query<{ id: number; po_number: string; supplier_id: number }>(
      `select id, po_number, supplier_id from purchase_orders where id = $1`,
      [data.purchase_order_id],
    );
    if (!po) throw new Error("Orden de compra no encontrada");

    const lines = await sql.query<{ quantity_ordered: string; quantity_received: string; unit_cost: string | null }>(
      `select quantity_ordered::text, quantity_received::text, unit_cost::text
       from purchase_order_lines where purchase_order_id = $1`,
      [data.purchase_order_id],
    );
    const ordered = lines.reduce((s, l) => s + n(l.quantity_ordered), 0);
    const received = lines.reduce((s, l) => s + n(l.quantity_received), 0);
    if (received <= 0) throw new Error("Todavía no hay mercancía recibida para facturar al proveedor");
    const total = lines.reduce((s, l) => s + n(l.quantity_received) * n(l.unit_cost), 0);
    const issue = todayISO();
    const bill_number = await nextCode(sql, "supplier_bills", "bill_number", "FAC-");

    const rows = await sql.query<{ id: number }>(
      `insert into supplier_bills (bill_number, purchase_order_id, supplier_id, status, issue_date, due_date, ordered_qty, received_qty, total, paid, notes)
       values ($1,$2,$3,'open',$4,$5,$6,$7,$8,0,$9) returning id`,
      [bill_number, po.id, po.supplier_id, issue, addDaysISO(issue, 7), ordered, received, total, `Factura de ${po.po_number}`],
    );
    return { id: rows[0].id, bill_number, total, ordered, received };
  });

export const listInvoices = createServerFn({ method: "GET" }).handler(async () => {
  const sql = await getSql();
  const invoices = await sql.query<{
    id: number;
    invoice_number: string;
    sales_order_id: number | null;
    so_number: string | null;
    customer_id: number;
    customer_name: string;
    status: string;
    issue_date: string;
    due_date: string | null;
    subtotal: string;
    total: string;
    paid: string;
    notes: string | null;
  }>(`
    select i.id, i.invoice_number, i.sales_order_id, so.so_number, i.customer_id, c.name as customer_name,
           i.status, i.issue_date::text, i.due_date::text, i.subtotal::text, i.total::text, i.paid::text, i.notes
    from invoices i
    join customers c on c.id = i.customer_id
    left join sales_orders so on so.id = i.sales_order_id
    order by i.id desc
  `);
  const lines = await sql.query<{
    invoice_id: number;
    description: string | null;
    quantity: string;
    unit: string | null;
    unit_price: string | null;
    amount: string;
  }>(`select invoice_id, description, quantity::text, unit, unit_price::text, amount::text from invoice_lines`);
  return invoices.map((i) => {
    const total = n(i.total);
    const paid = n(i.paid);
    const saldo = Math.max(total - paid, 0);
    const days = i.due_date ? Math.round((Date.now() - new Date(`${i.due_date}T12:00:00`).getTime()) / 86400000) : 0;
    return {
      ...i,
      subtotal: n(i.subtotal),
      total,
      paid,
      saldo,
      overdue: saldo > 0.009 && !!i.due_date && days > 0,
      days_overdue: saldo > 0.009 && days > 0 ? days : 0,
      lines: lines
        .filter((l) => l.invoice_id === i.id)
        .map((l) => ({
          ...l,
          quantity: n(l.quantity),
          unit_price: n(l.unit_price),
          amount: n(l.amount),
        })),
    };
  });
});

export const listBills = createServerFn({ method: "GET" }).handler(async () => {
  const sql = await getSql();
  const bills = await sql.query<{
    id: number;
    bill_number: string;
    purchase_order_id: number | null;
    po_number: string | null;
    supplier_id: number;
    supplier_name: string;
    status: string;
    issue_date: string;
    due_date: string | null;
    ordered_qty: string;
    received_qty: string;
    total: string;
    paid: string;
    notes: string | null;
  }>(`
    select b.id, b.bill_number, b.purchase_order_id, po.po_number, b.supplier_id, s.name as supplier_name,
           b.status, b.issue_date::text, b.due_date::text, b.ordered_qty::text, b.received_qty::text,
           b.total::text, b.paid::text, b.notes
    from supplier_bills b
    join suppliers s on s.id = b.supplier_id
    left join purchase_orders po on po.id = b.purchase_order_id
    order by b.id desc
  `);
  return bills.map((b) => {
    const total = n(b.total);
    const paid = n(b.paid);
    const ordered = n(b.ordered_qty);
    const received = n(b.received_qty);
    return {
      ...b,
      ordered_qty: ordered,
      received_qty: received,
      total,
      paid,
      saldo: Math.max(total - paid, 0),
      match:
        Math.abs(ordered - received) < 0.01
          ? "cuadrado"
          : received < ordered
            ? "faltante"
            : "de más",
    };
  });
});

export const listCash = createServerFn({ method: "GET" }).handler(async () => {
  const sql = await getSql();
  const rows = await sql.query<{
    id: number;
    folio: string;
    mov_date: string;
    kind: string;
    counterparty: string | null;
    invoice_number: string | null;
    bill_number: string | null;
    amount: string;
    notes: string | null;
  }>(`
    select m.id, m.folio, m.mov_date::text, m.kind, m.counterparty,
           i.invoice_number, b.bill_number, m.amount::text, m.notes
    from cash_movements m
    left join invoices i on i.id = m.invoice_id
    left join supplier_bills b on b.id = m.supplier_bill_id
    order by m.mov_date desc, m.id desc
  `);
  const movements = rows.map((r) => ({ ...r, amount: n(r.amount) }));
  const balance = movements.reduce((s, m) => s + m.amount, 0);
  return { balance, movements };
});

export const registerCobro = createServerFn({ method: "POST" })
  .validator(z.object({ invoice_id: z.number(), amount: z.number().positive(), notes: z.string().optional() }))
  .handler(async ({ data }) => {
    const sql = await getSql();
    const [inv] = await sql.query<{
      id: number;
      invoice_number: string;
      customer_name: string;
      total: string;
      paid: string;
    }>(
      `select i.id, i.invoice_number, c.name as customer_name, i.total::text, i.paid::text
       from invoices i join customers c on c.id = i.customer_id where i.id = $1`,
      [data.invoice_id],
    );
    if (!inv) throw new Error("Factura no encontrada");
    const remaining = n(inv.total) - n(inv.paid);
    if (data.amount > remaining + 0.009) throw new Error(`El saldo de ${inv.invoice_number} es ${remaining.toFixed(2)}`);
    const paid = n(inv.paid) + data.amount;
    const status = moneyStatus(n(inv.total), paid);
    await sql.query(`update invoices set paid = $1, status = $2 where id = $3`, [paid, status, inv.id]);
    const folio = await nextCode(sql, "cash_movements", "folio", "MOV-");
    await sql.query(
      `insert into cash_movements (folio, mov_date, kind, counterparty, invoice_id, amount, notes)
       values ($1,$2,'cobro',$3,$4,$5,$6)`,
      [folio, todayISO(), inv.customer_name, inv.id, data.amount, data.notes || `Cobro ${inv.invoice_number}`],
    );
    return { folio, paid, status, remaining: n(inv.total) - paid };
  });

export const registerPago = createServerFn({ method: "POST" })
  .validator(z.object({ bill_id: z.number(), amount: z.number().positive(), notes: z.string().optional() }))
  .handler(async ({ data }) => {
    const sql = await getSql();
    const [bill] = await sql.query<{
      id: number;
      bill_number: string;
      supplier_name: string;
      total: string;
      paid: string;
    }>(
      `select b.id, b.bill_number, s.name as supplier_name, b.total::text, b.paid::text
       from supplier_bills b join suppliers s on s.id = b.supplier_id where b.id = $1`,
      [data.bill_id],
    );
    if (!bill) throw new Error("Factura de proveedor no encontrada");
    const remaining = n(bill.total) - n(bill.paid);
    if (data.amount > remaining + 0.009) throw new Error(`El saldo de ${bill.bill_number} es ${remaining.toFixed(2)}`);
    const paid = n(bill.paid) + data.amount;
    const status = moneyStatus(n(bill.total), paid);
    await sql.query(`update supplier_bills set paid = $1, status = $2 where id = $3`, [paid, status, bill.id]);
    const folio = await nextCode(sql, "cash_movements", "folio", "MOV-");
    await sql.query(
      `insert into cash_movements (folio, mov_date, kind, counterparty, supplier_bill_id, amount, notes)
       values ($1,$2,'pago',$3,$4,$5,$6)`,
      [folio, todayISO(), bill.supplier_name, bill.id, -data.amount, data.notes || `Pago ${bill.bill_number}`],
    );
    return { folio, paid, status, remaining: n(bill.total) - paid };
  });

export type PrintParty = { name: string; lines: string[] };
export type PrintLine = {
  sku: string;
  description: string;
  qty: number;
  unit: string;
  unit_price: number;
  amount: number;
};
export type PrintDoc = {
  tipo: "factura" | "oc" | "ov";
  kindLabel: string;
  number: string;
  date: string;
  due: string | null;
  terms: string | null;
  reference: string | null;
  partyTitle: string;
  party: PrintParty;
  shipTitle: string | null;
  ship: PrintParty | null;
  lines: PrintLine[];
  subtotal: number;
  total: number;
  notes: string | null;
  showPaca: boolean;
};

function partyOf(row: {
  name: string;
  contact_name?: string | null;
  phone?: string | null;
  city?: string | null;
  country?: string | null;
}): PrintParty {
  const loc = [row.city, row.country].filter(Boolean).join(", ");
  return {
    name: row.name,
    lines: [row.contact_name, loc, row.phone].filter((x): x is string => Boolean(x && x.trim())),
  };
}

export const getPrintDoc = createServerFn({ method: "GET" })
  .validator(z.object({ tipo: z.enum(["factura", "oc", "ov"]), id: z.coerce.number() }))
  .handler(async ({ data }): Promise<PrintDoc> => {
    const sql = await getSql();

    if (data.tipo === "factura") {
      const [inv] = await sql.query<{
        invoice_number: string;
        issue_date: string;
        due_date: string | null;
        subtotal: string;
        total: string;
        notes: string | null;
        so_number: string | null;
        customer_name: string;
        contact_name: string | null;
        phone: string | null;
        city: string | null;
        payment_terms: string | null;
      }>(
        `select i.invoice_number, i.issue_date::text, i.due_date::text, i.subtotal::text, i.total::text, i.notes,
                so.so_number, c.name as customer_name, c.contact_name, c.phone, c.city, c.payment_terms
         from invoices i
         join customers c on c.id = i.customer_id
         left join sales_orders so on so.id = i.sales_order_id
         where i.id = $1`,
        [data.id],
      );
      if (!inv) throw new Error("Factura no encontrada");
      const raw = await sql.query<{
        description: string | null;
        quantity: string;
        unit: string | null;
        unit_price: string | null;
        amount: string;
        sku: string | null;
      }>(
        `select il.description, il.quantity::text, il.unit, il.unit_price::text, il.amount::text, p.sku
         from invoice_lines il left join products p on p.id = il.product_id
         where il.invoice_id = $1 order by il.id`,
        [data.id],
      );
      const lines = raw.map((l) => ({
        sku: l.sku || "",
        description: l.description || "",
        qty: n(l.quantity),
        unit: l.unit || "",
        unit_price: n(l.unit_price),
        amount: n(l.amount),
      }));
      const party = partyOf({
        name: inv.customer_name,
        contact_name: inv.contact_name,
        phone: inv.phone,
        city: inv.city,
      });
      return {
        tipo: "factura",
        kindLabel: "Invoice",
        number: inv.invoice_number,
        date: inv.issue_date,
        due: inv.due_date,
        terms: inv.payment_terms,
        reference: inv.so_number,
        partyTitle: "Bill to",
        party,
        shipTitle: "Ship to",
        ship: party,
        lines,
        subtotal: n(inv.subtotal),
        total: n(inv.total),
        notes: inv.notes,
        showPaca: true,
      };
    }

    if (data.tipo === "oc") {
      const [po] = await sql.query<{
        po_number: string;
        order_date: string;
        expected_date: string | null;
        notes: string | null;
        supplier_name: string;
        contact_name: string | null;
        phone: string | null;
        city: string | null;
        country: string | null;
      }>(
        `select po.po_number, po.order_date::text, po.expected_date::text, po.notes,
                s.name as supplier_name, s.contact_name, s.phone, s.city, s.country
         from purchase_orders po join suppliers s on s.id = po.supplier_id
         where po.id = $1`,
        [data.id],
      );
      if (!po) throw new Error("Orden de compra no encontrada");
      const raw = await sql.query<{
        product_name: string;
        sku: string | null;
        quantity_ordered: string;
        unit: string;
        unit_cost: string | null;
      }>(
        `select p.name as product_name, p.sku, l.quantity_ordered::text, l.unit, l.unit_cost::text
         from purchase_order_lines l join products p on p.id = l.product_id
         where l.purchase_order_id = $1 order by l.id`,
        [data.id],
      );
      const lines = raw.map((l) => ({
        sku: l.sku || "",
        description: l.product_name,
        qty: n(l.quantity_ordered),
        unit: l.unit,
        unit_price: n(l.unit_cost),
        amount: n(l.quantity_ordered) * n(l.unit_cost),
      }));
      const subtotal = lines.reduce((s, l) => s + l.amount, 0);
      return {
        tipo: "oc",
        kindLabel: "Purchase Order",
        number: po.po_number,
        date: po.order_date,
        due: po.expected_date,
        terms: null,
        reference: null,
        partyTitle: "Vendor",
        party: partyOf({
          name: po.supplier_name,
          contact_name: po.contact_name,
          phone: po.phone,
          city: po.city,
          country: po.country,
        }),
        shipTitle: "Ship to",
        ship: { name: "Plein Produce LLC", lines: ["Nogales, Arizona", "USA"] },
        lines,
        subtotal,
        total: subtotal,
        notes: po.notes,
        showPaca: false,
      };
    }

    const [so] = await sql.query<{
      so_number: string;
      order_date: string;
      ship_date: string | null;
      notes: string | null;
      payment_terms: string | null;
      customer_name: string;
      contact_name: string | null;
      phone: string | null;
      city: string | null;
    }>(
      `select so.so_number, so.order_date::text, so.ship_date::text, so.notes, c.payment_terms,
              c.name as customer_name, c.contact_name, c.phone, c.city
       from sales_orders so join customers c on c.id = so.customer_id
       where so.id = $1`,
      [data.id],
    );
    if (!so) throw new Error("Orden de venta no encontrada");
    const raw = await sql.query<{
      product_name: string;
      sku: string | null;
      quantity_ordered: string;
      unit: string;
      unit_price: string | null;
    }>(
      `select p.name as product_name, p.sku, l.quantity_ordered::text, l.unit, l.unit_price::text
       from sales_order_lines l join products p on p.id = l.product_id
       where l.sales_order_id = $1 order by l.id`,
      [data.id],
    );
    const lines = raw.map((l) => ({
      sku: l.sku || "",
      description: l.product_name,
      qty: n(l.quantity_ordered),
      unit: l.unit,
      unit_price: n(l.unit_price),
      amount: n(l.quantity_ordered) * n(l.unit_price),
    }));
    const subtotal = lines.reduce((s, l) => s + l.amount, 0);
    const party = partyOf({
      name: so.customer_name,
      contact_name: so.contact_name,
      phone: so.phone,
      city: so.city,
    });
    return {
      tipo: "ov",
      kindLabel: "Sales Order",
      number: so.so_number,
      date: so.order_date,
      due: so.ship_date,
      terms: so.payment_terms,
      reference: null,
      partyTitle: "Bill to",
      party,
      shipTitle: "Ship to",
      ship: party,
      lines,
      subtotal,
      total: subtotal,
      notes: so.notes,
      showPaca: false,
    };
  });
