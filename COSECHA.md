# Cosecha — base completa

ERP de **Plein Produce LLC** (Nogales, AZ). Dueño: Miguel.
Este repo es el desarrollo entero: backend, frontend, diseño, migraciones, PDF, auth.

Si otro chat o proyecto usa esto como base: **no reconstruyas Cosecha**. Lee el repo. Reutiliza stack, tokens, server functions y patrones. No publiques. No toques el corte ni Chase histórico. No reescribas una liquidación ya emitida (`purchase_orders.liquidated_at`).

Antes de tocar código lee, en este orden: `HANDOFF.md` → este archivo → `CLAUDE.md` → `AUDITORIA-2026-09-03.md` (hallazgos vigentes, marcados los que ya se resolvieron y en qué bloque).

## Idioma

- UI y copy: español de producto (órdenes, corte, facturas, cobros, CxC/CxP, tesorería).
- Keys de código, rutas y SQL: inglés.

## Stack

- TanStack Start + Router + React 19 + Tailwind v4 + Radix/shadcn
- Server functions: `createServerFn` + zod + `authMiddleware`/`moduleMiddleware(módulo)` en [`src/lib/produce-server.ts`](src/lib/produce-server.ts)
- Postgres (Neon en publicado). Migraciones `migrations/0001`–`0039` (crece con cada bloque; revisa `ls migrations/` para el número real)
- Auth: Better Auth, Google + correo. Staff por módulos
- i18n: [`src/lib/i18n.ts`](src/lib/i18n.ts)
- PDF: [`src/lib/doc-pdf.ts`](src/lib/doc-pdf.ts) — descarga archivo, no `window.print`
- Enviar: Outlook `mailto` + WhatsApp `wa.me` con `window.open(_blank)`. La app no manda el correo
- Modales: `createPortal(document.body)` — nunca hijos de sticky / backdrop-filter

## Archivos clave

| Ruta | Qué es |
|---|---|
| `src/lib/produce-server.ts` | Toda la lógica de negocio (150+ server fns y creciendo; `grep -c "createServerFn({" src/lib/produce-server.ts` para el número exacto) |
| `src/lib/nav.ts` | Módulos y tabs. `sectionForPath` usa `tabs[].tab` **antes** que `search` |
| `src/lib/access.ts` | Módulos por rol (`PATH_MODULE` decide el permiso de cada ruta — independiente de en qué módulo la lista `nav.ts`) |
| `src/lib/company.ts` | Membrete Plein / PACA |
| `src/lib/doc-pdf.ts` | PDF carta |
| `src/components/print-doc.tsx` / `send-doc.tsx` | Imprimir / enviar |
| `src/routes/*` | Una ruta por pantalla |
| `migrations/` | Esquema + corte + catálogo Plein |
| `public/brand/wordmark.png` | Wordmark transparente (sin caja blanca) |

## Diseño

Fuente **DM Sans**. Tokens en [`src/styles.css`](src/styles.css):

- bg `#f4f6f8` · surface `#fff` · fg `#1c2430` · muted `#5b6573`
- primary `#1b6b4c` (marca) · action `#2563eb` (botón)
- ok `#15803d` · warn `#b45309` · danger `#dc2626`
- tab `#1b5e45` · seller `#1d4f91` · paper `#fff`

Chrome: rail de módulos + tabs de sección. Tablas con números tabular. Factura = hoja paper + membrete + PACA. Sin blobs, emojis de adorno ni gradientes.

## Flujo operativo

