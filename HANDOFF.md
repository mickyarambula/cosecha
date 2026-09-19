# Handoff — Cosecha → Claude

**Fecha:** 19 Sep 2026 (actualizado con la sesión 4 y la demo con socios; la versión del 27 Ago tenía números de corte viejos — ver nota abajo).
**Dueño:** Miguel Arambula · Plein Produce LLC · Nogales, AZ
**Producto:** Cosecha (ERP). Membrete de documentos: Plein Produce LLC.

Este archivo es el estado de la conversación. El código está en GitHub. Juntos son la base.
Antes de tocar código, lee también **`AUDITORIA-2026-09-03.md`** (lista vigente de hallazgos y qué sigue abierto), **`MODELO-NEGOCIO.md`** (lo que la operación real de Plein hace y Cosecha todavía no cubre, sacado de los libros V8 — con preguntas abiertas que solo Miguel contesta) y, si existe, **`PLAN-PASO-2.md`** (histórico de un plan que ya no se sigue tal cual — lee su nota al principio antes de creer que es el plan vigente).

## GitHub (el desarrollo entero)

| Repo | Visibilidad | Usar para Claude |
|---|---|---|
| https://github.com/mickyarambula/cosecha | **Privado** | **Sí — este** |
| https://github.com/mickyarambula/erppleinproduce | Privado (mismo código, nombre viejo) | No hace falta |

Rama `main`. Cada bloque va en rama nueva desde `origin/main` y se mezcla a `main` con `--no-ff`. **Desde el 18 Sep 2026** el agente cierra cada bloque probado él mismo: commit → merge `--no-ff` a `main` → push. Eso despliega a producción en Vercel en automático, y así es como debe ser — Miguel lo pidió para que no se le pase. **La única parada que sigue es antes de una migración:** enseñar el SQL y esperar su OK.

**Hasta el 18 Sep 2026 la regla era la contraria** (el merge lo hacía Miguel desde GitHub y el agente se detenía en la rama subida). Si encuentras ese texto en algún documento, es viejo: corrígelo.

Clone:

```bash
git clone https://github.com/mickyarambula/cosecha.git
cd cosecha
npm install
npm run dev
```

Repo privado: Claude Code necesita GitHub login de `mickyarambula`.

## Qué está hecho y vivo

- Catálogo Plein (SKU = producto × empaque × calibre). Contrapartes duales (Papayas & More, Carrifoods, etc.), sin netear.
- CPO → OV → OC → recepción PACA → lote. Ship → factura. Bill desde OC.
- Liquidación al productor (consignación y comisión pura): motor completo con **candados y complementaria** (ver abajo) — ya no es solo el cálculo PAS original.
- Disposición del remanente al liquidar (PACA 7 CFR 46): pendiente de venta / destruida / comprada por Plein, certificado al 5%.
- Trato **firme**: el costo es el capturado en la OC y nada lo recalcula desde el modal de liquidación (hallazgo 7 cerrado en firme, sesión 3). El costo de las líneas de OC se escribe por línea, nunca por producto.
- **La captura no miente** (sesión 4): el origen del lote sale de la orden (antes `'México'` estaba escrito a fuego y lo imprimían las etiquetas); las fechas de recepción y empaque son las que capturas; el grado llega al lote; los pallets se guardan, así que "distribuir por pallet" por fin opera **y cada gasto se reparte con su propio criterio**; se acabó el precio de $35 y la cantidad de lote completo en Nueva venta; la orden de venta guarda tipo, fechas y ruta; el gasto guarda su fecha y no pierde su prorrateo al editarse; y el gasto capturado con la compra nace ligado a ella.
- **Gasto repartido entre cargas** (hallazgo 14, sesión 3): un flete que trae fruta de dos productores se reparte entre sus cargas y a cada uno se le descuenta **su parte**. Se puede repartir de menos (el resto lo absorbe Plein, a la vista) y nunca de más. Lo ya rendido a una carga queda congelado; la otra sigue editable.
- **Notas de crédito atribuidas al productor con causa** (C-1b, sesión 3): cada nota de crédito al cliente se puede atribuir a la carga que surtió esa venta, con causa obligatoria (del productor / de Plein) y motivo. Si es del productor, le baja el neto **y la base de su comisión**; si la carga ya está liquidada, entra por complementaria. Cierra la última puerta del Área de mejora #1.
- **P&L en comisión pura** (sesión 3): la venta bruta entra al ingreso y la parte del productor sale como costo en la cuenta **50100 "Remitido al productor"**, así la utilidad ya no se infla con dinero ajeno. Renglón informativo con el ingreso propio de Plein (su comisión). Consignación no se toca — ahí el costo ya vive en el lote.
- **Documentos completos** (sesión 3): el BOL ampara lo que va en ESE camión (mercancía marcada por embarque, con lote y calibre) y congela su fecha de emisión; factura y OC impresas llevan empaque/calibre y el SKU del pack; el "Enviar a" de la factura es el destino de la orden.
- **Pagos que cuadran** (sesión 3): el cobro de cliente es exactamente lo aplicado, topado al saldo de cada factura, solo facturas vivas del cliente, con fecha, método y referencia. La fruta se paga en CxP contra la FAC- (topada al saldo); desde Gastos solo se pagan gastos con las mismas reglas. La OC ya no aparece como cuenta por pagar.
- Reempaque ligado a la carga que lo originó — ya no desaparece de la liquidación del productor.
- Ubicaciones (bodegas/cámaras propias y de terceros): catálogo con alta, edición, desactivar/reactivar y temperatura — pantalla en Almacén → Ubicaciones.
- CxC / CxP / gastos / tesorería / conciliación Chase / P&L / Balance / trial.
- Corte apertura **19 Ago 2026** desde libros V8 Drive (Ingresos/Egresos/Chase), **no Cargas** — ver números correctos abajo.
- PDF descargable (jspdf) + Outlook + WhatsApp. La app **no** envía el correo.
- Auth Google + correo. Staff y módulos. Ajustes → Pruebas para borrar tests (no borra el catálogo: productos, clientes, proveedores, **ubicaciones**).
- App **publicada** (Vercel) para que Miguel y socios prueben. Lo live se borra con Pruebas; el corte no.

