import { createServerFn } from "@tanstack/react-start";
import { authMiddleware, moduleMiddleware } from "@/lib/auth/middleware";
import { z } from "zod";
import { getSql as getSqlDb } from "@/lib/db";
import { COMPANY } from "@/lib/company";
import { addDaysISO, num, skuCodeOf, termsDays, todayISO } from "@/lib/utils";

// Intentionally `Promise<any>`, not `Promise<Sql>` — every one of this file's
// ~150 `sql.query(...)` calls would need an explicit row-shape generic before
// that's honest (tried it: 823 new errors, mostly in the route files that
// infer their prop types from this file's returns). That's real work for a
// dedicated session, not a side effect of removing `@ts-nocheck` from here.
async function getSql(): Promise<any> {
  return getSqlDb();
}

export type CompanyProfile = {
  legal_name: string;
  short_name: string;
  tagline: string;
  city: string;
  country: string;
  email: string | null;
  phone: string | null;
  address_line: string | null;
  paca_license: string | null;
  paca_notice: string | null;
};

export type PrintParty = { name: string; lines: string[]; phone?: string | null; email?: string | null };
export type PrintLine = {
  sku: string;
  description: string;
  qty: number;
  unit: string;
  unit_price: number;
  amount: number;
};
export type PrintDoc = {
  id: number;
  tipo: "factura" | "oc" | "ov" | "cuenta";
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
  company: CompanyProfile;
};

export type LotRow = {
  id: number;
  lot_number: string;
  product_id: number;
  product_name: string;
  sku: string;
  supplier_name: string | null;
  pack_name: string | null;
  pack_style_id: number | null;
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
  purchase_order_id: number | null;
  po_number: string | null;
  held: boolean;
  closed_at: string | null;
  waste_qty: number;
  rts_qty: number;
  pallets: number;
  sold_qty: number;
  revenue: number;
  asignable: boolean;
  locations: { location_id: number; location_name: string; quantity: number }[];
};

export type PayableRow = {
  kind: "expense" | "po";
  id: number;
  number: string;
  category?: string;
  supplier_id: number;
  supplier_name: string;
  invoice_number?: string | null;
  issue_date: string;
  due_date?: string | null;
  amount: number;
  paid: number;
  saldo: number;
  status: string;
  po_number?: string | null;
  po_id?: number | null;
  notes?: string | null;
};

function n(v) {
	return num(v);
}
async function nextCode(sql, table, column, prefix, pad = 3) {
	const match = ((await sql.query(`select ${column} as c from ${table} where ${column} like $1 order by id desc limit 1`, [`${prefix}%`]))[0]?.c ?? "").match(/(\d+)$/);
	const next = (match ? Number(match[1]) : 0) + 1;
	return `${prefix}${String(next).padStart(pad, "0")}`;
}
function lotPrefix() {
	const d = /* @__PURE__ */ new Date();
	return `LOT-${String(d.getFullYear()).slice(2)}${String(d.getMonth() + 1).padStart(2, "0")}-`;
}
function moneyStatus(total, paid) {
	if (paid >= total - .009) return "paid";
	if (paid > .009) return "partial";
	return "open";
}
function poShortNum(poNumber) {
	const m = poNumber.match(/(\d+)(?!.*\d)/);
	return m ? String(Number(m[1])) : poNumber.replace(/^OC-/, "");
}
async function nextLotNumber(sql, poId, productId) {
	const [po] = await sql.query(`select po_number from purchase_orders where id = $1`, [poId]);
	const [prod] = await sql.query(`select sku from products where id = $1`, [productId]);
	if (!po) return nextCode(sql, "lots", "lot_number", lotPrefix());
	const stem = `${poShortNum(po.po_number)}-${(prod?.sku.split("-")[0] || "LOT").slice(0, 3).toUpperCase()}-`;
	const [last] = await sql.query(`select lot_number as c from lots where lot_number like $1 order by id desc limit 1`, [`${stem}%`]);
	return `${stem}${last?.c ? Number(last.c.match(/(\d+)$/)?.[1] || 0) + 1 : 1}`;
}
async function insertLot(sql, args) {
	const lot_number = await nextLotNumber(sql, args.poId, args.product_id);
	const today = todayISO();
	const lotId = (await sql.query(`insert into lots (lot_number, product_id, supplier_id, pack_style_id, purchase_order_id, purchase_order_line_id,
                       original_qty, current_qty, unit, unit_cost, received_date, pack_date, quality_state, quality_note,
                       grade, origin_country, status, pallets)
     values ($1,$2,$3,$4,$5,$6,$7,$7,$8,$9,$10,$10,$11,$12,$13,'México','active',$14) returning id`, [
		lot_number,
		args.product_id,
		args.supplier_id,
		args.pack_style_id,
		args.poId,
		args.poLineId ?? null,
		args.qty,
		args.unit,
		args.unit_cost,
		today,
		args.quality_state,
		args.quality_note,
		args.grade ?? null,
		args.pallets ?? null
	]))[0].id;
	await sql.query(`insert into inventory (lot_id, location_id, quantity) values ($1,$2,$3)
     on conflict (lot_id, location_id) do update set quantity = inventory.quantity + excluded.quantity`, [
		lotId,
		args.location_id,
		args.qty
	]);
	await sql.query(`insert into inventory_movements (lot_id, location_id, movement_type, quantity, unit, reference_type, reference_id, notes)
     values ($1,$2,'receive',$3,$4,'purchase_order',$5,$6)`, [
		lotId,
		args.location_id,
		args.qty,
		args.unit,
		args.poId,
		args.notes ?? "Recepción PACA"
	]);
	return {
		lotId,
		lot_number
	};
}
function fallbackCompany() {
	return {
		legal_name: COMPANY.legalName,
		short_name: COMPANY.shortName,
		tagline: COMPANY.tagline,
		city: COMPANY.city,
		country: COMPANY.country,
		email: COMPANY.email,
		phone: COMPANY.phone,
		address_line: COMPANY.addressLine,
		paca_license: COMPANY.pacaLicense,
		paca_notice: COMPANY.pacaNotice
	};
}
async function loadCompany(sql) {
	try {
		const [row] = await sql.query(`select legal_name, short_name, tagline, city, country, email, phone, address_line, paca_license, paca_notice from company_profile where id = 1`);
		if (!row) return fallbackCompany();
		return {
			...row,
			paca_notice: row.paca_notice || COMPANY.pacaNotice
		};
	} catch {
		return fallbackCompany();
	}
}
var ALL_MODULES = [
	"orders",
	"warehouse",
	"contacts",
	"finance",
	"reports",
	"settings"
];
var ROLE_MODULE_MAP = {
	admin: ALL_MODULES,
	seller: [
		"orders",
		"contacts",
		"reports"
	],
	buyer: [
		"orders",
		"warehouse",
		"contacts"
	],
	warehouse: ["warehouse", "orders"]
};
function parseModules(raw) {
	if (Array.isArray(raw)) return raw.filter((x) => typeof x === "string");
	if (typeof raw !== "string" || !raw) return [];
	try {
		const v = JSON.parse(raw);
		return Array.isArray(v) ? v.filter((x) => typeof x === "string") : [];
	} catch {
		return [];
	}
}
function mapStaff(row) {
	const modules = row.role === "admin" ? ALL_MODULES : parseModules(row.modules);
	return {
		...row,
		modules
	};
}
async function readStaff(sql, where, params) {
	const [row] = await sql.query(`select id, user_id, name, email, role, coalesce(status, 'pending') as status, coalesce(modules::text, '[]') as modules
     from staff where ${where} limit 1`, params);
	return row ? mapStaff(row) : null;
}
async function assertAdmin(sql, userId) {
	const s = await readStaff(sql, "user_id = $1", [userId]);
	if (!s || s.role !== "admin" || s.status !== "active") throw new Error("Admin only");
	return s;
}
async function authIdentity(sql, userId) {
	const [row] = await sql.query(`select email, name from "user" where id = $1`, [userId]);
	return {
		email: row?.email?.trim().toLowerCase() || null,
		name: row?.name?.trim() || null
	};
}

// ---- Cancel / audit helpers (Sesión 2 — Poder equivocarse) ----------------

/** Display name for the "cancelled_by" trail — falls back to email, then the raw id. */
async function staffNameFor(sql, userId) {
	const [row] = await sql.query(`select coalesce(s.name, u.email, $1) as name
       from "user" u left join staff s on s.user_id = u.id where u.id = $1`, [userId]);
	return row?.name || "Unknown";
}

/** Folios of the live (non-cancelled) cash movements paying an invoice or bill — for error messages. */
async function findPaymentFolios(sql, kind, id) {
	if (kind === "invoice") {
		const direct = await sql.query(`select folio from cash_movements where invoice_id = $1 and cancelled_at is null`, [id]);
		const applied = await sql.query(`select cm.folio from payment_applications pa join cash_movements cm on cm.id = pa.cash_movement_id
         where pa.target_kind = 'invoice' and pa.target_id = $1 and cm.cancelled_at is null`, [id]);
		return [...new Set([...direct, ...applied].map((r) => r.folio))];
	}
	if (kind === "bill") {
		const rows = await sql.query(`select folio from cash_movements where supplier_bill_id = $1 and cancelled_at is null`, [id]);
		return [...new Set(rows.map((r) => r.folio))];
	}
	return [];
}

/** Reverses whatever a cash movement paid — direct invoice/bill/expense link, or payment_applications rows — and unmatches any reconciled bank line. */
async function reverseCashMovementEffects(sql, mov) {
	const apps = await sql.query(`select target_kind, target_id, amount::text from payment_applications where cash_movement_id = $1`, [mov.id]);
	if (apps.length) {
		for (const a of apps) {
			const amt = n(a.amount);
			if (a.target_kind === "invoice") {
				const [inv] = await sql.query(`select total::text, paid::text from invoices where id = $1`, [a.target_id]);
				if (inv) {
					const paid = Math.max(n(inv.paid) - amt, 0);
					await sql.query(`update invoices set paid=$1, status=$2 where id=$3`, [paid, moneyStatus(Math.abs(n(inv.total)), paid), a.target_id]);
				}
			} else if (a.target_kind === "po") {
				await sql.query(`update purchase_orders set paid = greatest(coalesce(paid,0) - $1, 0) where id = $2`, [amt, a.target_id]);
			} else if (a.target_kind === "expense") {
				const [exp] = await sql.query(`select amount::text, paid::text from expenses where id = $1`, [a.target_id]);
				if (exp) {
					const paid = Math.max(n(exp.paid) - amt, 0);
					await sql.query(`update expenses set paid=$1, status=$2 where id=$3`, [paid, moneyStatus(n(exp.amount), paid), a.target_id]);
				}
			}
		}
	} else {
		const amt = Math.abs(n(mov.amount));
		if (mov.invoice_id) {
			const [inv] = await sql.query(`select total::text, paid::text from invoices where id = $1`, [mov.invoice_id]);
			if (inv) {
				const paid = Math.max(n(inv.paid) - amt, 0);
				await sql.query(`update invoices set paid=$1, status=$2 where id=$3`, [paid, moneyStatus(Math.abs(n(inv.total)), paid), mov.invoice_id]);
			}
		}
		if (mov.supplier_bill_id) {
			const [bill] = await sql.query(`select total::text, paid::text from supplier_bills where id = $1`, [mov.supplier_bill_id]);
			if (bill) {
				const paid = Math.max(n(bill.paid) - amt, 0);
				await sql.query(`update supplier_bills set paid=$1, status=$2 where id=$3`, [paid, moneyStatus(n(bill.total), paid), mov.supplier_bill_id]);
			}
		}
		if (mov.expense_id) {
			const [exp] = await sql.query(`select amount::text, paid::text from expenses where id = $1`, [mov.expense_id]);
			if (exp) {
				const paid = Math.max(n(exp.paid) - amt, 0);
				await sql.query(`update expenses set paid=$1, status=$2 where id=$3`, [paid, moneyStatus(n(exp.amount), paid), mov.expense_id]);
			}
		}
	}
	await sql.query(`update bank_lines set cash_movement_id = null, status = 'open' where cash_movement_id = $1`, [mov.id]);
}

