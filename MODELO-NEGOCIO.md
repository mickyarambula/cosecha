# Modelo de negocio real — lo que Plein hace y Cosecha todavía no cubre

**19 Sep 2026.** Todo lo que está aquí salió de leer los **libros V8** y el **libro 2026** de Plein. Los números son de ahí; ninguno está inventado. Donde falta un dato real está marcado como pregunta abierta, no rellenado.

Este documento **no es un plan de construcción aprobado**. Es el mapa de lo que la operación real hace y el ERP no. Cada hueco trae dónde encaja en el modelo de datos, de qué depende y qué rompe si se hace mal — para que el siguiente bloque no nazca torcido. Nada de esto se construye sin que Miguel lo pida.

Léelo junto con `AUDITORIA-2026-09-03.md` (lo que está mal en lo ya construido) y `HANDOFF.md` (el estado).

---

## Cómo leer los números de este documento

**Los saldos del V8 son fotos de un día que ya pasó.** Los $52,447.33 de JEAM, los $211,191.67 de aportaciones, las 92 cargas: cuando el sistema esté operando van a ser otros números. **No construyas nada amarrado a esas cifras** — ni una migración que las siembre, ni un cálculo que las asuma, ni una prueba que las fije.

**Lo permanente es la FORMA de operar.** Eso no caduca y es lo que hay que cubrir:

- Compra en **pesos** y vende en **dólares**.
- En la serie de Northgate gana **50 centavos por caja sin tocar la fruta**.
- Tiene vencimientos de **3 y de 31 días con el mismo proveedor** — el plazo es del documento, no de la relación.
- Reparte **nómina y gasto financiero** entre cargas, y los reparte **con criterios distintos**.
- Su **FOB cambia** entre Mexicali, McAllen y Los Ángeles.

Las cifras de abajo están para dimensionar qué tan caro sale cada hueco, no para programarlas.

---

## La escala que hace que esto importe

**92 cargas, diciembre 2025 a junio 2026:**

| | |
|---|---:|
| Ingresos | $1,490,564.39 |
| Egresos | $1,411,311.02 |
| **Utilidad** | **$79,253.37** |
| **Margen neto** | **5.3 %** |

Ese 5.3 % es el contexto de todo lo que sigue. Con ese margen, los huecos de abajo **no son detalles contables**: un movimiento del dólar de doce centavos sobre las compras en pesos se come más de una décima parte de la utilidad del año. Una carga cuyos indirectos no se prorratean se ve rentable cuando no lo es.

---

## Modalidades de trato

### Las tres que Cosecha ya cubre

**Firme** (precio cerrado), **consignación / PAS** (el costo se define al liquidar) y **comisión pura** (Plein no toma título; su utilidad es la comisión).

En la serie **YTH** (jackfruit, Las Brisas → Papayas & More) la comisión **es** exactamente la utilidad de Plein:

| Carga | Comisión | Utilidad |
|---|---:|---:|
| YTH06 | 828.365 | 828.365 |
| YTH07 | 203 | 203 |
| YTH09 | 837.17 | 837.17 |

> **Verificación pendiente, no verificada aún:** correr esas tres cargas contra el motor de liquidación de Cosecha y confirmar que da el mismo número. Hasta que se corra, esto es una expectativa, no un hecho comprobado.

### La que falta: brokerage de margen fijo por caja

**Serie P**, cliente Northgate, proveedor Papayas & More:

| Compra | Vende | Margen |
|---:|---:|---:|
| 23.50 | 24.00 | 0.50 |
| 21.50 | 22.00 | 0.50 |
| 19.50 | 20.00 | 0.50 |

Siempre **0.50 por caja**. Cero fletes, cero aduanales, cero gastos. Utilidad exacta **528 = 1056 × 0.50**.

**La fruta no pasa físicamente por Plein.** Ahí está el problema: hoy toda orden de compra pasa por recepción y genera lote e inventario. Capturada como "firme", una carga de estas deja un **lote fantasma de 1056 cajas × $23.50 = $24,816 de inventario** en una bodega donde nunca hubo fruta — y Plein no tiene bodega propia.

Peor: si nadie despacha ese lote, el costo de venta queda en cero y los $25,344 de venta **no entran a la utilidad** aunque el ingreso y la cuenta por cobrar sí suban. Y si alguien despacha el lote para cuadrar, el P&L da 528 correcto pero los movimientos de inventario mienten, se pueden imprimir etiquetas de cajas que no existen, y esa carga entra al prorrateo de gastos de las demás. **Por ningún camino se llega al 528 limpio.**

---

## El bloque 0 que nadie había visto

Antes de cualquier hueco de abajo hay dos piezas que, si no se hacen primero, hacen que **cinco de los siete nazcan con los números en el cajón equivocado**:

**1. El P&L no sabe leer el catálogo de cuentas.** La función que asigna cada gasto a su cuenta contable es una lista fija escrita a mano en el código (`getFinancials` → `currentOf`, `src/lib/produce-server.ts`). La tabla `gl_mappings`, que **sí** se edita desde la pantalla de Cuentas, nunca se consulta. Y la columna `expenses.account_number` existe desde `migrations/0009` y **nadie la lee ni la escribe**. Resultado: toda cuenta nueva que no esté en esa lista fija cae en **"59999 General"**. Peso-dólar, nómina, JEAM, indirectos y flete de salida necesitan cuenta propia — los cinco caerían ahí.

Esto ya está en la auditoría como hallazgo **25** (marcado ⚠️ PARCIAL). No es un choque con los bloques nuevos: es su requisito.

**2. El P&L no tiene periodo.** `getFinancials` no recibe ningún argumento y no filtra por fecha; el campo "Period" de Reportes es una cajita sin estado. "Indirectos del mes" y "nómina del periodo" prometen un corte que el P&L no sabe hacer. Es el hallazgo **37** / Área de mejora #9.

**Tamaño del bloque 0: chico, y no toca dinero.** Pero sin él, los cinco bloques que siguen se construyen dos veces.

---

## Los huecos, ordenados por lo que cuestan

### 1. Peso–dólar: moneda, tipo de cambio y exposición

