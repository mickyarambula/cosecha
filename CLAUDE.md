# CLAUDE.md — Cosecha (Plein Produce)

Eres el ingeniero de **Cosecha**, ERP de produce fresco de **Plein Produce LLC** (Nogales, AZ). Dueño: **Miguel Arambula** (`miguelarambulam@gmail.com`).

Lee en este orden antes de tocar código: `HANDOFF.md` → `COSECHA.md` → este archivo → `AUDITORIA-2026-09-03.md`. Y antes de proponer un bloque nuevo, `MODELO-NEGOCIO.md` (lo que la operación real de Plein hace y el ERP todavía no cubre, con los números de los libros V8). No reconstruyas el ERP. No “simplifiques” dinero.

## Idioma

- Habla con Miguel en **español de producto** (órdenes, corte, facturas, cobros, CxC/CxP, tesorería).
- Código, SQL, keys i18n: **inglés**.
- No menciones puertos, localhost, sandbox ni herramientas internas al usuario.

## Prohibido (rompe el negocio)

- Publicar a producción **a media construcción**. El cierre de un bloque probado sí se publica: **Desde el 18 Sep 2026** el agente cierra cada bloque probado él mismo: commit → merge `--no-ff` a `main` → push. Eso despliega a producción en Vercel en automático, y así es como debe ser — Miguel lo pidió para que no se le pase. **La única parada que sigue es antes de una migración:** enseñar el SQL y esperar su OK. (Si algún documento dice que el merge lo hace Miguel desde GitHub, ese texto es anterior al 18 Sep 2026 y está mal — corrígelo.)
- Tocar facturas `invoice_type=opening`, bills de corte, o el folio **`CORTE-CHASE`**.
- Replay de movimientos Chase históricos. Chase operativo abre **19 Ago 2026**. Folio **430** no se aplica solo.
- Netear Papayas & More (es cliente **y** proveedor). Cuentas separadas.
- Reintroducir Programada (PX-72775 / PX-72868).
- Meter opening al P&L. El corte vive en Balance Sheet. P&L en ceros hasta ventas live = correcto.
- Contar dos veces la fruta del productor: en **comisión pura** el neto al productor sale por la cuenta `50100` al emitir la liquidación; en **consignación** ese costo ya vive en `lots.unit_cost` (50000) — nunca los dos.
- Cambiar `saldo = total − paid`.
- Volver a escribir a fuego en el código a qué cuenta va una categoría de gasto. Eso se resuelve contra el catálogo (`gl_mappings` + la partida de `money_concepts`), y la pantalla de Cuentas es la que manda. Una cuenta que no existe **se ignora** y el gasto sigue al escape siguiente — nunca se evapora.
- Mapear **"Materia prima"** a una cuenta de costo. El costo de la fruta ya viene de la orden de compra vía `lots.unit_cost`: mandarlo además a `50000` cuenta la misma fruta dos veces. Va al cajón `59999` a propósito, como alarma.
- Sacar del costo de venta (`sale_line_allocations.returned_qty`) fruta devuelta que **no** volvió al inventario. Solo `restock` lo resta: lo destruido y lo que no regresó se queda costeado como vendido — se fue y no volvió. `lots.rts_qty` en cambio documenta las tres.
- Bajarle el neto al productor por una devolución que fue **de Plein**, o por una carga en **firme**. La culpa se captura por renglón y viaja por las atribuciones de C-1b; el ingreso del lote no se toca.
- Sumar lo **rechazado** a `quantity_received`. Va en `purchase_order_lines.quantity_rejected`: cierra la línea (pendiente = `ordered − received − rejected`) sin pagarle al productor la fruta que Plein rechazó — en firme la factura es recibido × costo. Un reenvío es una carga nueva.
- Corregir el costo de una carga **por producto** en vez de por línea (`purchase_order_line_id`), o dejar los lotes hijos de un reempaque con el costo viejo (`recomputeRepackCosts`). Con factura de proveedor viva el costo **no se guarda en silencio**: se bloquea diciendo cómo corregirlo.
- Atribuirle a un productor más crédito del que su carga aportó a esa venta: el tope es **acumulado** sobre la venta, entre todas las notas de crédito.
- Cobrarle a un productor el monto COMPLETO de un gasto compartido: lo que se le descuenta es `expense_po_links.amount_applied` de SU carga. `expenses.purchase_order_id` ya solo es "la carga principal", no la fuente del dinero.
- Rellenar un dato que el usuario no capturó (origen `'MX'`, precio `$35`, cantidad = lote completo, categoría o monto de gasto). En blanco es honesto; inventado le llega al productor en su liquidación o al cliente en su factura.
- Publicar una server fn de **escritura** con solo `authMiddleware`. Pide el módulo de la pantalla donde vive (`moduleMiddleware("orders")`, o varios si vive en dos). Lo que no es de un módulo pide `staffMiddleware` (staff activo). Única excepción a propósito: `getMyAccess` y los tres enlaces públicos por token (portal del productor, documento impreso, membrete). Y si el candado es de otro módulo que el de la pantalla, **esconde el botón** con `useHasModule` — un botón que truena al guardar es peor que no tenerlo.
- Fechar con `new Date()` en el servidor. La fecha del negocio es la de Nogales: `todayISO()` / `todayYYMM()` de `src/lib/utils.ts`. El servidor corre en UTC y después de las 5 de la tarde fecha mañana.
- Sumar pesos con dólares. Los libros van en **dólares**: `unit_cost`, `total`, `amount`, `paid`, `saldo`, `lots.unit_cost` y `cash_movements.amount` son dólares SIEMPRE. Un documento en pesos guarda el original en `*_fx` y su TC (`fx_rate` / `fx_agreed`, pesos por dólar) y se convierte UNA vez con `src/lib/fx.ts` (`toUsd`, `unitCostToUsd`) antes de escribir. Sin TC no se guarda; nunca se inventa uno; la factura del proveedor se congela al TC pactado de su carga. Al pagar en pesos, `cash_movements.amount` es lo que SALIÓ de Chase (TC del banco) y lo abonado a la deuda es `|amount| + fx_result`; toda reversa (cancelar pago, BORRAR) resta lo abonado, nunca `|amount|` solo. El resultado cambiario vive en los pagos (`fx_result`), no en `expenses` — un gasto podría cargárselo al productor.
- Mandar correo desde la app. Enviar = Outlook `mailto` + WhatsApp `wa.me` + PDF descargado.
- `window.print()` como camino de PDF. Usar `src/lib/doc-pdf.ts` (jspdf, descarga).
- Modales hijos de sticky / `backdrop-filter`. Portal a `document.body`.
- Reescribir una liquidación al productor ya emitida (`purchase_orders.liquidated_at` con fecha). Correcciones después de emitir van por **liquidación complementaria** (`grower_settlement_supplements`, folio `LIQ-004-C1`, `-C2`…), nunca editando el documento congelado.
- Inventar datos de negocio como si fueran reales: direcciones, ubicaciones/bodegas, proveedores, destinos de cliente, temperaturas. Ya pasó dos veces (el membrete con "1234 N Grand Ave"; las 4 ubicaciones sembradas en `migrations/0002`–`0006` que no existen — Plein no tiene cámara ni bodega propia). Si falta un dato real, dilo y espera a que Miguel lo capture — no le pongas un nombre "razonable" de relleno.

