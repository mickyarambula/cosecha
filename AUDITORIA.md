# Auditoría Cosecha — 27 Ago 2026

Levantamiento completo del repo tal como está publicado en pleinproduce.vercel.app (commit `51fa472`). Solo lectura: nada de esto está corregido todavía. Dos partes: **A) Levantamiento** (qué hay) y **B) Plan de ataque** (en qué orden se arregla).

---

## El corte: por qué la app dice "19 de agosto · $9,361.05" y los papeles dicen "30 de junio · $19,066.20"

**La app está bien; los papeles están viejos.** Hubo dos cortes:

1. **Corte v1 (30 de junio)** — construido desde las *Cargas* pendientes de V8: AR $673,014.43 (50 facturas), AP $564,670.16 (52 bills), Chase $19,066.20, JEAMS $23,030.33, ajuste de capital $104,380.14. Es el que documentan HANDOFF.md y COSECHA.md. El propio asiento de Chase decía "reemplázalo con el saldo del banco cuando lo tengas".
2. **Corte v2 (19 de agosto)** — reconstruido después **desde los libros de dinero** (Ingresos / Egresos / Chase), que son la fuente que se decidió usar. Borra el corte v1 completo y siembra: AR $673,014.43 (50 facturas, mismo total), **AP $570,097.56 (62 bills)**, **Chase $9,361.05** (último folio aplicado: 429), **JEAMS $52,447.33**, ajuste de capital $59,830.59. Este corte **cuadra por construcción**: 673,014.43 + 9,361.05 = 570,097.56 + 52,447.33 + 59,830.59 = $682,375.48.

Lo que ve Miguel en la app es el corte v2 — el correcto y más reciente. **Pendiente**: actualizar HANDOFF.md y COSECHA.md para que digan corte 19 de agosto con estos números, y así ningún chat futuro "corrija" la app hacia los números viejos.

---

## A) LEVANTAMIENTO

### ROTO — impide operar con confianza

- **Cualquiera en internet puede leer las facturas y los números del negocio.** Los documentos (`/doc/factura/1, 2, 3…`) y el portal del grower (`/portal/1, 2, 3…`) son públicos y con folios consecutivos: se pueden recorrer uno por uno y ver clientes, teléfonos, montos, costos y comisión de Plein. La app ya está publicada con CxC/CxP reales.
- **No hay manera de deshacer un error de captura.** No existe cancelar ni editar una factura, orden de venta, orden de compra, factura de proveedor, cobro o pago. El único "borrador" es Ajustes → Pruebas, que borra TODO lo vivo. El primer día de captura real, el primer dedazo se queda para siempre.
- **Un cobro puede descuadrar caja contra clientes.** Al registrar un cobro se puede aplicar más del saldo de la factura sin que el sistema lo detenga, y el total del pago no tiene que cuadrar con lo aplicado a facturas: la caja registra una cifra y las facturas otra. El aviso de "se creará un crédito por sobrepago" es mentira — ese mecanismo no existe.
- **La misma compra se puede pagar dos veces.** Hay dos caminos de pago a proveedor que no se ven entre sí: por factura de proveedor (CxP) y por orden de compra (Gastos → Vendor Payment). Pagar por un lado no baja el saldo del otro. Además el pago por OC valora la deuda por lo *pedido*, no por lo *recibido*.
- **La liquidación del grower reparte mal el dinero si una venta sale de dos lotes.** Cuando una línea de venta se surte de más de un lote, todo lo vendido se le atribuye al último lote usado; el primero queda en ceros. En consignación eso le paga de más a un grower y de menos a otro, y también tuerce el costo de ventas.
- **El Balance va a descuadrar en silencio en cuanto haya venta viva.** La utilidad del periodo no se suma al capital; la pantalla no avisa que Activo ≠ Pasivo + Capital, solo muestra las tres sumas.

### INCOMPLETO — funciona a medias

