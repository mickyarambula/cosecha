# Plan — Paso 2 en adelante (verificado contra el código, 28-ago-2026)

**Nota (9 Sep 2026): este plan no se siguió.** Seis días después de escribirse esto (3 Sep), se corrió una auditoría de código completa (`AUDITORIA-2026-09-03.md`) que encontró algo más urgente que "margen visible al vender": la liquidación al productor no se congelaba al emitir (su hallazgo 8) y el reempaque sacaba cajas de esa liquidación (hallazgo 5). La sesión que siguió (PR #14 a #21, "sesión 2" en `HANDOFF.md`) atacó eso en vez de los Pasos 2-6 de abajo. Ninguno de los seis pasos de este documento se construyó.

Lo que sí sigue siendo cierto y útil de este documento: la **Parte 1** (verificación de los seis supuestos contra el código del 28 Ago) — nadie la desmintió, y varias de sus observaciones siguen abiertas hoy (el margen sigue sin verse al vender antes de surtir; sigue sin haber transportista/temperatura de flete; los reclamos de cliente siguen sin ruta de retorno a inventario). La **Parte 2** (plan de Pasos 2-6) es la que quedó atrás — antes de retomarla, confirma con Miguel si sigue siendo el orden que quiere o si `AUDITORIA-2026-09-03.md` (sección "Áreas de mejora") manda ahora.

Qué se construyó en su lugar: ver `HANDOFF.md` → "Sesión 2 — qué se construyó" (PR #14-#21: reempaque ligado a la carga, disposición del remanente PACA, liquidación complementaria, candados de la carga liquidada, reversa de venta cancelada, administración de ubicaciones). Nada de eso es un "Paso" de este plan — es la respuesta a hallazgos 5 y 8 de la auditoría.

---

Este documento tiene dos partes: primero la **verificación** de los seis supuestos
que salieron de estudiar Silo/PICS/PACA (cada uno con veredicto y el lugar exacto
del código donde se comprobó), y luego el **plan de pasos** construido sobre lo
que de verdad hay — no sobre lo que parecía haber.

Regla que sí se confirmó de la sospecha general: igual que pasó con el CPO, hay
más construido de lo que las pantallas dejan ver — sobre todo en compras y
liquidaciones — y también hay pantalla que promete cosas que no existen atrás.

---

## Parte 1 — Verificación de los seis supuestos

### 1. Costo y margen en la venta — EXISTE A MEDIAS

**Qué sí hay.** El margen que muestra la venta es real *cuando la línea ya tiene
lote asignado*: `listSalesOrders` (`src/lib/produce-server.ts:1681`) trae
`lots.unit_cost` del lote surtido, y la pantalla lo suma en
`src/routes/ventas.tsx:702-706` (total − costo = utilidad, margen y markup).
Reportes calcula igual (`src/routes/reportes.tsx:50`).

**Qué le falta (tres huecos):**
- **El costo es solo el precio de compra del lote.** Flete y gastos de la OC no
  entran al costo del lote al recibir; solo entran si Finanzas corre una
  liquidación (`applySettlement`, `produce-server.ts:1097`, reescribe
  `lots.unit_cost`). El margen diario que ve el vendedor **excluye flete y
  gastos** salvo que ya haya liquidación.
- **El vendedor ve el margen demasiado tarde.** Al capturar la venta no se
  muestra ningún costo; al surtir, el selector de lote muestra folio y cantidad
  pero no costo (`ventas.tsx:530-537`). El margen aparece hasta que la línea ya
  quedó surtida.
- **El "100% / 0%" es mentira cómoda.** Sin lote asignado el costo es 0 y la
  pantalla presume 100% de margen en vez de decir "costo aún desconocido".

### 2. Flete y transporte — EXISTE A MEDIAS (solo lado compra, como gasto)

**Qué sí hay.** El flete existe como **gasto ligado a la OC**: categoría
"Freight" en gastos (`migrations/0007_gastos.sql`, pantalla `gastos.tsx`),
mapeada a contabilidad (cuenta 51000, `migrations/0009_finance.sql:58`), y se
prorratea por pallet o por unidad en la liquidación (`alloc_by`,
`computeSettlementLots` en `produce-server.ts:969-1005`). La OC tiene campos de
texto `bol`, `shipping_ref`, `vendor_invoice` y `order_type`
(`migrations/0007_gastos.sql:3-6`).

**Qué no hay.** No existe transportista como catálogo ni como campo, no hay
número de carga/camión, no hay temperatura en ningún lado (la palabra solo
aparece como *defecto* de inspección, `src/lib/utils.ts:91`), y del lado
**venta** no hay nada de flete: ni costo de flete de salida ni datos del
transporte que se lleva la carga.

### 3. Modalidades de trato — EXISTE A MEDIAS (motor completo, captura ciega)

**Qué sí hay — más de lo esperado.** El motor de las tres modalidades vive en la
liquidación (`computeSettlementLots` + `loadSettlement`,
`produce-server.ts:969-1092`):
- **Firme**: lote con costo capturado → costo = precio de compra.
- **Consignación / PAS**: lote *sin* costo → la liquidación calcula el costo
  después, desde lo vendido menos gastos. La OC tiene `costing_mode` (default
  `'pas'`), y la pantalla de compra nueva ya marca "PAS" cuando dejas el costo
  vacío (`compras.tsx:475-477`).
- **Comisión / utilidad objetivo**: `target_profit_pct` en la OC — la
  liquidación retro-calcula el costo para dejarle a Plein exactamente ese %.

Además: `signed_off` en la OC, nivel de detalle compartible al proveedor
(`vendor_share_level`, `setVendorShare`) y **portal público del grower** con su
liquidación (`getVendorPortal` + `src/routes/portal.$id.tsx`, protegido por
token).

**Qué le falta.** La modalidad **no se elige** al capturar la OC — "emerge" de
si capturaste costo o no, y `costing_mode` se queda en su default. No hay
etiqueta visible de modalidad en listados de compras/lotes. Y la factura del
proveedor (`createBillFromPO`, `produce-server.ts:2120`) no distingue
modalidad: en consignación se puede generar bill antes de liquidar, lo cual no
corresponde al trato.

### 4. Ajustes post-llegada — A MEDIAS: fuerte al RECIBIR, débil cuando el CLIENTE reclama

**Lado compra (recepción) — sorprendentemente completo.** `receiveMerchandise`
(`produce-server.ts:1515`) captura inspección (tipo y folio), resultado por
línea — Aceptada / Aceptada con incidencia (cantidad afectada + defecto +
motivo) / Rechazada (motivo obligatorio) — y hasta emite la **advertencia PACA**
cuando hay rechazo con carga ya descargada. La calidad del lote
(sano/retenido/castigado/destruido, `setLotQuality`) bloquea el despacho de
fruta no sana (`shipSalesLine`, `produce-server.ts:2043`).

**Lado venta (cliente rechaza o pide rebaja) — casi nada.** Lo único que existe
es la **nota de crédito** (`createCreditInvoice`, `produce-server.ts:2817`,
botón en el detalle de la venta): líneas con descripción, cantidad y crédito por
unidad. No existe: convertir la venta a consignación, precio-después-de-venta
del lado cliente, protección de precio, ajuste de la factura original, ni
**retorno de mercancía del cliente al inventario** (la columna `rts_qty` de
lotes existe desde `migrations/0008` pero no encontré nada que la escriba, y el
texto "Return to shipper" en `compras.tsx:1030` es letra muerta). Hoy, si el
cliente rechaza 20 cajas: se emite crédito por el dinero y las cajas
desaparecen del mapa — no vuelven al lote ni quedan como merma documentada, y
el golpe no viaja a la liquidación del grower.

### 5. Trazabilidad — EXISTE A MEDIAS: el rastro de datos completo, los papeles no

**Datos: cadena completa.** OC → lote (`lots.purchase_order_id`) → despacho por
lote (`sales_order_lines.lot_id`) → venta → factura. `getLotTrace`
(`produce-server.ts:908`, pantalla en Inventario → lote) muestra movimientos,
ventas con cliente y factura, y mermas del lote. El reempaque (`createPackOut`,
pantalla en Productos) conserva la relación lotes-fuente → lote nuevo.

**Papeles: teatro.** Los links "Print pallet labels", "Print SO label", "Print
lot labels" (`ventas.tsx:848-849`, `compras.tsx:1024-1026`) son texto con
estilo de liga **sin ninguna acción conectada**. Y el "BOL" del picker de
impresión es el **mismo documento de la orden de venta con otro nombre**:
`getPrintDoc` colapsa `pick`/`bol`/`confirm` a la rama de OV
(`produce-server.ts:2448`) y siempre imprime "Sales Order" (`:2573`). No hay
BOL real: sin transportista, sin domicilio de entrega (el `ship_to` del paso
CPO todavía no se imprime en ningún documento — quedó anotado en el código),
sin temperatura, sin firmas.

### 6. Lo que no se veía — inventario de huérfanos

**Funciones de servidor sin pantalla (4):** `listExpenses`, `registerCobro`,
`registerPagoGasto` (las tres son rutas viejas que la Sesión 3 reemplazó por
`listPayables`/`registerCustomerPayment`/`registerVendorPayment` — candidatas a
borrarse, no a conectarse) y `revertLiveDemo` (utilidad interna de demo). **No
hay tesoro escondido tipo CPO esta vez** — casi todo lo exportado está
conectado.

**Pantalla que promete y no hace (la lista contraria):** las etiquetas y
"Return to shipper" ya mencionados; "Audit log" (`ventas.tsx:852`,
`compras.tsx:1029`) sin acción; en la ficha del cliente: "Credit limit",
selector "Delivery route", selector "Price sheet", "Fax", los checkboxes de
"Documents sent to this contact" y la zona "Drag and drop files here" — todo
decorativo; y el campo **markup** en las líneas de la OC nueva
(`compras.tsx:481`) se captura pero **nunca se manda al servidor** (no está en
el payload de `createPurchaseOrder`).

---

## Parte 2 — Plan de pasos

Criterio de orden (el que pediste): lo que más acerque a que Plein capture su
operación diaria completa —firme, consignación y comisión— **con margen real
visible**. Cada paso es una sesión en rama aparte, sin publicar hasta tu
"publícalo", sin tocar corte / bills del corte / CORTE-CHASE.

### Paso 2 — El margen se ve al vender, no después

**Qué se hace.** (a) Al capturar la venta y al surtir, mostrar el costo del
lote disponible y el margen estimado por línea y por orden — el selector de
lotes muestra costo, no solo cantidad. (b) Definir y mostrar el **costo
aterrizado**: costo del lote + prorrateo de los gastos de su OC (el mismo
prorrateo que ya usa la liquidación — el cálculo existe, solo no se enseña
aquí). (c) Matar el "100% / 0%": cuando el lote es PAS o no hay lote, decir
"costo por liquidar" en lugar de presumir margen perfecto. (d) De pasada:
borrar las 3 funciones muertas de servidor y el campo markup fantasma de la OC.

**Por qué primero.** Es la decisión de dinero diaria del trader: a qué precio
suelto la fruta. Todo el dato ya existe; es acomodarlo frente al vendedor a
tiempo. Riesgo bajo, valor inmediato, y deja la vara clara ("margen real")
contra la que se miden los pasos siguientes.

**Modelo.** Sonnet — es lectura de datos existentes y pantalla; sin lógica
financiera nueva.

**Preguntas para Miguel antes de empezar:**
1. El margen que quieres ver día a día, ¿incluye flete y gastos de la OC
   (costo aterrizado) o solo fruta? ¿O los dos números, uno junto al otro?
2. ¿Todos los que capturan ventas pueden ver costos y margen, o solo tú?
   (Ya hay módulos por persona; es decidir la regla.)
3. ¿Manejas margen mínimo o precio mínimo por producto que el sistema deba
   marcar en rojo?

### Paso 3 — La modalidad del trato se dice en voz alta

**Qué se hace.** Elegir **firme / consignación (PAS) / comisión** al capturar la
OC (hoy el modo "emerge" de dejar o no el costo vacío); guardarlo en el
`costing_mode` que ya existe; badge visible en compras, lotes y liquidación;
candados coherentes por modalidad: firme exige costo al capturar, consignación
bloquea la factura del proveedor hasta que la liquidación esté firmada
(`signed_off` ya existe), comisión pide el % objetivo desde el inicio (el campo
`target_profit_pct` ya existe). El portal del grower ya funciona — solo hereda
la claridad.

**Por qué segundo.** El motor de las tres modalidades ya está construido y
probado en la liquidación; lo que falta es la captura y los candados. Sin esto,
el margen de consignación/comisión del Paso 2 se queda en "por liquidar" sin
que nadie sepa por qué; con esto, cada lote sabe qué es desde que nace.

**Modelo.** Sonnet para captura y badges; si al revisar la interacción
bill/pagos/consignación aparece lógica financiera delicada, esa parte con Opus.

**Preguntas para Miguel:**
1. En consignación, ¿le pagas al grower solo después de liquidar, siempre?
   ¿Hay anticipos?
2. En comisión, ¿el % se pacta por OC o es fijo por proveedor? ¿Cuál es el
   típico?
3. ¿Quién debe poder firmar una liquidación (signed off) — solo tú?

### Paso 4 — Flete y transporte de verdad

**Qué se hace.** Transportista (catálogo simple), número de carga/camión y
temperatura pactada en la OC y en la OV; costo de flete de salida en la venta
(entrando al costo aterrizado del Paso 2); ligar el gasto "Freight" que ya
existe a estos datos; y el **BOL real** como documento: transportista, origen,
destino (el domicilio de entrega del CPO por fin impreso), pallets, temperatura
y espacio de firmas — reemplazando el BOL falso que hoy imprime la orden de
venta disfrazada.

**Por qué tercero.** Completa el costo real (el flete es de los gastos más
grandes del produce) y produce el papel sin el cual la carga no viaja. Depende
del Paso 2 (dónde pega el costo) y aprovecha el destino de entrega que ya dejó
el paso CPO.

**Modelo.** Sonnet.

**Preguntas para Miguel:**
1. ¿Quién contrata el flete normalmente — Plein o el cliente — y cambia según
   la modalidad?
2. ¿Qué exige tu cliente en el BOL sí o sí? (Mándame un BOL real de ejemplo,
   como hiciste con el PO de Northgate.)
3. ¿Temperatura por producto o por carga?

### Paso 5 — Cuando el cliente reclama (PACA del lado venta)

**Qué se hace.** Sobre la nota de crédito que ya existe: rechazo parcial del
cliente con destino de la fruta (vuelve al inventario, se destruye documentado,
o se revende a otro precio), rebaja por condición con motivo y evidencia,
ajuste tipo precio-después-de-venta / protección — y que el golpe viaje a donde
corresponde: al margen real del Paso 2 siempre, y a la liquidación del grower
cuando la fruta era consignada o a comisión (por eso este paso va después del
3). Conectar por fin `rts_qty` y "Return to shipper", que existen y nada usa.

**Por qué cuarto.** Es la realidad de todo trader de produce y el requisito
PACA más serio, pero necesita saber la modalidad (Paso 3) para saber a quién
pega el ajuste, y necesita el margen (Paso 2) para que el ajuste se refleje en
números honestos.

**Modelo.** **Opus** — toca dinero encadenado (factura, inventario, liquidación
del grower) y errores aquí son disputas PACA reales.

**Preguntas para Miguel:**
1. Cuando un cliente rechaza cajas hoy, ¿qué pasa físicamente con la fruta la
   mayoría de las veces?
2. ¿Qué evidencia pides/te piden (fotos, inspección federal) y dónde la
   guardas hoy?
3. Según la modalidad, ¿quién absorbe el golpe — Plein, el grower, o se
   negocia caso por caso?

### Paso 6 — Papeles y etiquetas (cerrar el teatro)

**Qué se hace.** Etiquetas reales de pallet y lote (lote, producto, origen,
fecha — la base de trazabilidad física estilo PTI), etiqueta de la OV; imprimir
el domicilio de entrega y las instrucciones de recibo en factura y BOL; y
limpiar o conectar cada texto muerto del inventario del punto 6 (Audit log,
Credit limit, Delivery route, etc.) — que la pantalla no prometa nada que el
sistema no haga.

**Por qué al final.** Es lo que más se ve pero lo que menos decide: para
entonces los papeles ya tendrán datos reales que imprimir (modalidad, flete,
destino, ajustes).

**Modelo.** Sonnet.

**Pregunta para Miguel:** una foto de las etiquetas de pallet/caja que tus
clientes ya aceptan, para copiar el formato y no inventar uno.

---

*Documento generado en sesión de solo lectura — nada de código cambió y no hay
commit. Miguel decide si este plan camina y en qué orden.*