## Corte (números sagrados)

**Corrección:** la versión anterior de este archivo (y de `COSECHA.md`) documentaba el corte v1 (30 jun 2026), que fue reemplazado por completo por el corte v2 (19 ago 2026) desde el mismo commit `9ad090c` (22 Ago 2026) que los introdujo — nadie actualizó estos dos documentos cuando pasó. `AUDITORIA.md` (27 Ago 2026) ya había marcado esto como pendiente; quedó pendiente hasta hoy. Los números correctos y vigentes, verificados contra `migrations/0016_opening_ingresos.sql`:

- AR opening `$673,014.43` — 50 facturas `invoice_type=opening` (fuera del P&L). **No cambió entre v1 y v2.**
- AP opening `$570,097.56` — 62 bills **sin PO**. (v1 decía $564,670.16 con 52 bills — viejo, no usar.)

**Las anclas son SALDO, no facturado.** Esto no estaba escrito en ningún lado y ya confundió a Miguel: el corte no dice "vendimos 673 mil", dice "nos deben 673 mil". El desglose, verificado sumando `migrations/0016_opening_ingresos.sql` renglón por renglón:

| | Facturado | Ya cobrado/pagado dentro del corte | **Saldo = el ancla** |
|---|---:|---:|---:|
| **CxC** (50 facturas de apertura) | $797,038.13 | $124,023.70 | **$673,014.43** |
| **CxP** (62 bills sin OC) | $635,041.48 | $64,943.92 | **$570,097.56** |
| **Chase** | — | — | **$9,361.05** |

El cobro y el pago que ya venían hechos viven dentro de la misma factura o bill (columna `paid`), no como movimientos de caja: por eso Chase arranca en 9,361.05 y no en una cifra inflada. Si alguna pantalla enseña $797,038.13 como "ventas", está sumando el bruto del corte — y el corte **no entra al P&L**.
- Chase `$9,361.05` folio `CORTE-CHASE`, fecha 2026-08-19. (v1 decía $19,066.20 al 2026-06-30 — viejo, no usar.)
- JEAMS `$52,447.33` GL `20250`. (v1 decía $23,030.33 — viejo.)
- Equity plug `$59,830.59` GL `30000`. (v1 decía $104,380.14 — viejo.)
- Chase operativo desde **19 Ago 2026**. Folio **430** no se aplica solo.
- Programada (PX-72775 / PX-72868) **fuera**.
- Papayas & More: cliente y proveedor, **no netear**.

Estas son las anclas que se verifican al final de cada bloque de trabajo (antes/después, y otra vez tras correr `BORRAR`). A la fecha de este documento, producción tiene 0 órdenes de compra, 0 de venta, 0 lotes, 0 liquidaciones — las anclas son el 100% del dinero en el sistema.

GL: `16000` JP Morgan Chase, `12000` AR, `20100` AP, `20250` JEAMS, `30000` equity.

## Demo con socios (19 Sep 2026) — y qué saber al capturar en equipo

Se corrió el manual de diez escenarios con **tres o cuatro personas capturando al mismo tiempo**, y al final alguien corrió `BORRAR` desde Ajustes → Pruebas. Resultado: la base quedó limpia y **las tres anclas intactas**. El ERP aguanta la operación en equipo.

Tres cosas que no son bugs pero que muerden en cuanto empiecen a capturar en serio. Conviene decirlas antes, no después:

