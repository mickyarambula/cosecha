# Cosecha — base completa

ERP de **Plein Produce LLC** (Nogales, AZ). Dueño: Miguel.  
Este repo es el desarrollo entero: backend, frontend, diseño, migraciones, PDF, auth.

Si otro chat o proyecto usa esto como base: **no reconstruyas Cosecha**. Lee el repo. Reutiliza stack, tokens, server functions y patrones. No publiques. No toques el corte ni Chase histórico.

## Idioma

- UI y copy: español de producto (órdenes, corte, facturas, cobros, CxC/CxP, tesorería).
- Keys de código, rutas y SQL: inglés.

## Stack

- TanStack Start + Router + React 19 + Tailwind v4 + Radix/shadcn
- Server functions: `createServerFn` + zod + `authMiddleware` en [`src/lib/produce-server.ts`](src/lib/produce-server.ts)
- Postgres (Neon en publicado). Migraciones `migrations/0001`–`0017`
- Auth: Better Auth, Google + correo. Staff por módulos
- i18n: [`src/lib/i18n.ts`](src/lib/i18n.ts)
- PDF: [`src/lib/doc-pdf.ts`](src/lib/doc-pdf.ts) — descarga archivo, no `window.print`
- Enviar: Outlook `mailto` + WhatsApp `wa.me` con `window.open(_blank)`. La app no manda el correo
- Modales: `createPortal(document.body)` — nunca hijos de sticky / backdrop-filter

## Archivos clave

| Ruta | Qué es |
|---|---|
| `src/lib/produce-server.ts` | Toda la lógica de negocio (~90 server fns) |
| `src/lib/nav.ts` | Módulos y tabs. `sectionForPath` usa `tabs[].tab` **antes** que `search` |
| `src/lib/access.ts` | Módulos por rol |
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

1. OC (`purchase_orders`) → `receiveMerchandise` crea lotes → `createBillFromPO` (CxP)
2. OV (`sales_orders`) → `shipSalesLine` descuenta lote → `createInvoiceFromSO` (CxC)
3. CPO (`customer_pos`) → `convertCustomerPOToSO`
4. Pack-out / waste / hold / close lote. Settlement grower: `getSettlement` / `applySettlement`
5. Cobro: `registerCustomerPayment`. Pago vendor: `registerVendorPayment`
6. Gastos + `expense_po_links`. Tesorería: `cash_movements` + `bank_lines`
7. SKU = producto × empaque × calibre (`PAPA-MARA-CAJA-10CT`), no “solo papaya”

Documentos públicos: `/doc/:tipo/:id` (factura, oc, ov, cpo). El resto con login.

## Dinero — no romper

1. Fuente de verdad = libros V8 Drive (Ingresos / Egresos / Chase), **no Cargas**.
2. Corte apertura **2026-06-30**:
   - AR opening `$673,014.43` (50 facturas `invoice_type=opening`)
   - AP opening `$564,670.16` (52 bills sin PO)
   - Chase `$19,066.20` folio `CORTE-CHASE`
   - JEAMS `$23,030.33` (GL `20250`)
   - Equity plug `$104,380.14` (GL `30000`)
3. `invoice_type=opening` **no entra al P&L**. El corte vive en Balance Sheet. P&L en ceros es correcto hasta ventas live.
4. Saldo CxC/CxP = `total − paid`. Nunca netear.
5. **Papayas & More** es cliente **y** proveedor. Cuentas separadas. No netear.
6. Programada (PX-72775 / PX-72868) **no** se importó.
7. **No replay** de Chase histórico. Chase operativo abre 19 Ago 2026. Folio 430 no se aplica solo. No tocar `CORTE-CHASE`.
8. `wipeLiveTests` (Ajustes → Pruebas, escribir `BORRAR`) borra actividad live y **protege** opening + `CORTE-CHASE`.
9. YTD 2026 histórico se queda en V8. Cosecha arranca en el corte.
10. GL: `16000` JP Morgan Chase, `20250` JEAMS, `30000` equity, `12000` AR, `20100` AP.

## Auth

Primer admin o `miguelarambulam@gmail.com` reclama staff.  
Módulos: orders, warehouse, contacts, finance, reports, settings.  
Roles: admin, seller, buyer, warehouse.  
Ajustes → Equipo para otorgar. No publicar a menos que Miguel diga “publícalo”.

## Módulos UI

- Orders: `/compras` `/ventas` `/cpo` `/listas` `/destinos`
- Warehouse: `/inventario` `/productos`
- Contacts: `/clientes` `/proveedores`
- Finance: `/cuentas` `/gastos` `/cxc` `/cxp` `/tesoreria`
- Reports: `/reportes` (Sales vs Financial; Financial usa `search.tab=pl` para no saltar a Sales)
- Settings: appearance, teams, sent, pruebas