**Qué pasa hoy.** Plein compra en pesos y lleva libros en dólares, y el ERP **no tiene moneda en ningún documento de dinero**. La única columna `currency` del sistema está en las órdenes de compra del cliente (`customer_pos`), es una etiqueta que nunca toca un número, y **se pierde** al convertir esa orden en venta.

**El costo real.** El cotizador de una carga trae materia prima **242,408.67 MXN** y flete **60,000 MXN**, convertidos a un "dólar hoy" de **17.23**. El análisis de costos de esa misma carga usa **17.35**. Si el dólar se mueve un peso entre pactar y pagar, esos 242,408 MXN cuestan **$771 dólares más** — y la utilidad de esa carga era **$3,268.70**. Son **24 % de la utilidad de la carga**, evaporados en algo que hoy el ERP ni registra.

**Qué falta, en cuatro piezas:**
1. **Declarar moneda y tipo de cambio en cada documento** (orden de compra, factura de proveedor, gasto, factura de venta, movimiento de caja). La columna que hoy suma se queda en dólares; lo nuevo es el registro del original.
2. **El diferencial entre el TC pactado y el TC al pagar** — con su cuenta de resultado cambiario, no metido en un gasto cualquiera.
3. **El costo de los dólares ya comprados al usarlos** — inventario de divisa a promedio ponderado. El patrón ya existe en el repo: los adelantos al productor consumen saldo con una guarda atómica; es el mismo molde.
4. **La exposición abierta por cubeta de vencimiento** — cuánto se debe en pesos y cuándo vence.

**Qué rompe si se hace mal.** Meter 242,408.67 **pesos** en el total de una factura de proveedor hace que el ERP sume pesos con dólares: CxP mostraría $242,408.67 contra $14,069 reales, y el ancla de 570,097.56 deja de ser comparable. Y si el diferencial cambiario se captura como un gasto ligado a una carga con "a cargo del productor", **se le descuenta al productor una pérdida cambiaria que es de Plein** — y si esa carga ya se liquidó, solo se corrige por complementaria.

**Depende de:** el bloque 0, y de cinco decisiones de Miguel (abajo). **Tamaño: grande** — se parte en tres: (A) registrar moneda y TC sin efecto contable, (B) diferencial realizado con su cuenta, (C) inventario de divisa y exposición.

> **Nota para el plan: este motor ya existe terminado en otro proyecto de Miguel (Azagro).** Conviene traerlo, no reinventarlo. Antes de construir, revisar qué se reutiliza.

**Preguntas abiertas para Miguel:**
- ¿Cuál es el tipo de cambio oficial: el DOF, el del banco, o el que le dan al comprar dólares?
- La factura de un productor mexicano, ¿se congela en dólares al TC pactado, o se revalúa al pagar?
- El diferencial cambiario, ¿lo absorbe Plein o se le descuenta al productor? (Toca PACA y la liquidación.)
- ¿Compra dólares por adelantado? ¿En qué cuenta caen?
- ¿Compra dólares por adelantado, y en qué cuenta caen? *(dato de Miguel)*
- Los nombres y plazos reales por proveedor. *(dato de Miguel)*

> ### Recomendación del agente — **confirmada por Miguel el 19 Sep 2026**
>
> **El tipo de cambio es el que le dan al comprar dólares.** El DOF es referencia fiscal; lo que cuesta dinero es el del banco. Registrar al DOF y pagar al del banco fabrica una diferencia falsa en cada operación.
>
> **Un solo TC pactado por carga.** El 17.23 del cotizador contra el 17.35 del análisis de costos es el síntoma: dos documentos de la misma carga con tipos de cambio distintos. Los dos tienen que leer el TC pactado del mismo lugar.
>
> **La factura del productor se congela en dólares al TC pactado.** No es preferencia: revaluarla movería el total de un documento ya emitido y con eso se cae `saldo = total − paid`, que es regla que no se toca. La diferencia al pagar va a resultado cambiario.
>
> **El diferencial lo absorbe Plein.** Le pactaste un precio en pesos, así que el riesgo del dólar es de Plein por definición del trato; y en consignación y comisión la liquidación tiene que mostrar lo que produjo su fruta, no una pérdida financiera ajena. *Excepción:* si el trato se pacta en dólares, no hay exposición que repartir.
>
> **La moneda de pago al productor: default por proveedor, editable en el documento.** Mismo patrón que el plazo de pago — el default evita teclearlo cada vez, pero la moneda es del documento, no de la relación.
>
> **Si no compra dólares por adelantado**, la pieza de inventario de divisa queda vacía y no estorba. Constrúyela así.

> ### Respuesta de Miguel — 22 Sep 2026
>
> **¿Cómo le paga en pesos a un productor?** *De momento, (a): transferencia desde Chase y el banco convierte los dólares.* Las otras dos —cuenta en pesos en México, o comprar pesos en casa de cambio— **pueden darse**, así que la parte B tiene que aceptarlas sin rehacer nada: el diferencial se mide contra el TC al que salieron los dólares, venga del banco o de la casa de cambio, y una cuenta en pesos entra como cuenta de tesorería con su moneda.
>
> **Parte A construida el 22 Sep 2026** (rama `peso-dolar-registro`, migración 0050): moneda y TC por documento en compras, factura de proveedor congelada al TC pactado, gastos y adelantos en pesos, moneda de pago default por proveedor. Las columnas que suman siguen en dólares; las anclas no se mueven.
>
> **Parte B construida el 22 Sep 2026** (rama `peso-dolar-diferencial`, migración 0051): pagar en pesos registra los pesos, el TC del banco y el resultado cambiario (cuenta 58100), siempre de Plein. Queda para la **parte C**: cuenta de tesorería en pesos y pesos comprados por adelantado (costo promedio, el `walkUsdCash` de Azagro invertido). **Pregunta abierta nueva** *(dato de Miguel)*: la remisión al productor en comisión pura se liquida en dólares; si se la pagas en pesos, ¿a qué TC se pacta? Sin ese TC no hay contra qué medir un diferencial.

---