- Merma y reempaque descuentan la cantidad de **todas** las bodegas donde está el lote, no solo de la afectada: el inventario por ubicación se desalinea del total del lote.
- Un depósito de Chase se puede capturar doble sin que nada lo impida: una vez como "línea Chase" en Tesorería y otra como cobro de la factura — el propio texto del modal invita a hacer ambas.
- Las notas de crédito no rebajan el saldo del cliente de forma pareja: el tablero las resta, el estado financiero las ignora, y no hay forma de aplicarlas contra una factura.
- La factura de una venta factura lo *pedido* si aún no se embarca nada, y **omite en silencio** las líneas sin precio; solo se permite una factura por venta (embarques posteriores ya no se pueden facturar). Lo mismo del lado compras: una sola bill por OC, con vencimiento fijo a 7 días.
- La conciliación Chase es real pero mínima: capturar el estado de cuenta línea por línea a mano y cruzar 1 a 1 con monto exacto. No hay importación del estado de cuenta ni cruces parciales.
- Un gasto marcado "ya pagado" nunca pasa por tesorería: el dinero salió pero la caja del sistema no se entera.
- El portal del grower muestra "No payments found" fijo aunque haya pagos, y enseña costos y comisión de Plein incluso en el nivel de vista más restringido.
- Las operaciones de varios pasos (embarcar, recibir, pagar) no son todo-o-nada: si algo truena a medio camino, quedan números a medias. Y dos personas capturando a la vez pueden duplicar folios.
- Las fechas se toman del reloj del servidor (UTC): capturas después de ~5 pm hora de Nogales se fechan al día siguiente.
- El botón de BOL, Pick ticket y Sales confirmation imprimen la **misma hoja** de la orden de venta, titulada "Sales Order".
- Al borrar pruebas se conservan corte y CORTE-CHASE (bien), pero si hubo cobros reales sobre facturas del corte, el cobro desaparece de caja y la factura se queda marcada como pagada.

### FALTA — no existe y se necesita

- **Devoluciones y rechazos del cliente.** La columna "Returned" existe pero nada la escribe; no hay retorno a inventario ni ajuste de precio por llegada. Un trader los usa a diario.
- **Modalidad del trato por compra.** Solo existe "PAS" (precio después de venta, con % objetivo) y precio en firme implícito. No hay consignación formal con comisión pactada ni comisión pura, ni el campo que diga qué trato es cada carga.
- **Account of sales PACA formal para el grower** — el portal no es un documento imprimible/enviable de liquidación como exige PACA en consignación.
- **Candados de rol en el servidor.** Los módulos por rol solo esconden botones: casi cualquier función (finanzas, catálogo contable, movimientos de caja, liquidaciones) la puede invocar cualquier usuario con sesión, incluso uno todavía "en espera". Hoy el riesgo es bajo (solo 5 correos pueden entrar), pero el candado real no está.
- **Antigüedad de saldos 30/60/90** en reportes (hoy los buckets son semanales y por fecha de emisión, no de vencimiento).
- **Prorrateo de gastos generales** no ligados a una OC (los ligados a OC sí se prorratean por pallet/unidad).
- **Borrar proveedor / cliente no existe.** "Delete vendor" (`proveedores.tsx:509`) y "Disable" del cliente (`clientes.tsx:234`) son botones sin `onClick` — no hay `deleteSupplier` ni `deleteCustomer` en `produce-server.ts`, ni un soft-disable conectado, aunque `suppliers.is_active` y `customers.is_active` ya existen y `updateSupplier`/`updateCustomer` ya los aceptan (conectarlos es barato). Hallazgo de la sesión `errores-mudos` (30-ago-2026) que vale para cuando se construya esto: ninguna FK de `suppliers(id)` ni `customers(id)` (`lots`, `purchase_orders`, `expenses`, `grower_advances`, `invoices`, `customer_pos`, `customer_locations`) tiene `on delete cascade` ni `on delete set null` — el default de Postgres (`NO ACTION`) ya bloquea con un error de llave foránea cualquier intento de borrar un proveedor o cliente con movimientos ligados. La base no deja huérfanos; lo que falta construir es capturar ese error y mostrarlo en español ("tiene 12 órdenes, no se puede borrar") en vez de dejar pasar el error crudo de Postgres — y decidir si en realidad "Delete" debería ser desactivar (`is_active=false`), no un borrado físico.