async function cancelCashMovementById(sql, context, id, expectedKind, reason) {
	const [mov] = await sql.query(`select id, folio, kind, invoice_id, supplier_bill_id, expense_id, amount::text, cancelled_at
       from cash_movements where id = $1`, [id]);
	if (!mov) throw new Error("Movimiento no encontrado");
	if (mov.folio === "CORTE-CHASE") throw new Error("Es el saldo de apertura de Chase (CORTE-CHASE) — no se puede cancelar");
	if (mov.cancelled_at) throw new Error(`El movimiento ${mov.folio} ya está cancelado`);
	if (mov.kind !== expectedKind) throw new Error(`El movimiento ${mov.folio} no es un ${expectedKind === "cobro" ? "cobro de cliente" : "pago a proveedor"}`);
	await reverseCashMovementEffects(sql, mov);
	const staffName = await staffNameFor(sql, context.userId);
	await sql.query(`update cash_movements set cancelled_at = now(), cancelled_by = $1, cancel_reason = $2 where id = $3`, [staffName, reason || null, id]);
	return { folio: mov.folio };
}
export const getDashboard = createServerFn({ method: "GET" }).middleware([authMiddleware]).handler(async () => {
	const empty = {
		counts: {
			products: 0,
			lots: 0,
			suppliers: 0,
			customers: 0,
			pos: 0,
			sos: 0,
			cpos: 0,
			retenidos: 0
		},
		inventoryValue: 0,
		cxc: 0,
		cxp: 0,
		cash: 0,
		corte: null,
		aging: [],
		openSales: [],
		alerts: []
	};
	try {
		const sql = await getSql();
		const one = async (q) => n((await sql.query(q))[0]?.c);
		const products = await one(`select count(*)::text as c from products where is_active`);
		const lots = await one(`select count(*)::text as c from lots where status = 'active'`);
		const suppliers = await one(`select count(*)::text as c from suppliers where is_active`);
		const customers = await one(`select count(*)::text as c from customers where is_active`);
		const pos = await one(`select count(*)::text as c from purchase_orders`);
		const sos = await one(`select count(*)::text as c from sales_orders`);
		const cpos = await one(`select count(*)::text as c from customer_pos where status = 'open'`);
		const retenidos = await one(`select count(*)::text as c from lots where status = 'active' and current_qty > 0 and quality_state <> 'sano'`);
		const inventoryValue = await one(`select coalesce(sum(current_qty * coalesce(unit_cost, 0)), 0)::text as c from lots where status = 'active'`);
		const cxc = await one(`select coalesce(sum(total - paid), 0)::text as c from invoices where status <> 'cancelled'`);
		const cxp = await one(`select coalesce(sum(total - paid), 0)::text as c from supplier_bills where status <> 'cancelled'`);
		const cash = await one(`select coalesce(sum(amount), 0)::text as c from cash_movements where cancelled_at is null`);
		const corteRows = await sql.query(`select key, value from app_settings where key in ('corte_as_of','chase_opening','jeams_opening')`);
		const corteMap = Object.fromEntries(corteRows.map((r) => [r.key, r.value]));
		const corte = corteMap.corte_as_of ? {
			as_of: corteMap.corte_as_of,
			chase: n(corteMap.chase_opening),
			jeams: n(corteMap.jeams_opening)
		} : null;
		const aging = await sql.query(`
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
		const openSales = await sql.query(`
    select s.so_number, c.name as customer, s.status, s.order_date::text
    from sales_orders s join customers c on c.id = s.customer_id
    where s.status in ('draft', 'confirmed', 'partial')
    order by s.id desc limit 5
  `);
		const alertsCpo = await sql.query(`
    select 'cpo' as kind, cpo.cpo_number as title,
           (c.name || ' · ' || coalesce(cpo.customer_po_number, 'no customer #') || ' · to convert') as detail,
           '/cpo' as href
    from customer_pos cpo join customers c on c.id = cpo.customer_id
    where cpo.status = 'open' limit 4
  `);
		const alertsCal = await sql.query(`
    select 'calidad' as kind, l.lot_number as title,
           (p.name || ' · ' || coalesce(l.quality_state, 'hold')) as detail,
           '/inventario' as href
    from lots l join products p on p.id = l.product_id
    where l.status = 'active' and l.current_qty > 0 and coalesce(l.quality_state, 'sano') <> 'sano'
    limit 4
  `);
		const alertsCxc = await sql.query(`
    select 'cxc' as kind, i.invoice_number as title,
           (c.name || ' · due ' || coalesce(i.due_date::text, '—')) as detail,
           '/cxc' as href
    from invoices i join customers c on c.id = i.customer_id
    where i.status <> 'cancelled' and i.total - i.paid > 0.009
      and i.due_date is not null and i.due_date < current_date
    limit 4
  `);
		const alertsPo = await sql.query(`
    select 'compra' as kind, po.po_number as title,
           (s.name || ' · pending receive') as detail,
           '/compras' as href
    from purchase_orders po join suppliers s on s.id = po.supplier_id
    where po.status in ('confirmed', 'partial', 'draft')
    limit 4
  `);
		return {
			counts: {
				products,
				lots,
				suppliers,
				customers,
				pos,
				sos,
				cpos,
				retenidos
			},
			inventoryValue,
			cxc,
			cxp,
			cash,
			corte,
			aging: aging.map((r) => ({
				...r,
				current_qty: n(r.current_qty),
				unit_cost: n(r.unit_cost)
			})),
			openSales,
			alerts: [
				...alertsCpo,
				...alertsCal,
				...alertsCxc,
				...alertsPo
			].slice(0, 8)
		};
	} catch (err) {
		console.error("[getDashboard]", err);
		return empty;
	}
});
export const listProducts = createServerFn({ method: "GET" }).middleware([authMiddleware]).handler(async () => {
	const sql = await getSql();
	const products = await sql.query(`select id, sku, name, variety, category, default_unit, is_active from products order by name`);
	const packs = await sql.query(`select id, product_id, name, unit_of_measure, net_weight::text, weight_unit, is_default,
           sku_code, empaque, calibre, units_per_pallet::text, units_per_layer::text,
           weight_per_pallet::text, weight_unit_pallet from pack_styles order by id`);
	return products.map((p) => ({
		...p,
		packs: packs.filter((k) => k.product_id === p.id).map((k) => ({
			...k,
			net_weight: k.net_weight == null ? null : n(k.net_weight),
			units_per_pallet: n(k.units_per_pallet),
			units_per_layer: n(k.units_per_layer),
			weight_per_pallet: n(k.weight_per_pallet)
		}))
	}));
});
export const createProduct = createServerFn({ method: "POST" }).validator(z.object({
	sku: z.string().optional(),
	name: z.string().min(1),
	variety: z.string().optional(),
	category: z.string().optional(),
	default_unit: z.string().default("caja"),
	pack_name: z.string().optional(),
	net_weight: z.number().optional()
})).middleware([authMiddleware]).handler(async ({ data }) => {
	const sql = await getSql();
	const sku = data.sku?.trim() || await nextCode(sql, "products", "sku", "SKU-");
	const id = (await sql.query(`insert into products (sku, name, variety, category, default_unit)
       values ($1,$2,$3,$4,$5) returning id`, [
		sku,
		data.name.trim(),
		data.variety || null,
		data.category || null,
		data.default_unit
	]))[0].id;
	const packName = data.pack_name?.trim() || `Caja ${data.default_unit}`;
	await sql.query(`insert into pack_styles (product_id, name, unit_of_measure, net_weight, is_default, sku_code)
       values ($1,$2,$3,$4,true,$5)`, [
		id,
		packName,
		data.default_unit,
		data.net_weight ?? null,
		sku
	]);
	return {
		id,
		sku
	};
});
export const createSku = createServerFn({ method: "POST" }).validator(z.object({
	product_id: z.number(),
	empaque: z.string().min(1),
	calibre: z.string().min(1),
	net_weight: z.number().optional(),
	weight_unit: z.string().default("lb")
})).middleware([authMiddleware]).handler(async ({ data }) => {
	const sql = await getSql();
	const [p] = await sql.query(`select id, sku, default_unit from products where id = $1`, [data.product_id]);
	if (!p) throw new Error("Producto no encontrado");
	const sku_code = skuCodeOf(p.sku, data.empaque, data.calibre);
	const [dup] = await sql.query(`select id from pack_styles where sku_code = $1`, [sku_code]);
	if (dup) throw new Error(`Ya existe el SKU ${sku_code}`);
	const name = `${data.empaque} ${data.calibre}`;
	return {
		id: (await sql.query(`insert into pack_styles (product_id, name, unit_of_measure, net_weight, weight_unit, is_default, sku_code, empaque, calibre)
       values ($1,$2,$3,$4,$5,false,$6,$7,$8) returning id`, [
			p.id,
			name,
			p.default_unit,
			data.net_weight ?? null,
			data.weight_unit || "lb",
			sku_code,
			data.empaque.trim(),
			data.calibre.trim()
		]))[0].id,
		sku_code
	};
});
export const listSuppliers = createServerFn({ method: "GET" }).middleware([authMiddleware]).handler(async () => {
	return (await (await getSql()).query(`select id, code, name, contact_name, phone, email, city, country, notes, is_active,
           coalesce(es_proveedor, true) as es_proveedor,
           coalesce(es_cliente, false) as es_cliente,
           linked_customer_id, commission_type, commission_rate::text, share_token
    from suppliers order by name`)).map((s) => ({
		...s,
		commission_rate: s.commission_rate != null ? n(s.commission_rate) : null
	}));
});
export const createSupplier = createServerFn({ method: "POST" }).validator(z.object({
	name: z.string().min(1),
	contact_name: z.string().optional(),
	phone: z.string().optional(),
	email: z.string().optional(),
	city: z.string().optional(),
	country: z.string().optional(),
	notes: z.string().optional(),
	tambien_cliente: z.boolean().optional(),
	commission_type: z.enum(["per_unit", "gross_pct", "net_pct"]).nullable().optional(),
	commission_rate: z.number().min(0).nullable().optional()
})).middleware([authMiddleware]).handler(async ({ data }) => {
	const sql = await getSql();
	const code = await nextCode(sql, "suppliers", "code", "PRO-");
	const id = (await sql.query(`insert into suppliers (code, name, contact_name, phone, email, city, country, notes, es_proveedor, es_cliente, commission_type, commission_rate)
       values ($1,$2,$3,$4,$5,$6,$7,$8,true,$9,$10,$11) returning id`, [
		code,
		data.name.trim(),
		data.contact_name || null,
		data.phone || null,
		data.email || null,
		data.city || null,
		data.country || null,
		data.notes || null,
		Boolean(data.tambien_cliente),
		data.commission_type ?? null,
		data.commission_type != null ? data.commission_rate ?? null : null
	]))[0].id;
	let customer_code: string | null = null;
	if (data.tambien_cliente) {
		const customer_code_n = await nextCode(sql, "customers", "code", "CLI-");
		const cust = await sql.query(`insert into customers (code, name, contact_name, phone, email, city, payment_terms, notes, es_cliente, es_proveedor, linked_supplier_id)
         values ($1,$2,$3,$4,$5,$6,'Net 14',$7,true,true,$8) returning id`, [
			customer_code_n,
			data.name.trim(),
			data.contact_name || null,
			data.phone || null,
			data.email || null,
			data.city || null,
			data.notes || null,
			id
		]);
		await sql.query(`update suppliers set linked_customer_id = $1 where id = $2`, [cust[0].id, id]);
		customer_code = customer_code_n;
	}
	return {
		id,
		code,
		customer_code
	};
});
export const updateSupplier = createServerFn({ method: "POST" }).validator(z.object({
	id: z.number(),
	name: z.string().min(1),
	contact_name: z.string().optional(),
	phone: z.string().optional(),
	email: z.string().optional(),
	city: z.string().optional(),
	country: z.string().optional(),
	notes: z.string().optional(),
	is_active: z.boolean().optional(),
	commission_type: z.enum(["per_unit", "gross_pct", "net_pct"]).nullable().optional(),
	commission_rate: z.number().min(0).nullable().optional()
})).middleware([authMiddleware]).handler(async ({ data }) => {
	await (await getSql()).query(`update suppliers set name=$1, contact_name=$2, phone=$3, email=$4, city=$5, country=$6, notes=$7, is_active=coalesce($8, is_active),
       commission_type = case when $10::boolean then $11 else commission_type end,
       commission_rate = case when $10::boolean then $12 else commission_rate end
     where id=$9`, [
		data.name.trim(),
		data.contact_name || null,
		data.phone || null,
		data.email || null,
		data.city || null,
		data.country || null,
		data.notes || null,
		data.is_active,
		data.id,
		data.commission_type !== undefined || data.commission_rate !== undefined,
		data.commission_type ?? null,
		data.commission_type != null ? data.commission_rate ?? null : null
	]);
	return { id: data.id };
});
export const listCustomers = createServerFn({ method: "GET" }).middleware([authMiddleware]).handler(async () => {
	return (await getSql()).query(`select id, code, name, contact_name, phone, email, city, payment_terms, notes, is_active,
           coalesce(es_cliente, true) as es_cliente,
           coalesce(es_proveedor, false) as es_proveedor,
           linked_supplier_id
    from customers order by name`);
});
export const createCustomer = createServerFn({ method: "POST" }).validator(z.object({
	name: z.string().min(1),
	contact_name: z.string().optional(),
	phone: z.string().optional(),
	email: z.string().optional(),
	city: z.string().optional(),
	payment_terms: z.string().optional(),
	notes: z.string().optional(),
	tambien_proveedor: z.boolean().optional()
})).middleware([authMiddleware]).handler(async ({ data }) => {
	const sql = await getSql();
	const code = await nextCode(sql, "customers", "code", "CLI-");
	const id = (await sql.query(`insert into customers (code, name, contact_name, phone, email, city, payment_terms, notes, es_cliente, es_proveedor)
       values ($1,$2,$3,$4,$5,$6,$7,$8,true,$9) returning id`, [
		code,
		data.name.trim(),
		data.contact_name || null,
		data.phone || null,
		data.email || null,
		data.city || null,
		data.payment_terms || null,
		data.notes || null,
		Boolean(data.tambien_proveedor)
	]))[0].id;
	let supplier_code: string | null = null;
	if (data.tambien_proveedor) {
		const supplier_code_n = await nextCode(sql, "suppliers", "code", "PRO-");
		const sup = await sql.query(`insert into suppliers (code, name, contact_name, phone, email, city, country, notes, es_proveedor, es_cliente, linked_customer_id)
         values ($1,$2,$3,$4,$5,$6,'México',$7,true,true,$8) returning id`, [
			supplier_code_n,
			data.name.trim(),
			data.contact_name || null,
			data.phone || null,
			data.email || null,
			data.city || null,
			data.notes || null,
			id
		]);
		await sql.query(`update customers set linked_supplier_id = $1 where id = $2`, [sup[0].id, id]);
		supplier_code = supplier_code_n;
	}
	return {
		id,
		code,
		supplier_code
	};
});
export const updateCustomer = createServerFn({ method: "POST" }).validator(z.object({
	id: z.number(),
	name: z.string().min(1),
	contact_name: z.string().optional(),
	phone: z.string().optional(),
	email: z.string().optional(),
	city: z.string().optional(),
	payment_terms: z.string().optional(),
	notes: z.string().optional(),
	is_active: z.boolean().optional()
})).middleware([authMiddleware]).handler(async ({ data }) => {
	await (await getSql()).query(`update customers set name=$1, contact_name=$2, phone=$3, email=$4, city=$5, payment_terms=$6, notes=$7, is_active=coalesce($8, is_active) where id=$9`, [
		data.name.trim(),
		data.contact_name || null,
		data.phone || null,
		data.email || null,
		data.city || null,
		data.payment_terms || null,
		data.notes || null,
		data.is_active,
		data.id
	]);
	return { id: data.id };
});
// ---- Destinos de entrega del cliente (Sesión de afinación del CPO) -------
// Libreta de direcciones SHIP TO por cliente. No confundir con `locations`
// (Delivery Routes) que es el catálogo de bodegas/cross-docks para RECIBIR
// compras — ese no tiene customer_id ni dirección completa.
export const listCustomerLocations = createServerFn({ method: "GET" }).validator(z.object({ customer_id: z.number().optional() })).middleware([authMiddleware]).handler(async ({ data }) => {
	const sql = await getSql();
	if (data.customer_id) {
		return sql.query(`select id, customer_id, label, address_line, city, state, zip, receiving_instructions, is_default
       from customer_locations where customer_id = $1 order by is_default desc, id`, [data.customer_id]);
	}
	return sql.query(`select id, customer_id, label, address_line, city, state, zip, receiving_instructions, is_default
     from customer_locations order by customer_id, is_default desc, id`);
});
export const createCustomerLocation = createServerFn({ method: "POST" }).validator(z.object({
	customer_id: z.number(),
	label: z.string().optional(),
	address_line: z.string().min(1),
	city: z.string().optional(),
	state: z.string().optional(),
	zip: z.string().optional(),
	receiving_instructions: z.string().optional(),
	is_default: z.boolean().optional()
})).middleware([authMiddleware]).handler(async ({ data }) => {
	const sql = await getSql();
	const [{ c }] = await sql.query(`select count(*)::int as c from customer_locations where customer_id = $1`, [data.customer_id]);
	const isDefault = Boolean(data.is_default) || c === 0;
	if (isDefault) await sql.query(`update customer_locations set is_default = false where customer_id = $1`, [data.customer_id]);
	const id = (await sql.query(`insert into customer_locations (customer_id, label, address_line, city, state, zip, receiving_instructions, is_default)
       values ($1,$2,$3,$4,$5,$6,$7,$8) returning id`, [
		data.customer_id,
		data.label?.trim() || null,
		data.address_line.trim(),
		data.city || null,
		data.state || null,
		data.zip || null,
		data.receiving_instructions || null,
		isDefault
	]))[0].id;
	return { id, is_default: isDefault };
});
export const updateCustomerLocation = createServerFn({ method: "POST" }).validator(z.object({
	id: z.number(),
	label: z.string().optional(),
	address_line: z.string().min(1),
	city: z.string().optional(),
	state: z.string().optional(),
	zip: z.string().optional(),
	receiving_instructions: z.string().optional()
})).middleware([authMiddleware]).handler(async ({ data }) => {
	await (await getSql()).query(`update customer_locations set label=$1, address_line=$2, city=$3, state=$4, zip=$5, receiving_instructions=$6 where id=$7`, [
		data.label?.trim() || null,
		data.address_line.trim(),
		data.city || null,
		data.state || null,
		data.zip || null,
		data.receiving_instructions || null,
		data.id
	]);
	return { id: data.id };
});
export const setDefaultCustomerLocation = createServerFn({ method: "POST" }).validator(z.object({ id: z.number() })).middleware([authMiddleware]).handler(async ({ data }) => {
	const sql = await getSql();
	const [loc] = await sql.query(`select customer_id from customer_locations where id = $1`, [data.id]);
	if (!loc) throw new Error("Destino no encontrado");
	await sql.query(`update customer_locations set is_default = false where customer_id = $1`, [loc.customer_id]);
	await sql.query(`update customer_locations set is_default = true where id = $1`, [data.id]);
	return { ok: true };
});
export const listLocations = createServerFn({ method: "GET" }).middleware([authMiddleware]).handler(async () => {
	return (await getSql()).query(`
    select loc.id, loc.code, loc.name, loc.location_type, loc.city, loc.owner_kind, loc.contact_name, loc.notes,
           loc.set_point_temp::text, loc.set_point_unit,
           coalesce((select sum(quantity) from inventory where location_id = loc.id), 0)::text as lot_qty
    from locations loc
    where loc.is_active
    order by loc.id
  `).then((rows) => rows.map((r) => ({
		...r,
		set_point_temp: r.set_point_temp == null ? null : n(r.set_point_temp),
		lot_qty: n(r.lot_qty)
	})));
});
export const createLocation = createServerFn({ method: "POST" }).validator(z.object({
	name: z.string().min(1),
	location_type: z.string().default("bodega"),
	owner_kind: z.string().default("propia"),
	city: z.string().optional(),
	contact_name: z.string().optional(),
	notes: z.string().optional()
})).middleware([authMiddleware]).handler(async ({ data }) => {
	const sql = await getSql();
	const code = await nextCode(sql, "locations", "code", data.location_type === "camara" ? "CAM-" : data.location_type === "cross_dock" ? "XD-" : data.location_type === "empaque" ? "EMP-" : "BOD-");
	return {
		id: (await sql.query(`insert into locations (code, name, location_type, city, owner_kind, contact_name, notes)
       values ($1,$2,$3,$4,$5,$6,$7) returning id`, [
			code,
			data.name.trim(),
			data.location_type,
			data.city?.trim() || null,
			data.owner_kind || "propia",
			data.contact_name?.trim() || null,
			data.notes?.trim() || null
		]))[0].id,
		code
	};
});
export const listValueLists = createServerFn({ method: "GET" }).middleware([authMiddleware]).handler(async () => {
	const rows = await (await getSql()).query(`select id, kind, value, sort_order from value_lists where is_active order by kind, sort_order, value`);
	const group = (kind) => rows.filter((r) => r.kind === kind);
	return {
		empaque: group("empaque"),
		calibre: group("calibre"),
		grado: group("grado")
	};
});
export const addValueList = createServerFn({ method: "POST" }).validator(z.object({
	kind: z.enum([
		"empaque",
		"calibre",
		"grado"
	]),
	value: z.string().min(1)
})).middleware([authMiddleware]).handler(async ({ data }) => {
	const sql = await getSql();
	const value = data.value.trim();
	const [dup] = await sql.query(`select id from value_lists where kind = $1 and lower(value) = lower($2)`, [data.kind, value]);
	if (dup) throw new Error(`«${value}» ya está en la lista`);
	const [max] = await sql.query(`select coalesce(max(sort_order),0)::text as m from value_lists where kind = $1`, [data.kind]);
	await sql.query(`insert into value_lists (kind, value, sort_order) values ($1,$2,$3)`, [
		data.kind,
		value,
		n(max?.m) + 1
	]);
	return { value };
});
// ── Catálogos aduanales (Fase B) ────────────────────────────────────────────
// Agencias, cruces y transportistas alimentan la captura de embarque en
// OC/OV (Fase C). "Proveedor ligado" es opcional: no toda agencia o línea es
// proveedor de Plein, y cuando sí lo es (Suárez Brokerage, Cornejos Trucking)
// se liga al registro de suppliers que ya existe en vez de duplicar el dato.
export const listCustomsBrokers = createServerFn({ method: "GET" }).middleware([authMiddleware]).handler(async () => {
	return (await getSql()).query(`
    select cb.id, cb.name, cb.country, cb.license_number, cb.contact_name, cb.phone, cb.email, cb.notes, cb.is_active,
           cb.supplier_id, s.name as supplier_name
    from customs_brokers cb
    left join suppliers s on s.id = cb.supplier_id
    order by cb.name
  `);
});
export const createCustomsBroker = createServerFn({ method: "POST" }).validator(z.object({
	name: z.string().min(1),
	country: z.enum(["MX", "US"]).default("MX"),
	license_number: z.string().optional(),
	contact_name: z.string().optional(),
	phone: z.string().optional(),
	email: z.string().optional(),
	supplier_id: z.number().nullable().optional(),
	notes: z.string().optional()
})).middleware([authMiddleware]).handler(async ({ data }) => {
	const sql = await getSql();
	return {
		id: (await sql.query(`insert into customs_brokers (name, country, license_number, contact_name, phone, email, supplier_id, notes)
       values ($1,$2,$3,$4,$5,$6,$7,$8) returning id`, [
			data.name.trim(),
			data.country,
			data.license_number?.trim() || null,
			data.contact_name?.trim() || null,
			data.phone?.trim() || null,
			data.email?.trim() || null,
			data.supplier_id ?? null,
			data.notes?.trim() || null
		]))[0].id
	};
});
export const updateCustomsBroker = createServerFn({ method: "POST" }).validator(z.object({
	id: z.number(),
	name: z.string().min(1),
	country: z.enum(["MX", "US"]),
	license_number: z.string().optional(),
	contact_name: z.string().optional(),
	phone: z.string().optional(),
	email: z.string().optional(),
	supplier_id: z.number().nullable().optional(),
	notes: z.string().optional(),
	is_active: z.boolean()
})).middleware([authMiddleware]).handler(async ({ data }) => {
	await (await getSql()).query(`update customs_brokers set name=$1, country=$2, license_number=$3, contact_name=$4,
       phone=$5, email=$6, supplier_id=$7, notes=$8, is_active=$9 where id=$10`, [
		data.name.trim(),
		data.country,
		data.license_number?.trim() || null,
		data.contact_name?.trim() || null,
		data.phone?.trim() || null,
		data.email?.trim() || null,
		data.supplier_id ?? null,
		data.notes?.trim() || null,
		data.is_active,
		data.id
	]);
	return { ok: true };
});

export const listBorderCrossings = createServerFn({ method: "GET" }).middleware([authMiddleware]).handler(async () => {
	return (await getSql()).query(`select id, name, port_mx, port_us, state_mx, state_us, is_active from border_crossings order by name`);
});
export const createBorderCrossing = createServerFn({ method: "POST" }).validator(z.object({
	name: z.string().min(1),
	port_mx: z.string().optional(),
	port_us: z.string().optional(),
	state_mx: z.string().optional(),
	state_us: z.string().optional()
})).middleware([authMiddleware]).handler(async ({ data }) => {
	const sql = await getSql();
	const name = data.name.trim();
	const [dup] = await sql.query(`select id from border_crossings where lower(name) = lower($1)`, [name]);
	if (dup) throw new Error(`«${name}» ya existe`);
	return {
		id: (await sql.query(`insert into border_crossings (name, port_mx, port_us, state_mx, state_us) values ($1,$2,$3,$4,$5) returning id`, [
			name,
			data.port_mx?.trim() || null,
			data.port_us?.trim() || null,
			data.state_mx?.trim() || null,
			data.state_us?.trim() || null
		]))[0].id
	};
});
export const updateBorderCrossing = createServerFn({ method: "POST" }).validator(z.object({
	id: z.number(),
	name: z.string().min(1),
	port_mx: z.string().optional(),
	port_us: z.string().optional(),
	state_mx: z.string().optional(),
	state_us: z.string().optional(),
	is_active: z.boolean()
})).middleware([authMiddleware]).handler(async ({ data }) => {
	await (await getSql()).query(`update border_crossings set name=$1, port_mx=$2, port_us=$3, state_mx=$4, state_us=$5, is_active=$6 where id=$7`, [
		data.name.trim(),
		data.port_mx?.trim() || null,
		data.port_us?.trim() || null,
		data.state_mx?.trim() || null,
		data.state_us?.trim() || null,
		data.is_active,
		data.id
	]);
	return { ok: true };
});

export const listCarriers = createServerFn({ method: "GET" }).middleware([authMiddleware]).handler(async () => {
	return (await getSql()).query(`
    select c.id, c.name, c.country, c.scac, c.caat, c.contact_name, c.phone, c.is_active,
           c.supplier_id, s.name as supplier_name
    from carriers c
    left join suppliers s on s.id = c.supplier_id
    order by c.name
  `);
});
export const createCarrier = createServerFn({ method: "POST" }).validator(z.object({
	name: z.string().min(1),
	country: z.string().optional(),
	scac: z.string().optional(),
	caat: z.string().optional(),
	contact_name: z.string().optional(),
	phone: z.string().optional(),
	supplier_id: z.number().nullable().optional()
})).middleware([authMiddleware]).handler(async ({ data }) => {
	const sql = await getSql();
	return {
		id: (await sql.query(`insert into carriers (name, country, scac, caat, contact_name, phone, supplier_id)
       values ($1,$2,$3,$4,$5,$6,$7) returning id`, [
			data.name.trim(),
			data.country?.trim() || null,
			data.scac?.trim().toUpperCase() || null,
			data.caat?.trim().toUpperCase() || null,
			data.contact_name?.trim() || null,
			data.phone?.trim() || null,
			data.supplier_id ?? null
		]))[0].id
	};
});
export const updateCarrier = createServerFn({ method: "POST" }).validator(z.object({
	id: z.number(),
	name: z.string().min(1),
	country: z.string().optional(),
	scac: z.string().optional(),
	caat: z.string().optional(),
	contact_name: z.string().optional(),
	phone: z.string().optional(),
	supplier_id: z.number().nullable().optional(),
	is_active: z.boolean()
})).middleware([authMiddleware]).handler(async ({ data }) => {
	await (await getSql()).query(`update carriers set name=$1, country=$2, scac=$3, caat=$4, contact_name=$5, phone=$6, supplier_id=$7, is_active=$8 where id=$9`, [
		data.name.trim(),
		data.country?.trim() || null,
		data.scac?.trim().toUpperCase() || null,
		data.caat?.trim().toUpperCase() || null,
		data.contact_name?.trim() || null,
		data.phone?.trim() || null,
		data.supplier_id ?? null,
		data.is_active,
		data.id
	]);
	return { ok: true };
});

export const listCarrierUnits = createServerFn({ method: "GET" }).middleware([authMiddleware]).handler(async () => {
	return (await getSql()).query(`select id, carrier_id, unit_type, plates, economic_number, make_model, model_year, is_active from carrier_units order by id`);
});
export const createCarrierUnit = createServerFn({ method: "POST" }).validator(z.object({
	carrier_id: z.number(),
	unit_type: z.enum(["camion", "remolque"]),
	plates: z.string().min(1),
	economic_number: z.string().optional(),
	make_model: z.string().optional(),
	model_year: z.number().optional()
})).middleware([authMiddleware]).handler(async ({ data }) => {
	const sql = await getSql();
	return {
		id: (await sql.query(`insert into carrier_units (carrier_id, unit_type, plates, economic_number, make_model, model_year)
       values ($1,$2,$3,$4,$5,$6) returning id`, [
			data.carrier_id,
			data.unit_type,
			data.plates.trim(),
			data.economic_number?.trim() || null,
			data.make_model?.trim() || null,
			data.model_year ?? null
		]))[0].id
	};
});
export const updateCarrierUnit = createServerFn({ method: "POST" }).validator(z.object({
	id: z.number(),
	unit_type: z.enum(["camion", "remolque"]),
	plates: z.string().min(1),
	economic_number: z.string().optional(),
	make_model: z.string().optional(),
	model_year: z.number().optional(),
	is_active: z.boolean()
})).middleware([authMiddleware]).handler(async ({ data }) => {
	await (await getSql()).query(`update carrier_units set unit_type=$1, plates=$2, economic_number=$3, make_model=$4, model_year=$5, is_active=$6 where id=$7`, [
		data.unit_type,
		data.plates.trim(),
		data.economic_number?.trim() || null,
		data.make_model?.trim() || null,
		data.model_year ?? null,
		data.is_active,
		data.id
	]);
	return { ok: true };
});

export const listDrivers = createServerFn({ method: "GET" }).middleware([authMiddleware]).handler(async () => {
	return (await getSql()).query(`select id, carrier_id, name, license_number, license_state, phone, is_active from drivers order by id`);
});
export const createDriver = createServerFn({ method: "POST" }).validator(z.object({
	carrier_id: z.number(),
	name: z.string().min(1),
	license_number: z.string().optional(),
	license_state: z.string().optional(),
	phone: z.string().optional()
})).middleware([authMiddleware]).handler(async ({ data }) => {
	const sql = await getSql();
	return {
		id: (await sql.query(`insert into drivers (carrier_id, name, license_number, license_state, phone)
       values ($1,$2,$3,$4,$5) returning id`, [
			data.carrier_id,
			data.name.trim(),
			data.license_number?.trim() || null,
			data.license_state?.trim() || null,
			data.phone?.trim() || null
		]))[0].id
	};
});
export const updateDriver = createServerFn({ method: "POST" }).validator(z.object({
	id: z.number(),
	name: z.string().min(1),
	license_number: z.string().optional(),
	license_state: z.string().optional(),
	phone: z.string().optional(),
	is_active: z.boolean()
})).middleware([authMiddleware]).handler(async ({ data }) => {
	await (await getSql()).query(`update drivers set name=$1, license_number=$2, license_state=$3, phone=$4, is_active=$5 where id=$6`, [
		data.name.trim(),
		data.license_number?.trim() || null,
		data.license_state?.trim() || null,
		data.phone?.trim() || null,
		data.is_active,
		data.id
	]);
	return { ok: true };
});
export const listLots = createServerFn({ method: "GET" }).middleware([authMiddleware]).handler(async () => {
	const sql = await getSql();
	const lots = await sql.query(`
    select l.id, l.lot_number, l.product_id, p.name as product_name, p.sku,
           s.name as supplier_name, ps.name as pack_name, l.pack_style_id,
           l.original_qty::text, l.current_qty::text, l.unit, l.unit_cost::text,
           l.received_date::text, l.pack_date::text, l.best_by_date::text,
           l.grade, l.origin_farm, l.origin_country, l.status,
           coalesce(l.quality_state, 'sano') as quality_state, l.quality_note,
           l.purchase_order_id, po.po_number,
           coalesce(l.held, false) as held, l.closed_at::text,
           coalesce(l.waste_qty,0)::text, coalesce(l.rts_qty,0)::text, l.pallets::text
    from lots l
    join products p on p.id = l.product_id
    left join suppliers s on s.id = l.supplier_id
    left join pack_styles ps on ps.id = l.pack_style_id
    left join purchase_orders po on po.id = l.purchase_order_id
    order by l.id desc
  `);
	const inv = await sql.query(`
    select i.lot_id, i.location_id, loc.name as location_name, i.quantity::text
    from inventory i join locations loc on loc.id = i.location_id
    where i.quantity > 0
  `);
	const sold = await sql.query(`
    select a.lot_id, coalesce(sum(a.quantity),0)::text as qty,
           coalesce(sum(a.quantity * coalesce(sol.unit_price,0)),0)::text as revenue
    from sale_line_allocations a
    join sales_order_lines sol on sol.id = a.sales_order_line_id
    group by a.lot_id
  `);
	const soldMap = new Map<number, { qty: number; revenue: number }>(sold.map((s) => [s.lot_id, {
		qty: n(s.qty),
		revenue: n(s.revenue)
	}]));
	return lots.map((l) => {
		const s = soldMap.get(l.id) ?? {
			qty: 0,
			revenue: 0
		};
		const held = Boolean(l.held);
		return {
			...l,
			original_qty: n(l.original_qty),
			current_qty: n(l.current_qty),
			unit_cost: n(l.unit_cost),
			waste_qty: n(l.waste_qty),
			rts_qty: n(l.rts_qty),
			pallets: n(l.pallets),
			sold_qty: s.qty,
			revenue: s.revenue,
			held,
			asignable: l.status === "active" && !held && !l.closed_at && n(l.current_qty) > 0 && (l.quality_state || "sano") === "sano",
			locations: inv.filter((i) => i.lot_id === l.id).map((i) => ({
				location_id: i.location_id,
				location_name: i.location_name,
				quantity: n(i.quantity)
			}))
		};
	});
});
export const getLotTrace = createServerFn({ method: "GET" }).validator(z.object({ lotId: z.number() })).middleware([authMiddleware]).handler(async ({ data }) => {
	const sql = await getSql();
	const movements = await sql.query(`
      select m.id, m.movement_type, m.quantity::text, m.unit, loc.name as location_name,
             m.reference_type, m.notes, m.created_at::text
      from inventory_movements m
      left join locations loc on loc.id = m.location_id
      where m.lot_id = $1
      order by m.id
    `, [data.lotId]);
	const sales = await sql.query(`
      select so.id as so_id, so.so_number, c.name as customer, sum(a.quantity)::text as qty,
             sol.unit_price::text, i.invoice_number as invoice, so.order_date::text
      from sale_line_allocations a
      join sales_order_lines sol on sol.id = a.sales_order_line_id
      join sales_orders so on so.id = sol.sales_order_id
      join customers c on c.id = so.customer_id
      left join invoices i on i.sales_order_id = so.id
      where a.lot_id = $1
      group by so.id, so.so_number, c.name, sol.id, sol.unit_price, i.invoice_number, so.order_date
      order by so.id
    `, [data.lotId]);
	const waste = await sql.query(`select id, quantity::text, reason, notes, created_at::text from waste_events where lot_id = $1 order by id`, [data.lotId]);
	return {
		movements: movements.map((m) => ({
			...m,
			quantity: n(m.quantity)
		})),
		sales: sales.map((s) => ({
			...s,
			qty: n(s.qty),
			unit_price: n(s.unit_price),
			revenue: n(s.qty) * n(s.unit_price)
		})),
		waste: waste.map((w) => ({
			...w,
			quantity: n(w.quantity)
		}))
	};
});
export const setLotQuality = createServerFn({ method: "POST" }).validator(z.object({
	lot_id: z.number(),
	quality_state: z.enum([
		"sano",
		"retenido",
		"castigado",
		"destruido"
	]),
	quality_note: z.string().optional()
})).middleware([authMiddleware]).handler(async ({ data }) => {
	const sql = await getSql();
	const [lot] = await sql.query(`select id, lot_number from lots where id = $1`, [data.lot_id]);
	if (!lot) throw new Error("Lote no encontrado");
	await sql.query(`update lots set quality_state = $1, quality_note = $2 where id = $3`, [
		data.quality_state,
		data.quality_note?.trim() || null,
		data.lot_id
	]);
	return {
		lot_number: lot.lot_number,
		quality_state: data.quality_state
	};
});
function computeSettlementLots(lots, expenseTotal, allocBy, targetPct, netToGrower: number | null = null) {
	const palletTotal = lots.reduce((s, l) => s + (l.pallets || 0), 0);
	const qtyTotal = lots.reduce((s, l) => s + l.original_qty, 0) || 1;
	const revenueTotal = lots.reduce((s, l) => s + l.revenue, 0);
	const usePallets = allocBy === "pallet" && palletTotal > 0;
	return lots.map((l) => {
		const expenses = expenseTotal * (usePallets ? (l.pallets || 0) / palletTotal : l.original_qty / qtyTotal);
		const pas = !(l.unit_cost > 0);
		let t_cost = pas ? 0 : l.unit_cost * l.original_qty;
		if (netToGrower != null) {
			// Liquidación por comisión: el neto al productor se reparte a cada
			// lote según el ingreso que ese lote realmente generó.
			t_cost = revenueTotal > 0 ? Math.max(0, netToGrower) * (l.revenue / revenueTotal) : 0;
		} else if (targetPct != null && l.revenue > 0) {
			t_cost = Math.max(0, l.revenue * (1 - targetPct / 100) - expenses);
		}
		const profit = l.revenue - t_cost - expenses;
		const profit_pct = l.revenue > 0 ? profit / l.revenue * 100 : 0;
		const cost_unit = l.original_qty > 0 ? t_cost / l.original_qty : 0;
		return {
			id: l.id,
			lot_number: l.lot_number,
			status: l.status,
			product_name: l.product_name,
			pack_name: l.pack_name,
			origin: l.origin,
			total: l.original_qty,
			rts: l.rts_qty,
			sold: l.sold,
			waste: l.waste_qty,
			remaining: l.current_qty,
			revenue: l.revenue,
			t_cost,
			expenses,
			profit,
			cost_unit,
			profit_pct,
			pallets: l.pallets,
			unit: l.unit,
			unit_cost: l.unit_cost,
			pas: pas && targetPct == null && netToGrower == null
		};
	});
}
/**
 * La secuencia real de Plein para liquidar una carga a consignación o
 * comisión: ingreso de la venta − gastos que se le descuentan al productor
 * − comisión de Plein = neto al productor. Devuelve el desglose completo
 * para que la liquidación se pueda leer y defender (documento PACA).
 */
function computeCommissionBreakdown(po, lotsRaw, expenseRows) {
	if (!po.commission_type || po.deal_type === "firme") return null;
	const revenue = lotsRaw.reduce((s, l) => s + l.revenue, 0);
	const soldUnits = lotsRaw.reduce((s, l) => s + l.sold, 0);
	const growerRows = expenseRows.filter((e) => e.charged_to === "grower");
	const grower_expenses = growerRows.reduce((s, e) => s + n(e.amount), 0);
	const plein_expenses = expenseRows.filter((e) => e.charged_to !== "grower").reduce((s, e) => s + n(e.amount), 0);
	const rate = n(po.commission_rate);
	let commission = 0;
	let commission_base = 0;
	if (po.commission_type === "per_unit") {
		commission_base = soldUnits;
		commission = rate * soldUnits;
	} else if (po.commission_type === "gross_pct") {
		commission_base = revenue;
		commission = revenue * rate / 100;
	} else if (po.commission_type === "net_pct") {
		commission_base = revenue - grower_expenses;
		commission = Math.max(0, commission_base) * rate / 100;
	}
	return {
		commission_type: po.commission_type,
		commission_rate: rate,
		revenue,
		sold_units: soldUnits,
		grower_expense_rows: growerRows.map((e) => ({
			id: e.id,
			category: e.category,
			amount: n(e.amount),
			notes: e.notes
		})),
		grower_expenses,
		plein_expenses,
		commission_base,
		commission,
		net_to_grower: revenue - grower_expenses - commission
	};
}
async function loadPoLots(sql, poId) {
	const lots = await sql.query(`select l.id, l.lot_number, l.status, p.name as product_name, ps.name as pack_name,
            l.origin_country as origin, l.original_qty::text, l.current_qty::text,
            coalesce(l.waste_qty,0)::text, coalesce(l.rts_qty,0)::text, l.pallets::text,
            l.unit, l.unit_cost::text
     from lots l
     join products p on p.id = l.product_id
     left join pack_styles ps on ps.id = l.pack_style_id
     where l.purchase_order_id = $1
     order by l.id`, [poId]);
	const sold = await sql.query(`select a.lot_id, coalesce(sum(a.quantity),0)::text as qty,
            coalesce(sum(a.quantity * coalesce(sol.unit_price,0)),0)::text as revenue
     from sale_line_allocations a
     join sales_order_lines sol on sol.id = a.sales_order_line_id
     join lots l on l.id = a.lot_id
     where l.purchase_order_id = $1
     group by a.lot_id`, [poId]);
	const soldMap = new Map<number, { qty: number; revenue: number }>(sold.map((s) => [s.lot_id, {
		qty: n(s.qty),
		revenue: n(s.revenue)
	}]));
	return lots.map((l) => {
		const s = soldMap.get(l.id) ?? {
			qty: 0,
			revenue: 0
		};
		return {
			id: l.id,
			lot_number: l.lot_number,
			status: l.status,
			product_name: l.product_name,
			pack_name: l.pack_name,
			origin: l.origin,
			original_qty: n(l.original_qty),
			current_qty: n(l.current_qty),
			waste_qty: n(l.waste_qty),
			rts_qty: n(l.rts_qty),
			pallets: n(l.pallets),
			unit: l.unit,
			unit_cost: n(l.unit_cost),
			sold: s.qty,
			revenue: s.revenue
		};
	});
}
/**
 * Shared by `getSettlement` (authenticated, finance-only) and `getVendorPortal`
 * (public, gated by the PO's `share_token` instead). Neither calls the other's
 * server fn — this plain function is the one place the math lives.
 */
async function loadSettlement(sql, purchase_order_id: number) {
	const [po] = await sql.query(`select po.id, po.po_number, po.supplier_id, s.name as supplier_name, po.status,
              coalesce(po.costing_mode,'pas') as costing_mode, po.target_profit_pct::text,
              coalesce(po.vendor_share_level,'po') as vendor_share_level,
              coalesce(po.signed_off,false) as signed_off,
              coalesce(po.deal_type,'firme') as deal_type,
              po.commission_type, po.commission_rate::text
       from purchase_orders po join suppliers s on s.id = po.supplier_id
       where po.id = $1`, [purchase_order_id]);
	if (!po) throw new Error("Purchase order not found");
	const expenses = await sql.query(`select id, category, notes, amount::text, coalesce(alloc_by,'pallet') as alloc_by,
              coalesce(charged_to,'plein') as charged_to
       from expenses where purchase_order_id = $1 and cancelled_at is null order by id`, [purchase_order_id]);
	const expense_total = expenses.reduce((s, e) => s + n(e.amount), 0);
	const allocBy = expenses[0]?.alloc_by === "unit" ? "unit" : "pallet";
	const lotsRaw = await loadPoLots(sql, purchase_order_id);
	// La liquidación por comisión (la secuencia real de Plein) manda; el
	// target % queda solo como camino legado cuando no hay comisión definida.
	const breakdown = computeCommissionBreakdown(po, lotsRaw, expenses);
	const target = breakdown == null && po.target_profit_pct != null ? n(po.target_profit_pct) : null;
	const lots = computeSettlementLots(lotsRaw, expense_total, allocBy, target, breakdown ? breakdown.net_to_grower : null);
	const revenue = lots.reduce((s, l) => s + l.revenue, 0);
	const t_cost = lots.reduce((s, l) => s + l.t_cost, 0);
	const profit = lots.reduce((s, l) => s + l.profit, 0);
	const paid = n((await sql.query(`select coalesce(sum(paid),0)::text as paid from supplier_bills where purchase_order_id = $1`, [purchase_order_id]))[0]?.paid);
	// Cuenta corriente del productor: saldo vivo de adelantos, la bill de esta
	// liquidación (si ya nació) y las recuperaciones ya aplicadas a esta carga.
	const grower_balance = n((await sql.query(`select coalesce(sum(amount - recovered),0)::text as v
       from grower_advances where supplier_id = $1 and cancelled_at is null`, [po.supplier_id]))[0]?.v);
	const [billRow] = await sql.query(`select id, bill_number, total::text, paid::text from supplier_bills
       where purchase_order_id = $1 and status <> 'cancelled' order by id desc limit 1`, [purchase_order_id]);
	const recoveries = (await sql.query(`select ap.amount::text, ap.created_at::text, a.advance_number, a.concept
       from grower_advance_applications ap join grower_advances a on a.id = ap.advance_id
       where ap.purchase_order_id = $1 order by ap.id`, [purchase_order_id])).map((r) => ({
		...r,
		amount: n(r.amount)
	}));
	const recovered_total = recoveries.reduce((s, r) => s + r.amount, 0);
	return {
		po_id: po.id,
		po_number: po.po_number,
		supplier_name: po.supplier_name,
		status: po.status,
		costing_mode: po.costing_mode,
		target_profit_pct: target,
		vendor_share_level: po.vendor_share_level,
		signed_off: po.signed_off,
		deal_type: po.deal_type,
		commission_type: po.commission_type,
		commission_rate: po.commission_rate != null ? n(po.commission_rate) : null,
		breakdown,
		expense_rows: expenses.map((e) => ({
			id: e.id,
			category: e.category,
			notes: e.notes,
			amount: n(e.amount),
			charged_to: e.charged_to
		})),
		revenue,
		inventory_total: t_cost,
		non_inventory_total: 0,
		expenses: expense_total,
		profit,
		profit_pct: revenue > 0 ? profit / revenue * 100 : 0,
		paid,
		balance_due: Math.max(t_cost - paid, 0),
		grower_balance,
		bill: billRow ? {
			id: billRow.id,
			bill_number: billRow.bill_number,
			total: n(billRow.total),
			paid: n(billRow.paid),
			remaining: Math.max(n(billRow.total) - n(billRow.paid), 0)
		} : null,
		recoveries,
		recovered_total,
		lots
	};
}
export const getSettlement = createServerFn({ method: "GET" }).validator(z.object({ purchase_order_id: z.number() })).middleware([moduleMiddleware("finance")]).handler(async ({ data }) => {
	const sql = await getSql();
	return loadSettlement(sql, data.purchase_order_id);
});
export const applySettlement = createServerFn({ method: "POST" }).validator(z.object({
	purchase_order_id: z.number(),
	target_profit_pct: z.number().min(0).max(100).optional(),
	lot_costs: z.array(z.object({
		lot_id: z.number(),
		unit_cost: z.number().min(0)
	})).optional()
})).middleware([moduleMiddleware("finance")]).handler(async ({ data }) => {
	const sql = await getSql();
	const [po] = await sql.query(`select coalesce(deal_type,'firme') as deal_type, commission_type, commission_rate::text from purchase_orders where id = $1`, [data.purchase_order_id]);
	if (!po) throw new Error("Orden de compra no encontrada");
	if (po.deal_type === "comision") throw new Error("Comisión pura: el costo de estos lotes se queda en cero — no hay compra que liquidar.");
	if (data.target_profit_pct != null) await sql.query(`update purchase_orders set target_profit_pct = $1 where id = $2`, [data.target_profit_pct, data.purchase_order_id]);
	const expenses = await sql.query(`select id, category, notes, amount::text, coalesce(alloc_by,'pallet') as alloc_by,
              coalesce(charged_to,'plein') as charged_to
       from expenses where purchase_order_id = $1 and cancelled_at is null`, [data.purchase_order_id]);
	const expense_total = expenses.reduce((s, e) => s + n(e.amount), 0);
	const allocBy = expenses[0]?.alloc_by === "unit" ? "unit" : "pallet";
	const lotsRaw = await loadPoLots(sql, data.purchase_order_id);
	// Si la OC tiene comisión definida, esa es la liquidación que se escribe;
	// el target % es solo el camino legado sin comisión.
	const breakdown = computeCommissionBreakdown(po, lotsRaw, expenses);
	const computed = computeSettlementLots(lotsRaw, expense_total, allocBy, breakdown ? null : data.target_profit_pct ?? null, breakdown ? breakdown.net_to_grower : null);
	const overrides = new Map((data.lot_costs ?? []).map((c) => [c.lot_id, c.unit_cost]));
	for (const lot of computed) {
		const cost = overrides.get(lot.id) ?? lot.cost_unit;
		await sql.query(`update lots set unit_cost = $1 where id = $2`, [cost, lot.id]);
		await sql.query(`update purchase_order_lines set unit_cost = $1
         where purchase_order_id = $2 and product_id = (select product_id from lots where id = $3)`, [
			cost,
			data.purchase_order_id,
			lot.id
		]);
	}
	await sql.query(`update purchase_orders set costing_mode = 'pas' where id = $1`, [data.purchase_order_id]);
	return {
		ok: true,
		lots: computed.length
	};
});
export const setPoCommission = createServerFn({ method: "POST" }).validator(z.object({
	purchase_order_id: z.number(),
	commission_type: z.enum(["per_unit", "gross_pct", "net_pct"]).nullable(),
	commission_rate: z.number().min(0).optional()
})).middleware([moduleMiddleware("finance")]).handler(async ({ data }) => {
	const sql = await getSql();
	const [po] = await sql.query(`select coalesce(deal_type,'firme') as deal_type from purchase_orders where id = $1`, [data.purchase_order_id]);
	if (!po) throw new Error("Orden de compra no encontrada");
	if (po.deal_type === "firme") throw new Error("Trato en firme: el precio ya está cerrado, no lleva comisión de liquidación.");
	if (data.commission_type != null && !(n(data.commission_rate) > 0)) throw new Error("Captura la tarifa de la comisión (monto por caja o %).");
	await sql.query(`update purchase_orders set commission_type = $1, commission_rate = $2 where id = $3`, [
		data.commission_type,
		data.commission_type != null ? data.commission_rate : null,
		data.purchase_order_id
	]);
	return { ok: true };
});
export const setExpenseChargedTo = createServerFn({ method: "POST" }).validator(z.object({
	expense_id: z.number(),
	charged_to: z.enum(["grower", "plein"])
})).middleware([moduleMiddleware("finance")]).handler(async ({ data }) => {
	const sql = await getSql();
	const [exp] = await sql.query(`select id from expenses where id = $1`, [data.expense_id]);
	if (!exp) throw new Error("Gasto no encontrado");
	await sql.query(`update expenses set charged_to = $1 where id = $2`, [data.charged_to, data.expense_id]);
	return { ok: true };
});
/**
 * Cuenta corriente del productor. Un adelanto sale de caja (cash_movement
 * kind 'adelanto') y nace como cuenta por cobrar al productor — no es gasto,
 * no toca expenses ni el P&L. Se recupera contra liquidaciones futuras como
 * cruce sin caja: baja la CxC al productor y sube supplier_bills.paid.
 */
export const createGrowerAdvance = createServerFn({ method: "POST" }).validator(z.object({
	supplier_id: z.number(),
	concept: z.string().min(1),
	amount: z.number().positive(),
	advance_date: z.string().optional(),
	purchase_order_id: z.number().optional(),
	notes: z.string().optional()
})).middleware([moduleMiddleware("finance")]).handler(async ({ data }) => {
	const sql = await getSql();
	const [sup] = await sql.query(`select name from suppliers where id = $1`, [data.supplier_id]);
	if (!sup) throw new Error("Productor no encontrado");
	if (data.purchase_order_id != null) {
		const [po] = await sql.query(`select id from purchase_orders where id = $1 and supplier_id = $2`, [data.purchase_order_id, data.supplier_id]);
		if (!po) throw new Error("Esa carga no es de este productor");
	}
	const advance_number = await nextCode(sql, "grower_advances", "advance_number", "ADE-");
	const folio = await nextCode(sql, "cash_movements", "folio", "MOV-");
	const date = data.advance_date || todayISO();
	const movId = (await sql.query(`insert into cash_movements (folio, mov_date, kind, counterparty, amount, notes)
       values ($1,$2,'adelanto',$3,$4,$5) returning id`, [
		folio,
		date,
		sup.name,
		-data.amount,
		`Adelanto ${advance_number} — ${data.concept.trim()}`
	]))[0].id;
	const id = (await sql.query(`insert into grower_advances (advance_number, supplier_id, purchase_order_id, advance_date, concept, amount, cash_movement_id, notes)
       values ($1,$2,$3,$4,$5,$6,$7,$8) returning id`, [
		advance_number,
		data.supplier_id,
		data.purchase_order_id ?? null,
		date,
		data.concept.trim(),
		data.amount,
		movId,
		data.notes || null
	]))[0].id;
	return { id, advance_number, folio };
});
async function loadGrowerAccount(sql, supplier_id: number) {
	const [sup] = await sql.query(`select id, name, contact_name, phone, email, city, country, share_token from suppliers where id = $1`, [supplier_id]);
	if (!sup) throw new Error("Productor no encontrado");
	const advances = (await sql.query(`select a.id, a.advance_number, a.advance_date::text, a.concept, a.amount::text, a.recovered::text, a.notes,
            a.purchase_order_id, po.po_number, a.cancelled_at::text, a.cancelled_by, a.cancel_reason
     from grower_advances a
     left join purchase_orders po on po.id = a.purchase_order_id
     where a.supplier_id = $1
     order by a.advance_date, a.id`, [supplier_id])).map((a) => ({
		...a,
		amount: n(a.amount),
		recovered: n(a.recovered),
		balance: a.cancelled_at ? 0 : Math.max(n(a.amount) - n(a.recovered), 0)
	}));
	const applications = (await sql.query(`select ap.id, ap.advance_id, ap.amount::text, ap.created_at::text,
            a.advance_number, a.concept, b.bill_number, po.po_number
     from grower_advance_applications ap
     join grower_advances a on a.id = ap.advance_id
     join supplier_bills b on b.id = ap.supplier_bill_id
     left join purchase_orders po on po.id = ap.purchase_order_id
     where a.supplier_id = $1
     order by ap.id`, [supplier_id])).map((r) => ({
		...r,
		amount: n(r.amount)
	}));
	const pos = await sql.query(`select id, po_number from purchase_orders
     where supplier_id = $1 and status <> 'cancelled' order by id desc limit 50`, [supplier_id]);
	return {
		supplier: sup,
		advances,
		applications,
		pos,
		balance: advances.reduce((s, a) => s + a.balance, 0)
	};
}
export const getGrowerAccount = createServerFn({ method: "GET" }).validator(z.object({ supplier_id: z.number() })).middleware([moduleMiddleware("finance")]).handler(async ({ data }) => {
	const sql = await getSql();
	return loadGrowerAccount(sql, data.supplier_id);
});
export const applyAdvanceRecovery = createServerFn({ method: "POST" }).validator(z.object({
	purchase_order_id: z.number(),
	amount: z.number().positive()
})).middleware([moduleMiddleware("finance")]).handler(async ({ data }) => {
	const sql = await getSql();
	const [po] = await sql.query(`select id, po_number, supplier_id from purchase_orders where id = $1`, [data.purchase_order_id]);
	if (!po) throw new Error("Orden de compra no encontrada");
	const [bill] = await sql.query(`select id, bill_number, total::text, paid::text from supplier_bills
       where purchase_order_id = $1 and status <> 'cancelled' order by id desc limit 1`, [po.id]);
	if (!bill) throw new Error("Esta carga aún no tiene factura de liquidación — captúrala primero.");
	const remaining = n(bill.total) - n(bill.paid);
	if (data.amount > remaining + .009) throw new Error(`Solo quedan ${remaining.toFixed(2)} por cubrir en ${bill.bill_number} — no se puede recuperar más que el neto pendiente de esta liquidación.`);
	// Los adelantos más viejos se recuperan primero (FIFO). Miguel decide el
	// monto total; el sistema lo reparte y deja rastro por adelanto.
	const open = await sql.query(`select id, amount::text, recovered::text from grower_advances
       where supplier_id = $1 and cancelled_at is null and recovered < amount - 0.009
       order by advance_date, id`, [po.supplier_id]);
	let left = data.amount;
	const splits: { id: number; take: number }[] = [];
	for (const a of open) {
		if (left <= .009) break;
		const take = Math.min(n(a.amount) - n(a.recovered), left);
		splits.push({ id: a.id, take });
		left -= take;
	}
	if (left > .009) throw new Error("El productor no tiene saldo de adelantos suficiente para recuperar ese monto.");
	for (const s of splits) {
		// Guarda atómica: recovered nunca puede pasar de amount, así que es
		// imposible recuperar el mismo adelanto dos veces.
		const updated = await sql.query(`update grower_advances set recovered = recovered + $1
         where id = $2 and cancelled_at is null and recovered + $1 <= amount + 0.009 returning id`, [s.take, s.id]);
		if (!updated.length) throw new Error("El saldo del adelanto cambió — recarga y vuelve a intentar.");
		await sql.query(`insert into grower_advance_applications (advance_id, supplier_bill_id, purchase_order_id, amount) values ($1,$2,$3,$4)`, [
			s.id,
			bill.id,
			po.id,
			s.take
		]);
	}
	// Cruce sin caja: la recuperación cubre parte de la liquidación sin
	// movimiento de dinero — baja la CxC al productor, baja la CxP de la carga.
	const paid = n(bill.paid) + data.amount;
	await sql.query(`update supplier_bills set paid = $1, status = $2 where id = $3`, [
		paid,
		moneyStatus(n(bill.total), paid),
		bill.id
	]);
	return {
		ok: true,
		applied: data.amount,
		bill_number: bill.bill_number,
		remaining: n(bill.total) - paid
	};
});
export const cancelGrowerAdvance = createServerFn({ method: "POST" }).validator(z.object({
	advance_id: z.number(),
	reason: z.string().optional()
})).middleware([moduleMiddleware("finance")]).handler(async ({ data, context }) => {
	const sql = await getSql();
	const [adv] = await sql.query(`select id, advance_number, recovered::text, cash_movement_id, cancelled_at from grower_advances where id = $1`, [data.advance_id]);
	if (!adv) throw new Error("Adelanto no encontrado");
	if (adv.cancelled_at) throw new Error(`${adv.advance_number} ya está cancelado`);
	if (n(adv.recovered) > .009) throw new Error(`${adv.advance_number} ya tiene recuperaciones aplicadas — no se puede cancelar.`);
	const staffName = await staffNameFor(sql, context.userId);
	await sql.query(`update grower_advances set cancelled_at = now(), cancelled_by = $1, cancel_reason = $2 where id = $3`, [staffName, data.reason || null, adv.id]);
	if (adv.cash_movement_id) await sql.query(`update cash_movements set cancelled_at = now(), cancelled_by = $1, cancel_reason = $2
       where id = $3 and folio <> 'CORTE-CHASE' and cancelled_at is null`, [staffName, data.reason || `Cancelación ${adv.advance_number}`, adv.cash_movement_id]);
	return { advance_number: adv.advance_number };
});
export const wasteLot = createServerFn({ method: "POST" }).validator(z.object({
	lot_id: z.number(),
	quantity: z.number().positive(),
	reason: z.string().min(1),
	notes: z.string().optional()
})).middleware([authMiddleware]).handler(async ({ data }) => {
	const sql = await getSql();
	const [lot] = await sql.query(`select id, current_qty::text, unit, lot_number from lots where id = $1`, [data.lot_id]);
	if (!lot) throw new Error("Lot not found");
	if (data.quantity > n(lot.current_qty) + 1e-9) throw new Error("Cannot waste more than on-hand");
	await sql.query(`insert into waste_events (lot_id, quantity, reason, notes) values ($1,$2,$3,$4)`, [
		data.lot_id,
		data.quantity,
		data.reason,
		data.notes || null
	]);
	await sql.query(`update lots set waste_qty = coalesce(waste_qty,0) + $1,
              current_qty = current_qty - $1,
              status = case when current_qty - $1 <= 0 then 'depleted' else status end
       where id = $2`, [data.quantity, data.lot_id]);
	await sql.query(`update inventory set quantity = greatest(quantity - $1, 0) where lot_id = $2`, [data.quantity, data.lot_id]);
	await sql.query(`insert into inventory_movements (lot_id, movement_type, quantity, unit, reference_type, notes)
       values ($1,'waste',$2,$3,'waste',$4)`, [
		data.lot_id,
		-data.quantity,
		lot.unit,
		data.reason
	]);
	return { lot_number: lot.lot_number };
});
export const holdLot = createServerFn({ method: "POST" }).validator(z.object({
	lot_id: z.number(),
	held: z.boolean()
})).middleware([authMiddleware]).handler(async ({ data }) => {
	await (await getSql()).query(`update lots set held = $1,
              quality_state = case
                when $1 then 'retenido'
                when quality_state = 'retenido' then 'sano'
                else quality_state
              end
       where id = $2`, [data.held, data.lot_id]);
	return { ok: true };
});
export const closeLot = createServerFn({ method: "POST" }).validator(z.object({ lot_id: z.number() })).middleware([authMiddleware]).handler(async ({ data }) => {
	await (await getSql()).query(`update lots set closed_at = now(), status = case when current_qty <= 0 then 'depleted' else status end where id = $1`, [data.lot_id]);
	return { ok: true };
});
export const updatePalletDef = createServerFn({ method: "POST" }).validator(z.object({
	pack_style_id: z.number(),
	units_per_pallet: z.number().optional(),
	units_per_layer: z.number().optional(),
	weight_per_pallet: z.number().optional(),
	weight_unit_pallet: z.string().optional()
})).middleware([authMiddleware]).handler(async ({ data }) => {
	await (await getSql()).query(`update pack_styles
       set units_per_pallet = coalesce($1, units_per_pallet),
           units_per_layer = coalesce($2, units_per_layer),
           weight_per_pallet = coalesce($3, weight_per_pallet),
           weight_unit_pallet = coalesce($4, weight_unit_pallet)
       where id = $5`, [
		data.units_per_pallet ?? null,
		data.units_per_layer ?? null,
		data.weight_per_pallet ?? null,
		data.weight_unit_pallet ?? null,
		data.pack_style_id
	]);
	return { ok: true };
});
export const setVendorShare = createServerFn({ method: "POST" }).validator(z.object({
	purchase_order_id: z.number(),
	level: z.enum([
		"po",
		"basic",
		"detailed"
	])
})).middleware([moduleMiddleware("finance")]).handler(async ({ data }) => {
	await (await getSql()).query(`update purchase_orders set vendor_share_level = $1 where id = $2`, [data.level, data.purchase_order_id]);
	return { ok: true };
});
export const getVendorPortal = createServerFn({ method: "GET" }).validator(z.object({ token: z.string().min(16) })).handler(async ({ data }) => {
	const sql = await getSql();
	const [po] = await sql.query(`select po.id, po.po_number, s.name as supplier_name, po.expected_date::text, po.vendor_invoice, po.bol, po.shipping_ref,
              coalesce(po.vendor_share_level,'po') as vendor_share_level
       from purchase_orders po join suppliers s on s.id = po.supplier_id where po.share_token = $1`, [data.token]);
	if (!po) throw new Error("Purchase order not found");
	const settlement = await loadSettlement(sql, po.id);
	const sales = await sql.query(`select so.order_date::text, p.name as item, l.lot_number, sum(a.quantity)::text as qty,
              sol.unit_price::text, (sum(a.quantity) * coalesce(sol.unit_price,0))::text as total
       from sale_line_allocations a
       join sales_order_lines sol on sol.id = a.sales_order_line_id
       join sales_orders so on so.id = sol.sales_order_id
       join lots l on l.id = a.lot_id
       join products p on p.id = sol.product_id
       where l.purchase_order_id = $1
       group by so.order_date, p.name, l.lot_number, sol.id, sol.unit_price
       order by so.order_date, l.lot_number`, [po.id]);
	return {
		...settlement,
		expected_date: po.expected_date,
		vendor_invoice: po.vendor_invoice,
		bol: po.bol,
		shipping_ref: po.shipping_ref,
		level: po.vendor_share_level,
		sales: sales.map((s) => ({
			order_date: s.order_date,
			item: s.item,
			lot_number: s.lot_number,
			qty: n(s.qty),
			unit_price: n(s.unit_price),
			total: n(s.total),
			status: "Unpaid",
			type: "Sale"
		}))
	};
});
export const getWarehouse = createServerFn({ method: "GET" }).middleware([authMiddleware]).handler(async () => {
	const sql = await getSql();
	const incoming = await sql.query(`
    select l.product_id, l.pack_style_id, coalesce(sum(l.quantity_ordered - l.quantity_received),0)::text as qty
    from purchase_order_lines l
    join purchase_orders po on po.id = l.purchase_order_id
    where l.quantity_ordered > l.quantity_received and po.status <> 'cancelled'
    group by l.product_id, l.pack_style_id
  `);
	const openSales = await sql.query(`
    select l.product_id, l.pack_style_id, coalesce(sum(l.quantity_ordered - l.quantity_shipped),0)::text as qty
    from sales_order_lines l
    join sales_orders so on so.id = l.sales_order_id
    where l.quantity_ordered > l.quantity_shipped and so.status <> 'cancelled'
    group by l.product_id, l.pack_style_id
  `);
	return {
		incoming: incoming.map((r) => ({
			...r,
			qty: n(r.qty)
		})),
		open_sales: openSales.map((r) => ({
			...r,
			qty: n(r.qty)
		}))
	};
});
export const listPurchasedLots = createServerFn({ method: "GET" }).middleware([authMiddleware]).handler(async () => {
	return (await (await getSql()).query(`
    select l.lot_number, p.name as product_name, ps.name as pack_name, l.origin_country as origin,
           po.po_number, s.name as vendor, l.received_date::text, po.bol,
           l.original_qty::text as total_qty, coalesce(l.rts_qty,0)::text as returned_qty,
           l.unit_cost::text,
           (l.original_qty * coalesce(l.unit_cost,0))::text as t_cost
    from lots l
    join products p on p.id = l.product_id
    left join pack_styles ps on ps.id = l.pack_style_id
    left join purchase_orders po on po.id = l.purchase_order_id
    left join suppliers s on s.id = l.supplier_id
    where l.purchase_order_id is not null
    order by l.received_date desc nulls last, l.id desc
  `)).map((r) => ({
		...r,
		total_qty: n(r.total_qty),
		returned_qty: n(r.returned_qty),
		unit_cost: n(r.unit_cost),
		t_cost: n(r.t_cost)
	}));
});
export const listPurchaseOrders = createServerFn({ method: "GET" }).middleware([authMiddleware]).handler(async () => {
	const sql = await getSql();
	const orders = await sql.query(`
    select po.id, po.po_number, po.share_token, po.supplier_id, s.name as supplier_name, s.phone as supplier_phone, s.email as supplier_email, po.status,
           po.order_date::text, po.expected_date::text, po.notes, po.sales_order_id, so.so_number,
           coalesce(po.order_type, 'entrega') as order_type, po.bol, po.vendor_invoice, po.shipping_ref,
           coalesce(po.costing_mode,'pas') as costing_mode, po.target_profit_pct::text,
           coalesce(po.vendor_share_level,'po') as vendor_share_level, coalesce(po.signed_off,false) as signed_off,
           coalesce(po.deal_type, 'firme') as deal_type,
           po.commission_type, po.commission_rate::text,
           po.cancelled_at::text, po.cancelled_by, po.cancel_reason
    from purchase_orders po join suppliers s on s.id = po.supplier_id
    left join sales_orders so on so.id = po.sales_order_id
    order by po.id desc
  `);
	const lines = await sql.query(`
    select l.id, l.purchase_order_id, l.product_id, p.name as product_name, l.pack_style_id,
           l.quantity_ordered::text, l.quantity_received::text, l.unit, l.unit_cost::text,
           ps.sku_code, ps.empaque, ps.calibre, ps.net_weight::text, coalesce(ps.weight_unit,'lb') as weight_unit,
           l.pallets::text, l.units_per_pallet::text, l.origin_country,
           p.storage_temp_min::text, p.storage_temp_max::text, p.storage_temp_unit
    from purchase_order_lines l
    join products p on p.id = l.product_id
    left join pack_styles ps on ps.id = l.pack_style_id
  `);
	const recs = await sql.query(`
    select r.id, r.purchase_order_id, rl.purchase_order_line_id, r.received_date::text, rl.result, rl.quantity::text,
           ls.lot_number as lot_sano, lr.lot_number as lot_retenido, p.name as product_name, r.warning
    from receptions r
    join reception_lines rl on rl.reception_id = r.id
    join purchase_order_lines pol on pol.id = rl.purchase_order_line_id
    join products p on p.id = pol.product_id
    left join lots ls on ls.id = rl.lot_sano_id
    left join lots lr on lr.id = rl.lot_retenido_id
    order by r.id
  `);
	const bills = await sql.query(`select purchase_order_id, bill_number, status from supplier_bills where purchase_order_id is not null`);
	const expenses = await sql.query(`
    select id, purchase_order_id, expense_number, category, quantity::text, unit_cost::text,
           amount::text, invoice_number, status, notes, payable,
           coalesce(alloc_by,'pallet') as alloc_by, coalesce(charged_to,'plein') as charged_to,
           supplier_id
    from expenses where cancelled_at is null
  `);
	return orders.map((o) => {
		const poLines = lines.filter((l) => l.purchase_order_id === o.id).map((l) => ({
			...l,
			quantity_ordered: n(l.quantity_ordered),
			quantity_received: n(l.quantity_received),
			unit_cost: n(l.unit_cost),
			pallets: n(l.pallets),
			units_per_pallet: n(l.units_per_pallet),
			net_weight: l.net_weight == null ? null : n(l.net_weight),
			storage_temp_min: l.storage_temp_min == null ? null : n(l.storage_temp_min),
			storage_temp_max: l.storage_temp_max == null ? null : n(l.storage_temp_max),
			storage_temp_unit: l.storage_temp_unit
		}));
		const poExpenses = expenses.filter((e) => e.purchase_order_id === o.id).map((e) => ({
			...e,
			quantity: n(e.quantity),
			unit_cost: n(e.unit_cost),
			amount: n(e.amount)
		}));
		const merch_total = poLines.reduce((s, l) => s + l.quantity_ordered * l.unit_cost, 0);
		const expense_total = poExpenses.reduce((s, e) => s + e.amount, 0);
		return {
			...o,
			commission_rate: o.commission_rate != null ? n(o.commission_rate) : null,
			bill: bills.find((b) => b.purchase_order_id === o.id && b.status !== "cancelled") ?? null,
			receptions: recs.filter((r) => r.purchase_order_id === o.id).map((r) => ({
				...r,
				quantity: n(r.quantity)
			})),
			lines: poLines,
			expenses: poExpenses,
			merch_total,
			expense_total,
			order_total: merch_total + expense_total
		};
	});
});
export const createPurchaseOrder = createServerFn({ method: "POST" }).validator(z.object({
	supplier_id: z.number(),
	deal_type: z.enum(["firme", "consignacion", "comision"]),
	commission_type: z.enum(["per_unit", "gross_pct", "net_pct"]).optional(),
	commission_rate: z.number().min(0).optional(),
	expected_date: z.string().optional(),
	notes: z.string().optional(),
	sales_order_id: z.number().optional(),
	order_type: z.string().optional(),
	bol: z.string().optional(),
	vendor_invoice: z.string().optional(),
	shipping_ref: z.string().optional(),
	lines: z.array(z.object({
		product_id: z.number(),
		pack_style_id: z.number().optional(),
		quantity_ordered: z.number().positive(),
		unit: z.string(),
		unit_cost: z.number().optional(),
		pallets: z.number().optional(),
		units_per_pallet: z.number().optional(),
		origin_country: z.string().optional()
	})).min(1)
})).middleware([authMiddleware]).handler(async ({ data }) => {
	if (data.deal_type === "firme") {
		if (data.lines.some((l) => !(n(l.unit_cost) > 0))) throw new Error("Trato en firme: captura el costo de cada línea — es un precio cerrado.");
	} else if (data.lines.some((l) => l.unit_cost != null)) {
		throw new Error("En consignación o comisión no se captura costo — se define al liquidar, después de vender.");
	}
	if (data.commission_type != null && !(n(data.commission_rate) > 0)) throw new Error("Captura la tarifa de la comisión (monto por caja o %).");
	const sql = await getSql();
	const po_number = await nextCode(sql, "purchase_orders", "po_number", "OC-");
	// La comisión solo aplica a tratos donde Plein liquida al productor.
	const withCommission = data.deal_type !== "firme" && data.commission_type != null;
	const id = (await sql.query(`insert into purchase_orders (po_number, supplier_id, deal_type, status, expected_date, notes, sales_order_id, order_type, bol, vendor_invoice, shipping_ref, commission_type, commission_rate)
       values ($1,$2,$3,'confirmed',$4,$5,$6,$7,$8,$9,$10,$11,$12) returning id`, [
		po_number,
		data.supplier_id,
		data.deal_type,
		data.expected_date || null,
		data.notes || null,
		data.sales_order_id ?? null,
		data.order_type || "entrega",
		data.bol || null,
		data.vendor_invoice || null,
		data.shipping_ref || null,
		withCommission ? data.commission_type : null,
		withCommission ? data.commission_rate : null
	]))[0].id;
	for (const line of data.lines) await sql.query(`insert into purchase_order_lines (purchase_order_id, product_id, pack_style_id, quantity_ordered, unit, unit_cost, pallets, units_per_pallet, origin_country)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9)`, [
		id,
		line.product_id,
		line.pack_style_id ?? null,
		line.quantity_ordered,
		line.unit,
		line.unit_cost ?? null,
		line.pallets ?? null,
		line.units_per_pallet ?? null,
		line.origin_country || null
	]);
	return {
		id,
		po_number
	};
});
/**
 * Edita de verdad una OC ya creada — no el modal de recepción. Qué tan lejos
 * se puede editar depende de cuánto ya pasó en el mundo real:
 *   - Ya facturada al proveedor (bill activa): solo referencia y notas.
 *     Proveedor, modalidad, comisión, líneas y cantidades quedan fijas.
 *   - Ya con mercancía recibida (sin bill todavía): proveedor y modalidad
 *     quedan fijos (cambiarlos rompería cómo se costeó/recibió), no se
 *     agregan ni quitan líneas ni se cambia el producto de una existente,
 *     y la cantidad no puede bajar de lo ya recibido. Costo, pallets,
 *     cajas/pallet y origen sí se pueden corregir. La comisión sigue
 *     editable (igual que desde el settlement).
 *   - Nada recibido todavía: la orden es un borrador real — todo editable,
 *     incluyendo reemplazar las líneas por completo.
 */
export const updatePurchaseOrder = createServerFn({ method: "POST" }).validator(z.object({
	purchase_order_id: z.number(),
	supplier_id: z.number(),
	deal_type: z.enum(["firme", "consignacion", "comision"]),
	commission_type: z.enum(["per_unit", "gross_pct", "net_pct"]).optional(),
	commission_rate: z.number().min(0).optional(),
	expected_date: z.string().optional(),
	notes: z.string().optional(),
	order_type: z.string().optional(),
	bol: z.string().optional(),
	vendor_invoice: z.string().optional(),
	shipping_ref: z.string().optional(),
	lines: z.array(z.object({
		id: z.number().optional(),
		product_id: z.number(),
		pack_style_id: z.number().optional(),
		quantity_ordered: z.number().positive(),
		unit: z.string(),
		unit_cost: z.number().optional(),
		pallets: z.number().optional(),
		units_per_pallet: z.number().optional(),
		origin_country: z.string().optional()
	})).min(1)
})).middleware([authMiddleware]).handler(async ({ data }) => {
	const sql = await getSql();
	const [po] = await sql.query(`select id, po_number, supplier_id, coalesce(deal_type,'firme') as deal_type from purchase_orders where id = $1`, [data.purchase_order_id]);
	if (!po) throw new Error("Orden de compra no encontrada");
	const [bill] = await sql.query(`select id from supplier_bills where purchase_order_id = $1 and status <> 'cancelled'`, [data.purchase_order_id]);
	const existingLines = await sql.query(`select id, product_id, pack_style_id, quantity_ordered::text, quantity_received::text from purchase_order_lines where purchase_order_id = $1`, [data.purchase_order_id]);
	const received = existingLines.some((l) => n(l.quantity_received) > 1e-4);
	if (bill) {
		if (data.supplier_id !== po.supplier_id) throw new Error("Esta orden ya tiene factura de proveedor — no se puede cambiar el proveedor.");
		if (data.deal_type !== po.deal_type) throw new Error("Esta orden ya tiene factura de proveedor — no se puede cambiar la modalidad.");
		if (data.lines.length !== existingLines.length) throw new Error("Esta orden ya tiene factura de proveedor — no se pueden agregar ni quitar líneas.");
		for (const line of data.lines) {
			const cur = existingLines.find((l) => l.id === line.id);
			if (!cur) throw new Error("Esta orden ya tiene factura de proveedor — no se pueden agregar líneas nuevas.");
			if (Math.abs(n(cur.quantity_ordered) - line.quantity_ordered) > 1e-4) throw new Error("Esta orden ya tiene factura de proveedor — no se puede cambiar la cantidad.");
		}
	} else if (received) {
		if (data.supplier_id !== po.supplier_id) throw new Error("Esta orden ya tiene mercancía recibida — no se puede cambiar el proveedor.");
		if (data.deal_type !== po.deal_type) throw new Error("Esta orden ya tiene mercancía recibida — no se puede cambiar la modalidad.");
		if (data.lines.length !== existingLines.length) throw new Error("Esta orden ya tiene mercancía recibida — no se pueden agregar ni quitar líneas.");
		for (const line of data.lines) {
			const cur = existingLines.find((l) => l.id === line.id);
			if (!cur) throw new Error("Esta orden ya tiene mercancía recibida — no se pueden agregar líneas nuevas.");
			if (cur.product_id !== line.product_id || (cur.pack_style_id ?? null) !== (line.pack_style_id ?? null)) throw new Error("No se puede cambiar el producto de una línea ya recibida.");
			if (line.quantity_ordered < n(cur.quantity_received) - 1e-4) throw new Error(`No se puede bajar la cantidad por debajo de lo ya recibido (${n(cur.quantity_received)}).`);
		}
	}
	if (data.deal_type === "firme") {
		if (data.lines.some((l) => !(n(l.unit_cost) > 0))) throw new Error("Trato en firme: captura el costo de cada línea — es un precio cerrado.");
	} else if (data.lines.some((l) => l.unit_cost != null)) {
		throw new Error("En consignación o comisión no se captura costo — se define al liquidar, después de vender.");
	}
	if (data.commission_type != null && !(n(data.commission_rate) > 0)) throw new Error("Captura la tarifa de la comisión (monto por caja o %).");
	const withCommission = data.deal_type !== "firme" && data.commission_type != null;
	await sql.query(`update purchase_orders set supplier_id=$1, deal_type=$2, expected_date=$3, notes=$4, order_type=$5, bol=$6, vendor_invoice=$7, shipping_ref=$8, commission_type=$9, commission_rate=$10 where id=$11`, [
		data.supplier_id,
		data.deal_type,
		data.expected_date || null,
		data.notes || null,
		data.order_type || "entrega",
		data.bol || null,
		data.vendor_invoice || null,
		data.shipping_ref || null,
		withCommission ? data.commission_type : null,
		withCommission ? data.commission_rate : null,
		po.id
	]);
	if (!bill && !received) {
		await sql.query(`delete from purchase_order_lines where purchase_order_id = $1`, [po.id]);
		for (const line of data.lines) await sql.query(`insert into purchase_order_lines (purchase_order_id, product_id, pack_style_id, quantity_ordered, unit, unit_cost, pallets, units_per_pallet, origin_country)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9)`, [
			po.id,
			line.product_id,
			line.pack_style_id ?? null,
			line.quantity_ordered,
			line.unit,
			line.unit_cost ?? null,
			line.pallets ?? null,
			line.units_per_pallet ?? null,
			line.origin_country || null
		]);
	} else if (!bill) {
		for (const line of data.lines) await sql.query(`update purchase_order_lines set quantity_ordered=$1, unit_cost=$2, pallets=$3, units_per_pallet=$4, origin_country=$5
         where id=$6 and purchase_order_id=$7`, [
			line.quantity_ordered,
			line.unit_cost ?? null,
			line.pallets ?? null,
			line.units_per_pallet ?? null,
			line.origin_country || null,
			line.id,
			po.id
		]);
	}
	return {
		ok: true,
		po_number: po.po_number
	};
});
export const listExpenses = createServerFn({ method: "GET" }).middleware([moduleMiddleware("finance")]).handler(async () => {
	return (await (await getSql()).query(`
    select e.id, e.expense_number, e.category, e.supplier_id, s.name as supplier_name,
           e.purchase_order_id, po.po_number, e.quantity::text, e.unit_cost::text,
           e.amount::text, e.invoice_number, e.payable, e.status, e.issue_date::text,
           e.paid::text, e.notes, coalesce(e.charged_to,'plein') as charged_to,
           coalesce(e.alloc_by,'pallet') as alloc_by, e.cancelled_at::text, e.cancel_reason
    from expenses e
    join suppliers s on s.id = e.supplier_id
    left join purchase_orders po on po.id = e.purchase_order_id
    order by e.id desc
  `)).map((r) => {
		const amount = n(r.amount);
		const paid = n(r.paid);
		return {
			...r,
			quantity: n(r.quantity),
			unit_cost: n(r.unit_cost),
			amount,
			paid,
			saldo: Math.max(amount - paid, 0)
		};
	});
});
export const createExpense = createServerFn({ method: "POST" }).validator(z.object({
	category: z.string().min(1),
	supplier_id: z.number(),
	purchase_order_id: z.number().optional(),
	amount: z.number().positive(),
	quantity: z.number().optional(),
	unit_cost: z.number().optional(),
	invoice_number: z.string().optional(),
	notes: z.string().optional(),
	payable: z.boolean().optional(),
	alloc_by: z.enum(["pallet", "unit"]).optional(),
	charged_to: z.enum(["grower", "plein"]).optional()
})).middleware([moduleMiddleware("finance")]).handler(async ({ data }) => {
	const sql = await getSql();
	const expense_number = await nextCode(sql, "expenses", "expense_number", "EXP-");
	const payable = data.payable !== false;
	const amount = data.amount;
	const paid = payable ? 0 : amount;
	const status = payable ? "open" : "paid";
	const id = (await sql.query(`insert into expenses (expense_number, category, supplier_id, purchase_order_id, quantity, unit_cost, amount, invoice_number, payable, status, issue_date, paid, notes, alloc_by, charged_to)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) returning id`, [
		expense_number,
		data.category,
		data.supplier_id,
		data.purchase_order_id ?? null,
		data.quantity ?? 1,
		data.unit_cost ?? amount,
		amount,
		data.invoice_number || null,
		payable,
		status,
		todayISO(),
		paid,
		data.notes || null,
		data.alloc_by || "pallet",
		data.charged_to || "plein"
	]))[0].id;
	// El detalle del gasto lee expense_po_links; sin esta fila el gasto se veía
	// "sin ligar" aunque la columna purchase_order_id sí estuviera puesta.
	if (data.purchase_order_id != null) {
		await sql.query(`insert into expense_po_links (expense_id, purchase_order_id, amount_applied) values ($1,$2,$3)
         on conflict (expense_id, purchase_order_id) do update set amount_applied = excluded.amount_applied`, [
			id,
			data.purchase_order_id,
			amount
		]);
	}
	return {
		id,
		expense_number
	};
});
// Un gasto ya prorrateado en una liquidación facturada no se puede mover: la
// bill del productor ya congeló ese número. Devuelve el folio que lo bloquea.
async function settledBillFor(sql, purchase_order_id: number | null) {
	if (purchase_order_id == null) return null;
	const [bill] = await sql.query(`select bill_number from supplier_bills
     where purchase_order_id = $1 and status <> 'cancelled' order by id desc limit 1`, [purchase_order_id]);
	return bill ? String(bill.bill_number) : null;
}
export const updateExpense = createServerFn({ method: "POST" }).validator(z.object({
	expense_id: z.number(),
	category: z.string().min(1),
	supplier_id: z.number(),
	purchase_order_id: z.number().nullable().optional(),
	amount: z.number().positive(),
	invoice_number: z.string().optional(),
	notes: z.string().optional(),
	payable: z.boolean().optional(),
	alloc_by: z.enum(["pallet", "unit"]).optional(),
	charged_to: z.enum(["grower", "plein"]).optional()
})).middleware([moduleMiddleware("finance")]).handler(async ({ data }) => {
	const sql = await getSql();
	const [exp] = await sql.query(`select id, amount::text, paid::text, purchase_order_id, status, cancelled_at
     from expenses where id = $1`, [data.expense_id]);
	if (!exp) throw new Error("Gasto no encontrado");
	if (exp.cancelled_at) throw new Error("Este gasto está cancelado — no se puede editar.");
	const paid = n(exp.paid);
	const oldPo = exp.purchase_order_id ?? null;
	// Sin el campo, la orden se queda como está: solo se mueve cuando quien
	// llama lo pide explícitamente (un null explícito sí la desliga).
	const nextPo = data.purchase_order_id === undefined ? oldPo : data.purchase_order_id;
	// El prorrateo al lote se recalcula solo desde los gastos de la OC, así que
	// mover el monto o la orden cambiaría una liquidación ya facturada.
	const movesMoney = Math.abs(n(exp.amount) - data.amount) > .009 || nextPo !== oldPo;
	if (movesMoney) {
		for (const poId of [oldPo, nextPo]) {
			const bill = await settledBillFor(sql, poId);
			if (bill) throw new Error(`La orden de este gasto ya se liquidó en ${bill} — solo puedes corregir datos que no muevan el monto.`);
		}
	}
	if (data.amount < paid - .009) throw new Error(`Ya se pagaron ${paid.toFixed(2)} de este gasto — el monto no puede quedar por debajo.`);
	const payable = data.payable !== false;
	const status = payable ? moneyStatus(data.amount, paid) : "paid";
	await sql.query(`update expenses set category = $1, supplier_id = $2, purchase_order_id = $3, amount = $4,
       unit_cost = $4, invoice_number = $5, notes = $6, payable = $7, alloc_by = $8, charged_to = $9,
       paid = $10, status = $11 where id = $12`, [
		data.category,
		data.supplier_id,
		nextPo,
		data.amount,
		data.invoice_number || null,
		data.notes || null,
		payable,
		data.alloc_by || "pallet",
		data.charged_to || "plein",
		payable ? paid : data.amount,
		status,
		data.expense_id
	]);
	if (nextPo !== oldPo && oldPo != null) {
		await sql.query(`delete from expense_po_links where expense_id = $1 and purchase_order_id = $2`, [data.expense_id, oldPo]);
	}
	if (nextPo != null) {
		await sql.query(`insert into expense_po_links (expense_id, purchase_order_id, amount_applied) values ($1,$2,$3)
         on conflict (expense_id, purchase_order_id) do update set amount_applied = excluded.amount_applied`, [
			data.expense_id,
			nextPo,
			data.amount
		]);
	}
	return { ok: true };
});
export const cancelExpense = createServerFn({ method: "POST" }).validator(z.object({
	expense_id: z.number(),
	reason: z.string().min(1)
})).middleware([moduleMiddleware("finance")]).handler(async ({ data }) => {
	const sql = await getSql();
	const [exp] = await sql.query(`select e.id, e.expense_number, e.amount::text, e.paid::text, e.purchase_order_id,
            e.cancelled_at, s.name as supplier_name
     from expenses e join suppliers s on s.id = e.supplier_id where e.id = $1`, [data.expense_id]);
	if (!exp) throw new Error("Gasto no encontrado");
	if (exp.cancelled_at) throw new Error("Este gasto ya está cancelado.");
	const bill = await settledBillFor(sql, exp.purchase_order_id ?? null);
	if (bill) throw new Error(`La orden de este gasto ya se liquidó en ${bill} — cancela primero esa liquidación.`);
	const paid = n(exp.paid);
	let reversal: string | null = null;
	// Si ya salió dinero de caja, no se borra: entra un movimiento inverso para
	// que la caja cuadre y quede el rastro de los dos lados.
	if (paid > .009) {
		reversal = await nextCode(sql, "cash_movements", "folio", "MOV-");
		await sql.query(`insert into cash_movements (folio, mov_date, kind, counterparty, expense_id, amount, notes)
         values ($1,$2,'pago',$3,$4,$5,$6)`, [
			reversal,
			todayISO(),
			exp.supplier_name,
			exp.id,
			paid,
			`Reverso por cancelación de ${exp.expense_number}: ${data.reason}`
		]);
	}
	// Se suelta el prorrateo y la CxP; el gasto queda visible como cancelado.
	await sql.query(`delete from expense_po_links where expense_id = $1`, [data.expense_id]);
	await sql.query(`update expenses set status = 'cancelled', cancelled_at = now(), cancel_reason = $1,
       payable = false, paid = 0, purchase_order_id = null where id = $2`, [data.reason, data.expense_id]);
	return {
		ok: true,
		expense_number: String(exp.expense_number),
		reversal
	};
});
export const registerPagoGasto = createServerFn({ method: "POST" }).validator(z.object({
	expense_id: z.number(),
	amount: z.number().positive(),
	notes: z.string().optional()
})).middleware([moduleMiddleware("finance")]).handler(async ({ data }) => {
	const sql = await getSql();
	const [exp] = await sql.query(`select e.id, e.expense_number, s.name as supplier_name, e.amount::text, e.paid::text
       from expenses e join suppliers s on s.id = e.supplier_id where e.id = $1`, [data.expense_id]);
	if (!exp) throw new Error("Expense not found");
	const remaining = n(exp.amount) - n(exp.paid);
	if (data.amount > remaining + .009) throw new Error(`Balance on ${exp.expense_number} is ${remaining.toFixed(2)}`);
	const paid = n(exp.paid) + data.amount;
	const status = moneyStatus(n(exp.amount), paid);
	await sql.query(`update expenses set paid = $1, status = $2 where id = $3`, [
		paid,
		status,
		exp.id
	]);
	const folio = await nextCode(sql, "cash_movements", "folio", "MOV-");
	await sql.query(`insert into cash_movements (folio, mov_date, kind, counterparty, expense_id, amount, notes)
       values ($1,$2,'pago',$3,$4,$5,$6)`, [
		folio,
		todayISO(),
		exp.supplier_name,
		exp.id,
		-data.amount,
		data.notes || `Pay ${exp.expense_number}`
	]);
	return {
		folio,
		paid,
		status,
		remaining: n(exp.amount) - paid
	};
});
export const receiveMerchandise = createServerFn({ method: "POST" }).validator(z.object({
	purchase_order_id: z.number(),
	location_id: z.number(),
	received_date: z.string().optional(),
	inspection_type: z.string().default("Ninguna"),
	inspection_folio: z.string().optional(),
	unloaded: z.boolean().default(true),
	notes: z.string().optional(),
	lines: z.array(z.object({
		line_id: z.number(),
		result: z.enum([
			"Aceptada",
			"Aceptada con incidencia",
			"Rechazada"
		]),
		quantity: z.number().positive(),
		affected_qty: z.number().optional(),
		defect_type: z.string().optional(),
		defect_reason: z.string().optional(),
		notes: z.string().optional()
	})).min(1)
})).middleware([authMiddleware]).handler(async ({ data }) => {
	const sql = await getSql();
	const [po] = await sql.query(`select id, po_number, supplier_id, status from purchase_orders where id = $1`, [data.purchase_order_id]);
	if (!po) throw new Error("Orden de compra no encontrada");
	if (po.status === "cancelled") throw new Error("Esta orden de compra está cancelada");
	for (const line of data.lines) {
		if (line.result === "Rechazada" && !line.defect_reason) throw new Error("El rechazo exige un motivo");
		if (line.result === "Aceptada con incidencia") {
			if (!(n(line.affected_qty) > 0)) throw new Error("Captura cuánto viene afectado");
			if (n(line.affected_qty) > line.quantity + 1e-9) throw new Error("Lo afectado no puede ser mayor que lo recibido");
			if (!line.defect_reason) throw new Error("La incidencia exige un motivo");
		}
	}
	const warning = data.unloaded && data.lines.some((l) => l.result === "Rechazada") ? "La carga ya se descargó y hay rechazo. Bajo PACA, documenta fotos, certificado y aviso al vendedor; el rechazo con mercancía descargada no se esconde." : null;
	const receptionId = (await sql.query(`insert into receptions (purchase_order_id, received_date, inspection_type, inspection_folio, unloaded, notes, warning)
       values ($1,$2,$3,$4,$5,$6,$7) returning id`, [
		data.purchase_order_id,
		data.received_date || todayISO(),
		data.inspection_type || "Ninguna",
		data.inspection_folio || null,
		data.unloaded,
		data.notes || null,
		warning
	]))[0].id;
	const created: {
		result: string;
		lot_sano_folio?: string;
		cantidad_sana?: number;
		lot_retenido_folio?: string;
		cantidad_retenida?: number;
	}[] = [];
	for (const recLine of data.lines) {
		const [line] = await sql.query(`select id, product_id, pack_style_id, quantity_ordered::text, quantity_received::text, unit, unit_cost::text
         from purchase_order_lines where id = $1 and purchase_order_id = $2`, [recLine.line_id, data.purchase_order_id]);
		if (!line) throw new Error("Línea de compra no encontrada");
		const pending = n(line.quantity_ordered) - n(line.quantity_received);
		let lotSanoId = null;
		let lotRetId = null;
		let qtyIntoStock = 0;
		const note = recLine.defect_reason ? `${recLine.result} — ${recLine.defect_reason}` : recLine.result;
		if (recLine.result === "Rechazada") {
			if (Math.abs(recLine.quantity - pending) > .01 && recLine.quantity > pending + 1e-4) throw new Error("El rechazo es por la línea completa pendiente");
			created.push({ result: recLine.result });
		} else if (recLine.result === "Aceptada") {
			if (recLine.quantity > pending + 1e-4) throw new Error("Cantidad mayor a lo pendiente");
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
				poLineId: line.id,
				notes: "Recepción aceptada"
			});
			lotSanoId = lot.lotId;
			qtyIntoStock = recLine.quantity;
			created.push({
				result: recLine.result,
				lot_sano_folio: lot.lot_number,
				cantidad_sana: recLine.quantity
			});
		} else {
			if (recLine.quantity > pending + 1e-4) throw new Error("Cantidad mayor a lo pendiente");
			const affected = n(recLine.affected_qty);
			const sanoQty = recLine.quantity - affected;
			if (sanoQty > 1e-4) {
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
					poLineId: line.id,
					notes: "Parte sana de recepción con incidencia"
				});
				lotSanoId = lot.lotId;
				created.push({
					result: recLine.result,
					lot_sano_folio: lot.lot_number,
					cantidad_sana: sanoQty
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
				poLineId: line.id,
				notes: note
			});
			lotRetId = ret.lotId;
			const last = created[created.length - 1];
			if (last && last.result === recLine.result && !last.lot_retenido_folio) {
				last.lot_retenido_folio = ret.lot_number;
				last.cantidad_retenida = affected;
			} else created.push({
				result: recLine.result,
				lot_retenido_folio: ret.lot_number,
				cantidad_retenida: affected
			});
			qtyIntoStock = recLine.quantity;
		}
		await sql.query(`insert into reception_lines (reception_id, purchase_order_line_id, result, quantity, affected_qty, defect_type, defect_reason, lot_sano_id, lot_retenido_id, notes)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`, [
			receptionId,
			recLine.line_id,
			recLine.result,
			recLine.result === "Rechazada" ? pending : recLine.quantity,
			recLine.result === "Aceptada con incidencia" ? n(recLine.affected_qty) : null,
			recLine.defect_type || null,
			recLine.defect_reason || null,
			lotSanoId,
			lotRetId,
			recLine.notes || null
		]);
		if (qtyIntoStock > 0) await sql.query(`update purchase_order_lines set quantity_received = quantity_received + $1 where id = $2`, [qtyIntoStock, recLine.line_id]);
	}
	const [pend] = await sql.query(`select coalesce(sum(quantity_ordered - quantity_received),0)::text as pending
       from purchase_order_lines where purchase_order_id = $1`, [data.purchase_order_id]);
	const status = n(pend?.pending) <= 0 ? "received" : "partial";
	await sql.query(`update purchase_orders set status = $1 where id = $2`, [status, data.purchase_order_id]);
	return {
		receptionId,
		status,
		warning,
		lineas: created,
		po_number: po.po_number
	};
});
export const listSalesOrders = createServerFn({ method: "GET" }).middleware([authMiddleware]).handler(async () => {
	const sql = await getSql();
	const orders = await sql.query(`
    select so.id, so.so_number, so.share_token, so.customer_id, c.name as customer_name, c.phone as customer_phone, c.email as customer_email,
           c.payment_terms as customer_payment_terms, so.payment_terms, so.status,
           so.order_date::text, so.ship_date::text, so.requested_date::text, so.notes, so.customer_po_id,
           cpo.cpo_number, cpo.customer_po_number,
           so.ship_to_location_id, loc.label as ship_to_label, loc.address_line as ship_to_address_line,
           loc.city as ship_to_city, loc.state as ship_to_state, loc.zip as ship_to_zip, loc.receiving_instructions as ship_to_instructions,
           so.cancelled_at::text, so.cancelled_by, so.cancel_reason
    from sales_orders so join customers c on c.id = so.customer_id
    left join customer_pos cpo on cpo.id = so.customer_po_id
    left join customer_locations loc on loc.id = so.ship_to_location_id
    order by so.id desc
  `);
	const lines = await sql.query(`
    select l.id, l.sales_order_id, l.product_id, p.name as product_name, p.variety, l.lot_id,
           lots.lot_number, l.quantity_ordered::text, l.quantity_shipped::text, l.unit,
           l.unit_price::text, lots.unit_cost::text, l.pack_style_id,
           ps.sku_code, ps.empaque, ps.calibre
    from sales_order_lines l
    join products p on p.id = l.product_id
    left join lots on lots.id = l.lot_id
    left join pack_styles ps on ps.id = l.pack_style_id
  `);
	const invoices = await sql.query(`select id, sales_order_id, invoice_number, status from invoices where sales_order_id is not null`);
	const purchased = await sql.query(`
    select po.sales_order_id, l.product_id, l.pack_style_id, coalesce(sum(l.quantity_ordered), 0)::text as qty
    from purchase_orders po
    join purchase_order_lines l on l.purchase_order_id = po.id
    where po.sales_order_id is not null
    group by po.sales_order_id, l.product_id, l.pack_style_id
  `);
	const linkedPos = await sql.query(`select id, po_number, sales_order_id from purchase_orders where sales_order_id is not null`);
	return orders.map((o) => ({
		...o,
		invoice: invoices.find((i) => i.sales_order_id === o.id && i.status !== "cancelled") ?? null,
		purchases: linkedPos.filter((p) => p.sales_order_id === o.id),
		lines: lines.filter((l) => l.sales_order_id === o.id).map((l) => {
			const required = n(l.quantity_ordered);
			const allocated = n(l.quantity_shipped);
			const bought = n(purchased.find((p) => p.sales_order_id === o.id && p.product_id === l.product_id && (l.pack_style_id == null || p.pack_style_id === l.pack_style_id))?.qty);
			return {
				...l,
				quantity_ordered: required,
				quantity_shipped: allocated,
				unit_price: n(l.unit_price),
				unit_cost: n(l.unit_cost),
				required,
				allocated,
				purchased: bought,
				open: Math.max(required - allocated, 0)
			};
		})
	}));
});
export const createSalesOrder = createServerFn({ method: "POST" }).validator(z.object({
	customer_id: z.number(),
	notes: z.string().optional(),
	customer_po_id: z.number().optional(),
	lines: z.array(z.object({
		product_id: z.number(),
		pack_style_id: z.number().optional(),
		lot_id: z.number().optional(),
		quantity_ordered: z.number().positive(),
		unit: z.string(),
		unit_price: z.number().optional()
	})).min(1)
})).middleware([authMiddleware]).handler(async ({ data }) => {
	const sql = await getSql();
	const so_number = await nextCode(sql, "sales_orders", "so_number", "OV-");
	const created = (await sql.query(`insert into sales_orders (so_number, customer_id, status, notes, customer_po_id)
       values ($1,$2,'confirmed',$3,$4) returning id, share_token`, [
		so_number,
		data.customer_id,
		data.notes || null,
		data.customer_po_id ?? null
	]))[0];
	const id = created.id;
	for (const line of data.lines) await sql.query(`insert into sales_order_lines (sales_order_id, product_id, lot_id, quantity_ordered, unit, unit_price, pack_style_id)
         values ($1,$2,$3,$4,$5,$6,$7)`, [
		id,
		line.product_id,
		line.lot_id ?? null,
		line.quantity_ordered,
		line.unit,
		line.unit_price ?? null,
		line.pack_style_id ?? null
	]);
	return {
		id,
		so_number,
		share_token: created.share_token
	};
});
export const listCustomerPOs = createServerFn({ method: "GET" }).middleware([authMiddleware]).handler(async () => {
	const sql = await getSql();
	const orders = await sql.query(`
    select cpo.id, cpo.cpo_number, cpo.customer_id, c.name as customer_name, cpo.customer_po_number,
           cpo.po_date::text, cpo.requested_date::text, cpo.currency, cpo.attachment_url, cpo.notes, cpo.status,
           cpo.attachment_filename, (cpo.attachment_data is not null) as has_attachment,
           cpo.rejected_at::text, cpo.rejected_by, cpo.rejected_reason,
           cpo.payment_terms, cpo.ship_to_location_id,
           loc.label as ship_to_label, loc.address_line as ship_to_address_line, loc.city as ship_to_city,
           loc.state as ship_to_state, loc.zip as ship_to_zip, loc.receiving_instructions as ship_to_instructions,
           (select so.id from sales_orders so where so.customer_po_id = cpo.id order by so.id desc limit 1) as so_id,
           (select so.so_number from sales_orders so where so.customer_po_id = cpo.id order by so.id desc limit 1) as so_number
    from customer_pos cpo
    join customers c on c.id = cpo.customer_id
    left join customer_locations loc on loc.id = cpo.ship_to_location_id
    order by cpo.id desc
  `);
	const lines = await sql.query(`
    select l.id, l.customer_po_id, l.product_id, p.name as product_name, p.variety,
           l.quantity::text, l.unit, l.unit_price::text, l.notes, l.pack_style_id,
           ps.sku_code, ps.empaque, ps.calibre
    from customer_po_lines l
    join products p on p.id = l.product_id
    left join pack_styles ps on ps.id = l.pack_style_id
  `);
	return orders.map((o) => ({
		...o,
		lines: lines.filter((l) => l.customer_po_id === o.id).map((l) => ({
			...l,
			quantity: n(l.quantity),
			unit_price: n(l.unit_price)
		}))
	}));
});
const createCustomerPOPayload = z.object({
	customer_id: z.number(),
	customer_po_number: z.string().optional(),
	po_date: z.string().optional(),
	requested_date: z.string().optional(),
	currency: z.string().default("USD"),
	payment_terms: z.string().optional(),
	ship_to_location_id: z.number().optional(),
	notes: z.string().optional(),
	lines: z.array(z.object({
		product_id: z.number(),
		pack_style_id: z.number().optional(),
		quantity: z.number().positive(),
		unit: z.string(),
		unit_price: z.number().optional(),
		notes: z.string().optional()
	})).min(1)
});
const MAX_ATTACHMENT_BYTES = 15 * 1024 * 1024;
export const createCustomerPO = createServerFn({ method: "POST" }).validator((form: FormData) => {
	const raw = form.get("payload");
	if (typeof raw !== "string") throw new Error("Falta la información del PO");
	const payload = createCustomerPOPayload.parse(JSON.parse(raw));
	const file = form.get("file");
	return { payload, file: file instanceof File ? file : null };
}).middleware([authMiddleware]).handler(async ({ data }) => {
	const sql = await getSql();
	const { payload } = data;
	let attachment: { filename: string; mime: string; bytes: Buffer } | null = null;
	if (data.file) {
		if (data.file.size > MAX_ATTACHMENT_BYTES) throw new Error("El archivo pesa más de 15 MB — súbelo más chico.");
		attachment = {
			filename: data.file.name,
			mime: data.file.type || "application/octet-stream",
			bytes: Buffer.from(await data.file.arrayBuffer())
		};
	}
	const d = /* @__PURE__ */ new Date();
	const cpo_number = await nextCode(sql, "customer_pos", "cpo_number", `CPO-${String(d.getFullYear()).slice(2)}${String(d.getMonth() + 1).padStart(2, "0")}-`);
	const id = (await sql.query(`insert into customer_pos
         (cpo_number, customer_id, customer_po_number, po_date, requested_date, currency, payment_terms, ship_to_location_id, notes, status, attachment_filename, attachment_mime, attachment_data)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,'open',$10,$11,$12) returning id`, [
		cpo_number,
		payload.customer_id,
		payload.customer_po_number?.trim() || null,
		payload.po_date || todayISO(),
		payload.requested_date || null,
		payload.currency || "USD",
		payload.payment_terms?.trim() || null,
		payload.ship_to_location_id ?? null,
		payload.notes || null,
		attachment?.filename ?? null,
		attachment?.mime ?? null,
		attachment?.bytes ?? null
	]))[0].id;
	for (const line of payload.lines) await sql.query(`insert into customer_po_lines (customer_po_id, product_id, quantity, unit, unit_price, notes, pack_style_id)
         values ($1,$2,$3,$4,$5,$6,$7)`, [
		id,
		line.product_id,
		line.quantity,
		line.unit,
		line.unit_price ?? null,
		line.notes || null,
		line.pack_style_id ?? null
	]);
	return {
		id,
		cpo_number
	};
});
export const convertCustomerPOToSO = createServerFn({ method: "POST" }).validator(z.object({ customer_po_id: z.number() })).middleware([authMiddleware]).handler(async ({ data }) => {
	const sql = await getSql();
	const [cpo] = await sql.query(`select id, cpo_number, customer_id, customer_po_number, status, notes, requested_date::text, payment_terms, ship_to_location_id from customer_pos where id = $1`, [data.customer_po_id]);
	if (!cpo) throw new Error("Customer PO no encontrado");
	if (cpo.status === "converted") {
		const [existing] = await sql.query(`select so_number from sales_orders where customer_po_id = $1 order by id desc limit 1`, [cpo.id]);
		throw new Error(`Este PO ya se convirtió${existing ? ` a ${existing.so_number}` : ""}`);
	}
	if (cpo.status === "rejected") throw new Error("Este Customer PO está rechazado — no se puede convertir");
	if (cpo.status !== "open") throw new Error("Solo se convierten POs abiertos");
	const lines = await sql.query(`select product_id, quantity::text, unit, unit_price::text, pack_style_id from customer_po_lines where customer_po_id = $1`, [cpo.id]);
	if (!lines.length) throw new Error("El Customer PO no tiene líneas");
	const so_number = await nextCode(sql, "sales_orders", "so_number", "OV-");
	const note = [
		`Desde ${cpo.cpo_number}`,
		cpo.customer_po_number ? `PO cliente ${cpo.customer_po_number}` : null,
		cpo.notes
	].filter(Boolean).join(" · ");
	// Destino y condiciones de pago viajan del CPO a la venta. Falta seguirlos
	// más allá: embarque (BOL con el domicilio de este ship_to_location_id) y
	// factura (usar so.payment_terms, no solo el default del cliente — ya
	// aplicado en createInvoiceFromSO, pero el documento impreso de la
	// factura/BOL todavía no imprime la dirección de entrega).
	const id = (await sql.query(`insert into sales_orders (so_number, customer_id, status, notes, customer_po_id, requested_date, ship_to_location_id, payment_terms)
       values ($1,$2,'confirmed',$3,$4,$5,$6,$7) returning id`, [
		so_number,
		cpo.customer_id,
		note,
		cpo.id,
		cpo.requested_date || null,
		cpo.ship_to_location_id || null,
		cpo.payment_terms || null
	]))[0].id;
	for (const line of lines) await sql.query(`insert into sales_order_lines (sales_order_id, product_id, quantity_ordered, unit, unit_price, pack_style_id)
         values ($1,$2,$3,$4,$5,$6)`, [
		id,
		line.product_id,
		n(line.quantity),
		line.unit,
		n(line.unit_price) || null,
		line.pack_style_id
	]);
	await sql.query(`update customer_pos set status = 'converted' where id = $1`, [cpo.id]);
	return {
		id,
		so_number,
		cpo_number: cpo.cpo_number
	};
});
export const rejectCustomerPO = createServerFn({ method: "POST" }).validator(z.object({
	customer_po_id: z.number(),
	reason: z.string().trim().min(1, "Escribe el motivo del rechazo")
})).middleware([authMiddleware]).handler(async ({ data, context }) => {
	const sql = await getSql();
	const [cpo] = await sql.query(`select id, cpo_number, status from customer_pos where id = $1`, [data.customer_po_id]);
	if (!cpo) throw new Error("Customer PO no encontrado");
	if (cpo.status === "converted") throw new Error("Este Customer PO ya se convirtió a venta — no se puede rechazar");
	if (cpo.status === "rejected") throw new Error(`El PO ${cpo.cpo_number} ya está rechazado`);
	const staffName = await staffNameFor(sql, context.userId);
	await sql.query(`update customer_pos set status='rejected', rejected_at=now(), rejected_by=$1, rejected_reason=$2 where id=$3`, [staffName, data.reason, cpo.id]);
	return { cpo_number: cpo.cpo_number };
});
export const extractCustomerPO = createServerFn({ method: "POST" }).validator((form: FormData) => {
	const file = form.get("file");
	if (!(file instanceof File)) throw new Error("Falta el archivo");
	return file;
}).middleware([authMiddleware]).handler(async ({ data: file }) => {
	if (file.size > MAX_ATTACHMENT_BYTES) return { ok: false as const, reason: "El archivo pesa más de 15 MB — súbelo más chico." };
	const { extractCustomerPOFile, matchCustomer, matchSku, matchLocation } = await import("@/lib/po-extract.server");
	const buf = Buffer.from(await file.arrayBuffer());
	const result = await extractCustomerPOFile(buf, file.type || "application/octet-stream", file.name);
	if (!result.ok) return result;
	const sql = await getSql();
	const customers = await sql.query(`select id, name from customers`);
	const skuRows = await sql.query(`
    select ps.id, ps.product_id, ps.sku_code, ps.empaque, ps.calibre, p.name as product_name, coalesce(ps.unit_of_measure, 'caja') as unit
    from pack_styles ps join products p on p.id = ps.product_id
  `);
	const customer_id = matchCustomer(result.data.customer_name, customers);
	const lines = result.data.lines.map((line) => {
		const match = matchSku(line, skuRows);
		return { ...line, ...match };
	});
	let ship_to_location_id: number | null = null;
	if (customer_id && result.data.ship_to_address_line) {
		const locations = await sql.query(`select id, address_line, city from customer_locations where customer_id = $1`, [customer_id]);
		ship_to_location_id = matchLocation(result.data, locations);
	}
	return { ok: true as const, data: { ...result.data, customer_id, ship_to_location_id, lines } };
});
export const createPurchaseFromSO = createServerFn({ method: "POST" }).validator(z.object({
	sales_order_id: z.number(),
	supplier_id: z.number(),
	deal_type: z.enum(["firme", "consignacion", "comision"]).default("firme"),
	unit_cost: z.number().positive().optional(),
	commission_type: z.enum(["per_unit", "gross_pct", "net_pct"]).optional(),
	commission_rate: z.number().min(0).optional(),
	notes: z.string().optional()
})).middleware([authMiddleware]).handler(async ({ data }) => {
	if (data.deal_type === "firme") {
		if (!(n(data.unit_cost) > 0)) throw new Error("Trato en firme: captura el costo — es un precio cerrado.");
	} else if (data.unit_cost != null) {
		throw new Error("En consignación o comisión no se captura costo — se define al liquidar, después de vender.");
	}
	if (data.commission_type != null && !(n(data.commission_rate) > 0)) throw new Error("Captura la tarifa de la comisión (monto por caja o %).");
	const sql = await getSql();
	const [so] = await sql.query(`select id, so_number, status from sales_orders where id = $1`, [data.sales_order_id]);
	if (!so) throw new Error("Orden de venta no encontrada");
	if (so.status === "cancelled") throw new Error("Esta orden de venta está cancelada");
	const lines = await sql.query(`select l.product_id, p.name as product_name, l.quantity_ordered::text, l.unit, l.pack_style_id
       from sales_order_lines l join products p on p.id = l.product_id
       where l.sales_order_id = $1`, [data.sales_order_id]);
	if (!lines.length) throw new Error("La venta no tiene líneas");
	const bought = await sql.query(`select l.product_id, l.pack_style_id, coalesce(sum(l.quantity_ordered),0)::text as qty
       from purchase_orders po
       join purchase_order_lines l on l.purchase_order_id = po.id
       where po.sales_order_id = $1
       group by l.product_id, l.pack_style_id`, [data.sales_order_id]);
	const toBuy = lines.map((l) => {
		const already = n(bought.find((b) => b.product_id === l.product_id && (l.pack_style_id == null || b.pack_style_id === l.pack_style_id))?.qty);
		return {
			...l,
			remaining: n(l.quantity_ordered) - already
		};
	}).filter((l) => l.remaining > 1e-4);
	if (!toBuy.length) throw new Error("Esta venta ya tiene compra por todo lo pedido");
	const po_number = await nextCode(sql, "purchase_orders", "po_number", "OC-");
	const withCommission = data.deal_type !== "firme" && data.commission_type != null;
	const id = (await sql.query(`insert into purchase_orders (po_number, supplier_id, deal_type, status, notes, sales_order_id, commission_type, commission_rate)
       values ($1,$2,$3,'confirmed',$4,$5,$6,$7) returning id`, [
		po_number,
		data.supplier_id,
		data.deal_type,
		data.notes || `Generada desde ${so.so_number}`,
		so.id,
		withCommission ? data.commission_type : null,
		withCommission ? data.commission_rate : null
	]))[0].id;
	for (const line of toBuy) {
		let packId = line.pack_style_id;
		if (!packId) {
			const [pack] = await sql.query(`select id from pack_styles where product_id = $1 order by is_default desc, id limit 1`, [line.product_id]);
			packId = pack?.id ?? null;
		}
		await sql.query(`insert into purchase_order_lines (purchase_order_id, product_id, pack_style_id, quantity_ordered, unit, unit_cost)
         values ($1,$2,$3,$4,$5,$6)`, [
			id,
			line.product_id,
			packId,
			line.remaining,
			line.unit,
			data.deal_type === "firme" ? data.unit_cost : null
		]);
	}
	return {
		id,
		po_number,
		so_number: so.so_number
	};
});
export const shipSalesLine = createServerFn({ method: "POST" }).validator(z.object({
	line_id: z.number(),
	quantity: z.number().positive(),
	lot_id: z.number(),
	location_id: z.number()
})).middleware([authMiddleware]).handler(async ({ data }) => {
	const sql = await getSql();
	const [line] = await sql.query(`select l.id, l.sales_order_id, l.product_id, l.quantity_ordered::text, l.quantity_shipped::text, l.unit, so.status as so_status
       from sales_order_lines l join sales_orders so on so.id = l.sales_order_id where l.id = $1`, [data.line_id]);
	if (!line) throw new Error("Línea no encontrada");
	if (line.so_status === "cancelled") throw new Error("Esta orden de venta está cancelada");
	const remaining = n(line.quantity_ordered) - n(line.quantity_shipped);
	if (data.quantity > remaining + 1e-4) throw new Error("Cantidad mayor a lo pendiente");
	const [lot] = await sql.query(`select product_id, current_qty::text, coalesce(quality_state, 'sano') as quality_state, lot_number, coalesce(held,false) as held from lots where id = $1`, [data.lot_id]);
	if (!lot || lot.product_id !== line.product_id) throw new Error("El lote no corresponde al producto");
	if (lot.held) throw new Error(`Lot ${lot.lot_number} is on hold.`);
	if (lot.quality_state !== "sano") throw new Error(`No se puede despachar el lote ${lot.lot_number}: está ${lot.quality_state}. Libéralo a Sano en Inventario.`);
	const [inv] = await sql.query(`select quantity::text from inventory where lot_id = $1 and location_id = $2`, [data.lot_id, data.location_id]);
	if (!inv || n(inv.quantity) < data.quantity) throw new Error("Stock insuficiente en esa ubicación");
	await sql.query(`update inventory set quantity = quantity - $1 where lot_id = $2 and location_id = $3`, [
		data.quantity,
		data.lot_id,
		data.location_id
	]);
	await sql.query(`update lots set current_qty = current_qty - $1, status = case when current_qty - $1 <= 0 then 'depleted' else status end where id = $2`, [data.quantity, data.lot_id]);
	await sql.query(`insert into inventory_movements (lot_id, location_id, movement_type, quantity, unit, reference_type, reference_id, notes)
       values ($1,$2,'ship',$3,$4,'sales_order',$5,'Despacho de venta')`, [
		data.lot_id,
		data.location_id,
		-data.quantity,
		line.unit,
		line.sales_order_id
	]);
	await sql.query(`update sales_order_lines set quantity_shipped = quantity_shipped + $1, lot_id = $2 where id = $3`, [
		data.quantity,
		data.lot_id,
		data.line_id
	]);
	// Atribución real: sol.lot_id solo guarda el último lote despachado; esta
	// tabla es la fuente de verdad de qué lote surtió cuánto de cada línea.
	await sql.query(`insert into sale_line_allocations (sales_order_line_id, lot_id, quantity) values ($1,$2,$3)`, [
		data.line_id,
		data.lot_id,
		data.quantity
	]);
	const [so] = await sql.query(`select coalesce(sum(quantity_ordered - quantity_shipped),0)::text as pending from sales_order_lines where sales_order_id = $1`, [line.sales_order_id]);
	const status = n(so?.pending) <= 0 ? "completed" : "partial";
	await sql.query(`update sales_orders set status = $1, ship_date = coalesce(ship_date, $2) where id = $3`, [
		status,
		todayISO(),
		line.sales_order_id
	]);
	return { status };
});
export const createInvoiceFromSO = createServerFn({ method: "POST" }).validator(z.object({ sales_order_id: z.number() })).middleware([authMiddleware]).handler(async ({ data }) => {
	const sql = await getSql();
	const [existing] = await sql.query(`select invoice_number from invoices where sales_order_id = $1 and status <> 'cancelled'`, [data.sales_order_id]);
	if (existing) throw new Error(`Esta venta ya tiene factura ${existing.invoice_number}`);
	const [so] = await sql.query(`select so.id, so.so_number, so.customer_id, coalesce(so.payment_terms, c.payment_terms) as payment_terms, so.status
       from sales_orders so join customers c on c.id = so.customer_id where so.id = $1`, [data.sales_order_id]);
	if (!so) throw new Error("Orden de venta no encontrada");
	if (so.status === "cancelled") throw new Error("Esta orden de venta está cancelada");
	const billable = (await sql.query(`select l.product_id, p.name as product_name, l.quantity_ordered::text, l.quantity_shipped::text, l.unit, l.unit_price::text
       from sales_order_lines l join products p on p.id = l.product_id where l.sales_order_id = $1`, [data.sales_order_id])).map((l) => ({
		...l,
		qty: n(l.quantity_shipped) > 0 ? n(l.quantity_shipped) : n(l.quantity_ordered),
		unit_price: n(l.unit_price)
	})).filter((l) => l.qty > 0 && l.unit_price > 0);
	if (!billable.length) throw new Error("No hay líneas con precio para facturar. Despacha o captura precio.");
	const subtotal = billable.reduce((s, l) => s + l.qty * l.unit_price, 0);
	const issue = todayISO();
	const due = addDaysISO(issue, termsDays(so.payment_terms));
	const invoice_number = await nextCode(sql, "invoices", "invoice_number", `PP-${issue.slice(0, 4)}-`, 4);
	const id = (await sql.query(`insert into invoices (invoice_number, sales_order_id, customer_id, status, issue_date, due_date, subtotal, total, paid, notes)
       values ($1,$2,$3,'open',$4,$5,$6,$6,0,$7) returning id`, [
		invoice_number,
		so.id,
		so.customer_id,
		issue,
		due,
		subtotal,
		`Factura de ${so.so_number}`
	]))[0].id;
	for (const l of billable) await sql.query(`insert into invoice_lines (invoice_id, product_id, description, quantity, unit, unit_price, amount)
         values ($1,$2,$3,$4,$5,$6,$7)`, [
		id,
		l.product_id,
		l.product_name,
		l.qty,
		l.unit,
		l.unit_price,
		l.qty * l.unit_price
	]);
	return {
		id,
		invoice_number,
		total: subtotal,
		due_date: due
	};
});
export const createBillFromPO = createServerFn({ method: "POST" }).validator(z.object({ purchase_order_id: z.number() })).middleware([authMiddleware]).handler(async ({ data }) => {
	const sql = await getSql();
	const [existing] = await sql.query(`select bill_number from supplier_bills where purchase_order_id = $1 and status <> 'cancelled'`, [data.purchase_order_id]);
	if (existing) throw new Error(`Esta compra ya tiene factura ${existing.bill_number}`);
	const [po] = await sql.query(`select id, po_number, supplier_id, status, coalesce(deal_type,'firme') as deal_type from purchase_orders where id = $1`, [data.purchase_order_id]);
	if (!po) throw new Error("Orden de compra no encontrada");
	if (po.status === "cancelled") throw new Error("Esta orden de compra está cancelada");
	if (po.deal_type === "comision") throw new Error("Este trato es a comisión pura: Plein no compra la fruta — no se genera factura de proveedor por su valor.");
	const lines = await sql.query(`select quantity_ordered::text, quantity_received::text, unit_cost::text
       from purchase_order_lines where purchase_order_id = $1`, [data.purchase_order_id]);
	const ordered = lines.reduce((s, l) => s + n(l.quantity_ordered), 0);
	const received = lines.reduce((s, l) => s + n(l.quantity_received), 0);
	if (received <= 0) throw new Error("Todavía no hay mercancía recibida para facturar al proveedor");
	if (po.deal_type === "consignacion" && !lines.some((l) => n(l.unit_cost) > 0)) {
		throw new Error("Este trato es en consignación: el costo se define al liquidar, después de vender. Corre \"Calculate settlement\" primero.");
	}
	// En firme el costo lo capturó Miguel, así que qty × costo ya es exacto.
	// En consignación liquidada, el costo/unidad que se guardó en cada línea
	// viene de redondear a 4 decimales el resultado de repartir el neto entre
	// las cajas — al multiplicar de vuelta por la cantidad, ese redondeo se
	// puede notar un centavo. Para que la bill cuadre exacto con lo que
	// Miguel vio en el settlement, se usa el neto ya calculado ahí
	// (loadSettlement hace la misma cuenta, sin pasar por ese redondeo).
	const total = po.deal_type === "firme" ? lines.reduce((s, l) => s + n(l.quantity_received) * n(l.unit_cost), 0) : Math.round((await loadSettlement(sql, po.id)).inventory_total * 100) / 100;
	const issue = todayISO();
	const bill_number = await nextCode(sql, "supplier_bills", "bill_number", "FAC-");
	return {
		id: (await sql.query(`insert into supplier_bills (bill_number, purchase_order_id, supplier_id, status, issue_date, due_date, ordered_qty, received_qty, total, paid, notes)
       values ($1,$2,$3,'open',$4,$5,$6,$7,$8,0,$9) returning id`, [
			bill_number,
			po.id,
			po.supplier_id,
			issue,
			addDaysISO(issue, 7),
			ordered,
			received,
			total,
			`Factura de ${po.po_number}`
		]))[0].id,
		bill_number,
		total,
		ordered,
		received
	};
});

// ---- Cancelar (Sesión 2 — Poder equivocarse) ------------------------------
// Cada cancelación revierte solo lo que ESE documento causó directamente, y
// bloquea con un mensaje claro si hay algo encadenado después que haya que
// deshacer primero (una factura ya cobrada, una OC ya recibida y vendida).
// Nada del corte (opening, bills sin OC, CORTE-CHASE) se puede cancelar.

export const cancelInvoice = createServerFn({ method: "POST" }).validator(z.object({
	invoice_id: z.number(),
	reason: z.string().optional()
})).middleware([moduleMiddleware("finance")]).handler(async ({ data, context }) => {
	const sql = await getSql();
	const [inv] = await sql.query(`select id, invoice_number, status, invoice_type, paid::text from invoices where id = $1`, [data.invoice_id]);
	if (!inv) throw new Error("Factura no encontrada");
	if (inv.status === "cancelled") throw new Error(`La factura ${inv.invoice_number} ya está cancelada`);
	if (inv.invoice_type === "opening") throw new Error("Es una factura del corte de apertura — no se puede cancelar");
	if (n(inv.paid) > 0.009) {
		const folios = await findPaymentFolios(sql, "invoice", inv.id);
		throw new Error(`Esta factura tiene $${n(inv.paid).toFixed(2)} cobrado${folios.length ? ` (folio${folios.length > 1 ? "s" : ""} ${folios.join(", ")})` : ""}. Cancela ese cobro primero.`);
	}
	const staffName = await staffNameFor(sql, context.userId);
	await sql.query(`update invoices set status='cancelled', cancelled_at=now(), cancelled_by=$1, cancel_reason=$2 where id=$3`, [staffName, data.reason || null, inv.id]);
	return { invoice_number: inv.invoice_number };
});

export const cancelSalesOrder = createServerFn({ method: "POST" }).validator(z.object({
	sales_order_id: z.number(),
	reason: z.string().optional()
})).middleware([moduleMiddleware("orders")]).handler(async ({ data, context }) => {
	const sql = await getSql();
	const [so] = await sql.query(`select id, so_number, status from sales_orders where id = $1`, [data.sales_order_id]);
	if (!so) throw new Error("Orden de venta no encontrada");
	if (so.status === "cancelled") throw new Error(`La orden ${so.so_number} ya está cancelada`);
	const [inv] = await sql.query(`select invoice_number from invoices where sales_order_id = $1 and status <> 'cancelled'`, [so.id]);
	if (inv) throw new Error(`Esta orden ya tiene la factura ${inv.invoice_number}. Cancela esa factura primero.`);
	const shipMovs = await sql.query(`select lot_id, location_id, quantity::text, unit from inventory_movements
       where reference_type='sales_order' and reference_id=$1 and movement_type='ship'`, [so.id]);
	for (const mv of shipMovs) {
		const qty = Math.abs(n(mv.quantity));
		if (qty <= 1e-9) continue;
		await sql.query(`insert into inventory (lot_id, location_id, quantity) values ($1,$2,$3)
         on conflict (lot_id, location_id) do update set quantity = inventory.quantity + excluded.quantity`, [mv.lot_id, mv.location_id, qty]);
		await sql.query(`update lots set current_qty = current_qty + $1, status = case when status = 'depleted' then 'active' else status end where id = $2`, [qty, mv.lot_id]);
		await sql.query(`insert into inventory_movements (lot_id, location_id, movement_type, quantity, unit, reference_type, reference_id, notes)
         values ($1,$2,'cancel_ship',$3,$4,'sales_order',$5,$6)`, [mv.lot_id, mv.location_id, qty, mv.unit, so.id, `Cancelación ${so.so_number}`]);
	}
	await sql.query(`delete from sale_line_allocations where sales_order_line_id in (select id from sales_order_lines where sales_order_id = $1)`, [so.id]);
	await sql.query(`update sales_order_lines set quantity_shipped = 0, lot_id = null where sales_order_id = $1`, [so.id]);
	const staffName = await staffNameFor(sql, context.userId);
	await sql.query(`update sales_orders set status='cancelled', cancelled_at=now(), cancelled_by=$1, cancel_reason=$2 where id=$3`, [staffName, data.reason || null, so.id]);
	return { so_number: so.so_number };
});

export const cancelPurchaseOrder = createServerFn({ method: "POST" }).validator(z.object({
	purchase_order_id: z.number(),
	reason: z.string().optional()
})).middleware([moduleMiddleware("orders")]).handler(async ({ data, context }) => {
	const sql = await getSql();
	const [po] = await sql.query(`select id, po_number, status from purchase_orders where id = $1`, [data.purchase_order_id]);
	if (!po) throw new Error("Orden de compra no encontrada");
	if (po.status === "cancelled") throw new Error(`La orden ${po.po_number} ya está cancelada`);
	const [bill] = await sql.query(`select bill_number from supplier_bills where purchase_order_id = $1 and status <> 'cancelled'`, [po.id]);
	if (bill) throw new Error(`Esta orden ya tiene la factura de proveedor ${bill.bill_number}. Cancela esa factura primero.`);
	const lots = await sql.query(`select id, lot_number, original_qty::text, current_qty::text, unit, status from lots where purchase_order_id = $1`, [po.id]);
	const touched = lots.filter((l) => l.status !== "cancelled" && Math.abs(n(l.current_qty) - n(l.original_qty)) > 1e-6);
	if (touched.length) {
		throw new Error(`Los lotes ${touched.map((l) => l.lot_number).join(", ")} de esta orden ya se vendieron, mermaron o reempacaron. Corrige o deshaz eso primero antes de cancelar la recepción.`);
	}
	for (const lot of lots) {
		if (lot.status === "cancelled") continue;
		const qty = n(lot.original_qty);
		if (qty > 1e-9) {
			await sql.query(`update inventory set quantity = 0 where lot_id = $1`, [lot.id]);
			await sql.query(`insert into inventory_movements (lot_id, movement_type, quantity, unit, reference_type, reference_id, notes)
           values ($1,'cancel_receive',$2,$3,'purchase_order',$4,$5)`, [lot.id, -qty, lot.unit, po.id, `Cancelación ${po.po_number}`]);
		}
		await sql.query(`update lots set current_qty = 0, status='cancelled' where id = $1`, [lot.id]);
	}
	await sql.query(`update purchase_order_lines set quantity_received = 0 where purchase_order_id = $1`, [po.id]);
	const staffName = await staffNameFor(sql, context.userId);
	await sql.query(`update purchase_orders set status='cancelled', cancelled_at=now(), cancelled_by=$1, cancel_reason=$2 where id=$3`, [staffName, data.reason || null, po.id]);
	return { po_number: po.po_number };
});

export const cancelSupplierBill = createServerFn({ method: "POST" }).validator(z.object({
	bill_id: z.number(),
	reason: z.string().optional()
})).middleware([moduleMiddleware("finance")]).handler(async ({ data, context }) => {
	const sql = await getSql();
	const [bill] = await sql.query(`select id, bill_number, status, purchase_order_id, paid::text from supplier_bills where id = $1`, [data.bill_id]);
	if (!bill) throw new Error("Factura de proveedor no encontrada");
	if (bill.status === "cancelled") throw new Error(`La factura ${bill.bill_number} ya está cancelada`);
	if (bill.purchase_order_id == null) throw new Error("Es una factura del corte de apertura — no se puede cancelar");
	if (n(bill.paid) > 0.009) {
		const folios = await findPaymentFolios(sql, "bill", bill.id);
		throw new Error(`Esta factura tiene $${n(bill.paid).toFixed(2)} pagado${folios.length ? ` (folio${folios.length > 1 ? "s" : ""} ${folios.join(", ")})` : ""}. Cancela ese pago primero.`);
	}
	const staffName = await staffNameFor(sql, context.userId);
	await sql.query(`update supplier_bills set status='cancelled', cancelled_at=now(), cancelled_by=$1, cancel_reason=$2 where id=$3`, [staffName, data.reason || null, bill.id]);
	return { bill_number: bill.bill_number };
});

export const cancelCustomerPayment = createServerFn({ method: "POST" }).validator(z.object({
	cash_movement_id: z.number(),
	reason: z.string().optional()
})).middleware([moduleMiddleware("finance")]).handler(async ({ data, context }) => {
	const sql = await getSql();
	return cancelCashMovementById(sql, context, data.cash_movement_id, "cobro", data.reason);
});

export const cancelVendorPayment = createServerFn({ method: "POST" }).validator(z.object({
	cash_movement_id: z.number(),
	reason: z.string().optional()
})).middleware([moduleMiddleware("finance")]).handler(async ({ data, context }) => {
	const sql = await getSql();
	return cancelCashMovementById(sql, context, data.cash_movement_id, "pago", data.reason);
});

export const listInvoices = createServerFn({ method: "GET" }).middleware([moduleMiddleware("finance")]).handler(async () => {
	const sql = await getSql();
	const invoices = await sql.query(`
    select i.id, i.invoice_number, i.share_token, i.sales_order_id, so.so_number, i.customer_id, c.name as customer_name,
           c.phone as customer_phone, c.email as customer_email,
           i.status, i.issue_date::text, i.due_date::text, i.subtotal::text, i.total::text, i.paid::text, i.notes,
           coalesce(i.invoice_type,'sale') as invoice_type, c.payment_terms, i.sales_rep,
           i.cancelled_at::text, i.cancelled_by, i.cancel_reason
    from invoices i
    join customers c on c.id = i.customer_id
    left join sales_orders so on so.id = i.sales_order_id
    order by i.id desc
  `);
	const lines = await sql.query(`select invoice_id, description, quantity::text, unit, unit_price::text, amount::text from invoice_lines`);
	return invoices.map((i) => {
		const total = n(i.total);
		const paid = n(i.paid);
		const saldo = Math.max(total - paid, 0);
		const days = i.due_date ? Math.round((Date.now() - (/* @__PURE__ */ new Date(`${i.due_date}T12:00:00`)).getTime()) / 864e5) : 0;
		return {
			...i,
			subtotal: n(i.subtotal),
			total,
			paid,
			saldo,
			overdue: saldo > .009 && !!i.due_date && days > 0,
			days_overdue: saldo > .009 && days > 0 ? days : 0,
			lines: lines.filter((l) => l.invoice_id === i.id).map((l) => ({
				...l,
				quantity: n(l.quantity),
				unit_price: n(l.unit_price),
				amount: n(l.amount)
			}))
		};
	});
});
export const listBills = createServerFn({ method: "GET" }).middleware([moduleMiddleware("finance")]).handler(async () => {
	return (await (await getSql()).query(`
    select b.id, b.bill_number, b.purchase_order_id, po.po_number, b.supplier_id, s.name as supplier_name,
           s.phone as supplier_phone, s.email as supplier_email,
           b.status, b.issue_date::text, b.due_date::text, b.ordered_qty::text, b.received_qty::text,
           b.total::text, b.paid::text, b.notes, b.cancelled_at::text, b.cancelled_by, b.cancel_reason
    from supplier_bills b
    join suppliers s on s.id = b.supplier_id
    left join purchase_orders po on po.id = b.purchase_order_id
    order by b.id desc
  `)).map((b) => {
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
			match: Math.abs(ordered - received) < .01 ? "cuadrado" : received < ordered ? "faltante" : "de más"
		};
	});
});
export const listCash = createServerFn({ method: "GET" }).middleware([moduleMiddleware("finance")]).handler(async () => {
	const movements = (await (await getSql()).query(`
    select m.id, m.folio, m.mov_date::text, m.kind, m.counterparty,
           i.invoice_number, b.bill_number, m.amount::text, m.notes,
           m.cancelled_at::text, m.cancelled_by, m.cancel_reason
    from cash_movements m
    left join invoices i on i.id = m.invoice_id
    left join supplier_bills b on b.id = m.supplier_bill_id
    order by m.mov_date desc, m.id desc
  `)).map((r) => ({
		...r,
		amount: n(r.amount)
	}));
	return {
		balance: movements.filter((m) => !m.cancelled_at).reduce((s, m) => s + m.amount, 0),
		movements
	};
});
export const registerCobro = createServerFn({ method: "POST" }).validator(z.object({
	invoice_id: z.number(),
	amount: z.number().positive(),
	notes: z.string().optional()
})).middleware([moduleMiddleware("finance")]).handler(async ({ data }) => {
	const sql = await getSql();
	const [inv] = await sql.query(`select i.id, i.invoice_number, c.name as customer_name, i.total::text, i.paid::text
       from invoices i join customers c on c.id = i.customer_id where i.id = $1`, [data.invoice_id]);
	if (!inv) throw new Error("Factura no encontrada");
	const remaining = n(inv.total) - n(inv.paid);
	if (data.amount > remaining + .009) throw new Error(`El saldo de ${inv.invoice_number} es ${remaining.toFixed(2)}`);
	const paid = n(inv.paid) + data.amount;
	const status = moneyStatus(n(inv.total), paid);
	await sql.query(`update invoices set paid = $1, status = $2 where id = $3`, [
		paid,
		status,
		inv.id
	]);
	const folio = await nextCode(sql, "cash_movements", "folio", "MOV-");
	await sql.query(`insert into cash_movements (folio, mov_date, kind, counterparty, invoice_id, amount, notes)
       values ($1,$2,'cobro',$3,$4,$5,$6)`, [
		folio,
		todayISO(),
		inv.customer_name,
		inv.id,
		data.amount,
		data.notes || `Cobro ${inv.invoice_number}`
	]);
	return {
		folio,
		paid,
		status,
		remaining: n(inv.total) - paid
	};
});
export const registerPago = createServerFn({ method: "POST" }).validator(z.object({
	bill_id: z.number(),
	amount: z.number().positive(),
	notes: z.string().optional()
})).middleware([moduleMiddleware("finance")]).handler(async ({ data }) => {
	const sql = await getSql();
	const [bill] = await sql.query(`select b.id, b.bill_number, s.name as supplier_name, b.total::text, b.paid::text
       from supplier_bills b join suppliers s on s.id = b.supplier_id where b.id = $1`, [data.bill_id]);
	if (!bill) throw new Error("Factura de proveedor no encontrada");
	const remaining = n(bill.total) - n(bill.paid);
	if (data.amount > remaining + .009) throw new Error(`El saldo de ${bill.bill_number} es ${remaining.toFixed(2)}`);
	const paid = n(bill.paid) + data.amount;
	const status = moneyStatus(n(bill.total), paid);
	await sql.query(`update supplier_bills set paid = $1, status = $2 where id = $3`, [
		paid,
		status,
		bill.id
	]);
	const folio = await nextCode(sql, "cash_movements", "folio", "MOV-");
	await sql.query(`insert into cash_movements (folio, mov_date, kind, counterparty, supplier_bill_id, amount, notes)
       values ($1,$2,'pago',$3,$4,$5,$6)`, [
		folio,
		todayISO(),
		bill.supplier_name,
		bill.id,
		-data.amount,
		data.notes || `Pago ${bill.bill_number}`
	]);
	return {
		folio,
		paid,
		status,
		remaining: n(bill.total) - paid
	};
});
function partyOf(row) {
	const loc = [row.city, row.country].filter(Boolean).join(", ");
	return {
		name: row.name,
		lines: [
			row.contact_name,
			loc,
			row.phone,
			row.email
		].filter((x) => Boolean(x && x.trim())),
		phone: row.phone ?? null,
		email: row.email ?? null
	};
}
export const getPrintDoc = createServerFn({ method: "GET" }).validator(z.object({
	tipo: z.enum([
		"factura",
		"oc",
		"ov",
		"pick",
		"bol",
		"confirm",
		"cuenta"
	]),
	token: z.string().min(16)
})).handler(async ({ data }) => {
	const sql = await getSql();
	const company = await loadCompany(sql);
	if (data.tipo === "cuenta") {
		const [sup] = await sql.query(`select id, name, contact_name, phone, email, city, country from suppliers where share_token = $1`, [data.token]);
		if (!sup) throw new Error("Productor no encontrado");
		const account = await loadGrowerAccount(sql, sup.id);
		const dmy = (iso: string | null) => iso ? iso.slice(0, 10).split("-").reverse().join("/") : "";
		const entries = [
			...account.advances.filter((a) => !a.cancelled_at).map((a) => ({
				date: a.advance_date,
				sku: a.advance_number,
				description: `${dmy(a.advance_date)} · Adelanto — ${a.concept}${a.po_number ? ` · carga ${a.po_number}` : ""}`,
				amount: a.amount
			})),
			...account.applications.map((ap) => ({
				date: ap.created_at,
				sku: ap.advance_number,
				description: `${dmy(ap.created_at)} · Recuperación en liquidación ${ap.bill_number}${ap.po_number ? ` · ${ap.po_number}` : ""}`,
				amount: -ap.amount
			}))
		].sort((a, b) => a.date < b.date ? -1 : a.date > b.date ? 1 : 0);
		return {
			id: sup.id,
			tipo: "cuenta" as const,
			kindLabel: "Grower Statement",
			number: `CTA-${String(sup.id).padStart(3, "0")}`,
			date: todayISO(),
			due: null,
			terms: null,
			reference: null,
			partyTitle: "Productor",
			party: partyOf(sup),
			shipTitle: null,
			ship: null,
			lines: entries.map((e) => ({
				sku: e.sku,
				description: e.description,
				qty: 1,
				unit: "",
				unit_price: e.amount,
				amount: e.amount
			})),
			subtotal: account.balance,
			total: account.balance,
			notes: "Saldo vivo de adelantos a la fecha. Los adelantos otorgados se recuperan contra liquidaciones futuras del productor.",
			showPaca: false,
			company
		};
	}
	if ((data.tipo === "pick" || data.tipo === "bol" || data.tipo === "confirm" ? "ov" : data.tipo) === "factura") {
		const [inv] = await sql.query(`select i.id, i.invoice_number, i.issue_date::text, i.due_date::text, i.subtotal::text, i.total::text, i.notes,
                so.so_number, c.name as customer_name, c.contact_name, c.phone, c.email, c.city, c.payment_terms
         from invoices i
         join customers c on c.id = i.customer_id
         left join sales_orders so on so.id = i.sales_order_id
         where i.share_token = $1`, [data.token]);
		if (!inv) throw new Error("Factura no encontrada");
		const lines = (await sql.query(`select il.description, il.quantity::text, il.unit, il.unit_price::text, il.amount::text, p.sku
         from invoice_lines il left join products p on p.id = il.product_id
         where il.invoice_id = $1 order by il.id`, [inv.id])).map((l) => ({
			sku: l.sku || "",
			description: l.description || "",
			qty: n(l.quantity),
			unit: l.unit || "",
			unit_price: n(l.unit_price),
			amount: n(l.amount)
		}));
		const party = partyOf({
			name: inv.customer_name,
			contact_name: inv.contact_name,
			phone: inv.phone,
			email: inv.email,
			city: inv.city
		});
		let showPaca = true;
		try {
			const [paca] = await sql.query(`select value from app_settings where key = 'paca_on_invoices'`);
			if (paca) showPaca = paca.value !== "false";
		} catch {}
		return {
			id: inv.id,
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
			showPaca,
			company
		};
	}
	if (data.tipo === "oc") {
		const [po] = await sql.query(`select po.id, po.po_number, po.order_date::text, po.expected_date::text, po.notes,
                s.name as supplier_name, s.contact_name, s.phone, s.email, s.city, s.country
         from purchase_orders po join suppliers s on s.id = po.supplier_id
         where po.share_token = $1`, [data.token]);
		if (!po) throw new Error("Orden de compra no encontrada");
		const lines = (await sql.query(`select p.name as product_name, p.sku, l.quantity_ordered::text, l.unit, l.unit_cost::text
         from purchase_order_lines l join products p on p.id = l.product_id
         where l.purchase_order_id = $1 order by l.id`, [po.id])).map((l) => ({
			sku: l.sku || "",
			description: l.product_name,
			qty: n(l.quantity_ordered),
			unit: l.unit,
			unit_price: n(l.unit_cost),
			amount: n(l.quantity_ordered) * n(l.unit_cost)
		}));
		const subtotal = lines.reduce((s, l) => s + l.amount, 0);
		return {
			id: po.id,
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
				email: po.email,
				city: po.city,
				country: po.country
			}),
			shipTitle: "Ship to",
			ship: {
				name: company.legal_name,
				lines: [company.address_line || company.city, company.country].filter((x) => Boolean(x))
			},
			lines,
			subtotal,
			total: subtotal,
			notes: po.notes,
			showPaca: false,
			company
		};
	}
	const [so] = await sql.query(`select so.id, so.so_number, so.order_date::text, so.ship_date::text, so.notes, coalesce(so.payment_terms, c.payment_terms) as payment_terms,
              c.name as customer_name, c.contact_name, c.phone, c.email, c.city
       from sales_orders so join customers c on c.id = so.customer_id
       where so.share_token = $1`, [data.token]);
	if (!so) throw new Error("Orden de venta no encontrada");
	const lines = (await sql.query(`select p.name as product_name, p.sku, l.quantity_ordered::text, l.unit, l.unit_price::text
       from sales_order_lines l join products p on p.id = l.product_id
       where l.sales_order_id = $1 order by l.id`, [so.id])).map((l) => ({
		sku: l.sku || "",
		description: l.product_name,
		qty: n(l.quantity_ordered),
		unit: l.unit,
		unit_price: n(l.unit_price),
		amount: n(l.quantity_ordered) * n(l.unit_price)
	}));
	const subtotal = lines.reduce((s, l) => s + l.amount, 0);
	const party = partyOf({
		name: so.customer_name,
		contact_name: so.contact_name,
		phone: so.phone,
		email: so.email,
		city: so.city
	});
	return {
		id: so.id,
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
		company
	};
});
function payableStatus(amount, paid) {
	const st = moneyStatus(amount, paid);
	return st === "open" ? "Unpaid" : st === "partial" ? "Partially paid" : "Paid";
}
export const listPayables = createServerFn({ method: "GET" }).middleware([moduleMiddleware("finance")]).handler(async () => {
	const sql = await getSql();
	const expenses = await sql.query(`
    select e.id, e.expense_number, e.category, e.supplier_id, s.name as supplier_name,
           e.invoice_number, e.issue_date::text, coalesce(e.due_date, e.issue_date)::text as due_date,
           e.amount::text, e.paid::text, e.status, e.notes, po.po_number, e.purchase_order_id as po_id
    from expenses e
    join suppliers s on s.id = e.supplier_id
    left join purchase_orders po on po.id = e.purchase_order_id
    where e.cancelled_at is null
    order by e.issue_date desc, e.id desc
  `);
	const pos = await sql.query(`
    select po.id, po.po_number, po.supplier_id, s.name as supplier_name, po.vendor_invoice,
           po.order_date::text, coalesce(po.paid,0)::text as paid, po.notes
    from purchase_orders po
    join suppliers s on s.id = po.supplier_id
    where po.status <> 'cancelled'
    order by po.order_date desc, po.id desc
  `);
	const merchRows = await sql.query(`
    select purchase_order_id, coalesce(sum(quantity_ordered * coalesce(unit_cost,0)),0)::text as merch
    from purchase_order_lines group by purchase_order_id
  `);
	const merchMap = new Map<number, number>(merchRows.map((r) => [r.purchase_order_id, n(r.merch)]));
	const expRows = expenses.map((e) => {
		const amount = n(e.amount);
		const paid = n(e.paid);
		return {
			kind: "expense",
			id: e.id,
			number: e.expense_number,
			category: e.category,
			supplier_id: e.supplier_id,
			supplier_name: e.supplier_name,
			invoice_number: e.invoice_number,
			issue_date: e.issue_date,
			due_date: e.due_date,
			amount,
			paid,
			saldo: Math.max(amount - paid, 0),
			status: payableStatus(amount, paid),
			notes: e.notes,
			po_number: e.po_number,
			po_id: e.po_id
		};
	});
	const poRows = pos.map((p) => {
		const amount = merchMap.get(p.id) ?? 0;
		const paid = n(p.paid);
		return {
			kind: "po",
			id: p.id,
			number: p.po_number,
			category: "Purchase Order",
			supplier_id: p.supplier_id,
			supplier_name: p.supplier_name,
			invoice_number: p.vendor_invoice,
			issue_date: p.order_date,
			due_date: p.order_date,
			amount,
			paid,
			saldo: Math.max(amount - paid, 0),
			status: payableStatus(amount, paid),
			notes: p.notes,
			po_number: p.po_number,
			po_id: p.id
		};
	});
	return [...expRows, ...poRows];
});
export const listExpenseLinks = createServerFn({ method: "GET" }).validator(z.object({ expense_id: z.number() })).middleware([moduleMiddleware("finance")]).handler(async ({ data }) => {
	const sql = await getSql();
	const [exp] = await sql.query(`select e.id, e.expense_number, e.category, e.supplier_id, s.name as supplier_name, e.invoice_number,
              e.issue_date::text, e.amount::text, e.payable, e.notes, e.paid::text, e.status,
              e.purchase_order_id, coalesce(e.alloc_by,'pallet') as alloc_by,
              coalesce(e.charged_to,'plein') as charged_to, e.cancelled_at::text, e.cancel_reason
       from expenses e join suppliers s on s.id = e.supplier_id where e.id = $1`, [data.expense_id]);
	if (!exp) throw new Error("Expense not found");
	const links = await sql.query(`select x.purchase_order_id, po.po_number, s.name as supplier_name, po.order_date::text,
              po.vendor_invoice, x.amount_applied::text
       from expense_po_links x
       join purchase_orders po on po.id = x.purchase_order_id
       join suppliers s on s.id = po.supplier_id
       where x.expense_id = $1`, [data.expense_id]);
	const firstItems = await sql.query(`
      select distinct on (l.purchase_order_id) l.purchase_order_id, p.name as product_name
      from purchase_order_lines l join products p on p.id = l.product_id
      order by l.purchase_order_id, l.id
    `);
	const itemMap = new Map(firstItems.map((r) => [r.purchase_order_id, r.product_name]));
	return {
		...exp,
		amount: n(exp.amount),
		paid: n(exp.paid),
		links: links.map((l) => ({
			...l,
			amount_applied: n(l.amount_applied),
			product_name: itemMap.get(l.purchase_order_id) ?? null
		}))
	};
});
export const connectExpensePo = createServerFn({ method: "POST" }).validator(z.object({
	expense_id: z.number(),
	purchase_order_id: z.number(),
	amount: z.number().optional()
})).middleware([moduleMiddleware("finance")]).handler(async ({ data }) => {
	const sql = await getSql();
	const [exp] = await sql.query(`select amount::text from expenses where id = $1`, [data.expense_id]);
	if (!exp) throw new Error("Expense not found");
	await sql.query(`insert into expense_po_links (expense_id, purchase_order_id, amount_applied) values ($1,$2,$3)
       on conflict (expense_id, purchase_order_id) do update set amount_applied = excluded.amount_applied`, [
		data.expense_id,
		data.purchase_order_id,
		data.amount ?? n(exp.amount)
	]);
	await sql.query(`update expenses set purchase_order_id = coalesce(purchase_order_id, $1) where id = $2`, [data.purchase_order_id, data.expense_id]);
	return { ok: true };
});
export const disconnectExpensePo = createServerFn({ method: "POST" }).validator(z.object({
	expense_id: z.number(),
	purchase_order_id: z.number()
})).middleware([moduleMiddleware("finance")]).handler(async ({ data }) => {
	await (await getSql()).query(`delete from expense_po_links where expense_id = $1 and purchase_order_id = $2`, [data.expense_id, data.purchase_order_id]);
	return { ok: true };
});
export const registerVendorPayment = createServerFn({ method: "POST" }).validator(z.object({
	supplier_id: z.number(),
	amount: z.number().positive(),
	method: z.string().default("ACH"),
	pay_date: z.string().optional(),
	notes: z.string().optional(),
	applications: z.array(z.object({
		kind: z.enum(["expense", "po"]),
		id: z.number(),
		amount: z.number().positive()
	})).min(1)
})).middleware([moduleMiddleware("finance")]).handler(async ({ data }) => {
	const sql = await getSql();
	const [sup] = await sql.query(`select name from suppliers where id = $1`, [data.supplier_id]);
	if (!sup) throw new Error("Vendor not found");
	const applied = data.applications.reduce((s, a) => s + a.amount, 0);
	if (Math.abs(applied - data.amount) > .05) throw new Error("Payment amount must equal the sum applied to invoices");
	const folio = await nextCode(sql, "cash_movements", "folio", "MOV-");
	const date = data.pay_date || todayISO();
	const movId = (await sql.query(`insert into cash_movements (folio, mov_date, kind, counterparty, amount, notes)
         values ($1,$2,'pago',$3,$4,$5) returning id`, [
		folio,
		date,
		sup.name,
		-data.amount,
		data.notes || `${data.method} payment`
	]))[0].id;
	for (const app of data.applications) {
		if (app.kind === "expense") {
			const [exp] = await sql.query(`select amount::text, paid::text from expenses where id = $1`, [app.id]);
			if (!exp) throw new Error("Expense not found");
			const paid = n(exp.paid) + app.amount;
			await sql.query(`update expenses set paid = $1, status = $2 where id = $3`, [
				paid,
				moneyStatus(n(exp.amount), paid),
				app.id
			]);
		} else {
			const [po] = await sql.query(`select coalesce(paid,0)::text as paid from purchase_orders where id = $1`, [app.id]);
			if (!po) throw new Error("PO not found");
			await sql.query(`update purchase_orders set paid = coalesce(paid,0) + $1 where id = $2`, [app.amount, app.id]);
		}
		await sql.query(`insert into payment_applications (cash_movement_id, kind, target_kind, target_id, amount) values ($1,'vendor',$2,$3,$4)`, [
			movId,
			app.kind,
			app.id,
			app.amount
		]);
	}
	return {
		folio,
		id: movId
	};
});
export const registerCustomerPayment = createServerFn({ method: "POST" }).validator(z.object({
	customer_id: z.number(),
	amount: z.number().positive(),
	method: z.string().default("Cash"),
	pay_date: z.string().optional(),
	notes: z.string().optional(),
	applications: z.array(z.object({
		invoice_id: z.number(),
		amount: z.number().positive()
	})).min(1)
})).middleware([moduleMiddleware("finance")]).handler(async ({ data }) => {
	const sql = await getSql();
	const [cust] = await sql.query(`select name from customers where id = $1`, [data.customer_id]);
	if (!cust) throw new Error("Customer not found");
	const folio = await nextCode(sql, "cash_movements", "folio", "MOV-");
	const date = data.pay_date || todayISO();
	const firstInv = data.applications[0]?.invoice_id ?? null;
	const movId = (await sql.query(`insert into cash_movements (folio, mov_date, kind, counterparty, invoice_id, amount, notes)
         values ($1,$2,'cobro',$3,$4,$5,$6) returning id`, [
		folio,
		date,
		cust.name,
		firstInv,
		data.amount,
		data.notes || `${data.method} receipt`
	]))[0].id;
	for (const app of data.applications) {
		const [inv] = await sql.query(`select total::text, paid::text, invoice_type from invoices where id = $1`, [app.invoice_id]);
		if (!inv) throw new Error("Invoice not found");
		const paid = n(inv.paid) + app.amount;
		await sql.query(`update invoices set paid = $1, status = $2 where id = $3`, [
			paid,
			moneyStatus(Math.abs(n(inv.total)), paid),
			app.invoice_id
		]);
		await sql.query(`insert into payment_applications (cash_movement_id, kind, target_kind, target_id, amount) values ($1,'customer','invoice',$2,$3)`, [
			movId,
			app.invoice_id,
			app.amount
		]);
	}
	return {
		folio,
		id: movId
	};
});
export const createCreditInvoice = createServerFn({ method: "POST" }).validator(z.object({
	sales_order_id: z.number(),
	customer_po: z.string().optional(),
	internal_note: z.string().optional(),
	customer_note: z.string().optional(),
	lines: z.array(z.object({
		product_id: z.number().optional(),
		description: z.string(),
		qty: z.number(),
		credit_per_unit: z.number()
	})).min(1)
})).middleware([moduleMiddleware("finance")]).handler(async ({ data }) => {
	const sql = await getSql();
	const [so] = await sql.query(`select id, so_number, customer_id from sales_orders where id = $1`, [data.sales_order_id]);
	if (!so) throw new Error("Sales order not found");
	const creditTotal = data.lines.reduce((s, l) => s + l.qty * l.credit_per_unit, 0);
	if (creditTotal <= 0) throw new Error("Credit total must be greater than zero");
	const invoice_number = await nextCode(sql, "invoices", "invoice_number", `PP-${todayISO().slice(0, 4)}-CR-`, 3);
	const id = (await sql.query(`insert into invoices (invoice_number, sales_order_id, customer_id, status, issue_date, due_date, subtotal, total, paid, notes, invoice_type, sales_rep)
         values ($1,$2,$3,'open',$4,null,$5,$5,0,$6,'credit','Miguel') returning id`, [
		invoice_number,
		so.id,
		so.customer_id,
		todayISO(),
		-creditTotal,
		[
			data.internal_note,
			data.customer_note,
			data.customer_po ? `CPO ${data.customer_po}` : null
		].filter(Boolean).join(" · ") || `Credit of ${so.so_number}`
	]))[0].id;
	for (const l of data.lines) await sql.query(`insert into invoice_lines (invoice_id, product_id, description, quantity, unit, unit_price, amount)
         values ($1,$2,$3,$4,'ea',$5,$6)`, [
		id,
		l.product_id ?? null,
		l.description,
		l.qty,
		-l.credit_per_unit,
		-(l.qty * l.credit_per_unit)
	]);
	return {
		id,
		invoice_number,
		total: -creditTotal
	};
});
export const listGlAccounts = createServerFn({ method: "GET" }).middleware([moduleMiddleware("finance")]).handler(async () => {
	return (await (await getSql()).query(`
    select id, number, name, description, statement, kind, subtype, parent_number,
           tracking_start::text, starting_balance::text, sort_order
    from gl_accounts where is_active = true order by sort_order, number
  `)).map((r) => ({
		...r,
		starting_balance: n(r.starting_balance)
	}));
});
export const createGlAccount = createServerFn({ method: "POST" }).validator(z.object({
	number: z.string().min(1),
	name: z.string().min(1),
	description: z.string().optional(),
	statement: z.enum(["income", "balance"]),
	kind: z.enum([
		"revenue",
		"cogs",
		"expense",
		"asset",
		"liability",
		"equity"
	]),
	subtype: z.string().optional(),
	parent_number: z.string().optional(),
	starting_balance: z.number().optional()
})).middleware([moduleMiddleware("finance")]).handler(async ({ data }) => {
	await (await getSql()).query(`insert into gl_accounts (number, name, description, statement, kind, subtype, parent_number, tracking_start, starting_balance, sort_order)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,90)`, [
		data.number,
		data.name,
		data.description || null,
		data.statement,
		data.kind,
		data.subtype || null,
		data.parent_number || null,
		todayISO(),
		data.starting_balance ?? 0
	]);
	return { ok: true };
});
export const listGlMappings = createServerFn({ method: "GET" }).middleware([moduleMiddleware("finance")]).handler(async () => {
	return (await getSql()).query(`select map_key, account_number from gl_mappings`);
});
export const saveGlMappings = createServerFn({ method: "POST" }).validator(z.object({ mappings: z.array(z.object({
	map_key: z.string(),
	account_number: z.string()
})) })).middleware([moduleMiddleware("finance")]).handler(async ({ data }) => {
	const sql = await getSql();
	for (const m of data.mappings) await sql.query(`insert into gl_mappings (map_key, account_number) values ($1,$2)
         on conflict (map_key) do update set account_number = excluded.account_number`, [m.map_key, m.account_number]);
	return { ok: true };
});
export const getFinancials = createServerFn({ method: "GET" }).middleware([moduleMiddleware("finance")]).handler(async () => {
	const sql = await getSql();
	const invoices = await sql.query(`select coalesce(invoice_type,'sale') as invoice_type, total::text, paid::text, issue_date::text, status from invoices`);
	const cogsRows = await sql.query(`
    select coalesce(sum(a.quantity * coalesce(lots.unit_cost,0)),0)::text as cogs,
           coalesce((select sum(sol.quantity_shipped * coalesce(sol.unit_price,0)) from sales_order_lines sol),0)::text as sales
    from sale_line_allocations a
    left join lots on lots.id = a.lot_id
  `);
	const expenses = await sql.query(`select category, amount::text from expenses where cancelled_at is null`);
	const cash = await sql.query(`select amount::text from cash_movements where cancelled_at is null`);
	const invVal = await sql.query(`select coalesce(sum(current_qty * coalesce(unit_cost,0)),0)::text as v from lots where current_qty > 0`);
	const billPayable = await sql.query(`select coalesce(sum(total - paid),0)::text as v from supplier_bills where status <> 'cancelled'`);
	const expPayable = await sql.query(`select coalesce(sum(amount - paid),0)::text as v from expenses where payable = true and cancelled_at is null`);
	// Adelantos vivos a productores: activo circulante (CxC al productor).
	const advRows = await sql.query(`select coalesce(sum(amount - recovered),0)::text as v from grower_advances where cancelled_at is null`);
	const accounts = await sql.query(`
    select number, name, kind, statement, subtype, parent_number, starting_balance::text, sort_order, description, tracking_start::text
    from gl_accounts where is_active = true order by sort_order
  `);
	const liveInv = invoices.filter((i) => i.status !== "cancelled");
	const sales = liveInv.filter((i) => i.invoice_type === "sale").reduce((s, i) => s + n(i.total), 0);
	const credits = liveInv.filter((i) => i.invoice_type === "credit").reduce((s, i) => s + n(i.total), 0);
	const ar = liveInv.reduce((s, i) => s + Math.max(n(i.total) - n(i.paid), 0), 0);
	const cogs = n(cogsRows[0]?.cogs);
	const salesShipped = n(cogsRows[0]?.sales);
	const expByCat: Record<string, number> = {};
	for (const e of expenses) expByCat[e.category] = (expByCat[e.category] || 0) + n(e.amount);
	const expTotal = expenses.reduce((s, e) => s + n(e.amount), 0);
	const cashBal = cash.reduce((s, m) => s + n(m.amount), 0);
	const inventory = n(invVal[0]?.v);
	const ap = n(billPayable[0]?.v) + n(expPayable[0]?.v);
	const income = sales + credits;
	const gp = (salesShipped || sales) - cogs;
	const net = gp - expTotal;
	const currentOf = (number, starting) => {
		if (number === "40000") return sales;
		if (number === "40002") return credits;
		if (number === "50000") return cogs;
		if (number === "51000") return expByCat.Freight || 0;
		if (number === "53000") return (expByCat.Supplies || 0) + (expByCat.Boxes || 0) + (expByCat["Dues & Subscriptions"] || 0);
		if (number === "55000") return (expByCat.Insurance || 0) + (expByCat["Legal & Professional fees"] || 0);
		if (number === "59999") {
			const known = /* @__PURE__ */ new Set([
				"Freight",
				"Supplies",
				"Boxes",
				"Dues & Subscriptions",
				"Insurance",
				"Legal & Professional fees"
			]);
			return Object.entries(expByCat).reduce((s, [k, v]) => s + (known.has(k) ? 0 : v), 0);
		}
		if (number === "12000") return ar;
		if (number === "12500") return n(advRows[0]?.v);
		if (number === "13000") return inventory;
		if (number === "14000") return 0;
		if (number === "16000") return starting + cashBal;
		if (number === "20100") return ap;
		if (number === "20250") return starting;
		if (number === "30000") return starting;
		return starting;
	};
	return {
		sales,
		credits,
		income,
		cogs,
		gp,
		expenses: expTotal,
		expByCat,
		net,
		ar,
		ap,
		cash: cashBal,
		inventory,
		accounts: accounts.map((a) => {
			const start = n(a.starting_balance);
			return {
				...a,
				starting_balance: start,
				current_balance: currentOf(a.number, start)
			};
		})
	};
});
export const listVendorPayments = createServerFn({ method: "GET" }).middleware([moduleMiddleware("finance")]).handler(async () => {
	const sql = await getSql();
	const movs = await sql.query(`
    select id, folio, mov_date::text, counterparty, amount::text, notes, cancelled_at::text, cancelled_by, cancel_reason
    from cash_movements where kind = 'pago' order by mov_date desc, id desc
  `);
	const apps = await sql.query(`select cash_movement_id, target_kind, target_id, amount::text from payment_applications where kind = 'vendor'`);
	return movs.map((m) => ({
		...m,
		amount: Math.abs(n(m.amount)),
		applications: apps.filter((a) => a.cash_movement_id === m.id).map((a) => ({
			...a,
			amount: n(a.amount)
		}))
	}));
});
export const listPartySkus = createServerFn({ method: "GET" }).validator(z.object({
	party_kind: z.enum(["customer", "vendor"]).optional(),
	party_id: z.number().optional(),
	pack_style_id: z.number().optional(),
	product_id: z.number().optional()
})).middleware([authMiddleware]).handler(async ({ data }) => {
	return (await getSql()).query(`select ps.id, ps.party_kind, ps.party_id, coalesce(c.name, s.name) as party_name,
              ps.pack_style_id, ps.alias_sku, ps.notes, k.sku_code, k.empaque, k.calibre,
              p.id as product_id, p.name as product_name, p.variety
       from party_skus ps
       join pack_styles k on k.id = ps.pack_style_id
       join products p on p.id = k.product_id
       left join customers c on ps.party_kind = 'customer' and c.id = ps.party_id
       left join suppliers s on ps.party_kind = 'vendor' and s.id = ps.party_id
       where ($1::text is null or ps.party_kind = $1)
         and ($2::int is null or ps.party_id = $2)
         and ($3::int is null or ps.pack_style_id = $3)
         and ($4::int is null or k.product_id = $4)
       order by p.name, k.sku_code`, [
		data.party_kind ?? null,
		data.party_id ?? null,
		data.pack_style_id ?? null,
		data.product_id ?? null
	]);
});
export const savePartySku = createServerFn({ method: "POST" }).validator(z.object({
	party_kind: z.enum(["customer", "vendor"]),
	party_id: z.number(),
	pack_style_id: z.number(),
	alias_sku: z.string().optional(),
	notes: z.string().optional()
})).middleware([authMiddleware]).handler(async ({ data }) => {
	return { id: (await (await getSql()).query(`insert into party_skus (party_kind, party_id, pack_style_id, alias_sku, notes)
       values ($1,$2,$3,$4,$5)
       on conflict (party_kind, party_id, pack_style_id)
       do update set alias_sku = excluded.alias_sku, notes = excluded.notes
       returning id`, [
		data.party_kind,
		data.party_id,
		data.pack_style_id,
		data.alias_sku?.trim() || null,
		data.notes?.trim() || null
	]))[0].id };
});
export const deletePartySku = createServerFn({ method: "POST" }).validator(z.object({ id: z.number() })).middleware([authMiddleware]).handler(async ({ data }) => {
	await (await getSql()).query(`delete from party_skus where id = $1`, [data.id]);
	return { ok: true };
});
export const getCompany = createServerFn({ method: "GET" }).handler(async () => loadCompany(await getSql()));
export const saveCompany = createServerFn({ method: "POST" }).middleware([authMiddleware]).validator(z.object({
	legal_name: z.string().min(1),
	short_name: z.string().optional(),
	tagline: z.string().optional(),
	city: z.string().optional(),
	country: z.string().optional(),
	email: z.string().optional(),
	phone: z.string().optional(),
	address_line: z.string().optional(),
	paca_license: z.string().optional()
})).handler(async ({ data, context }) => {
	const sql = await getSql();
	await assertAdmin(sql, context.userId);
	await sql.query(`insert into company_profile (id, legal_name, short_name, tagline, city, country, email, phone, address_line, paca_license, updated_at)
       values (1,$1,$2,$3,$4,$5,$6,$7,$8,$9,now())
       on conflict (id) do update set
         legal_name = excluded.legal_name, short_name = excluded.short_name, tagline = excluded.tagline,
         city = excluded.city, country = excluded.country, email = excluded.email, phone = excluded.phone,
         address_line = excluded.address_line, paca_license = excluded.paca_license, updated_at = now()`, [
		data.legal_name.trim(),
		data.short_name?.trim() || "Plein",
		data.tagline?.trim() || "Fresh produce",
		data.city?.trim() || null,
		data.country?.trim() || null,
		data.email?.trim() || null,
		data.phone?.trim() || null,
		data.address_line?.trim() || null,
		data.paca_license?.trim() || null
	]);
	return loadCompany(sql);
});
export const getAppSettings = createServerFn({ method: "GET" }).middleware([authMiddleware]).handler(async () => {
	const rows = await (await getSql()).query(`select key, value from app_settings`);
	return Object.fromEntries(rows.map((r) => [r.key, r.value]));
});
export const saveAppSetting = createServerFn({ method: "POST" }).middleware([authMiddleware]).validator(z.object({
	key: z.string().min(1),
	value: z.string()
})).handler(async ({ data, context }) => {
	const sql = await getSql();
	await assertAdmin(sql, context.userId);
	await sql.query(`insert into app_settings (key, value) values ($1,$2) on conflict (key) do update set value = excluded.value`, [data.key, data.value]);
	return { ok: true };
});
export const listDepartments = createServerFn({ method: "GET" }).middleware([authMiddleware]).handler(async () => (await getSql()).query(`select id, name from departments order by id`));
export const addDepartment = createServerFn({ method: "POST" }).middleware([authMiddleware]).validator(z.object({ name: z.string().min(1) })).handler(async ({ data, context }) => {
	const sql = await getSql();
	await assertAdmin(sql, context.userId);
	return { id: (await sql.query(`insert into departments (name) values ($1) on conflict (name) do update set name = excluded.name returning id`, [data.name.trim()]))[0].id };
});
export const getMyAccess = createServerFn({ method: "GET" }).middleware([authMiddleware]).handler(async ({ context }) => {
	const sql = await getSql();
	const ident = await authIdentity(sql, context.userId);
	let staff = await readStaff(sql, "user_id = $1", [context.userId]);
	if (!staff && ident.email) staff = await readStaff(sql, "lower(coalesce(email,'')) = $1", [ident.email]);
	if (staff) {
		if (!staff.user_id) {
			await sql.query(`update staff set user_id = $1 where id = $2 and user_id is null`, [context.userId, staff.id]);
			staff = {
				...staff,
				user_id: context.userId
			};
		}
		if (staff.status === "invited") {
			await sql.query(`update staff set status = 'active', user_id = $1 where id = $2`, [context.userId, staff.id]);
			staff = {
				...staff,
				status: "active",
				user_id: context.userId
			};
		}
		if (staff.role === "admin") staff = {
			...staff,
			modules: ALL_MODULES
		};
		return {
			id: staff.id,
			name: staff.name,
			email: staff.email,
			role: staff.role,
			status: staff.status,
			modules: staff.modules,
			linked: Boolean(staff.user_id)
		};
	}
	const linkedAdmin = await sql.query(`select count(*)::text as n from staff where role = 'admin' and user_id is not null`);
	const owner = await readStaff(sql, "role = 'admin' order by id", []);
	if ((ident.email === "miguelarambulam@gmail.com" || owner && !owner.user_id && Number(linkedAdmin[0]?.n || 0) === 0) && owner) {
		const name = ident.name || owner.name || "Miguel";
		await sql.query(`update staff set user_id=$1, status='active', role='admin', modules=$2::jsonb
         where id=$3 and user_id is null`, [
			context.userId,
			JSON.stringify(ALL_MODULES),
			owner.id
		]);
		return {
			id: owner.id,
			name: owner.name || name,
			email: owner.email || ident.email,
			role: "admin",
			status: "active",
			modules: ALL_MODULES,
			linked: true
		};
	}
	return {
		id: (await sql.query(`insert into staff (user_id, name, email, role, status, modules)
       values ($1,$2,$3,'seller','pending','[]'::jsonb) returning id`, [
			context.userId,
			ident.name || ident.email || "User",
			ident.email
		]))[0].id,
		name: ident.name || ident.email || "User",
		email: ident.email,
		role: "seller",
		status: "pending",
		modules: [],
		linked: true
	};
});
export const listStaff = createServerFn({ method: "GET" }).middleware([authMiddleware]).handler(async ({ context }) => {
	const sql = await getSql();
	await assertAdmin(sql, context.userId);
	return (await sql.query(`select id, user_id, name, email, role, coalesce(status,'pending') as status, coalesce(modules::text,'[]') as modules
       from staff order by case status when 'pending' then 0 when 'invited' then 1 when 'active' then 2 else 3 end, id`)).map((r) => ({
		...mapStaff(r),
		linked: Boolean(r.user_id)
	}));
});
export const saveStaff = createServerFn({ method: "POST" }).middleware([authMiddleware]).validator(z.object({
	id: z.number().optional(),
	name: z.string().min(1),
	email: z.string().optional(),
	role: z.string().optional()
})).handler(async ({ data, context }) => {
	const sql = await getSql();
	await assertAdmin(sql, context.userId);
	const role = data.role || "seller";
	const modules = JSON.stringify(role === "admin" ? ALL_MODULES : ROLE_MODULE_MAP[role] ?? []);
	if (data.id) {
		await sql.query(`update staff set name=$1, email=$2, role=$3, modules=$4::jsonb where id=$5`, [
			data.name.trim(),
			data.email?.trim().toLowerCase() || null,
			role,
			modules,
			data.id
		]);
		return { id: data.id };
	}
	return { id: (await sql.query(`insert into staff (name, email, role, status, modules) values ($1,$2,$3,'invited',$4::jsonb) returning id`, [
		data.name.trim(),
		data.email?.trim().toLowerCase() || null,
		role,
		modules
	]))[0].id };
});
export const grantStaff = createServerFn({ method: "POST" }).middleware([authMiddleware]).validator(z.object({
	id: z.number(),
	status: z.enum([
		"pending",
		"invited",
		"active",
		"disabled"
	]).optional(),
	role: z.string().optional(),
	modules: z.array(z.string()).optional()
})).handler(async ({ data, context }) => {
	const sql = await getSql();
	await assertAdmin(sql, context.userId);
	const current = await readStaff(sql, "id = $1", [data.id]);
	if (!current) throw new Error("Person not found");
	const role = data.role || current.role;
	const modules = role === "admin" ? ALL_MODULES : data.modules ?? current.modules;
	const status = data.status || current.status;
	await sql.query(`update staff set role=$1, status=$2, modules=$3::jsonb where id=$4`, [
		role,
		status,
		JSON.stringify(modules),
		data.id
	]);
	return { ok: true };
});
export const listPackOuts = createServerFn({ method: "GET" }).middleware([authMiddleware]).handler(async () => {
	const sql = await getSql();
	const heads = await sql.query(`select po.id, po.pack_number, po.pack_date::text, loc.name as location_name, po.notes
       from pack_outs po left join locations loc on loc.id = po.location_id order by po.id desc`);
	const lines = await sql.query(`select l.pack_out_id, l.direction, lot.lot_number, p.name as product_name, ps.sku_code, l.qty::text, l.unit
       from pack_out_lines l
       left join lots lot on lot.id = l.lot_id
       left join products p on p.id = l.product_id
       left join pack_styles ps on ps.id = l.pack_style_id
       order by l.id`);
	return heads.map((h) => ({
		...h,
		ins: lines.filter((l) => l.pack_out_id === h.id && l.direction === "in").map((l) => ({
			...l,
			qty: n(l.qty)
		})),
		outs: lines.filter((l) => l.pack_out_id === h.id && l.direction === "out").map((l) => ({
			...l,
			qty: n(l.qty)
		}))
	}));
});
export const createPackOut = createServerFn({ method: "POST" }).middleware([authMiddleware]).validator(z.object({
	pack_date: z.string().optional(),
	location_id: z.number(),
	notes: z.string().optional(),
	sources: z.array(z.object({
		lot_id: z.number(),
		qty: z.number().positive()
	})).min(1),
	dest_pack_style_id: z.number(),
	dest_qty: z.number().positive()
})).handler(async ({ data, context }) => {
	const sql = await getSql();
	const pack_date = data.pack_date || todayISO();
	const [dest] = await sql.query(`select id, product_id, sku_code, unit_of_measure from pack_styles where id = $1`, [data.dest_pack_style_id]);
	if (!dest) throw new Error("Destination SKU not found");
	let value = 0;
	const srcLots: {
		id: number;
		current_qty: string;
		unit_cost: string;
		unit: string;
		supplier_id: number;
		origin_country: string | null;
		lot_number: string;
		product_id: number;
		held: boolean;
		status: string;
	}[] = [];
	for (const src of data.sources) {
		const [lot] = await sql.query(`select id, current_qty::text, unit_cost::text, unit, supplier_id, origin_country, lot_number, product_id,
                coalesce(held,false) as held, status from lots where id = $1`, [src.lot_id]);
		if (!lot) throw new Error("Source lot not found");
		if (lot.held) throw new Error(`Lot ${lot.lot_number} is on hold`);
		if (lot.status !== "active") throw new Error(`Lot ${lot.lot_number} is not active`);
		if (src.qty > n(lot.current_qty) + 1e-9) throw new Error(`Lot ${lot.lot_number} only has ${lot.current_qty}`);
		value += src.qty * n(lot.unit_cost);
		srcLots.push(lot);
	}
	const pack_number = await nextCode(sql, "pack_outs", "pack_number", "RPK-", 3);
	const [head] = await sql.query(`insert into pack_outs (pack_number, pack_date, location_id, notes, created_by) values ($1,$2,$3,$4,$5) returning id`, [
		pack_number,
		pack_date,
		data.location_id,
		data.notes || null,
		context.userId
	]);
	for (let i = 0; i < data.sources.length; i += 1) {
		const src = data.sources[i];
		const lot = srcLots[i];
		await sql.query(`update lots set current_qty = current_qty - $1, status = case when current_qty - $1 <= 0 then 'depleted' else status end where id = $2`, [src.qty, src.lot_id]);
		await sql.query(`update inventory set quantity = greatest(quantity - $1, 0) where lot_id = $2`, [src.qty, src.lot_id]);
		await sql.query(`insert into inventory_movements (lot_id, location_id, movement_type, quantity, unit, reference_type, reference_id, notes)
         values ($1,$2,'repack_out',$3,$4,'pack_out',$5,$6)`, [
			src.lot_id,
			data.location_id,
			-src.qty,
			lot.unit,
			head.id,
			pack_number
		]);
		await sql.query(`insert into pack_out_lines (pack_out_id, direction, lot_id, product_id, pack_style_id, qty, unit, unit_cost)
         values ($1,'in',$2,$3,(select pack_style_id from lots where id=$2),$4,$5,(select unit_cost from lots where id=$2))`, [
			head.id,
			src.lot_id,
			lot.product_id,
			src.qty,
			lot.unit
		]);
	}
	const unit_cost = data.dest_qty > 0 ? value / data.dest_qty : 0;
	const unit = dest.unit_of_measure || "caja";
	const lot_number = await nextCode(sql, "lots", "lot_number", `RPK-${pack_date.replaceAll("-", "").slice(2)}-`, 2);
	const first = srcLots[0];
	const destLotId = (await sql.query(`insert into lots (lot_number, product_id, supplier_id, pack_style_id, original_qty, current_qty, unit, unit_cost,
                           received_date, pack_date, origin_country, status, quality_state, pack_out_id)
         values ($1,$2,$3,$4,$5,$5,$6,$7,$8,$8,$9,'active','sano',$10) returning id`, [
		lot_number,
		dest.product_id,
		first.supplier_id,
		dest.id,
		data.dest_qty,
		unit,
		unit_cost,
		pack_date,
		first.origin_country,
		head.id
	]))[0].id;
	await sql.query(`insert into inventory (lot_id, location_id, quantity) values ($1,$2,$3)
       on conflict (lot_id, location_id) do update set quantity = inventory.quantity + excluded.quantity`, [
		destLotId,
		data.location_id,
		data.dest_qty
	]);
	await sql.query(`insert into inventory_movements (lot_id, location_id, movement_type, quantity, unit, reference_type, reference_id, notes)
       values ($1,$2,'repack_in',$3,$4,'pack_out',$5,$6)`, [
		destLotId,
		data.location_id,
		data.dest_qty,
		unit,
		head.id,
		pack_number
	]);
	await sql.query(`insert into pack_out_lines (pack_out_id, direction, lot_id, product_id, pack_style_id, qty, unit, unit_cost)
       values ($1,'out',$2,$3,$4,$5,$6,$7)`, [
		head.id,
		destLotId,
		dest.product_id,
		dest.id,
		data.dest_qty,
		unit,
		unit_cost
	]);
	return {
		id: head.id,
		pack_number,
		lot_number,
		unit_cost
	};
});
export const listBankAccounts = createServerFn({ method: "GET" }).middleware([moduleMiddleware("finance")]).handler(async () => (await getSql()).query(`select id, name, bank_name, last4, opening_balance::text from bank_accounts where is_active order by id`).then((rows) => rows.map((r) => ({
	...r,
	opening_balance: n(r.opening_balance)
}))));
export const listBankLines = createServerFn({ method: "GET" }).middleware([moduleMiddleware("finance")]).handler(async () => {
	return (await (await getSql()).query(`select b.id, b.bank_account_id, a.name as bank_name, b.line_date::text, b.description, b.amount::text,
              b.cash_movement_id, b.status, m.folio
       from bank_lines b
       join bank_accounts a on a.id = b.bank_account_id
       left join cash_movements m on m.id = b.cash_movement_id
       order by b.line_date desc, b.id desc`)).map((l) => ({
		...l,
		amount: n(l.amount)
	}));
});
export const addBankLine = createServerFn({ method: "POST" }).middleware([moduleMiddleware("finance")]).validator(z.object({
	bank_account_id: z.number(),
	line_date: z.string(),
	description: z.string().min(1),
	amount: z.number()
})).handler(async ({ data }) => {
	return { id: (await (await getSql()).query(`insert into bank_lines (bank_account_id, line_date, description, amount, status) values ($1,$2,$3,$4,'open') returning id`, [
		data.bank_account_id,
		data.line_date,
		data.description.trim(),
		data.amount
	]))[0].id };
});
export const matchBankLine = createServerFn({ method: "POST" }).middleware([moduleMiddleware("finance")]).validator(z.object({
	line_id: z.number(),
	cash_movement_id: z.number()
})).handler(async ({ data }) => {
	const sql = await getSql();
	const [line] = await sql.query(`select amount::text from bank_lines where id = $1`, [data.line_id]);
	const [mov] = await sql.query(`select amount::text, folio from cash_movements where id = $1`, [data.cash_movement_id]);
	if (!line || !mov) throw new Error("Line or movement not found");
	if (Math.abs(n(line.amount) - n(mov.amount)) > .009) throw new Error(`Amount mismatch: bank ${n(line.amount).toFixed(2)} vs cash ${n(mov.amount).toFixed(2)}`);
	await sql.query(`update bank_lines set cash_movement_id = $1, status = 'matched' where id = $2`, [data.cash_movement_id, data.line_id]);
	return {
		ok: true,
		folio: mov.folio
	};
});
export const ignoreBankLine = createServerFn({ method: "POST" }).middleware([moduleMiddleware("finance")]).validator(z.object({ line_id: z.number() })).handler(async ({ data }) => {
	await (await getSql()).query(`update bank_lines set status = 'ignored', cash_movement_id = null where id = $1`, [data.line_id]);
	return { ok: true };
});
export const recordSend = createServerFn({ method: "POST" }).middleware([authMiddleware]).validator(z.object({
	channel: z.enum(["email", "whatsapp"]),
	doc_tipo: z.string().optional(),
	doc_id: z.number().optional(),
	doc_number: z.string().optional(),
	party_name: z.string().optional(),
	address: z.string().optional()
})).handler(async ({ data, context }) => {
	await (await getSql()).query(`insert into send_events (channel, doc_tipo, doc_id, doc_number, party_name, address, created_by)
       values ($1,$2,$3,$4,$5,$6,$7)`, [
		data.channel,
		data.doc_tipo || null,
		data.doc_id ?? null,
		data.doc_number || null,
		data.party_name || null,
		data.address || null,
		context.userId
	]);
	return { ok: true };
});
export const listSendEvents = createServerFn({ method: "GET" }).middleware([authMiddleware]).handler(async () => (await getSql()).query(`select id, channel, doc_tipo, doc_id, doc_number, party_name, address, created_at::text from send_events order by id desc limit 80`));
export const revertLiveDemo = createServerFn({ method: "POST" }).middleware([authMiddleware]).handler(async ({ context }) => {
	const sql = await getSql();
	await assertAdmin(sql, context.userId);
	const before = await countLiveActivity(sql);
	await wipeLiveActivity(sql);
	return {
		ok: true,
		pos: before.purchase_orders,
		sos: before.sales_orders,
		invoices: before.invoices,
		lots: before.lots
	};
});

export type LiveWipeCounts = {
	purchase_orders: number;
	sales_orders: number;
	invoices: number;
	lots: number;
	expenses: number;
	bills: number;
	cash: number;
	pack_outs: number;
	receptions: number;
	customer_pos: number;
	send_events: number;
};

function wipeTotal(c: LiveWipeCounts) {
	return (
		c.purchase_orders +
		c.sales_orders +
		c.invoices +
		c.lots +
		c.expenses +
		c.bills +
		c.cash +
		c.pack_outs +
		c.receptions +
		c.customer_pos +
		c.send_events
	);
}

async function countLiveActivity(sql: any): Promise<LiveWipeCounts> {
	const n = async (text: string) => {
		const [row] = await sql.query(text);
		return Number(row?.c || 0);
	};
	return {
		purchase_orders: await n(`select count(*)::text as c from purchase_orders`),
		sales_orders: await n(`select count(*)::text as c from sales_orders`),
		invoices: await n(`select count(*)::text as c from invoices where coalesce(invoice_type, 'sale') <> 'opening'`),
		lots: await n(`select count(*)::text as c from lots`),
		expenses: await n(`select count(*)::text as c from expenses`),
		bills: await n(`select count(*)::text as c from supplier_bills where purchase_order_id is not null`),
		cash: await n(`select count(*)::text as c from cash_movements where folio <> 'CORTE-CHASE'`),
		pack_outs: await n(`select count(*)::text as c from pack_outs`),
		receptions: await n(`select count(*)::text as c from receptions`),
		customer_pos: await n(`select count(*)::text as c from customer_pos`),
		send_events: await n(`select count(*)::text as c from send_events`),
	};
}

async function wipeLiveActivity(sql: any) {
	const ids = async (text: string) => (await sql.query(text)).map((r) => r.id);
	await sql.query(
		`update cash_movements set invoice_id = null, supplier_bill_id = null, expense_id = null where folio = 'CORTE-CHASE'`,
	);
	const invIds = await ids(`select id from invoices where coalesce(invoice_type, 'sale') <> 'opening'`);
	const poIds = await ids(`select id from purchase_orders`);
	const soIds = await ids(`select id from sales_orders`);
	const lotIds = await ids(`select id from lots`);
	const billIds = await ids(`select id from supplier_bills where purchase_order_id is not null`);
	const expIds = await ids(`select id from expenses`);
	await sql.query(`delete from payment_applications`);
	await sql.query(`delete from grower_advance_applications`);
	await sql.query(`delete from grower_advances`);
	await sql.query(`update bank_lines set cash_movement_id = null`);
	await sql.query(`delete from bank_lines`);
	await sql.query(`delete from cash_movements where folio <> 'CORTE-CHASE'`);
	await sql.query(`delete from send_events`);
	await sql.query(`delete from expense_po_links`);
	await sql.query(`delete from pack_out_lines`);
	await sql.query(`delete from pack_outs`);
	await sql.query(`delete from waste_events`);
	await sql.query(`delete from inventory_movements`);
	await sql.query(`delete from inventory`);
	await sql.query(`delete from sale_line_allocations`);
	if (lotIds.length) {
		await sql.query(`update sales_order_lines set lot_id = null where lot_id = any($1::int[])`, [lotIds]);
		await sql.query(
			`update reception_lines set lot_sano_id = null, lot_retenido_id = null
       where lot_sano_id = any($1::int[]) or lot_retenido_id = any($1::int[])`,
			[lotIds],
		);
	}
	if (poIds.length) {
		await sql.query(
			`delete from reception_lines where reception_id in (select id from receptions where purchase_order_id = any($1::int[]))`,
			[poIds],
		);
		await sql.query(`delete from receptions where purchase_order_id = any($1::int[])`, [poIds]);
	}
	if (invIds.length) {
		await sql.query(`update invoices set parent_invoice_id = null where parent_invoice_id = any($1::int[])`, [invIds]);
		await sql.query(`delete from invoice_lines where invoice_id = any($1::int[])`, [invIds]);
		await sql.query(`delete from invoices where id = any($1::int[])`, [invIds]);
	}
	if (soIds.length) {
		await sql.query(`delete from sales_order_lines where sales_order_id = any($1::int[])`, [soIds]);
	}
	if (billIds.length) {
		await sql.query(`delete from supplier_bills where id = any($1::int[])`, [billIds]);
	}
	if (expIds.length) {
		await sql.query(`delete from expenses where id = any($1::int[])`, [expIds]);
	}
	if (lotIds.length) {
		await sql.query(`delete from lots where id = any($1::int[])`, [lotIds]);
	}
	if (poIds.length) {
		await sql.query(`delete from purchase_order_lines where purchase_order_id = any($1::int[])`, [poIds]);
		await sql.query(`delete from purchase_orders where id = any($1::int[])`, [poIds]);
	}
	if (soIds.length) {
		await sql.query(`delete from sales_orders where id = any($1::int[])`, [soIds]);
	}
	await sql.query(`delete from customer_po_lines`);
	await sql.query(`delete from customer_pos`);
}

export const previewLiveWipe = createServerFn({ method: "GET" })
	.middleware([authMiddleware])
	.handler(async ({ context }) => {
		const sql = await getSql();
		await assertAdmin(sql, context.userId);
		const counts = await countLiveActivity(sql);
		return { counts, total: wipeTotal(counts) };
	});

export const wipeLiveTests = createServerFn({ method: "POST" })
	.middleware([authMiddleware])
	.validator(z.object({ confirm: z.literal("BORRAR") }))
	.handler(async ({ context }) => {
		const sql = await getSql();
		await assertAdmin(sql, context.userId);
		const before = await countLiveActivity(sql);
		await wipeLiveActivity(sql);
		const after = await countLiveActivity(sql);
		return { ok: true, before, after, remaining: wipeTotal(after) };
	});
export const listSettlements = createServerFn({ method: "GET" }).middleware([moduleMiddleware("finance")]).handler(async () => {
	const sql = await getSql();
	const pos = await sql.query(`select po.id, po.po_number, s.name as supplier_name, coalesce(po.signed_off,false) as signed_off,
              coalesce(po.costing_mode,'pas') as costing_mode, po.status
       from purchase_orders po join suppliers s on s.id = po.supplier_id where po.status <> 'cancelled' order by po.id desc`);
	const out: any[] = [];
	for (const po of pos) {
		const settlement = await loadSettlement(sql, po.id);
		out.push({
			po_id: po.id,
			po_number: po.po_number,
			supplier_name: po.supplier_name,
			signed_off: po.signed_off,
			costing_mode: po.costing_mode,
			deal_type: settlement.deal_type,
			status: po.status,
			revenue: settlement.revenue,
			expenses: settlement.expenses,
			profit: settlement.profit,
			profit_pct: settlement.profit_pct,
			balance_due: settlement.balance_due
		});
	}
	return out;
});
export const listConcepts = createServerFn({ method: "GET" }).validator(z.object({
	kind: z.enum(["ingreso", "gasto"]).optional(),
	activeOnly: z.boolean().optional()
}).optional()).middleware([moduleMiddleware("finance")]).handler(async ({ data }) => {
	const sql = await getSql();
	const kind = data?.kind;
	const activeOnly = data?.activeOnly !== false;
	return await sql.query(`select id, kind, partida, name, is_active, sort_order
       from money_concepts
       where ($1::text is null or kind = $1)
         and ($2::boolean = false or is_active = true)
       order by kind, partida, sort_order, name`, [kind ?? null, activeOnly]);
});
export const addConcept = createServerFn({ method: "POST" }).validator(z.object({
	kind: z.enum(["ingreso", "gasto"]),
	partida: z.string().min(1),
	name: z.string().min(1)
})).middleware([moduleMiddleware("finance")]).handler(async ({ data }) => {
	const sql = await getSql();
	const name = data.name.trim();
	const partida = data.partida.trim();
	const [existing] = await sql.query(`select id, is_active from money_concepts where kind = $1 and partida = $2 and name = $3`, [
		data.kind,
		partida,
		name
	]);
	if (existing) {
		if (!existing.is_active) await sql.query(`update money_concepts set is_active = true where id = $1`, [existing.id]);
		return {
			id: existing.id,
			name
		};
	}
	const [row] = await sql.query(`insert into money_concepts (kind, partida, name, sort_order)
       values ($1,$2,$3, coalesce((select max(sort_order)+10 from money_concepts where kind = $1 and partida = $2), 10))
       returning id`, [
		data.kind,
		partida,
		name
	]);
	return {
		id: row.id,
		name
	};
});
export const setConceptActive = createServerFn({ method: "POST" }).validator(z.object({
	id: z.number(),
	is_active: z.boolean()
})).middleware([moduleMiddleware("finance")]).handler(async ({ data }) => {
	await (await getSql()).query(`update money_concepts set is_active = $1 where id = $2`, [data.is_active, data.id]);
	return { ok: true };
});
export const registerCashMovement = createServerFn({ method: "POST" }).validator(z.object({
	folio: z.string().optional(),
	mov_date: z.string().optional(),
	direction: z.enum(["in", "out"]),
	kind: z.enum([
		"cobro",
		"pago",
		"ajuste"
	]).optional(),
	counterparty: z.string().optional(),
	amount: z.number().positive(),
	concept: z.string().optional(),
	notes: z.string().optional()
})).middleware([moduleMiddleware("finance")]).handler(async ({ data }) => {
	const sql = await getSql();
	const folio = (data.folio || "").trim() || await nextCode(sql, "cash_movements", "folio", "MOV-");
	const [dup] = await sql.query(`select id from cash_movements where folio = $1`, [folio]);
	if (dup) throw new Error(`Folio ${folio} already exists`);
	const kind = data.kind || (data.direction === "in" ? "cobro" : "pago");
	const signed = data.direction === "in" ? data.amount : -data.amount;
	const date = data.mov_date || todayISO();
	const note = [data.concept, data.notes].filter(Boolean).join(" · ") || null;
	const [row] = await sql.query(`insert into cash_movements (folio, mov_date, kind, counterparty, amount, notes, concept)
       values ($1,$2,$3,$4,$5,$6,$7) returning id`, [
		folio,
		date,
		kind,
		data.counterparty?.trim() || null,
		signed,
		note,
		data.concept || null
	]);
	return {
		id: row.id,
		folio
	};
});