### 2. Indirectos prorrateados por carga

**Qué pasa hoy.** La hoja "Rentabilidad" del V8 reparte gastos generales, nómina y gastos financieros entre **todas** las cargas del periodo. Número real: la **carga 1358** cargó **904.93** de indirectos y su utilidad bajó de **~1,394 a 489.17** — es decir, **la carga se veía 2.8 veces más rentable de lo que fue**. Cosecha solo prorratea gastos que están ligados a una orden de compra concreta; un gasto general no tiene camino para llegar a la rentabilidad por carga.

El dinero **ya está** en el P&L como gasto operativo. Lo que no existe es la rebanada por carga.

**Qué falta.** Un pool de indirectos con periodo y criterio de reparto, y su tabla de aplicaciones por carga — espejo de lo que ya existe para gastos compartidos, pero con periodo. Más una función que **calcule sin escribir** (previsualizar el reparto) antes de aplicarlo, y que salte las cargas ya liquidadas.

**Qué rompe si se hace mal.** Dos cosas, las dos caras:
- Si el indirecto entra por el camino de gastos compartidos marcado "a cargo del productor", **el productor paga la nómina de Plein**: en la carga 1358 con comisión del 10 % sobre neto, su neto cae 904.93 y la comisión ~90.49. Si la liquidación ya se emitió, solo se corrige por complementaria.
- **Doble conteo en el P&L**: el indirecto ya está sumado como gasto. Si el prorrateo crea filas de gasto nuevas, la utilidad neta baja dos veces — 904.93 × 2.

**Depende de:** el bloque 0, del **periodo**, y de la nómina (si se quiere prorratear) — **la nómina ya existe** (22 Sep 2026): los periodos cerrados, por fecha de fin, son la bolsa de donde leer. **Tamaño: mediano.**

**Preguntas abiertas:** ninguna de diseño — resueltas abajo. Falta el dato de qué partidas concretas del V8 entran a cada bolsa. *(dato de Miguel)*

> ### Recomendación del agente — **corregida y confirmada por Miguel el 19 Sep 2026**
>
> **Dos bolsas, no una. Su V8 ya las trae separadas en dos columnas y hay que respetarlo:**
>
> | Bolsa | Criterio de reparto | Por qué |
> |---|---|---|
> | **Nómina + administrativo** | **por cajas recibidas** | Escalan con el volumen que se maneja, no con el precio. Repartir por dólares vendidos le cargaría más overhead a la carga que se vendió cara, que es al revés de la realidad. El motor de prorrateo por caja ya funciona. |
> | **Gasto financiero** | **NO por cajas** | Escala con **dinero parado por tiempo**, no con volumen. Y es coherente con la regla de JEAM: el interés va al proyecto que usó el dinero. Una carga chica financiada seis meses cuesta más que una grande pagada de contado. |
>
> **El prorrateo no crea filas de gasto nuevas.** El indirecto ya está sumado en el P&L; si el reparto genera gastos, la utilidad baja dos veces. El pool necesita tabla propia — la alternativa "barata" de reusar la tabla de gastos reabre el hallazgo 14 sola.
>
> **Nunca "a cargo del productor".** Un indirecto que llegue a su liquidación le cobra la nómina de Plein.

---

### 3. Flete de salida y punto FOB

**Qué pasa hoy.** La hoja de costos real trae punto FOB en **Mexicali, Nayarit, McAllen y Los Ángeles**. En Cosecha solo existe flete de **compra**, como gasto ligado a la carga. Del lado de la **venta** no hay nada: ni flete de salida, ni punto FOB en la orden, ni efecto en el margen.

**Media buena noticia:** el punto FOB **ya está en la base y en el catálogo** (`shipments.incoterm` e `incoterm_place`, con FOB/EXW/DAP/DDP ya sembrados desde `migrations/0027`). Lo único que los apaga es la pantalla: el panel de embarques solo los muestra y los manda cuando el embarque es de **entrada**. Destaparlos en salida es trabajo de pantalla, cero SQL.

**Qué falta.** Ligar gastos a la **venta** (hoy un gasto solo se liga a una carga de compra) y el punto FOB / base de precio en la orden de venta.

**Qué rompe si se hace mal.** Ligar el flete de salida a la **carga de compra** por no tener dónde ponerlo. Un camión Nogales→Los Ángeles de $3,200, capturado contra la carga y "a cargo del productor": en una carga a comisión del 10 % con venta bruta de $20,000, el neto correcto es **$18,000** y el roto **$14,800**. Con la liquidación ya emitida, eso ya no se corrige — solo complementaria.

**Depende de:** la captura se puede hacer sola hoy; que **mueva el margen** depende de tener el costo aterrizado, que es otro hueco. **Tamaño: mediano** (chico si es solo destapar el FOB en salida).

**Preguntas abiertas:**
- Mexicali / Nayarit / McAllen / LA — ¿son FOB de **venta** (donde el cliente toma la fruta) o de **compra** (donde Plein la recoge)? Cambia en qué tabla vive.
- ¿Plein paga el flete de salida y lo cobra en la factura, o es por cuenta del cliente?
- ¿Un camión de salida puede llevar dos ventas?
- ¿Plein paga el flete de salida y lo cobra en la factura, o es por cuenta del cliente? *(dato de Miguel — constrúyelo para que el gasto PUEDA generar línea en la factura; en produce pasan las dos)*

> ### Recomendación del agente — **confirmada por Miguel el 19 Sep 2026**
>
> **Dos puntos FOB separados, no uno.** Mexicali y Nayarit son origen en México; McAllen y Los Ángeles son cruce y destino. En la hoja del V8 están mezclados en una sola columna, y una sola columna los va a seguir revolviendo. Modelar **punto de origen** (compra) y **punto de entrega** (venta) por separado.
>
> **Repartible entre ventas desde el día uno.** En produce un camión lleva dos ventas rutinariamente. Esto no es teoría: no haberlo hecho del lado compra **es el hallazgo 14**, y costó un bloque entero arreglarlo con migración de reparación incluida.
>
> **El flete de salida nunca se le descuenta al productor.** Su fruta se entregó en el punto pactado; lo que Plein gaste llevándola a su cliente es costo de vender. Cobrárselo es cobrar dos veces sobre la misma comisión.