### COSMÉTICO — molesta pero no bloquea

- Reportes con adornos que no funcionan: filtros de fecha y de vendedor que no filtran, palanca "with expenses" pintada, "Cost of goods returned" fijo en $0, tres pestañas (vendor/inventory/items) que muestran la misma tabla, "Sales rep" siempre Miguel, y ventas medidas por lo pedido, no por lo facturado.
- El idioma default es inglés y muchas pantallas (CxP, Reportes) tienen textos sin pasar por el diccionario: la UI sale mezclada inglés/español. La decisión de producto dice español.
- El P&L es "todo el histórico", sin periodo elegible.
- El archivo central de lógica tiene apagada la revisión de tipos (`@ts-nocheck`): el "typecheck limpio" no cubre el corazón del sistema.

---

## B) PLAN DE ATAQUE

Orden pensado para que Miguel capture **una semana real de operación sin toparse con nada ROTO**. Una sesión = una conversación de trabajo enfocada.

**Sesión 1 — Cerrar la puerta (Sonnet).** Documentos y portal dejan de ser adivinables: liga con token largo no consecutivo para compartir factura/OC/portal, y candado de rol/estatus en el servidor para las funciones sensibles. Va primero porque la app ya está publicada con números reales; cada día abierto es exposición.

**Sesión 2 — Poder equivocarse (Sonnet).** Cancelar y corregir: factura, OV, OC, bill, cobro y pago, con su rastro (quién y cuándo), regresando inventario y saldos. Va segundo porque sin esto la primera captura equivocada contamina los números y la única salida es borrar todo.

**Sesión 3 — Cobros y pagos que cuadran (Sonnet).** Tope de sobrepago, el pago debe cuadrar con lo aplicado, un solo camino de pago a proveedor (el pago por OC se liga a su bill o desaparece), candado contra el depósito Chase capturado doble, y el gasto "ya pagado" pasa por caja. Con 1+2+3, capturar una semana ya es seguro.

**Sesión 4 — Lotes y liquidación exactos (Fable).** Registrar de qué lote salió cada embarque (tabla de asignaciones, no sobrescribir), corregir merma/reempaque por ubicación, y volver todo-o-nada las operaciones de varios pasos. Es la sesión arquitectónica: toca el modelo de datos del que cuelga la liquidación del grower y el costo de ventas. Antes de liquidar consignación real, esto tiene que estar.

**Sesión 5 — Estados financieros confiables (Sonnet).** La utilidad del periodo entra al capital para que el Balance cuadre (y avise si no), P&L por periodo, notas de crédito que rebajan saldo y se aplican, y actualizar HANDOFF.md/COSECHA.md al corte del 19 de agosto.

**Sesión 6 — Operar como trader (Fable diseña, Sonnet ejecuta).** Modalidad del trato por compra (firme / consignación con comisión / comisión pura), devoluciones y ajustes post-factura con retorno a inventario, y account of sales PACA imprimible desde la liquidación. Es lo que falta para que Cosecha cubra el negocio completo estilo Silo.

**Sesión 7 — Pulir (Haiku para lo mecánico, Sonnet para reportes).** Español completo en toda la UI (default español), reportes con filtros reales y ventas por facturado, aging 30/60/90, BOL/pick/confirmación como documentos de verdad, portal del grower con pagos reales y vista por nivel bien recortada.

**Regla transversal:** ninguna sesión toca las facturas del corte, las bills del corte ni CORTE-CHASE.