1. **Los folios son un solo contador compartido.** Dos personas capturando al mismo tiempo se llevan números salteados — una se queda con la OC-014 y la otra con la OC-016. No se pierde nada ni se duplica; simplemente los folios no salen corridos. (La raíz está en `AUDITORIA-2026-09-03.md`, Área de mejora #10: el folio se calcula leyendo "el último por id". Secuencias de Postgres lo cierran.)
2. **La pantalla no se refresca sola.** Lo que crea otra persona no aparece hasta recargar. Si alguien dice "ya la capturé" y no se ve, es esto: recarga antes de volver a capturarla.
3. **El `BORRAR` es global.** Uno lo corre y se lleva la actividad de todos — incluido lo que alguien tenga a medias en ese momento. Protege el corte y el catálogo, pero no protege el trabajo en curso de los demás. Acordar quién lo corre y avisar antes.

### Aviso para cuando Miguel pruebe: los cuatro números de "cuánto debo"

El tablero, el Balance, CxC/CxP y Gastos **dan cuatro cifras distintas de lo mismo**, y las cuatro están "bien" cada una por su lado: el tablero netea las notas de crédito, el Balance las excluye, la lista de CxC las deja en cero, y Gastos suma lo suyo aparte. Es el **Área de mejora #2**, no un error de captura. Si al probar ves cuatro números que no cuadran entre sí, es esto — no lo reportes como bug de tu prueba.

## Estado de producción (verificado contra Neon el 19 Sep 2026)

- **0** órdenes de compra · **0** recepciones · **0** ventas · **0** facturas vivas · **0** movimientos de caja después del corte.
- **4 ubicaciones activas** más `PREUBA-001` "PRUEBA BODEGA X", **desactivada** (quedó de la prueba de `ubicaciones-admin`).
- Última migración aplicada: **`0047_devolucion_del_cliente.sql`**, con `customer_returns` y `customer_return_lines` ya creadas.
- **Anclas intactas.**

Es decir: las tres anclas siguen siendo el 100 % del dinero del sistema. Todo lo construido en las sesiones 3 y 4 está publicado y **sin estrenar con datos reales**.

## Decisiones de producto (no “mejorarlas”)

1. Libros = V8 Drive, no Cargas.
2. Enviar documentos = como el ERP viejo: usuario descarga PDF y lo pega en Outlook/WhatsApp.
3. Cri International: el correo del catálogo puede ir vacío; se escribe a mano. El teléfono sí está.
4. P&L en ceros es correcto hasta que haya ventas live (opening no es revenue).
5. Nav Reportes: tabs Financial usan `search.tab=pl` para no saltar al chrome de Sales.
6. Wordmark del login: PNG transparente, sin caja blanca.
7. Miguel habla producto, no ingeniería. No le muestres puertos ni diffs enormes.
8. **No inventar datos de negocio como si fueran reales** (direcciones, ubicaciones/bodegas, proveedores, destinos de cliente). Si falta un dato real, dilo y déjalo en blanco o con un valor obviamente de ejemplo — Miguel lo captura cuando lo tenga. Ver "Pendientes de captura" abajo: el membrete, las 4 ubicaciones sembradas y el destino de Alpine Fresh son ejemplos de esto que ya pasó y sigue sin corregirse.
9. Liquidación al productor emitida = documento congelado. Correcciones después de emitir van por **liquidación complementaria** (folio `LIQ-004-C1`, `-C2`…), nunca reescribiendo el documento ya emitido. Ver `AUDITORIA-2026-09-03.md` hallazgo 8 y esta sesión (bloques C-1/C-2 abajo).

## Sesión 2 (5–9 Sep 2026) — qué se construyó

Después de `AUDITORIA-2026-09-03.md`, el trabajo se enfocó en su "Área de mejora #1" (liquidación al productor cerrada de punta a punta), no en el plan de `PLAN-PASO-2.md` (ese plan quedó sin ejecutar — ver la nota al inicio de ese archivo). En orden, todo en `main`, cada uno probado por Miguel en producción antes del siguiente:

| PR | Rama | Qué hace |
|---|---|---|
| #14 | `reempaque-liquidacion` | Hallazgo 5: el lote hijo de un reempaque hereda la carga de origen; la merma del reempaque se le liquida al productor con `charged_to` (Plein/productor); ya no se mezclan cargas al reempacar. |
| #15 | `arreglos-reempaque` | Arreglos de la prueba: símbolo `≈` en el PDF, buscador de SKU por `sku_code`, lote de origen visible en el renglón de merma. |
| #16 | `disposicion-remanente` | PACA 7 CFR 46: al liquidar, cada caja sin vender va a pendiente de venta / destruida / comprada por Plein; certificado de destrucción obligatorio al llegar al 5% del embarque; compra de Plein sin comisión. De paso, bug del alias `waste_qty`/`rts_qty` (salían siempre en 0). |
| #17 | `detalles-bloque-b` | Confirmación de doble clic en "Todo a pendiente"; motivos de merma en español; singular/plural de "caja"; **money_concepts + gl_mappings**: "Fletes" y "Seguros" (categorías en español sembradas desde el principio) nunca caían en su cuenta contable — el P&L las mandaba a "General". |
| #18 | `congelamiento-liquidacion` | **Bloque C-1a**: liquidación complementaria (`LIQ-004-C1`, `-C2`…) colgada de la liquidación padre — rinde solo lo ocurrido después de emitir. Adelanto (`ADE-`) sin salida de caja cuando la cuenta sale negativa. Cuatro cruces que bloquean con salida (gastos, ventas, comisión, cajas). 5% acumulado sobre el embarque original. |
| #19 | `candados-liquidacion` | **Bloques C-2a + C-2c**: `purchase_orders.liquidated_at` congela la carga al emitir. Candados con salida siempre nombrada (recepción adicional → OC nueva; gasto rendido → ajuste a favor del productor; comisión fija; etc.). La factura de consignación nace del documento congelado, no del cálculo vivo. Portal del productor y Reportes → Liquidaciones leen el congelado. |
| #20 | `reversa-venta-rendida` | **Bloque C-2b**: cancelar una venta ya rendida ya no borra el rastro — las `sale_line_allocations` se marcan canceladas (no se borran) y la complementaria rinde la reversa con la comisión devuelta. El cruce de ventas rendidas es la única lectura que cuenta las canceladas (a propósito). |
| #21 | `ubicaciones-admin` | Editar/desactivar-reactivar ubicaciones (antes solo se podían crear); temperatura en el alta; pantalla movida de Órdenes → "Delivery Routes" a Almacén → "Ubicaciones"; permiso movido de `orders` a `warehouse`. |

Migraciones de esta sesión: `0035` a `0039` (`reempaque_carga`, `disposicion_remanente`, `liquidacion_complementaria`, `candados_liquidacion`, `reversa_venta_rendida`). `ubicaciones-admin` **no** agregó migración — las columnas ya existían.

## Sesión 3 (18 Sep 2026) — qué se construyó

| PR | Rama | Qué hace |
|---|---|---|
| #23 | `hallazgo-7-firme` | **Hallazgo 7 en firme**: `applySettlement` ("Aplicar % objetivo", "Borrar meta", "Actualizar costos de lote") se niega en trato firme — el costo es el que se capturó en la OC. El modal de liquidación en firme ya no muestra la cajita "Utilidad objetivo %" ni el botón "Actualizar costos de lote" (solo lectura). Un % objetivo guardado ya no sustituye el costo real ni en pantalla ni en Reportes → Liquidaciones. Donde sí se escribe costo de líneas de OC (consignación, al emitir y en "Actualizar costos" antes de emitir) se hace **por línea** vía `lots.purchase_order_line_id` (promedio ponderado de sus lotes), ya no por producto — dos calibres del mismo producto conservan su costo. |

Sin migración. Verificado en Chrome contra base local (10/10): firme con dos calibres de Papaya ($10 y $12) — las tres acciones se niegan y los costos de lote y línea quedan intactos; consignación con dos calibres vendidos a $20 y $30 con comisión 10 % — al emitir, la línea del 6 ct queda en $18 y la del 8 ct en $27 (antes las dos quedaban en $27). Anclas iguales antes/después.

| directo a `main` | `pagos-que-cuadran` | **Hallazgos 3 y 4 — pagos que cuadran.** Cobro de cliente (`registerCustomerPayment`): el monto debe ser igual a lo aplicado (±$0.05), cada aplicación se topa al saldo de su factura, la factura debe ser del cliente, viva y no nota de crédito, sin repetir factura; todo se valida antes de escribir. Fecha de depósito, método y referencia capturables en CxC → Registrar pago; desapareció el aviso falso de "etiqueta de sobrepago". Pago a proveedor: `listPayables` ya no lista las OCs como cuentas por pagar y `registerVendorPayment` solo acepta gastos (la fruta se paga en CxP contra la FAC-, `registerPago`, que ya se topaba al saldo) con tope al saldo, proveedor correcto y sin repetir; `registerPago` y `registerPagoProductor` aceptan fecha, método y referencia. Gastos → Pagos muestra el método real (antes "ACH" fijo) y la referencia; Tesorería también. |

| directo a `main` | `devolucion-del-cliente` | **Área de mejora #3 — devoluciones y rechazos del cliente.** Hasta hoy un reclamo solo podía terminar en nota de crédito: el dinero bajaba y la fruta no existía en ningún lado. Ahora una sola captura (`createCustomerReturn`) mueve las dos cosas, así no pueden contarse cosas distintas. La fruta va a uno de tres destinos: **regresa** (nace un lote NUEVO marcado devuelto, con el costo y la carga del original, **retenido** hasta que Miguel lo revise — esa fruta ya viajó), **se destruye** (motivo obligatorio y folio de certificado, que es lo que PACA pide documentar) o **no regresó** (el camión se rechazó en destino: se captura qué pasó con ella allá y lo que se recuperó). La culpa se captura por renglón y viaja por el camino ya probado de C-1b: solo la del productor le baja el neto y la base de su comisión; lo que fue de Plein no le cuesta un peso; y en trato firme nunca se le atribuye porque esa fruta ya es de Plein. `lots.rts_qty` —la columna que existía desde `migrations/0008` y **nadie escribía**— por fin se llena, y la liquidación se la enseña al productor. `sale_line_allocations.returned_qty` saca del costo de venta **solo** lo que de verdad volvió a la cámara; lo destruido y lo que no regresó se queda costeado como vendido a propósito (se fue y no volvió). Cancelar la devolución deshace fruta y crédito juntos, y se niega si el lote devuelto ya se revendió, se reempacó o se movió, o si el crédito ya se le rindió al productor. La nota nacida de una devolución no se cancela sola y la venta no se cancela por debajo. |
| directo a `main` | `carga-cierra-bien` | **Hallazgos 12 y 23 — la carga cierra bien.** *Rechazo:* migración `0046` agrega `purchase_order_lines.quantity_rejected`. Lo rechazado ya no se espera — el pendiente es `ordered − received − rejected`, la carga pasa a `received`, sale de "por llegar" en Almacén y deja de alertar en el tablero. **No** se suma a `quantity_received` a propósito: en firme la factura al proveedor es recibido × costo y sumarlo le pagaría al productor la fruta que Plein rechazó. Decisión de Miguel: un reenvío del productor es **una carga nueva**, no una reapertura. La tarjeta de la OC muestra las cajas rechazadas y lo que de verdad se paga. *Costo:* corregir el `unit_cost` de una carga ya recibida en firme ahora baja a los lotes de **su** línea (`purchase_order_line_id`, nunca por producto) y recalcula en cascada los lotes hijos de reempaque (`recomputeRepackCosts`, en orden de creación, para que un reempaque de un reempaque tome el costo ya corregido). Aplica hacia atrás, **también a las cajas ya vendidas** — el COGS y el margen se leen vivos. Con factura de proveedor viva ya no hay no-op silencioso: bloquea nombrando la salida ("cancela FAC-003 en Finanzas → CxP, corrige el costo y vuelve a generarla"). No aplica con liquidación emitida ni en consignación/comisión. |
| directo a `main` | `captura-honesta` | **Sesión 4 — hallazgos 11, 13, 15, 17, 18, 19 y 20.** `insertLot` deja de fijar las fechas en "hoy" y de escribir `'México'` como origen: recibe lo capturado y, sin dato, guarda null (en blanco es honesto). La recepción pide fecha de empaque, grado por línea, folio de inspección y si la carga se descargó. `lots.pallets` se escribe a prorrata de lo recibido; `expensesByLot` reparte **cada gasto con su propio criterio** y usa pallets solo si TODOS los lotes los tienen — con uno en blanco, ese lote pesaría cero. Corregir origen o pallets de una carga recibida llega a sus lotes (salvo con liquidación emitida). Nueva venta: sin precio ni cantidad inventados, con guarda que impide colocar una orden incompleta. `sales_orders` guarda tipo, fecha solicitada, fecha de recolección y ruta (migración `0045`). El gasto respeta su fecha, no pierde su prorrateo al editarse, y el capturado desde "Nueva OC" espera y nace ligado a la carga. |
| directo a `main` | `gasto-repartido` | **Hallazgo 14 — el gasto de varias cargas.** Toda lectura de dinero (liquidación, complementaria, su cruce, costo del lote y la vista de Compras) pasó de `expenses.purchase_order_id` con el monto COMPLETO a `expense_po_links.amount_applied`: el monto aplicado a ESA carga. Nuevo `setExpenseSplit` es el único camino que escribe montos por carga; la pantalla del gasto trae "Reparto entre cargas" con las cajas recibidas de cada una, "Proponer por cajas recibidas" y el aviso de lo que absorbe Plein. Candado nuevo `renderedExpenseLink` **por pareja gasto×carga**: lo rendido a una carga se congela y la otra sigue viva — que es lo que pide un flete de dos productores. `resyncExpensePrimaryPo` deja `expenses.purchase_order_id` como "carga principal", así que "Desconectar" dejó de mentir. Migración `0044`: repara el dato viejo (cada liga nacía con el monto completo) dejando exactamente lo que el sistema cobraba hasta hoy. |
| directo a `main` | `credito-al-productor` | **C-1b — notas de crédito atribuidas al productor con causa.** Migración `0043`: `grower_credit_attributions` (viva) + `grower_settlement_credits` y `grower_settlement_supplement_credits` (congeladas) + `credit_total` en los dos encabezados. La atribución se captura en el mismo modal de la nota de crédito ("¿Quién absorbe este crédito?", con las cargas que surtieron la venta, lo que aportó cada una, reparto propuesto, causa **sin preseleccionar** y motivo obligatorio). El crédito del productor baja su neto y la base de su comisión (decisión de Miguel: la comisión se gana sobre lo que de verdad entró; en `per_unit` no aplica — esa comisión es por caja manejada). Renglón propio en el account of sales y en la complementaria, con factura, cliente, tipo y motivo. Candados: firme no se atribuye; tope acumulado por carga sobre toda la venta; una carga cuyos despachos se cancelaron no se atribuye (esa venta se rinde como reversa); no se cancela una nota ni una atribución ya rendida. De paso, `getFinancials`: la nota de crédito ya bajaba el ingreso pero **no** la utilidad — al bajar también lo remitido, Plein se llevaba el crédito dos veces. |
| directo a `main` | `pl-comision-pura` | **Hallazgo 6 — el P&L ya no se queda con el dinero del productor.** Opción B de Miguel: cuenta nueva `50100 Remitido al productor` (kind cogs) alimentada con el `net_to_grower` de las liquidaciones **emitidas** a comisión pura y sus complementarias (que pueden ser negativas por una venta cancelada). `getFinancials` devuelve `remit`, `commission_income` y `cogs_total`; la utilidad bruta y la neta ya restan la remisión. El P&G en pantalla muestra el renglón y, bajo la utilidad bruta, "De lo anterior, ingreso propio de Plein… (su comisión)". Se ata con el Balance: el costo reconocido es el mismo evento que crea el pasivo `21000`. |
| directo a `main` | `documentos-completos` | **Hallazgos 9 y 10 — documentos completos.** BOL: `sale_line_allocations.shipment_id` liga cada despacho a su camión; `listShipmentCargo`/`setShipmentCargo` arman la carga desde el panel de Embarques (botón "Mercancía", pre-marcado lo libre); `issueBol` se niega sin mercancía marcada y congela `bol_issued_at`; `getBolDoc` imprime lo embarcado con lote, empaque y calibre; el PDF ya no fecha con `todayISO()`. Factura: `invoice_lines.pack_style_id` + descripción "Papaya · Caja 6 ct", SKU del pack, y "Enviar a" desde el destino de la OV (sin destino capturado no se imprime el bloque — antes repetía la dirección de facturación). La nota de crédito hereda el pack. OC impresa: calibre y SKU del pack. |

Migración de devoluciones: `0047_devolucion_del_cliente` — dos tablas nuevas (`customer_returns`, `customer_return_lines`) y dos columnas con default (`sale_line_allocations.returned_qty`, `lots.returned_from_lot_id`). Aditiva; no toca el corte ni nada emitido. Verificado en Chrome contra base local limpia (47/47, incluidas cuatro pruebas de pantalla) y regresión completa de las nueve suites anteriores en verde con las anclas intactas, más **revisión adversarial sobre el diff antes de publicar**: 10 defectos reales, todos corregidos. Los números que fija la prueba: carga a consignación de 100 cajas vendidas a $20 con comisión 10 % → neto del productor **$1,800**; el cliente devuelve 20 cajas por fruta blanda (culpa del productor) → nota de crédito **$400**, el lote origen guarda `rts_qty` 20, nace el lote devuelto retenido con sus 20 cajas, y el neto del productor baja a **$1,440** — no a $1,400, porque la comisión también se calcula sobre lo que de verdad entró. La misma devolución con culpa de Plein no le baja un peso al productor. Destruir sin motivo se niega; el certificado queda guardado; "no regresó" exige decir qué pasó con la fruta. Dos devoluciones parciales suman contra el mismo tope (30 + 30 sobre 50 se niega). En firme la carga se marca no atribuible y Plein absorbe el crédito aunque se marque "del productor".

Lo que destapó la revisión adversarial y se corrigió antes de publicar, todo con prueba propia. **El grande:** en consignación, al emitir la liquidación el reparto del neto por ingreso le dejaba costo **cero** al lote devuelto (no ha vendido nada), mientras el costo de venta ya le había restado esas cajas al lote origen — con una carga de 100 cajas a $10 y 50 devueltas, **$450 de costo desaparecían del P&L y del Balance al mismo tiempo**. Ahora el lote devuelto **hereda el costo por caja de su lote origen** (`inheritReturnedLotCosts`) y la prueba fija el cuadre: costo de venta + inventario = exactamente lo que se le debe al productor. **El segundo:** colgar el lote devuelto de la carga lo contaba como fruta que el productor entregó — 100 cajas más 50 devueltas daban un embarque de 150, y con eso **6 cajas destruidas pasaban de 6 % a 4 % y se evadía el certificado que PACA exige al 5 %**; también diluía el costo por caja de la línea de OC y pedía "clasificar" 50 cajas fantasma al liquidar. El lote devuelto sigue colgando de la carga (para que una reventa le vuelva a producir al productor) pero ya no cuenta como recibido. **Los demás:** `cancelCustomerReturn` borraba el lote devuelto sin revisar tres tablas más que lo referencian (despachos —vivos o cancelados—, disposición del remanente y liquidaciones ya emitidas), así que reventaba con un error crudo **a media cancelación**, con los contadores ya restados y el crédito todavía vivo; `cancelPurchaseOrder` vaciaba el lote devuelto por debajo, dejando la devolución y su nota apuntando a fruta que ya no existía; la línea de la devolución se escribía al final, que es justo el candado contra reintento, así que una caída a media escritura dejaba pasar un segundo intento que **restaba el costo dos veces en silencio**; la nota de crédito se ligaba a la devolución al final, dejando una ventana donde una nota suelta bajaba el saldo del cliente sin que nadie la conociera; el monto recuperado en destino y el motivo de destrucción se capturaban y **no se mostraban en ningún lado**; un vendedor (sin módulo de Finanzas) veía los botones, llenaba el modal completo y tronaba al guardar; y el conteo previo de "BORRAR" no listaba las devoluciones que sí borraba.

**Límite conocido y documentado:** el monto recuperado en destino (`salvage_amount`) queda en el documento de la devolución **para el expediente del reclamo** — no entra a caja, ni al P&L, ni a la liquidación. La pantalla lo dice explícitamente. Si ese dinero lo cobró Plein, se captura aparte.

Migración del cierre de carga: `0046_rechazo_cierra_la_linea` — una columna `not null default 0` en `purchase_order_lines` (aditiva, no toca filas existentes). Verificado en Chrome contra base local limpia (27/27) y regresión completa de las ocho suites anteriores en verde con las anclas intactas, más **revisión adversarial sobre el diff antes de publicar**: 8 defectos reales, todos corregidos. Lo que fija la prueba: 400 cajas pedidas, 100 aceptadas y 300 rechazadas → la carga CIERRA y la FAC- sale por **$1,000, no $4,000**; una segunda recepción ya no puede meter cajas que la línea dio por cerradas; un rechazo parcial deja abierto solo lo que de verdad falta; editar una carga 100 % rechazada ya no truena (era un crash latente por llave foránea); corregir $10 → $12 baja al lote; con dos líneas del **mismo** producto en distinto calibre la corrección toca solo la suya; un lote reempacado se recalcula en cascada (10 → 20); y con factura viva el costo se bloquea con el mensaje que dice qué cancelar, dejando el lote intacto.

Lo que destapó la revisión adversarial y se corrigió antes de publicar: **la pantalla de recepción mandaba siempre la línea completa en un rechazo** (Miguel escribía 40 y se guardaban 100 — cerraba la carga y le quitaba al productor 60 cajas que sí iba a mandar; era justo el rastro que PACA pide documentar); el **total de la orden** seguía cobrando las cajas rechazadas ($1,000 en pantalla contra una factura que nace en $600); la factura al proveedor quedaba marcada **"faltante" para siempre** en CxP porque `ordered_qty` no restaba lo rechazado; el aviso "Se paga $X" salía con la línea todavía abierta, cuando ese número no es el final; se podía **bajar lo pedido por debajo de lo ya resuelto** (100 pedidas con 100 rechazadas encima); **editar una orden cancelada reventaba** con el error crudo de Postgres y con el encabezado ya escrito (`updatePurchaseOrder` era el único mutador de OC sin guarda de cancelada — cancelar pone los contadores en cero y la orden volvía a verse como borrador); un rechazo con la cantidad vacía llegaba al validador y sacaba su mensaje en inglés; y una recepción de varias líneas donde la segunda no cabía dejaba la primera grabada a medias (ahora se valida todo antes de escribir nada). Se revisaron y quedaron limpios: el promedio ponderado y el orden de la cascada de reempaques, que la corrección retroactiva no desincroniza nada congelado (COGS, valor de inventario y margen leen `lots.unit_cost` vivo; lo único congelado es la factura al proveedor, que es justo lo que el candado protege), y que la migración `0046` es metadata-only en Postgres 16 y corre en el build antes de que el código nuevo sirva tráfico.

Migración de la sesión 4: `0045_captura_que_se_guarda` — tres columnas opcionales en `sales_orders`. Verificado en Chrome contra base local limpia (25/25) más revisión adversarial: 14 hallazgos, 4 altos, todos corregidos o descartados con razón. Lo que destapó y se arregló: precargar `"MX"` en el formulario de la OC dejaba el arreglo del origen en puro adorno (toda la fruta seguiría naciendo mexicana); un lote sin pallets junto a uno con pallets se llevaba **$0** del gasto; el `alloc_by` del primer gasto decidía por todos (inocuo mientras los pallets no existían, no después); el borrador del gasto nacía con "Servicios de inspección $100" inventados que ahora sí llegan a la liquidación; si fallaba un gasto después de crear la OC, la pantalla decía "no se pudo colocar" con la orden ya creada y el segundo clic la duplicaba; Inventario inventaba "MX" en pantalla; la fecha del gasto seguía muerta en el modal de Compras; y una venta con cantidad o precio en blanco reventaba con el error crudo del validador.

Migración del hallazgo 14: `0044_reparto_gasto_heredado` — solo repara dato, no cambia esquema. Verificado en Chrome contra base local limpia (27/27) más **revisión adversarial de 70 agentes**: 22 hallazgos crudos, 15 confirmados (6 defectos distintos vistos por varias lentes), 7 refutados. Se corrigieron: el dato viejo que habría hecho que la segunda carga cobrara el flete entero (migración `0044`); **cualquier edición del gasto le devolvía el monto completo a la carga principal** y recreaba el doble cobro; "conectar" una carga ya ligada le subía el monto en silencio, incluso sobre una parte ya rendida; el ajuste a favor del productor estaba cerrado para la carga secundaria del gasto (validaba contra la columna, no contra las ligas); "Proponer por cajas" pisaba los renglones ya rendidos y el guardado siempre fallaba; y conectar una carga nueva no recargaba el detalle, así que el siguiente "Guardar reparto" la borraba.

Migración de C-1b: `0043_credito_al_productor` (tablas y columnas nuevas, aditivas). Verificado en Chrome contra base local limpia (37/37) y con **revisión adversarial de 53 agentes** sobre el diff antes de publicar: 16 hallazgos crudos, 11 confirmados tras verificación, 5 refutados. Se corrigieron: el tope por carga no acumulaba entre notas (dos notas podían cargarle al productor el doble de lo que su fruta produjo); `wipeLiveTests` tronaba por llave foránea con un crédito rendido; `applySettlement` ("Actualizar costos de lote") calculaba el costo del lote ignorando el crédito; una atribución rechazada dejaba viva la nota de crédito y el reintento creaba una segunda; el reparto propuesto podía exceder el tope de una carga; y el portal del productor exponía nombre de cliente y motivo interno en el payload. **También destapó un bug ya publicado del bloque anterior**: `wipeLiveTests` tronaba por llave foránea si un embarque tenía mercancía asignada (migración `0041`) — corregido aquí.

**Límite conocido y documentado (no corregido):** en **consignación**, si el crédito llega DESPUÉS de emitir la liquidación, el costo del lote ya quedó escrito desde el neto congelado y no se reescribe (regla del ERP). La complementaria sí le baja el neto al productor y nace un `ADE-`, pero ese ajuste no toca el P&L, así que el COGS queda alto por el monto del crédito. Es el mismo hueco que ya existía para reversas de ventas canceladas y ajustes; cerrarlo pide una línea de "ajustes de costo de cargas liquidadas" en el P&L — bloque aparte. Mitigación práctica: atribuir el crédito **antes** de emitir cuando se pueda.

Migración del P&L en comisión: `0042_pl_comision_pura` — sólo inserta la cuenta `50100` (aditiva, `on conflict do nothing`). Verificado en Chrome contra base local limpia (15/15): carga a comisión de $10,000 con comisión 10 % y flete de $500 al productor → remitido $8,500, cuenta 50100 $8,500, pasivo 21000 $8,500, ingreso propio $1,000 y la utilidad neta sube **$1,000, no $9,500** (reproducido antes del arreglo). Una carga a consignación liquidada **no** suma a 50100 — su costo sigue en 50000 vía `lots.unit_cost`, sin doble conteo. Límite conocido y a propósito: el costo se reconoce **al emitir** la liquidación, así que entre la venta y la liquidación el P&L sigue sin la parte del productor — es la misma ventana en la que el Balance tampoco tiene el pasivo 21000, así que los dos estados siguen contándose la misma historia.

Migración de documentos: `0041_documentos_completos` — `invoice_lines.pack_style_id`, `sale_line_allocations.shipment_id` (+ índice) y `shipments.bol_issued_at`, todas nullable. Verificado en Chrome contra base local (21/21): una OV de 8 cajas surtida en dos despachos (5 y 3) y dos camiones — el BOL del camión 1 imprime 5 cajas con su lote, no las 8 de la orden; sin mercancía marcada no se emite; robar cajas del otro camión se niega; con el BOL emitido la carga queda congelada (la salida es otro embarque con su propio BOL); reimprimir devuelve el mismo folio y la misma fecha. Factura y OC con calibre, SKU del pack y destino real. Límite conocido: un embarque cuyo BOL se hubiera emitido ANTES de este bloque no tiene mercancía ligada y su BOL saldría vacío — en producción no aplica (cero órdenes de venta).

Migración de la parte de pagos: `0040_pagos_metodo_referencia` — dos columnas nullable en `cash_movements` (`method`, `reference`); no toca filas. Verificado en Chrome contra base local (29/29): cobro de 100 con cheque y referencia; cuatro cobros negados (monto ≠ aplicado, más que el saldo, factura de otro cliente, factura repetida) que no tocaron nada; dos parciales de 30 cierran una factura de 60; cancelar el cobro regresa el saldo; la OC ya no aparece en Gastos ni se puede pagar desde ahí; gasto de 200 negado a 250 / a otro proveedor / con monto distinto, pagado con Wire y referencia; FAC- de 300 pagada en CxP con fecha, método y referencia; Chase cuadra en cada paso. Anclas iguales antes/después con la migración aplicada. Decisión de producto: un cobro que no cuadra con lo aplicado **se niega** (no nace crédito de cliente por sobrepago — eso es el Área de mejora #2, no construida).

### Qué sigue pendiente (al 19 Sep 2026, cierre de la sesión 4)

**Los seis bloques de la sesión 3 y los dos de la sesión 4 están construidos, probados y en `main`**
(hallazgo 7 en firme, pagos que cuadran, documentos completos, P&L en comisión pura, C-1b, hallazgo 14,
captura honesta y la carga que cierra bien). Con eso **no queda ningún hallazgo CRÍTICO abierto** en
`AUDITORIA-2026-09-03.md`. Lo que sigue, por valor:

- **Área de mejora #1 — CERRADA COMPLETA** (19 Sep 2026). Su última puerta eran las devoluciones:
  `lots.rts_qty` existía desde `migrations/0008` y nada la escribía. El bloque `devolucion-del-cliente`
  la cerró — hoy toda caja devuelta queda documentada y la liquidación se la enseña al productor.
- **Área de mejora #3 — devoluciones y rechazos del cliente**: **construida** en la rama
  `devolucion-del-cliente`. Queda fuera el ajuste de precio por condición, que sigue por el camino de
  nota de crédito normal (`credit_type: 'precio'`), ya existente y ya atribuible.
- **Área de mejora #2 — un solo número de "cuánto debo" y "cuánto me deben"**: siguen existiendo varias
  lecturas de CxC/CxP que no coinciden entre dashboard, Balance, CxC/CxP y Gastos. Aquí entra el
  crédito de cliente por sobrepago (hoy un cobro que no cuadra **se niega**, a propósito).
- **Área de mejora #4 — documentos que faltan**: pick ticket y confirmación de pedido siguen imprimiendo
  la OV; el estado de cuenta sigue sin detalle ni fecha "al".
- **Área de mejora #5 — conciliación**: importar el estado de cuenta de Chase (CSV) y cruce
  parcial/múltiple. Fecha, método y referencia ya se capturan (bloque de pagos).
- Hallazgos ALTOS que siguen abiertos: **16** (12 server fns sin candado de rol), **21**, **22**,
  **24**, **26**, y **51** (el vencimiento de la factura de proveedor sale de un "+7 días" inventado
  en el código — hace pagar hasta 13 días antes de tiempo; agregado el 19 Sep 2026). Están descritos con archivo y línea en `AUDITORIA-2026-09-03.md`. Los hallazgos 11,
  13, 15, 17, 18, 19, 20, **12** y **23** se cerraron en la sesión 4.
- `purchase_orders.paid` quedó sin escritores tras el bloque de pagos: la columna existe y ya no se usa
  (no se borró a propósito).

**Límites conocidos, decididos y documentados** (no son bugs por corregir, son fronteras del diseño):

- **Comisión pura**: el costo "Remitido al productor" se reconoce al **emitir** la liquidación, así que
  entre la venta y la liquidación ni el P&L ni el Balance tienen la parte del productor. Es la misma
  ventana en los dos, nunca se contradicen.
- **Consignación con crédito tardío**: si la nota de crédito llega después de emitir, el costo del lote
  ya quedó escrito y no se reescribe; la complementaria le baja el neto al productor y nace un `ADE-`,
  pero ese ajuste no toca el P&L, así que el COGS queda alto por ese monto. Mismo hueco que ya tenían
  reversas y ajustes; cerrarlo pide una línea de "ajustes de costo de cargas liquidadas" en el P&L.
- **BOL anterior a `documentos-completos`**: un embarque cuyo BOL se emitió antes de ese bloque no tiene
  mercancía ligada y su BOL saldría vacío. En producción no aplica (cero órdenes de venta).

Detalles chicos, anotados y sin resolver (no bloquean nada, no se construyeron):
- "Quality dump" sigue en inglés en el account of sales (el catálogo de motivos se tradujo, el valor ya guardado en filas viejas no).
- La advertencia de precio fuera de rango (merma que absorbe Plein) no se probó con merma en libras a $20/lb — pendiente de confirmar si dispara.
- La ubicación de un lote no se ve en ninguna pantalla de solo lectura (Almacén → Lotes no la muestra); solo aparece en los selectores de Recibir, Reempacar y Surtir.
- El rol de José Arambula es `seller` (orders/contacts/reports), sin `finance`, siendo el socio financiero — revisar con Miguel si es intencional.
- El aviso de temperatura ubicación-vs-producto solo existe al recibir mercancía; no en reempaque ni al surtir.
- No existe "trasladar un lote de una ubicación a otra" como operación.

### Prueba de Ubicaciones (PR #21) — corrida parcial en producción

**Probado y correcto:** la ruta Almacén → Ubicaciones (la URL sigue siendo `/destinos`, por compatibilidad); alta con temperatura (38 °F llegaron a la base); edición del nombre; rechazo de código duplicado con mensaje claro en español; y desactivar — la fila queda tachada, con etiqueta "Desactivada", el KPI baja y el botón cambia a "Activar".

**Falta por probar** (tres cosas, y la primera es justo la salida del candado):
- **Reactivar** una ubicación desactivada.
- **Editar la temperatura** (el alta sí se probó; la edición no).
- Si una ubicación desactivada **sigue apareciendo en el selector de Recibir** — que es donde de verdad estorbaría.

### Pendientes de captura, de Miguel (no son bugs)

- Dirección real de la empresa (hoy imprime "1234 N Grand Ave", inventada).
- Bodegas reales de terceros (las 4 ubicaciones sembradas — Cámara 1, Cámara 2, Área de empaque, Bodega Nogales — son de ejemplo; Plein no tiene cámara ni bodega propia hoy). La pantalla para corregirlas ya existe: Almacén → Ubicaciones.
- Destino real de envío de Alpine Fresh (hoy "Doral, FL", inventado).
- Temperatura de 29 de 39 productos del catálogo.
- Peso neto del SKU Brussels Sprouts Organic Caja Mesh.
- Ubicación de prueba `PREUBA-001` "PRUEBA BODEGA X" quedó **en producción**, desactivada. Borrarla o dejarla, decisión de Miguel — `BORRAR` no se la lleva (protege el catálogo).

## Huecos conocidos (no son bugs de "arranque")

- Email de algunos clientes (Cri) vacío en `0014_plein_catalog.sql`.
- Chase histórico no se importa a propósito.
- Preview embebido (iframe) bloquea WhatsApp/`window.print`; por eso PDF = descarga. En la app publicada funciona mejor.

## Cómo seguir (primer mensaje para Claude)

Pega esto en Claude Code / Claude.ai (con el repo abierto):

```
Clona o abre github.com/mickyarambula/cosecha (privado).
Lee HANDOFF.md, COSECHA.md, CLAUDE.md, AUDITORIA-2026-09-03.md y MODELO-NEGOCIO.md.
Eres el ingeniero de Cosecha (Plein Produce, Miguel). No reconstruyas. No toques corte ni CORTE-CHASE ni una liquidación ya emitida (liquidated_at).
Al cerrar un bloque probado: commit, merge --no-ff a main y push — eso publica a producción.
Antes de cualquier migración párate: enséñame el SQL y espera mi OK.
Habla español de producto.
Lo que quiero ahora: [Miguel escribe la tarea]
```

## Si Miguel usa Claude.ai (chat, no Code)

1. Conectar GitHub a Claude y agregar el repo **privado** `mickyarambula/cosecha`.
2. O Project → pegar `HANDOFF.md` + `COSECHA.md` + `CLAUDE.md` + `AUDITORIA-2026-09-03.md` + `MODELO-NEGOCIO.md` y decirle que el código está en ese repo.
3. No subas un zip a un Project público. Hay CxC/CxP reales.

Claude Code es el camino correcto: clona, edita, corre, commit.