---

### 4. Antigüedad por fecha compromiso

**Qué pasa hoy.** Los libros Ingresos y Egresos del V8 llevan **fecha de vencimiento separada** de la del documento, y de ahí sale el "monto vencido". Cosecha calcula la antigüedad por fecha de emisión.

**Media buena noticia otra vez:** las tres columnas de vencimiento **ya existen** (factura, factura de proveedor, gasto). Lo que falla es quién las llena y quién las lee:
- La **factura de proveedor** se vence a **7 días fijos**, escrito a fuego en el código, en dos lugares. Ese 7 es un dato inventado: la tabla de proveedores **no tiene plazo de pago** (los clientes sí).
- El **gasto** ni siquiera acepta fecha de vencimiento al capturarlo.
- **Gastos** calcula su antigüedad por fecha de emisión **aunque el servidor ya le manda el vencimiento**. El dato está y se ignora.
- **CxP no tiene pestaña de antigüedad.**

**Qué falta.** Plazo de pago por proveedor, vencimiento capturable en el gasto, un solo cálculo de antigüedad que lean las tres pantallas, y la pestaña de antigüedad en CxP.

**Qué rompe.** Nada contable — el vencimiento no entra en ningún asiento y las anclas son sumas sin filtro de fecha. Rompe **la decisión de pago**: una factura de proveedor de $21,271.01 emitida el 19 de agosto sale vencida el 27 por el "+7". Si el plazo real es de 21 días, no vence hasta el 9 de septiembre — **Miguel paga 13 días antes de lo que debe**.

Cuidado con una cosa: si alguien "arregla" esto escribiendo vencimientos sobre las facturas del corte, **altera documentos congelados**.

**Depende de:** nada técnico. Solo del plazo real por proveedor. **Tamaño: chico.** Es el segundo mejor valor por esfuerzo.

**Preguntas abiertas:** en el V8, ¿el "monto vencido" se mide contra la fecha capturada o contra documento + días de plazo? *(dato de Miguel)*

> **✅ CONSTRUIDO — 22 Sep 2026 (rama `antiguedad-por-vencimiento`, migración 0049).** Plazo default por proveedor (en blanco hasta capturarlo), vencimiento capturable en la factura del proveedor y en el gasto, un solo cálculo por fecha compromiso que leen CxC, CxP y Gastos, y la pestaña de antigüedad de CxP. La columna **"Sin plazo"** separa lo que falta capturar de lo que está corriente.
>
> **La pregunta abierta se contestó sola al leer los libros:** los 112 documentos del corte traen **fecha de vencimiento capturada**, no calculada — y los plazos varían (21 días en la gran mayoría, pero también 22, 23, 28 y 41). Por eso el vencimiento se guarda como **fecha en el documento** y el plazo del proveedor es solo el atajo para proponerla. Miguel sigue pudiendo corregir esto si en el V8 significaba otra cosa.
>
> **Lo que falta capturar:** el plazo real de cada proveedor. La ficha ya enseña la pista sacada de sus propias facturas del corte, con un botón para aceptarla.

> ### Recomendación del agente — **confirmada por Miguel el 19 Sep 2026**
>
> **El plazo es del DOCUMENTO, no del proveedor.** Miguel tiene vencimientos de **3 y de 31 días con el mismo proveedor**. Así que: **default por proveedor** para no teclearlo cada vez, **editable en cada documento**. Mismo patrón que la moneda de pago.
>
> **Mientras no haya plazo capturado, el vencimiento va en blanco** y la pantalla dice "sin plazo capturado". Hoy hay un **"+7 días" inventado en el código** que lo está haciendo pagar hasta 13 días antes de tiempo. En blanco es honesto; el 7 es mentira. *(Registrado como hallazgo **51** en `AUDITORIA-2026-09-03.md`.)*
>
> **Un gasto sin factura del proveedor es corriente** hasta que la factura llegue — no nace vencido.

---

### 5. Saldo e interés de la línea JEAM

**Qué pasa hoy.** El V8 trae la línea JEAM en **-52,447.33** y el corte la tiene como cuenta `20250`. Esa cuenta está **congelada a fuego en el código**: el saldo nunca se mueve. No hay tabla de disposiciones, ni de abonos, ni de interés.

**Cómo funciona de verdad.** JEAM presta por dos vías:
- un **préstamo operativo sin interés**;
- una **línea back to back al 6 % anual** para proyectos con productores con contrato.

Son **préstamos** — no aportaciones y no gastos.

> **Aclaración importante, para que nadie la modele mal:** JEAM funcionó como **cuenta de pago solo al arranque**, antes de que Plein tuviera cuenta propia: **8 pagos por $52,872.00** entre el 11 de diciembre de 2025 y el 8 de enero de 2026. Desde el **21 de enero** todo sale de Chase: **193 pagos, $871,931.80**. Pagar desde JEAM **no es el deber ser**. **No modelar JEAM como cuenta de pago.**

**Qué falta.** Las dos líneas (operativa y back to back) con su tasa; cada disposición y cada abono; el devengo mensual del 6 %, congelado al cerrar el mes como se congela una liquidación; y dos cuentas contables (interés por pagar y gasto financiero). El saldo de apertura de 52,447.33 se queda intacto donde está.

El patrón ya está probado en el repo: los adelantos al productor son exactamente esto al revés (un activo en vez de un pasivo), con su guarda atómica de recuperación.

**Qué rompe si se hace mal.** Si una disposición de JEAM se registra como movimiento de caja normal, **entra a Chase** y el pasivo se queda quieto: una disposición de $100,000 deja Chase en $109,361.05 con el pasivo todavía en $52,447.33, y el Balance se descuadra por exactamente $100,000 — la identidad del corte (`673,014.43 + 9,361.05 = 570,097.56 + 52,447.33 + 59,830.59`) deja de cerrar. Y si el interés se captura como gasto ligado a una carga, **se le cobra al productor el costo del dinero de José**.

