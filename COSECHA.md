# Cosecha — base completa

ERP de **Plein Produce LLC** (Nogales, AZ). Dueño: Miguel.
Este repo es el desarrollo entero: backend, frontend, diseño, migraciones, PDF, auth.

Si otro chat o proyecto usa esto como base: **no reconstruyas Cosecha**. Lee el repo. Reutiliza stack, tokens, server functions y patrones. No publiques *ese* proyecto desde aquí. No toques el corte ni Chase histórico. No reescribas una liquidación ya emitida (`purchase_orders.liquidated_at`).

Si trabajas **en Cosecha**, es al revés: al cerrar un bloque probado se mezcla a `main` y se publica — ver «Auth» abajo.

Antes de tocar código lee, en este orden: `HANDOFF.md` → este archivo → `CLAUDE.md` → `AUDITORIA-2026-09-03.md` (hallazgos vigentes, marcados los que ya se resolvieron y en qué bloque) → `MODELO-NEGOCIO.md` (lo que el negocio real hace y el ERP no cubre).

## Idioma

- UI y copy: español de producto (órdenes, corte, facturas, cobros, CxC/CxP, tesorería).
- Keys de código, rutas y SQL: inglés.

## Stack

- TanStack Start + Router + React 19 + Tailwind v4 + Radix/shadcn
- Server functions: `createServerFn` + zod + `authMiddleware`/`moduleMiddleware(módulo)` en [`src/lib/produce-server.ts`](src/lib/produce-server.ts)
- Postgres (Neon en publicado). Migraciones `migrations/0001`–`0048` (crece con cada bloque; revisa `ls migrations/` para el número real)
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

1. OC (`purchase_orders`) → `receiveMerchandise` crea lotes **con lo capturado** (fecha de recepción y de empaque, grado, origen de la línea, pallets a prorrata; sin dato va null — nada de `'México'` de relleno) → `createBillFromPO` (CxP). Lo **rechazado cierra la línea**: va a `purchase_order_lines.quantity_rejected`, el pendiente es `ordered − received − rejected` y la carga sale de "por llegar"; no se suma a lo recibido porque en firme la factura es recibido × costo y eso le pagaría al productor la fruta rechazada. Un reenvío del productor es **una carga nueva**. En consignación, la bill nace del **congelado** si la carga ya tiene liquidación (`liquidated_at`), no del cálculo vivo.
2. OV (`sales_orders`) → `shipSalesLine` descuenta lote (cada despacho se liga a su camión con `sale_line_allocations.shipment_id`; el BOL ampara solo eso y congela `bol_issued_at`) → `createInvoiceFromSO` (CxC, línea con empaque/calibre y `pack_style_id`; "Enviar a" = destino de la OV). Cancelar una venta ya rendida al productor **marca** la asignación (`sale_line_allocations.cancelled_at`), no la borra.
3. CPO (`customer_pos`) → `convertCustomerPOToSO`.
4. Pack-out (`createPackOut`, hereda la carga de origen) / waste / hold / close lote. Ubicación del lote: catálogo en `locations`, pantalla Almacén → Ubicaciones (`listLocations`/`createLocation`/`updateLocation`/`setLocationActive`).
5. Liquidación al productor (consignación y comisión pura). Las **notas de crédito al cliente** se atribuyen a la carga con causa (`grower_credit_attributions`): la del productor le baja el neto y la base de su comisión, y si la carga ya está liquidada entra por complementaria. `getSettlement` calcula en vivo; `issueGrowerSettlement` **congela** el documento y marca `purchase_orders.liquidated_at` (desde ahí la carga solo cambia por complementaria). `issueSettlementSupplement` emite una **complementaria** (`LIQ-004-C1`, `-C2`…) con lo ocurrido después: ventas de cajas pendientes, gastos nuevos, reversas de ventas canceladas (con la comisión devuelta), ajustes a favor del productor. Si la cuenta sale negativa, nace un adelanto (`grower_advances`) **sin salida de caja**.
5b. **Devolución del cliente** (`customer_returns` + `customer_return_lines`): una sola captura mueve la fruta y el dinero. Tres destinos — **regresa** (nace un lote nuevo marcado devuelto, `lots.returned_from_lot_id`, retenido hasta revisarlo, con el costo y la carga del original), **se destruye** (motivo obligatorio + certificado, PACA) o **no regresó** (el camión se rechazó en destino; se captura qué pasó y lo que se recuperó). La culpa se captura por renglón: solo la del productor le baja el neto, por el mismo camino de C-1b; en firme nunca se atribuye. `sale_line_allocations.returned_qty` saca del COGS **solo** lo que de verdad volvió a la cámara; lo destruido se queda costeado como vendido. `lots.rts_qty` documenta toda caja devuelta y la liquidación se la enseña al productor.
6. Disposición del remanente al liquidar (PACA 7 CFR 46, `lot_dispositions`): cada caja sin vender va a pendiente de venta, destruida (certificado obligatorio al 5% del embarque) o comprada por Plein.
7. Cobro: `registerCustomerPayment` — monto = suma aplicada, topado al saldo de cada factura, factura del cliente y viva, con fecha/método/referencia. Pago de fruta: `registerPago` contra la FAC- en CxP. Pago de gastos: `registerVendorPayment` (solo gastos, mismas reglas). La OC no es cuenta por pagar.
8. Gastos + `expense_po_links`: un gasto de varias cargas se **reparte** (`setExpenseSplit`), y a cada productor se le descuenta el `amount_applied` de SU carga — nunca el monto completo. Lo no repartido lo absorbe Plein. Tesorería: `cash_movements` + `bank_lines`.
9. SKU = producto × empaque × calibre (`PAPA-MARA-CAJA-10CT`), no "solo papaya".