1. OC (`purchase_orders`) → `receiveMerchandise` crea lotes → `createBillFromPO` (CxP). En consignación, la bill nace del **congelado** si la carga ya tiene liquidación (`liquidated_at`), no del cálculo vivo.
2. OV (`sales_orders`) → `shipSalesLine` descuenta lote → `createInvoiceFromSO` (CxC). Cancelar una venta ya rendida al productor **marca** la asignación (`sale_line_allocations.cancelled_at`), no la borra.
3. CPO (`customer_pos`) → `convertCustomerPOToSO`.
4. Pack-out (`createPackOut`, hereda la carga de origen) / waste / hold / close lote. Ubicación del lote: catálogo en `locations`, pantalla Almacén → Ubicaciones (`listLocations`/`createLocation`/`updateLocation`/`setLocationActive`).
5. Liquidación al productor (consignación y comisión pura): `getSettlement` calcula en vivo; `issueGrowerSettlement` **congela** el documento y marca `purchase_orders.liquidated_at` (desde ahí la carga solo cambia por complementaria). `issueSettlementSupplement` emite una **complementaria** (`LIQ-004-C1`, `-C2`…) con lo ocurrido después: ventas de cajas pendientes, gastos nuevos, reversas de ventas canceladas (con la comisión devuelta), ajustes a favor del productor. Si la cuenta sale negativa, nace un adelanto (`grower_advances`) **sin salida de caja**.
6. Disposición del remanente al liquidar (PACA 7 CFR 46, `lot_dispositions`): cada caja sin vender va a pendiente de venta, destruida (certificado obligatorio al 5% del embarque) o comprada por Plein.
7. Cobro: `registerCustomerPayment`. Pago vendor: `registerVendorPayment`.
8. Gastos + `expense_po_links`. Tesorería: `cash_movements` + `bank_lines`.
9. SKU = producto × empaque × calibre (`PAPA-MARA-CAJA-10CT`), no "solo papaya".

Documentos públicos: `/doc/:tipo/:id` (factura, oc, ov, cpo, **liq** — liquidación y sus complementarias, mismo enlace). El resto con login.

## Dinero — no romper

1. Fuente de verdad = libros V8 Drive (Ingresos / Egresos / Chase), **no Cargas**.
2. Corte apertura **2026-08-19** (no 2026-06-30 — ese fue el corte v1, reemplazado desde el mismo commit que lo introdujo; ver `HANDOFF.md` si encuentras el número viejo en algún lado):
   - AR opening `$673,014.43` (50 facturas `invoice_type=opening`)
   - AP opening `$570,097.56` (62 bills sin PO)
   - Chase `$9,361.05` folio `CORTE-CHASE`
   - JEAMS `$52,447.33` (GL `20250`)
   - Equity plug `$59,830.59` (GL `30000`)
3. `invoice_type=opening` **no entra al P&L**. El corte vive en Balance Sheet. P&L en ceros es correcto hasta ventas live.
4. Saldo CxC/CxP = `total − paid`. Nunca netear.
5. **Papayas & More** es cliente **y** proveedor. Cuentas separadas. No netear.
6. Programada (PX-72775 / PX-72868) **no** se importó.
7. **No replay** de Chase histórico. Chase operativo abre 19 Ago 2026. Folio 430 no se aplica solo. No tocar `CORTE-CHASE`.
8. `wipeLiveTests` (Ajustes → Pruebas, escribir `BORRAR`) borra actividad live y **protege** opening + `CORTE-CHASE` + todo el catálogo (productos, clientes, proveedores, ubicaciones) — el catálogo no se limpia con este botón porque no es "actividad de prueba", es dato maestro.
9. Una liquidación emitida (`liquidated_at`) **no se reescribe**. Correcciones van por complementaria (`grower_settlement_supplements`), nunca editando lo ya emitido.
10. YTD 2026 histórico se queda en V8. Cosecha arranca en el corte.
11. GL: `16000` JP Morgan Chase, `20250` JEAMS, `30000` equity, `12000` AR, `20100` AP.

## Auth

Primer admin o `miguelarambulam@gmail.com` reclama staff.
Módulos: orders, warehouse, contacts, finance, reports, settings.
Roles: admin, seller, buyer, warehouse — el mapa rol→módulos está en `src/lib/access.ts` (`ROLE_MODULES`), no en `nav.ts` (ese solo decide dónde aparece cada pantalla en el menú).
Ajustes → Equipo para otorgar. No publicar a menos que Miguel diga "publícalo".

## Módulos UI

- Orders: `/compras` `/ventas` `/cpo` `/listas` `/embarques` `/agencias` `/cruces` `/transportistas`
- Warehouse: `/inventario` `/productos` `/destinos` (pantalla "Ubicaciones" — bodegas/cámaras propias y de terceros; el nombre de la ruta quedó igual por compatibilidad, el menú y el título en pantalla ya dicen "Ubicaciones")
- Contacts: `/clientes` `/proveedores`
- Finance: `/cuentas` `/gastos` `/cxc` `/cxp` `/tesoreria`
- Reports: `/reportes` (Sales vs Financial; Financial usa `search.tab=pl` para no saltar a Sales; pestaña Settlements lee el congelado cuando la carga ya tiene liquidación)
- Settings: appearance, teams, sent, pruebas