**Depende de:** el bloque 0. No toca liquidación ni el corte. **Tamaño: mediano** — lo mediano no es el alta de datos, es el devengo (base, días, cierre mensual congelado) sin contaminar Chase.

**Preguntas abiertas:**
- ¿Cómo se parte hoy el $52,447.33 entre operativo y back to back? Sin ese corte no hay base para devengar el 6 %. Si no está partido, ¿la back to back abre en cero desde hoy?
- ¿El 6 % es sobre saldo promedio diario o a fin de mes? ¿360 o 365 días? ¿Se capitaliza o se paga aparte?
- ¿Hay contratos con productores ya vigentes de esa línea? ¿El interés lo absorbe Plein o va al proyecto?
- ¿Hay contratos con productores ya vigentes de la línea back to back? *(dato de Miguel)*

> ### Recomendación del agente — **corregida por Miguel el 19 Sep 2026**
>
> **La línea NO se defaultea a nada. El devengo queda bloqueado hasta que Miguel traiga el corte real.**
>
> Mi recomendación original era dejar los $52,447.33 completos como operativo sin interés y abrir la back to back en cero. **Era una contradicción mía**: tres párrafos más abajo, en aportaciones, yo mismo decía que los "Depósito back to back" podían ser esa misma línea. Y sí lo son: **en los traspasos hay $82,700 etiquetados "back 2 back" entre agosto y septiembre, hoy clasificados como aportación**. Defaultear todo a "sin interés" **le esconde un pasivo** y le regala un gasto financiero que sí existe.
>
> Entonces:
> - La línea nace **marcada como "pendiente de corte real"**.
> - **El devengo del 6 % no corre** mientras esa marca esté puesta — no se devenga sobre una base desconocida.
> - La pantalla dice explícitamente que el saldo está sin partir, en vez de mostrar un número que parece bueno.
> - Los $82,700 se revisan **antes** de tocar nada: si son financiamiento, no son capital.
>
> **Lo que sí queda confirmado de esta línea:**
> - **El interés va al proyecto que usó el dinero**, que es el punto entero de una back to back.
> - **Pero nunca toca la liquidación del productor.** Cobrarle el costo del dinero de José es lo que PACA no permite y lo que las reglas del ERP ya prohíben en otros lados. Al P&L de esa carga sí; al account of sales no.
> - **Convención estándar si el contrato no la fija:** saldo promedio diario, base 360, interés pagadero y no capitalizado. Y sea cual sea, **el devengo se congela al cerrar el mes**, igual que una liquidación — un interés que se recalcula para atrás nunca cuadra.
> - **Las 8 disposiciones de dic 2025 – ene 2026 se quedan fuera**, igual que el Chase histórico: el saldo de apertura ya contiene su resultado, y capturarlas lo contaría dos veces.
> - **JEAM no se modela como cuenta de pago.** Lo fue solo al arranque; desde el 21 de enero todo sale de Chase.

---

### 6. Aportaciones, retiros y semilla a productores

**Qué pasa hoy.** **$211,191.67 aportados y $21,000 retirados**, con conceptos "Depósito back to back", "Depósito Semilla Kabocha", "Depósito Semilla Bell Pepper", "Compra Semilla". Cosecha **no tiene nada de capital**: no hay tabla de aportaciones ni de retiros, y el catálogo de conceptos de tesorería solo conoce ingreso y gasto.

**El financiamiento de semilla a productores con contrato es un negocio distinto** al de comprar y vender cargas, y hoy no tiene lugar en el modelo.

Lo más cercano que existe son los **adelantos al productor**, que sirven a medias: la migración que los creó ya menciona "semilla" y el motor de recuperación contra liquidaciones ya está. Pero le faltan tres cosas:
- el dinero de la semilla **sale a un tercero** (la semillera), no al productor — y hoy el adelanto solo sabe de una contraparte;
- la recuperación exige una liquidación de una carga: **semilla sin cosecha no tiene salida**;
- no hay castigo, ni temporada, ni contrato.

**Qué rompe si se hace mal.** Una aportación registrada como movimiento de caja normal sube Chase $211,191.67 y **ninguna cuenta de capital baja** — el Balance se descuadra por ese monto contra las anclas. Un retiro capturado como gasto cae en "59999 General" y baja la utilidad neta $21,000; y si además se liga a una carga, **se le descuenta al productor fruta que nunca consumió**. La semilla capturada como gasto es peor: el P&L se come un activo y, al liquidar, se le paga al productor el neto completo sin descontar la semilla — **Plein paga dos veces**.

**Depende de:** aportaciones y retiros, de nada (bloque 0 aparte). Semilla, de una decisión de Miguel. **Tamaño:** aportaciones **chico**; semilla **mediano**.

**Preguntas abiertas:**
- ¿Quién aporta — Miguel, José/JEAMS, ambos? Si es JEAMS puede ser **pasivo**, no capital.
- "Depósito back to back": ¿aportación de socio o financiamiento? Cambia la cuenta.
- ¿Los $21,000 los retiró el mismo socio que aportó?
- ¿La semilla se le descuenta 100 % al productor? ¿Y si no entrega: se castiga, se arrastra a la siguiente temporada, o se cobra?
- ¿Las fechas son anteriores al 19 de agosto de 2026? Si sí, ya están dentro del corte y no se recapturan. *(dato de Miguel)*

> ### Recomendación del agente — **confirmada por Miguel el 19 Sep 2026**
>
> **Los "Depósito back to back" probablemente NO son capital.** El nombre coincide con la línea de JEAM, y hay **$82,700 etiquetados "back 2 back" entre agosto y septiembre clasificados como aportación**. Si son financiamiento, son **pasivo**. Clasificarlos mal infla el capital y esconde deuda. **Verificarlo antes de registrar un peso** — está atado al bloque de JEAM, no se resuelven por separado.
>
> **Modela con socio desde el primer día.** Hay más de una contraparte y no cuesta nada dejarlo listo.
>
> **La semilla: 100 % recuperable** contra las liquidaciones del productor. Es un adelanto, no un regalo, y el motor de recuperación ya existe.
>
> **Si no entrega: castigo explícito, con motivo, nunca automático** — que se vea como la decisión que es.
>
> **Topa el adelanto de semilla a lo que sus cargas históricas producen.** Si se le adelanta más de lo que su cosecha va a rendir, el adelanto no se recupera nunca y solo se descubre al final de la temporada.