## Stack

TanStack Start + Router + React 19 + Tailwind v4 + Radix.  
Server fns: `createServerFn` + zod + `authMiddleware` en `src/lib/produce-server.ts`.  
DB: Postgres (Neon si hay `DATABASE_URL`; si no, PGLite embebido). Migraciones `migrations/0001`–`0052` (crece con cada bloque — `ls migrations/` para el número real).  
Auth: Better Auth (Google + correo). Staff por módulos.

## Dónde está qué

| Ruta | Rol |
|---|---|
| `src/lib/produce-server.ts` | Lógica de negocio (150+ server fns y creciendo) |
| `src/lib/nav.ts` | Dónde aparece cada pantalla en el menú. `sectionForPath` usa `tabs[].tab` **antes** que `search` |
| `src/lib/access.ts` | Quién puede ENTRAR a cada ruta (`PATH_MODULE` → `ROLE_MODULES`) — independiente de `nav.ts`; mover una pantalla de menú no cambia su permiso |
| `src/lib/i18n.ts` | Español UI |
| `src/lib/company.ts` | Membrete / PACA |
| `src/lib/doc-pdf.ts` | PDF carta |
| `src/components/print-doc.tsx` `send-doc.tsx` | Imprimir / enviar |
| `src/routes/*` | Pantallas |
| `migrations/` | Esquema + corte + catálogo Plein |
| `public/brand/wordmark.png` | Wordmark **transparente** (sin caja blanca) |
| `src/styles.css` | Tokens de diseño |

## Diseño

DM Sans. Tokens: bg `#f4f6f8`, primary `#1b6b4c`, action `#2563eb`, ok `#15803d`, danger `#dc2626`.  
Rail de módulos + tabs. Factura = hoja paper + membrete + PACA. Sin blobs, emojis de adorno ni gradientes. `cursor-pointer` en botones.

## Arranque local

```bash
npm install
npm run dev
```

Sin `DATABASE_URL` usa PGLite y corre las migraciones al arrancar (incluye el corte). Con Neon de producción: **cuidado** — es la base live de Plein.

`npm run typecheck` antes de dar por cerrado un cambio.

## Auth / equipo

Primer admin o `miguelarambulam@gmail.com` reclama staff.  
Módulos: orders, warehouse, contacts, finance, reports, settings.  
Roles: admin, seller, buyer, warehouse.  
Borrar pruebas: Ajustes → Pruebas → escribir `BORRAR` (`wipeLiveTests` protege opening + `CORTE-CHASE` + todo el catálogo — productos, clientes, proveedores, ubicaciones — porque no es actividad de prueba).

## Documentos que hay que leer y mantener

Antes de un bloque nuevo: `HANDOFF.md` (estado y qué se construyó), `AUDITORIA-2026-09-03.md` (hallazgos vigentes, marcados los resueltos), `MODELO-NEGOCIO.md` (huecos del negocio real, con sus preguntas abiertas — no las contestes tú). Al cerrar un bloque grande: actualiza `HANDOFF.md` con lo que se hizo y lo que quedó pendiente — no dejes que el próximo chat lea números o rutas viejas (pasó con el corte: quedó documentado mal durante semanas).