Documentos públicos: `/doc/:tipo/:id` (factura, oc, ov, cpo, **liq** — liquidación y sus complementarias, mismo enlace). El resto con login.

## Dinero — no romper

1. Fuente de verdad = libros V8 Drive (Ingresos / Egresos / Chase), **no Cargas**.
2. Corte apertura **2026-08-19** (no 2026-06-30 — ese fue el corte v1, reemplazado desde el mismo commit que lo introdujo; ver `HANDOFF.md` si encuentras el número viejo en algún lado):
   - AR opening `$673,014.43` (50 facturas `invoice_type=opening`) — **es SALDO**: $797,038.13 facturado menos $124,023.70 cobrado dentro del propio corte
   - AP opening `$570,097.56` (62 bills sin PO) — **es SALDO**: $635,041.48 menos $64,943.92 ya pagado
   - Chase `$9,361.05` folio `CORTE-CHASE`
   - JEAMS `$52,447.33` (GL `20250`)
   - Equity plug `$59,830.59` (GL `30000`)
3. `invoice_type=opening` **no entra al P&L**. El corte vive en Balance Sheet. P&L en ceros es correcto hasta ventas live.
3b. **Comisión pura**: la venta bruta entra al ingreso y el neto al productor sale como costo en la cuenta `50100` al **emitir** la liquidación (mismo evento que crea el pasivo `21000`). La utilidad de esas cargas es la comisión. En consignación NO aplica: ahí el costo ya vive en `lots.unit_cost` (50000).
4. Saldo CxC/CxP = `total − paid`. Nunca netear.
5. **Papayas & More** es cliente **y** proveedor. Cuentas separadas. No netear.
6. Programada (PX-72775 / PX-72868) **no** se importó.
7. **No replay** de Chase histórico. Chase operativo abre 19 Ago 2026. Folio 430 no se aplica solo. No tocar `CORTE-CHASE`.
8. `wipeLiveTests` (Ajustes → Pruebas, escribir `BORRAR`) borra actividad live y **protege** opening + `CORTE-CHASE` + todo el catálogo (productos, clientes, proveedores, ubicaciones) — el catálogo no se limpia con este botón porque no es "actividad de prueba", es dato maestro. **Es global:** uno lo corre y se lleva la actividad de todos, incluido lo que alguien tenga a medias en ese momento. Con varias personas capturando, acordar quién lo corre y avisar antes.
8b. **Corregir el costo en firme** (`updatePurchaseOrder`) baja a los lotes de **su** línea (`purchase_order_line_id`, nunca por producto) y recalcula en cascada los lotes hijos de reempaque (`recomputeRepackCosts`). Aplica hacia atrás, también a cajas ya vendidas — el COGS se lee vivo. Con factura de proveedor viva **bloquea** (cancela la FAC-, corrige, regenera); con liquidación emitida no aplica; en consignación/comisión el costo se define al liquidar.
9. Una liquidación emitida (`liquidated_at`) **no se reescribe**. Correcciones van por complementaria (`grower_settlement_supplements`), nunca editando lo ya emitido.
10. YTD 2026 histórico se queda en V8. Cosecha arranca en el corte. **Miguel puso esta regla en revisión** (19 Sep 2026): quiere registrar las 92 cargas de dic 2025 – jun 2026. Las anclas YA contienen su resultado resumido, así que registrarlas como actividad normal las contaría dos veces. Tres caminos en `MODELO-NEGOCIO.md`; se inclina por el (a), registro histórico consultable fuera de contabilidad. **Sin confirmar — no construir nada que dependa de esto.**
11. GL: `16000` JP Morgan Chase, `20250` JEAMS, `30000` equity, `12000` AR, `20100` AP, `21000` por remitir a productores, `50100` remitido al productor (su contrapartida en resultados), `52500` nómina, `56000` gastos de venta, `57000` gastos administrativos, `58000` gastos financieros.
12. **A qué cuenta va un gasto** (bloque 0): se resuelve con cuatro escapes, de lo más específico a lo más general — `expenses.account_number` → `gl_mappings[categoría]` → `gl_mappings['partida:' + partida del concepto]` → cajón `59999`. Las cinco partidas (`money_concepts.partida`: Costo, Gasto de Venta, Gasto Nómina, Gasto Administrativo, Gasto Financiero) son las del V8 y cubren el catálogo entero, así que un concepto nuevo nace clasificado. Una cuenta mapeada que no existe o que no es de gasto/costo **se ignora** y el gasto sigue al escape siguiente: el dinero nunca se evapora. `getFinancials({from, to})` recorta **solo el P&L**; el Balance es siempre la foto de hoy, a propósito.