---

### 7. Nómina

**Qué pasa hoy.** **13 registros, $42,145** en el periodo. Entraría como gasto suelto: sin empleado, sin periodo, y sin poder prorratearse a cargas. El catálogo de conceptos ya trae las partidas (Nómina Ventas / Compras / Admin), pero solo del lado de tesorería — **hoy la nómina vive en el registro de Chase, sin una fila de gasto que prorratear**.

No hay tabla de empleados. La que existe (`staff`) es de **acceso al sistema**, no de personal: no tiene puesto, sueldo ni fecha de alta. El catálogo de **departamentos** sí existe y sirve como área.

**Qué falta.** Empleados (separado de los usuarios del sistema), periodo de nómina con su folio y las filas del periodo. *(Corrección 22 Sep 2026: la cuenta de sueldos **sí existe** desde el bloque 0 — 52500 "Nómina", migración 0048; este párrafo decía que no.)*

**Qué rompe si se hace mal.** Tres cosas concretas:
- La tabla de gastos **exige proveedor**. Capturar los 13 registros obliga a **inventar un proveedor "Nómina"** — prohibido por `CLAUDE.md`.
- El gasto nace "por pagar" por default: los $42,145 entrarían a cuentas por pagar y **el ancla pasaría de $570,097.56 a $612,242.56** por dinero que ya salió.
- Si alguna fila queda "a cargo del productor" y ligada a una carga, se le descuenta en su liquidación.

**Depende de:** el bloque 0 (para la cuenta contable). De los indirectos, solo si se quiere prorratear. **Tamaño: mediano.**

**Preguntas abiertas:** nombres reales de los empleados y su área — **no los tengo**. ¿Periodicidad? ¿Los 13 registros ya salieron por Chase? *(datos de Miguel)*

> ### Recomendación del agente — **confirmada por Miguel el 19 Sep 2026**
>
> **Captura bruto y deducciones por separado**, aunque hoy solo tenga el neto a la mano. El P&L quiere el costo completo; registrar solo el neto subestima el costo para siempre y nunca permite conciliar.
>
> **Nunca se le cobra a un productor.** Sin excepción.
>
> **Las que ya salieron por Chase nacen marcadas "ya pagadas"**, o inflan las cuentas por pagar con dinero que ya salió — el ancla pasaría de $570,097.56 a $612,242.56.
>
> **No inventar un proveedor "Nómina".** La tabla de gastos exige proveedor; por eso la nómina necesita su propio camino, no el de gastos.

> ### ✅ CONSTRUIDO — 22 Sep 2026 (rama `nomina`, migración 0052)
>
> Empleados (catálogo, vacío hasta que Miguel capture), periodos `NOM-` con un renglón por empleado (bruto, deducciones, neto; nombre y partida congelados), cierre que entra al P&L por el **bruto** y por la **fecha de fin del periodo** en la 52500 (mapeo `payroll` en Cuentas), y tres formas de pago: por Chase (un movimiento por empleado, nunca antes del corte), ya pagada sin mover Chase (si la fecha es anterior al corte, no entra al P&L: es del V8), o por pagar (pasivo **20300**). Un gasto con partida "Gasto Nómina" se rechaza para no contarla dos veces. Las retenciones se acumulan en **20350**. La 20100 y el KPI de CxP no se tocan. Un movimiento de nómina se cancela solo desde Nómina. Pantalla: Finanzas → Nómina.
>
> **Contestado por Miguel el 23 Sep 2026** (y confirmado en el V8, hoja Registro de Nómina): hoy **no hay empleados** — cobran **dos socios** una mensualidad por su trabajo (Samuel Ibarra, $3,500 al mes como Nómina Ventas; Juan Mercado, $3,500 como Nómina Compras) y **Fernanda Palacios**, administrativa de medio tiempo (Nómina Admin), pactada en unos **MX$5,000 al mes** pero registrada en el V8 en dólares por lo que salió de Chase ($145 el 11 Ago, $294 el 31 Ago). **Periodicidad: mensual.** Los **13 registros ($42,145) son todos anteriores al corte** (12 × $3,500 de los socios de marzo al 7 Ago + $145 de Fernanda del 11 Ago): se capturan como "ya pagada, Chase ya lo refleja" y quedan fuera del P&L. Los **3 pagos del 31 Ago ($7,294)** salieron **después** del corte: son operación viva. **La mensualidad de los socios es sueldo** (Miguel, 23 Sep 2026: "operan el negocio") — va al P&L como nómina, igual que en el V8.

> **Preguntas abiertas nuevas** *(datos de Miguel)*: ¿cada cuánto se paga (semana, quincena)? — el periodo es de fechas libres, así que funciona con cualquiera. ¿Los 13 registros del V8 ya salieron por Chase antes del 19 Ago 2026? — si sí, se capturan como "ya pagada, Chase ya lo refleja" con su fecha real: quedan marcados "antes del corte" y **no entran al P&L ni a los pasivos** (ese dinero ya vive en el saldo de apertura); sirven de registro y de base para el prorrateo. ¿Qué son las deducciones (retenciones de impuestos, préstamos al empleado)? — hoy se acumulan en la 20350 y **no hay pantalla para enterarlas**: si se pagan como gasto normal se cuentan dos veces. ¿Hay nómina en pesos? — hoy solo dólares.

---

## Decisiones del 23 Sep 2026

