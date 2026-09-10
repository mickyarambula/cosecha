# Handoff — Cosecha → Claude

**Fecha:** 9 Sep 2026 (actualizado; versión anterior era del 27 Ago y ya tenía números de corte viejos — ver nota abajo).
**Dueño:** Miguel Arambula · Plein Produce LLC · Nogales, AZ
**Producto:** Cosecha (ERP). Membrete de documentos: Plein Produce LLC.

Este archivo es el estado de la conversación. El código está en GitHub. Juntos son la base.
Antes de tocar código, lee también **`AUDITORIA-2026-09-03.md`** (lista vigente de hallazgos y qué sigue abierto) y, si existe, **`PLAN-PASO-2.md`** (histórico de un plan que ya no se sigue tal cual — lee su nota al principio antes de creer que es el plan vigente).

## GitHub (el desarrollo entero)

| Repo | Visibilidad | Usar para Claude |
|---|---|---|
| https://github.com/mickyarambula/cosecha | **Privado** | **Sí — este** |
| https://github.com/mickyarambula/erppleinproduce | Privado (mismo código, nombre viejo) | No hace falta |

Rama `main`. Cada bloque de trabajo entra por PR desde una rama nueva; Miguel hace el merge desde GitHub, nunca el agente.

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
- Chase `$9,361.05` folio `CORTE-CHASE`, fecha 2026-08-19. (v1 decía $19,066.20 al 2026-06-30 — viejo, no usar.)
- JEAMS `$52,447.33` GL `20250`. (v1 decía $23,030.33 — viejo.)
- Equity plug `$59,830.59` GL `30000`. (v1 decía $104,380.14 — viejo.)
- Chase operativo desde **19 Ago 2026**. Folio **430** no se aplica solo.
- Programada (PX-72775 / PX-72868) **fuera**.
- Papayas & More: cliente y proveedor, **no netear**.

Estas son las anclas que se verifican al final de cada bloque de trabajo (antes/después, y otra vez tras correr `BORRAR`). A la fecha de este documento, producción tiene 0 órdenes de compra, 0 de venta, 0 lotes, 0 liquidaciones — las anclas son el 100% del dinero en el sistema.

GL: `16000` JP Morgan Chase, `12000` AR, `20100` AP, `20250` JEAMS, `30000` equity.

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

### Qué sigue pendiente de esta sesión

- **C-1b**: notas de crédito atribuidas al productor con causa (Plein vs productor) — no se construyó.
- **Hallazgo 6** (`AUDITORIA-2026-09-03.md`): en comisión pura el P&L sigue inflando la utilidad con dinero del productor (el neto al productor no entra como costo/remisión al P&L).
- **Hallazgo 7, la parte de FIRME**: "Update lot costs" ya está bloqueado en consignación (candados-liquidacion), pero en trato **firme** sigue reescribiendo el costo pactado — no se tocó.
- Sesiones 3 y 4 del plan de `AUDITORIA-2026-09-03.md` (pagos que cuadran, documentos completos) — no empezadas.

Detalles chicos, anotados y sin resolver (no bloquean nada, no se construyeron):
- "Quality dump" sigue en inglés en el account of sales (el catálogo de motivos se tradujo, el valor ya guardado en filas viejas no).
- La advertencia de precio fuera de rango (merma que absorbe Plein) no se probó con merma en libras a $20/lb — pendiente de confirmar si dispara.
- La ubicación de un lote no se ve en ninguna pantalla de solo lectura (Almacén → Lotes no la muestra); solo aparece en los selectores de Recibir, Reempacar y Surtir.
- El rol de José Arambula es `seller` (orders/contacts/reports), sin `finance`, siendo el socio financiero — revisar con Miguel si es intencional.
- El aviso de temperatura ubicación-vs-producto solo existe al recibir mercancía; no en reempaque ni al surtir.
- No existe "trasladar un lote de una ubicación a otra" como operación.

### Pendientes de captura, de Miguel (no son bugs)

- Dirección real de la empresa (hoy imprime "1234 N Grand Ave", inventada).
- Bodegas reales de terceros (las 4 ubicaciones sembradas — Cámara 1, Cámara 2, Área de empaque, Bodega Nogales — son de ejemplo; Plein no tiene cámara ni bodega propia hoy). La pantalla para corregirlas ya existe: Almacén → Ubicaciones.
- Destino real de envío de Alpine Fresh (hoy "Doral, FL", inventado).
- Temperatura de 29 de 39 productos del catálogo.
- Peso neto del SKU Brussels Sprouts Organic Caja Mesh.
- Miguel todavía no corre la prueba de `ubicaciones-admin` (PR #21) en producción.

## Huecos conocidos (no son bugs de "arranque")

- Email de algunos clientes (Cri) vacío en `0014_plein_catalog.sql`.
- Chase histórico no se importa a propósito.
- Preview embebido (iframe) bloquea WhatsApp/`window.print`; por eso PDF = descarga. En la app publicada funciona mejor.

## Cómo seguir (primer mensaje para Claude)

Pega esto en Claude Code / Claude.ai (con el repo abierto):

```
Clona o abre github.com/mickyarambula/cosecha (privado).
Lee HANDOFF.md, COSECHA.md, CLAUDE.md y AUDITORIA-2026-09-03.md.
Eres el ingeniero de Cosecha (Plein Produce, Miguel). No reconstruyas. No publiques. No toques corte ni CORTE-CHASE ni una liquidación ya emitida (liquidated_at).
Habla español de producto.
Lo que quiero ahora: [Miguel escribe la tarea]
```

## Si Miguel usa Claude.ai (chat, no Code)

1. Conectar GitHub a Claude y agregar el repo **privado** `mickyarambula/cosecha`.
2. O Project → pegar `HANDOFF.md` + `COSECHA.md` + `CLAUDE.md` + `AUDITORIA-2026-09-03.md` y decirle que el código está en ese repo.
3. No subas un zip a un Project público. Hay CxC/CxP reales.

Claude Code es el camino correcto: clona, edita, corre, commit.