## Auth

Primer admin o `miguelarambulam@gmail.com` reclama staff.
Módulos: orders, warehouse, contacts, finance, reports, settings.
Roles: admin, seller, buyer, warehouse — el mapa rol→módulos está en `src/lib/access.ts` (`ROLE_MODULES`), no en `nav.ts` (ese solo decide dónde aparece cada pantalla en el menú).
Ajustes → Equipo para otorgar. Mezclar a `main` publica solo (Vercel). **Desde el 18 Sep 2026** el agente cierra cada bloque probado él mismo: commit → merge `--no-ff` a `main` → push. Eso despliega a producción en Vercel en automático, y así es como debe ser — Miguel lo pidió para que no se le pase. **La única parada que sigue es antes de una migración:** enseñar el SQL y esperar su OK.

## Módulos UI

- Orders: `/compras` `/ventas` `/cpo` `/listas` `/embarques` `/agencias` `/cruces` `/transportistas`
- Warehouse: `/inventario` `/productos` `/destinos` (pantalla "Ubicaciones" — bodegas/cámaras propias y de terceros; el nombre de la ruta quedó igual por compatibilidad, el menú y el título en pantalla ya dicen "Ubicaciones")
- Contacts: `/clientes` `/proveedores`
- Finance: `/cuentas` `/gastos` `/cxc` `/cxp` `/tesoreria`
- Reports: `/reportes` (Sales vs Financial; Financial usa `search.tab=pl` para no saltar a Sales; pestaña Settlements lee el congelado cuando la carga ya tiene liquidación)
- Settings: appearance, teams, sent, pruebas