- **Corte nuevo al 30 Sep 2026 y arranque limpio el 1 Oct 2026.** Entre el corte del 19 Ago y hoy hubo operación real en el V8 (ventas de septiembre, renta, la nómina del 31 Ago) que Cosecha no tiene. En vez de recapturar cinco semanas, cuando Miguel cierre septiembre en el V8 se genera un corte nuevo con los saldos al 30 Sep (CxC, CxP, Chase, JEAMS y lo que se le haya financiado a productores) y los tres números sagrados se reemplazan — con el SQL enseñado antes, como toda migración. Mientras tanto Miguel practica en Cosecha con BORRAR.
- **"Financiamiento" no es gasto.** En el V8 está en la partida Gasto Financiero ($253,344 entre julio y septiembre), pero los renglones son dinero que Plein le presta o aporta a productores (Akambarhu, Baja Plants, Santana Agrícola, Seed Company Aruba): préstamos con el back to back y aportaciones que se esperan de regreso, algunas sin costo. En Cosecha se registra como **adelanto al productor** (cuenta por cobrar, se recupera en la liquidación) y no se puede capturar como gasto ni como salida suelta de Chase. En el corte nuevo, lo que siga pendiente de regresar entra como saldo de adelantos, no como pérdida. **Pregunta abierta** *(dato de Miguel, en la descripción de cada renglón del V8)*: cuáles son back to back (con costo, ligados a JEAM) y cuáles aportación sin costo, y cuánto sigue pendiente de cada uno al 30 Sep.
- La utilidad del V8 cambia por eso: la pérdida neta de marzo a septiembre (−$400,579) incluye esos $253,344 que no son gasto.
- **El corte ya se genera solo** (`scripts/gen-corte.py`, 23 Sep 2026): lee el V8 en Excel y calcula CxC, CxP, Chase y JEAMS a cualquier fecha. **Validado** contra el corte vigente: al 19 Ago reproduce Chase ($9,361.05) y JEAMS ($52,447.33) al centavo, y CxC/CxP difieren exactamente por las correcciones que se le hicieron al V8 después (la venta del rechazo NGM248545 que se quitó, precios de Alpine y Northgate, una venta de Jalisco Produce, PX-72774). Vista previa al 30 Sep con datos del 22 Sep: CxC $589,899.58 · CxP $512,972.59 · Chase $17,855.12 · JEAMS $52,447.33.
- **Lo que falta clasificar para el corte** *(dato de Miguel)*: el Financiamiento sale de Chase a Akambarhu ($98,860), Santana ($53,733), Sierra Seed ($39,603), Baja Plants ($31,190), Seed Company Aruba ($23,641) y "General" ($6,318) — ¿de qué productor es cada pago a los semilleros, y cuánto sigue pendiente de regresar? Y los depósitos de JEAMS en Chase: back to back $105,700, semilla $93,767, inversión/préstamo $181,626 (enero–junio), devoluciones −$23,000 — ¿cuáles son préstamo (se regresan) y cuáles capital? Hoy todo eso vive escondido en el cuadre de capital.
- **Los programas de financiamiento, relacionados (archivos de Miguel del 23 Sep 2026, solo referencia — no se capturó nada):**
  - **Akambarhu** (Acámbaro y Comonfort, pimiento orgánico, contrato con TopLine): plan de apoyo de Plein $98,400 en 13 meses; depósitos semanales "Financiamiento programa top line" más apoyo extra (semilla bell pepper de Sierra Seed $31,220, 70 % plásticos y 50 % certificaciones $10,819.84). Se recupera con la producción: el excedente sobre el contrato TopLine es de Plein.
  - **Brocolini de Santana** (ranchos Campito y Concha, 18 bloques, 127 acres): programa de $312,178 — semilla de **Seed Company Aruba**, plántula en invernadero de **Baja Plants** y pago fijo semanal de acres a **Santana** ($10,116.42). Pagado según el archivo al 21 Sep: $131,725.67. Aruba y Baja Plants son proveedores del programa, **el deudor es Santana**.
  - **Cornejos Horticola** (kabocha): semilla pagada a **Sierra Seed** ($8,307.60 + $8,382.60). No viene en los archivos.
  - **JEAMS fondea exactamente estos programas**: los comentarios de Chase lo dicen ("Depósito para semilla Akambarhu", "Semilla, invernadero y acres Santana", "Semilla Cornejos 2da fase kabocha", "Back 2 back, Akam y Santana"). Es el back to back: JEAMS → Plein → productor.
  - Diferencias a revisar al cortar, no errores confirmados: el archivo de Brocolini trae envíos que todavía no aparecen en Chase (los del 21 Sep, que Chase tiene en $0, y la semilla del 20 Jul por $6,180, que en el V8 parece ser la línea "General" de $6,318); en Akambarhu, $11,000 del 20 Sep y $7,740 de apoyo extra sin línea en Chase. El folio 527 (−$2,793.07, "esta venta no es nuestra, solo se probó la cuenta") se anula con el abono del folio 500.
- **Antes del corte, en el V8**: corregir la fecha de 4 pagos de Jeam Capital capturados en diciembre (filas 11, 12, 14 y 18 de Egresos — son de enero), registrar en Egresos el folio 550 ($7,000 a Akambarhu del 21 Sep) y dar de alta en Cosecha a El Dorado Growers, RC Food Service, Jalisco Produce (clientes) y Sierra Seed International (proveedor).

## Orden de construcción sugerido

Este orden minimiza el retrabajo. **No está aprobado** — es la recomendación que sale del mapeo.

**0.** Bloque 0 — que el P&L lea el catálogo de cuentas y acepte un periodo.
**1.** Antigüedad por vencimiento — chico, sin riesgo contable, ahorra días de pago.
**2.** Peso–dólar (A) registrar y (B) diferencial — **el que más vale**, y con el motor de Azagro de referencia.
**3.** Nómina. ✅ (22 Sep 2026)
**4.** Indirectos por carga.
**5.** Flete de salida y FOB.
**6.** JEAM.
**7.** Aportaciones, retiros y semilla.
**8.** Brokerage de margen fijo.

**Fuera de este orden, a propósito:** las 92 cargas históricas (decisión abierta — no se construye nada, se retoma cuando el sistema esté operando) y cualquier cosa amarrada a un saldo del V8.

**Por qué el brokerage va al final y no al principio.** Parece el más sencillo (una columna y listo) y es el más caro. El costo de venta del ERP sale **únicamente** del lote del despacho: una carga directa sin lote da **costo cero en silencio**. En Northgate: se evaporan **$24,816** y la utilidad sale **$25,344 en vez de $528**. Hay que darle costo propio al despacho y reescribir la consulta del costo de venta, que además ya lee las devoluciones del bloque 09.

**Preguntas abiertas del brokerage:** ¿lleva BOL, y quién lo emite? ¿Términos de pago y cobro propios de la serie P? *(datos de Miguel)*

> ### Recomendación del agente — **confirmada por Miguel el 19 Sep 2026**
>
> **Plein asume PACA completo sobre esa fruta.** Compra a 23.50 y factura a 24.00: toma título y está en la cadena. Que la fruta no toque su bodega no lo saca. Constrúyelo asumiendo PACA — **devoluciones y reclamos aplican**, y por eso se apoya en el bloque 09 que ya está hecho.

---

## Dos dudas abiertas — sin resolver, a propósito

**1. "Descuento".** Existe como columna en las cargas del V8 y **desaparece** en el libro 2026. No se sabe si se sigue usando, si se reemplazó por otra cosa, o si simplemente dejó de aplicarse. **Pregunta para Miguel.**

**2. Cartón genérico contra cartón de marca dentro de una misma carga.** Los números no se entienden:

| Carga | Genérico | Marca |
|---|---:|---:|
| YTH11 | 192 | 960 |
| YTH15 | 480 | 576 |
| YTH16 | 1056 | 0 |

No se ve la regla: no es una proporción fija, no es todo o nada, y YTH16 va entero en uno solo. **Pregunta para Miguel** — sin entender esto no se puede modelar el empaque de esas cargas.

---

## Las 92 cargas históricas — decisión abierta, congelada a propósito

Miguel quiere registrar las **92 cargas de diciembre 2025 a junio 2026**.

**Esto choca con una regla escrita en `COSECHA.md`:** el YTD 2026 histórico se queda en el V8 y Cosecha arranca en el corte del 19 de agosto. El choque es real y no es de forma: **las tres anclas YA contienen el resultado de esas 92 cargas**, resumido. Registrarlas como actividad normal las contaría dos veces.

Tres caminos:

**(a) Registro histórico consultable que no toca contabilidad ni el corte.** Las cargas entran para poder consultarlas —qué se compró, a quién, a cómo se vendió— pero marcadas como históricas: fuera del P&L, fuera del Balance, fuera de CxC/CxP, fuera de las anclas. *Miguel se inclina por esta.*

**(b) Rehacer el corte al 1 de diciembre de 2025** y que Cosecha lleve el ciclo completo. Las anclas cambian, el corte se rehace entero, y todo lo probado contra `673,014.43 / 570,097.56 / 9,361.05` hay que volver a fijarlo.

**(c) No entran.** Se quedan en el V8, como está escrito hoy.

> ### Decisión de Miguel, 19 Sep 2026: **NO se construye nada para esto por ahora.**
>
> Ni el marcado estructural, ni los candados, ni la pantalla. **Se retoma cuando el sistema ya esté operando**, no antes. Queda **fuera del orden de bloques**: ningún bloque puede depender de esta decisión ni prepararse para ella.
>
> Si aparece la tentación de "dejarlo listo por si acaso", no. Las 92 cargas son un saldo del V8 —una foto de un día que ya pasó— y para cuando se retome, el número va a ser otro.

*(Si algún día se toma el camino (a): lo que tiene que garantizar es que el marcado sea **estructural, no una etiqueta** — si una sola lectura de dinero se olvida de filtrarlas, se cuentan $1.49 millones dos veces y el corte deja de cuadrar. Anotado para entonces, no para ahora.)*

---

## Qué hallazgos de la auditoría se cierran con estos bloques

Para no duplicar trabajo. Los números son de `AUDITORIA-2026-09-03.md`.

**Se resuelven completos:** **19** (todo gasto nace vencido el mismo día que se emite) · **26** (estado de cuenta sin detalle y sin restar créditos) · **32** (el concepto de la línea Chase se guarda y nadie lo lee) · **20** (marcar "ya pagado" sin movimiento de tesorería) · **42** y **21** (cancelar un adelanto, o una factura con recuperación de adelantos, deja la caja colgada).

**Parciales:** **27** (el plazo default se guarda y nadie lo lee) · **36** · **37** · **34** · **39** · **33** (el margen se captura en Compras y nunca se manda).

**Hay que resolverlos ANTES o el bloque nuevo nace mal:**
- **25** — es el bloque 0.
- **24** — el P&L tiene **dos bases de venta distintas** (lo facturado y lo embarcado). Prorratear indirectos sobre un ingreso ambiguo da un margen que no cuadra.
- **45** — el servidor fecha en UTC: después de las 5 de la tarde en Nogales, una factura nace con la fecha de mañana y su vencimiento hereda el error. (El cálculo de antigüedad en pantalla sí usa la hora local y está bien; el error es del servidor, al crear el documento.)

**Tres ya resueltos que se reabrirían si no se cuidan:**
- **6** — el P&L en comisión pura conoce tres modalidades. El brokerage sería una cuarta: sin contrapartida definida, esa fruta se cuenta dos veces o desaparece.
- **4** — un cobro en pesos contra una factura en dólares rompe la regla de "monto = suma aplicada ±$0.05". Hay que definir dónde vive la diferencia cambiaria antes de tocar el cobro.
- **14** — un indirecto ligado por el camino viejo vuelve a cobrarle el flete entero al primer productor.

**Lo que ningún bloque de aquí cubre y sigue costando:**
1. **16** — 12 funciones del servidor sin candado de rol: recibir, facturar, despachar, crear órdenes.
2. **22** — el folio del BOL puede chocar, y ese documento sale a un tercero.
3. **44** — "Borrar pruebas" no repone lo pagado en las facturas del corte: **las anclas quedan mal**.
4. **38** — en reempaque no se compara lo que sale contra lo que entra: se puede crear fruta.
5. **45** — la zona horaria (arriba).
6. **31** — merma y reempaque restan en **todas** las ubicaciones del lote.
7. **40** — validaciones que solo viven en la pantalla.
