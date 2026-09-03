# Auditoría Cosecha — 3 Sep 2026

Solo lectura. Nada se cambió en el código. Cobertura: `migrations/0001`–`0032`, `src/lib/produce-server.ts` completo, todas las rutas en `src/routes`, componentes, generadores de PDF (`doc-pdf`, `bol-pdf`, `label-pdf`) y scripts de migración.

Criterio de severidad (el que pediste):
- **CRÍTICO**: corrompe datos, pierde dinero, o produce un documento equivocado que sale a un tercero.
- **ALTO**: función que no hace lo que aparenta, en algo que se usa.
- **MEDIO**: inconsistencia real de bajo impacto.
- **BAJO**: cosmético.

Los puntos que ya estaban en `AUDITORIA.md` (27 Ago) y siguen abiertos se marcan como *(ya documentado, sigue abierto)*. Lo que parece intencional se dice.

---

## Hallazgos

### CRÍTICO

1. **La nota de crédito ignora todo lo que capturas y siempre acredita la orden completa.** `src/routes/ventas.tsx:899-948`. El modal muestra tipo (Restock/Loss/Price Adjustment), cantidad a acreditar y dos notas, pero ninguno está ligado a estado (líneas 904-911, 924-927). Al pulsar "Create credit" se manda cada línea con `quantity_ordered × unit_price` (942-947). Hoy: si el cliente rechazó 20 cajas de 800, sale una nota de crédito por las 800 y viaja al cliente. Debería: acreditar lo capturado.

2. **Después de la primera nota de crédito ya no se pueden emitir facturas.** `produce-server.ts:124-135` (`nextCode`) y `4827-4833`. El folio de factura busca la última fila con `like 'PP-2026-%'` ordenada por id; la nota de crédito `PP-2026-CR-001` (6094-6100) cae en ese patrón. Con facturas 0001..0010 y CR-001 recién creada, la siguiente factura calcula `PP-2026-0002`, que ya existe → error crudo `duplicate key`, y se repite en cada intento hasta que existan más créditos que facturas. Debería: secuencia independiente por tipo de documento.

3. **La misma compra se puede pagar dos veces y sin tope.** *(ya documentado, sigue abierto)*. `listPayables` (5782-5856) sigue devolviendo cada OC como "por pagar" valuada a pedido × costo, y `registerVendorPayment` (5940-6009) acepta pagos a `kind: "po"` que suben `purchase_orders.paid`; CxP paga la misma compra contra la bill (`cxp.tsx:53`, `registerPago` 5306-5352). Ninguna de las dos rutas ve a la otra. Además `registerVendorPayment` no valida que el monto por renglón no rebase el saldo (5976-5999) ni que el gasto/OC sea del proveedor elegido. El KPI "Total expenses" de Gastos suma las OCs de fruta como si fueran gastos (`gastos.tsx:65-78`) y la antigüedad de CxP cuenta OC + bill de la misma carga.

4. **El cobro de cliente no cuadra caja con facturas.** *(ya documentado, sigue abierto)*. `registerCustomerPayment` (6010-6064): no exige que la suma aplicada sea igual al monto, no topa al saldo de cada factura, no verifica que la factura sea del cliente ni que esté viva, y no acepta fecha (siempre hoy, 6034; la UI tampoco la pide). El aviso "An overpayment tag will be created" (`cxc.tsx:599`) describe un mecanismo que no existe.

5. **Reempacar saca las cajas de la liquidación del productor.** `createPackOut` (6697-6828): el lote nuevo nace sin `purchase_order_id` (6788-6806) y la liquidación solo lee lotes de la OC (`loadPoLots` 2346-2356). Al lote origen se le baja `current_qty` como `repack_out` (6759-6762): no cuenta como vendido, ni merma, ni remanente. Hoy: en consignación o comisión, cada caja reempacada desaparece del account of sales y el productor no cobra por ella. Debería: heredar la OC / prorratear ventas del lote hijo al lote padre.

6. **En comisión pura el P&L se queda con el dinero del productor.** `getFinancials` (6217-6332): ingreso = total facturado (6259-6261); costo = allocations × `lots.unit_cost` (6224-6229), pero en comisión el costo del lote se queda en cero a propósito (`applySettlement` 2740-2743). Existe el pasivo 21000 "por remitir" (6305) pero no hay contrapartida en resultados. Hoy: utilidad neta sobreestimada por el neto al productor; el Balance no cuadra por ese monto. Debería: el neto al productor entra como costo/remisión al emitir la liquidación.

7. **"Apply target %" y "Update lot costs" reescriben el costo pactado de una compra en firme.** `compras.tsx:2349-2378, 2670-2685` → `applySettlement` (2717-2785). Solo bloquea comisión (2740); en firme el `target_profit_pct` sobreescribe `t_cost` (2269-2270) y se escribe en `lots.unit_cost` y en `purchase_order_lines.unit_cost` **por producto** (2771-2776), así que dos calibres del mismo producto quedan con el mismo costo. `createBillFromPO` en firme factura recibido × ese costo (4895-4897). Hoy: una "herramienta de análisis" (texto en 2375-2376) cambia el costo real y el monto de la factura al productor. Debería: no escribir en firme; y escribir por línea, nunca por producto.

8. **La liquidación emitida no congela la carga.** `issueGrowerSettlement` (2573-2716) crea el documento y el pasivo `grower_payables` (2687-2703), pero nada impide después: despachar más cajas de esos lotes (`shipSalesLine` 4702-4791), cancelar una venta ya liquidada (`cancelSalesOrder` 4965-5025 borra las allocations), cambiar quién absorbe un gasto o la comisión (`setExpenseChargedTo` 2818-2835, `setPoCommission` 2786-2817), editar/cancelar gastos (3781-3917 solo bloquean si hay bill, no si hay LIQ). En consignación la bill se calcula en vivo (4895-4898), no desde el documento congelado. Hoy: LIQ-001 dice $10,000 y REM-001 nace por $10,000; se venden 50 cajas más y ese ingreso ya nunca le llega al productor; o la bill sale distinta del account of sales que ya se le mandó. Debería: cerrar la carga al emitir, o liquidación complementaria explícita.

9. **El BOL imprime lo pedido, no lo embarcado, y cambia de fecha al reimprimir.** `getBolDoc` (1752-1819) lista todas las líneas de la OV con `quantity_ordered` (1789-1802) sin importar de qué embarque es; `bol-pdf.ts:142` imprime `Fecha: hoy`. Hoy: un embarque parcial o el segundo camión de la misma OV llevan un BOL con todas las cajas de la orden; el mismo folio BOL sale con fechas distintas. Debería: cantidades del embarque y fecha de emisión congelada.

10. **Factura y OC salen sin calibre/empaque, y la factura pone la dirección de facturación como "Enviar a".** `createInvoiceFromSO` guarda como descripción solo el nombre del producto (4845) y el SKU impreso es el del producto, no del pack (5622-5628); `getPrintDoc` factura usa `ship: party` (5661). La OC impresa tampoco lleva calibre (5679-5693). Hoy: a Northgate le llega "Papaya · 800 caja" sin "Carton 10 ct" y "Enviar a: Northgate Markets, Anaheim"; al productor le llega una OC con tres líneas "Papaya" sin decir cuál calibre es cuál. Se suma lo ya documentado: factura por lo pedido si nada se embarcó (4818) y líneas sin precio omitidas en silencio (4821). Debería: descripción con SKU/calibre y ship-to del destino de la OV.

### ALTO

11. **Un gasto agregado desde "Nueva OC" queda huérfano.** `compras.tsx:288, 304`: con `expenseFor === "draft"` el gasto se crea sin `purchase_order_id`; al colocar la OC nadie lo liga. La tarjeta "Expenses" del borrador es `money(0)` fijo (539, 801). Hoy: el flete capturado junto con la compra no se prorratea ni se le descuenta al productor.

12. **Corregir costo/pallets/origen en una OC ya recibida no llega a los lotes.** `updatePurchaseOrder` rama "recibida" (3658-3673) actualiza solo `purchase_order_lines`; `lots.unit_cost` (margen, COGS, valor de inventario) se queda igual, mientras la bill en firme sí toma el costo nuevo (4897). El modal promete "Puedes corregir costo…" (`compras.tsx:1727-1731`). Hoy: OC dice $10, lote y margen dicen $9, bill dice $10.

13. **"Distribuir gasto por pallet" nunca opera.** `receiveMerchandise` llama a `insertLot` sin `pallets` (4055-4068, 4081-4094, 4102-4115; `insertLot` 160-186), así que `lots.pallets` es null en todo lote real y `computeSettlementLots` cae a prorrateo por unidades (2256-2262). Además solo el `alloc_by` del **primer** gasto decide por todos (2427). El selector Pallet/Unidad del modal de gasto es decorativo salvo en el primero.

14. **Conectar un gasto a varias OCs o desconectarlo no cambia la liquidación.** La liquidación lee `expenses.purchase_order_id` con el monto completo (2420-2425) e ignora `expense_po_links.amount_applied`; "Disconnect" (`disconnectExpensePo` 5923-5939) borra el link pero deja `purchase_order_id`. UI: `gastos.tsx:776-800, 904-963`. Hoy: un flete de dos cargas se le descuenta entero al productor de la primera y nada al de la segunda; "Not connected to a PO" mientras la OC lo sigue listando.

15. **La recepción ignora lo que capturas y hardcodea el resto.** `insertLot` (162-179) fija `received_date` y `pack_date` a hoy aunque el modal pida fecha; `origin_country` es 'México' fijo (168) aunque la línea de OC traiga origen; `grade` nunca se pasa. `inspection_folio` y `unloaded` no tienen input en el modal (`compras.tsx:1002-1147`), así que el aviso PACA asume siempre "carga descargada" (4009-4012). Las etiquetas de lote imprimen esos datos (`etiquetas.lotes.$poId.tsx:24-28`): "Empacado" = fecha de recepción, "Origen: México" para producto de Carrifoods USA.

16. **Los candados de rol siguen solo en la UI para la mitad de las funciones.** `moduleMiddleware` (`src/lib/auth/middleware.ts`, `access.server.ts`) protege finanzas y cancelaciones, pero estas usan solo `authMiddleware`: `createInvoiceFromSO` (4794), `createBillFromPO` (4856), `receiveMerchandise` (3990), `shipSalesLine` (4711), `wasteLot` (3103), `createPurchaseOrder` (3440), `updatePurchaseOrder` (3542), `createPackOut` (6698), `setLotQuality` (2234), `holdLot` (3142), `closeLot` (3160), `createSalesOrder` (4261). Un login nuevo queda `pending` (6581-6595) y puede llamarlas directo. *(parcialmente documentado)*.

17. **Nueva OV: precio "$35" inventado y cantidad = lote completo por default.** `ventas.tsx:150-151` (qty = todo el lote, price "35") y el picker muestra "Default price $35.00" en todos los SKUs (454; `product-picker.tsx:82,106`). Hoy: un dedazo coloca una venta por todas las cajas del lote a $35.

18. **Campos de la OV que se pierden al guardar.** `ventas.tsx:100-106`: "Requested date" (295-301), "Order type" (305-314), "Pickup date" (302-304) y "Delivery route" (315-319) no van en `createSalesOrder` (validador 4240-4260). La lista y el detalle muestran "Delivery to customer" fijo (676, 1079) y la fecha solicitada cae a la fecha de captura.

19. **La fecha del gasto se ignora.** `compras.tsx:2039-2041` (input sin estado) y `gastos.tsx:523, 579-581` (capturada, no enviada); `createExpense` usa hoy (3748) y `due_date = issue_date` (5788). Hoy: un flete de la semana pasada se fecha hoy y nunca aparece vencido.

20. **Editar un gasto resetea su prorrateo y "Ya pagado" paga sin caja.** `updateExpense`: `alloc_by` vuelve a 'pallet' (3841) porque la UI no lo manda (`gastos.tsx:702-713`); marcar "Ya pagado" pone `paid = amount` sin movimiento de tesorería (3827-3846). *(lo segundo ya documentado)*.

21. **Una bill con recuperación de adelantos no se puede cancelar ni deshacer.** `applyAdvanceRecovery` sube `supplier_bills.paid` sin cash_movement (3048-3053); `cancelSupplierBill` bloquea por `paid > 0` y pide "cancela ese pago primero" (5112-5117) pero no hay folio que cancelar ni función para revertir la recuperación.

22. **El folio del BOL puede chocar.** `nextCode` toma la última fila por id (128), pero los BOL se emiten en orden de impresión (`issueBol` 1740): embarque 5 recibe BOL-001, luego embarque 3 recibe BOL-002, y el siguiente vuelve a calcular BOL-002 → falla el índice único de `0029`.

23. **Un rechazo en recepción deja la OC "pendiente" para siempre.** La línea rechazada no toca `quantity_received` (4049-4052, 4145-4149), el estado queda `partial` (4151-4160), `getWarehouse.incoming` sigue contando esa fruta como "por llegar" (3266-3272) y el dashboard la alerta.

24. **P&L: Ingreso y Utilidad bruta usan bases distintas.** `getFinancials`: la cuenta 40000 es lo facturado (6259-6261) pero la utilidad bruta usa lo embarcado (`salesShipped`, 6226/6275) y el COGS usa allocations aunque no haya factura. Dos números de venta en el mismo reporte.

25. **Las categorías de gasto no llegan a la cuenta contable y "Save mappings" no se lee.** `ConceptSelect` emite nombres del catálogo V8 ("Fletes", "Carton", `concepts.tsx`) mientras `getFinancials.currentOf` (6277-6309) y `EXPENSE_KEYS` (`cuentas.tsx:20-36`) esperan "Freight", "Boxes"…; todo cae en 59999 General. `gl_mappings` se guarda (`persistMaps` 98-113) pero `getFinancials` no lo consulta: las cuentas están fijas en código.

26. **El estado de cuenta al cliente sale sin detalle y sin restar créditos.** `cxc.tsx:178-187` manda `lines` vacías → el PDF "Statement" solo trae el total (`send-doc.tsx:199-222`); `listInvoices.saldo = max(total − paid, 0)` (5173) deja las notas de crédito en saldo 0, así que no rebajan el estado de cuenta. *(créditos ya documentado)*.

### MEDIO

27. **Ajustes que se guardan y nadie lee.** De `settings.tsx` solo `paca_on_invoices` se consulta en el servidor (5645). Los demás (auto_fulfill, default_terms_days, expenses_in_breakeven, lot_number_method, repack_pack_date, print_po_on_place, share_vendor_portal, online_ordering, require_cpo, deactivate_open_lots, deactivate_empty_days, auto_close_empty_days; líneas 85-144, 236-283) no cambian nada. La tabla "Seller features" (850-877) son checkboxes sin estado.

28. **"Sign-off" no se firma nunca.** `signed_off` no tiene ninguna escritura en `src/`. La columna en Compras (963) siempre "—" y Reportes → Settlements muestra "Signed"/estado (`reportes.tsx:103`) de un dato que no cambia.

29. **Fichas de cliente y proveedor: la mitad es decoración.** `clientes.tsx`: Delivery route (223-226), Price sheet (228-231), "Disable" sin acción (236-239) *(ya documentado)*, Customer code (245-246), Credit limit (248-249), opciones del cliente (256-262), **Statement delivery method** (305-309 y 396-400, no guarda), contacto Name/Phone/Fax (312-314), "Documents sent" (317-325), "+ Add contact" (326-328), drag & drop (331-336), Export/Filters (158-171). Alta de cliente: address1/2, state, zip, code, credit se capturan y no se envían (25-38 vs 95-104). `proveedores.tsx`: Net D (229-231), Vendor code (232-234), Goods/Services (264-271, no se envían), Shipping/Billing (275-315), Fax (321), "Delete vendor" (513-515) *(ya documentado)*, Export all (184-186).

30. **Papayas & More puede quedar con dos teléfonos.** `updateSupplier`/`updateCustomer` (765-806, 880-913) no sincronizan el registro ligado; `createSupplier` fija 'Net 14' al cliente espejo (741). Parece intencional el "no netear"; lo que no parece intencional es que los datos de contacto diverjan.

31. **Merma y reempaque descuentan de todas las ubicaciones.** *(ya documentado, sigue abierto)*. `wasteLot` (3124-3127) y `createPackOut` (6763-6766) hacen `quantity − N` en todas las bodegas del lote; la merma tampoco guarda ubicación.

32. **El concepto de las líneas Chase se guarda y ningún reporte lo usa.** `registerCashMovement` (7245-7278) y `tesoreria.tsx:234-240` guardan `concept`; `listCash` no lo lee y `getFinancials` tampoco. El catálogo V8 Master existe solo para almacenarse.

33. **Compras: controles muertos y datos inventados.** `compras.tsx`: filtro Buyer con `<option>` sin `value` (848), botón "Filters" sin acción (869-871), "Requested date" fijo en hoy (843), checkbox "Organic" (636), "Share vendor portal" (782), "Print order when placed"/nota al proveedor no se usan (786-793), `markup` capturado y nunca enviado (84, 721-731), "+ Add non-inventory item" abre el picker de inventario (756-762), Pallets `|| row.lines.length` (1538) y `|| 1` (1432) muestran pallets que no existen, "Buyer: Miguel" fijo (1389), "Payment status" ignora parcial y comisión (1586), "Attachments · No attached files" (1589), Audit log / Return to shipper (1529-1530) *(ya documentado)*. Settlement: "Rev. status: Unpaid" fijo (2638), lote agotado se pinta "OPEN" (2633-2635), hint `money(0)` (2339).

34. **Ventas: controles muertos.** Filtro de cliente con `<option>` sin `value` ni `onChange` (591-596); "Print documents" manda BOL/Pick/Confirmación al mismo documento de OV (542-549) *(ya documentado)*; "Price sheet: Default", "Sales rep", "Fulfilled by: Auto-fulfilled {fecha de orden}" (1074, 1147, 1149); "{embarcado} received / {abierto} ATS" (1182); el `lot_id` pre-asignado al crear (145-150, 171; servidor 4286) parece reserva pero no reserva nada y otra OV puede tomar el mismo lote.

35. **Gastos: controles muertos.** "From/To" (186); KPIs de Pagos "Terms accounts $0", "Paid via ACH" = todo (247-250) y columna Method fija "ACH" (277) aunque el método se captura (el servidor solo lo mete en notas, 5973); "Export expenses" (341-343); "Distribution type: Auto distributed by pallet" fijo (773); concepto editable como texto libre (809); pestaña Credits y "Apply Credit" prometen créditos que no existen (84-106, 1057-1058); "Future due $0" (1046).

36. **CxC: controles muertos y clasificación falsa.** "From/To" y "As of" (70, 154); "Sales to terms customers" siempre 0 porque ambas ramas suman a cash (58-60, 76); KPIs cash/terms (339-340); "C PO #" siempre "—" (369) aunque el dato existe; "Type: Delivery" (377); términos `|| "Cash"` (383); crédito "Applied/Unused" siempre Unused (249); "Current $0" en el modal de cobro (532).

37. **Reportes: filtros pintados.** *(ya documentado, sigue abierto)*. Fechas, "Sales rep", "View report with expenses" (163-167, 275-279, 299-303, 379-383, 399-414); vendor/inventory/items con la misma tabla (361-387); "Cost of goods returned $0" (341); "Miguel" fijo (308); ventas por lo pedido (44-45, 53-55). `listSettlements` recalcula toda la liquidación por cada OC (7144-7171): con 300 OCs son ~2,500 consultas por carga de pantalla.

38. **Inventario: controles muertos.** Input "Price" por renglón editable y no guardado (423-428); "Label" siempre "—" (412); "Allo." siempre 0 (419); "Export" (369-371); pestaña "Inactive" es texto (330-332). Reempaque: `dest_qty` no se compara con lo consumido (6712-6714) y el lote hijo hereda solo el proveedor del primer origen (6787, 6796).

39. **Portal del productor.** "No payments found." fijo (183) aunque `paid` existe; estado de cada venta "Unpaid"/"Sale" fijo (3257-3258); `getVendorPortal` devuelve la liquidación completa (comisión, gastos de Plein, utilidad) sin importar el nivel (3218-3261) y la pantalla muestra "Commission $" y gastos en todos los niveles (46-48, 109-174). *(ya documentado)*.

40. **Validaciones que solo viven en la UI.** Sin chequeo en servidor: que el pack pertenezca al producto (`createPurchaseOrder` 3424-3437, `createSalesOrder` 4247-4258, `createCustomerPO` 4367-4388); que el destino sea del cliente (`createSalesOrder` 4267-4275 y `createCustomerPO` 4432 — `setSalesOrderDestination` sí lo valida, 4316-4322); lote cerrado/agotado al despachar (`shipSalesLine` 4727-4751 revisa held y calidad, no `closed_at` ni `status`); ubicación existente al recibir/reempacar; clientes/proveedores inactivos (ningún selector filtra `is_active` y el servidor tampoco); OC desde OV con un solo costo para todas las líneas (4683-4694).

41. **Vocabulario mezclado en la base.** `order_type` guarda "Delivery by vendor"/"Pickup"/"Will-call" (`compras.tsx:159, 515-517`) con default 'entrega' en `0007`; `CALIDAD_LABEL` y `DESTINO_*` en `utils.ts` tienen valores en inglés; `kindLabel` de tesorería en inglés (38-43).

42. **Cancelar un adelanto no libera la línea de banco.** `cancelGrowerAdvance` cancela el movimiento con un update directo (3086-3091) sin pasar por `reverseCashMovementEffects` (410-413), así que una línea Chase ya conciliada se queda apuntando a un movimiento cancelado.

43. **Cuentas: "Edit" sin acción (364-366) y `createGlAccount` sin verificar número duplicado (6156-6189)** → error crudo de Postgres.

44. **Borrar pruebas.** Borra todas las líneas de banco y todo movimiento salvo CORTE-CHASE (7055-7057), incluidos los reales posteriores al corte (el texto de la pantalla lo avisa, parece intencional). Sigue sin reponer `paid` en facturas/bills del corte que recibieron cobros vivos *(ya documentado)*. Tablas nuevas sí están cubiertas (pallets, shipments, settlements, payables, advances).

45. **Fechas en UTC del servidor.** *(ya documentado)*. `todayISO` (`utils.ts:74-77`) alimenta folios de lote/CPO, fecha de factura, bill, cobros: después de ~5 pm en Nogales todo se fecha mañana.

46. **La nota de crédito no se liga a la factura que corrige.** `createCreditInvoice` (6065-6139): `parent_invoice_id` nunca se llena, `sales_rep` es 'Miguel' fijo (6104), y no se topa al total facturado.

### BAJO

47. Textos en inglés crudo o mezclado en pantallas ya "traducidas": `cxp.tsx:86-87`, `tesoreria.tsx:65`, badges "Received"/"Unpaid"/"Cancelled" en compras/cxc/cxp, "Customer PO #" en el portal del productor (36, 63) para lo que es una OC.
48. `company.ts` (correo y teléfono de respaldo) difiere del `company_profile` sembrado en `0011`; si la fila no carga, el membrete cambia de datos.
49. `poShort` recorta a los últimos dígitos: "OC-022" y "OV-022" se ven ambos como "22" en tablas que mezclan ambos (embarques).
50. Settlement modal: "Inventory total" con hint `$0.00` fijo; portal muestra "Purchaser expenses" para gastos de Plein.

---

## Áreas de mejora (ordenadas por valor para el negocio)

**1. Liquidación al productor cerrada de punta a punta — grande.**
Qué falta: candado al emitir (o liquidación complementaria), reempaque y notas de crédito que viajen al productor, devoluciones (`rts_qty` existe desde `0008` y nada lo escribe), y una sola fuente para "cuánto le debo a cada productor" (bill + remisión + adelantos). Por qué importa: es el documento PACA más delicado y hoy tiene cuatro puertas abiertas (hallazgos 5, 7, 8, 14).

**2. Un solo número de "cuánto debo" y "cuánto me deben" — mediano.**
Hoy hay cuatro CxP: dashboard (solo bills, 482), Balance (bills + gastos, 6273), CxP (bills, `cxp.tsx:41`), Gastos (gastos + OCs, `gastos.tsx:68`); y tres CxC: dashboard netea créditos (479), Balance los excluye (6265), lista CxC los deja en 0 (5173). Falta una función única de saldos que lean todas las pantallas, con créditos aplicables a facturas y remisiones incluidas.

**3. Devoluciones y rechazos del cliente — grande.** *(ya en AUDITORIA.md)*. Rechazo parcial con destino de la fruta (regresa a lote, se destruye documentado, se revende), ajuste de precio por condición, y que el golpe llegue al margen y a la liquidación. Sin esto, cada reclamo termina en una nota de crédito que hoy además sale mal (hallazgo 1).

**4. Documentos completos y congelados — mediano.**
Factura con SKU/calibre y destino real; OC con calibres; BOL por embarque con cantidades y lotes; pick ticket y confirmación de pedido como documentos propios (hoy los tres imprimen la OV); estado de cuenta con detalle y fecha "al"; fecha de emisión fija en todo documento. Por qué importa: es lo que ven cliente, productor y transportista.

**5. Cobros y pagos con fecha, método y referencia real, y conciliación importada — mediano.**
Fecha de depósito capturable, método guardado como campo (no en notas), referencia/folio Chase en el cobro para no capturar el depósito dos veces, importación del estado de cuenta (CSV) y cruce parcial/múltiple. Hoy conciliar es teclear el estado de cuenta línea por línea.

**6. Margen aterrizado visible al vender — mediano.** *(PLAN-PASO-2)*. Costo del lote + prorrateo de gastos de su OC en el selector de lotes y en la línea; "costo por liquidar" en vez de "100%"; margen por allocations, no por el último lote. Requiere primero arreglar 12 y 13.

**7. Preguntas que hoy no se pueden contestar — mediano cada una.**
- Exposición total por productor (adelantos vivos + remisiones pendientes + bills + inventario consignado sin vender): los datos existen en cuatro tablas y ninguna pantalla los junta.
- Rentabilidad real por carga (facturado − costo aterrizado − gastos − créditos): Settlements se acerca pero usa precio de OV, no facturado, y no ve créditos.
- Rentabilidad por cliente y por calibre con lo facturado y sus notas de crédito.
- Días promedio de cobro por cliente y flujo de caja proyectado (CxC por vencer − CxP por vencer − remisiones).
- Pagos por método y por cuenta.
- Inventario consignado valorado (hoy vale $0 hasta liquidar).
- Qué gastos generales no están ligados a ninguna carga y cuánto pesan por mes.

**8. Roles reales en servidor y bitácora — mediano.**
Cerrar las 12 funciones con solo `authMiddleware` (hallazgo 16), guardar quién creó/editó cada documento (`created_by` solo existe en OC/OV/embarques) y un "Audit log" real detrás del texto que ya está en pantalla.

**9. Reportes con periodo y filtros reales — mediano.** *(ya en AUDITORIA.md)*. P&L por periodo, filtros de fecha/vendedor que filtren, ventas por lo facturado, antigüedad por vencimiento en ambos lados.

**10. Operaciones todo-o-nada y folios con secuencia de base — mediano.**
Ninguna función usa transacción: recibir, despachar, emitir liquidación, cobrar con aplicaciones y borrar pruebas hacen 5-20 escrituras y si una falla quedan a medias. `nextCode` lee "el último por id" y calcula el siguiente: se rompe con concurrencia (dos capturas al mismo tiempo) y ya se rompe solo con créditos (hallazgo 2) y BOLs (22). Secuencias de Postgres por tipo de documento resuelven ambas cosas.

**11. Lo que Miguel teclea dos veces — chico/mediano.**
La OC desde OV solo acepta un costo para todos los calibres; el gasto desde la OC se pierde (11); la fecha del gasto se pide y se ignora (19); el destino, términos y fecha de entrega del CPO viajan a la OV pero la OV nueva a mano los pierde (18); "Buyer"/"Sales rep" siempre Miguel aunque ya hay staff; el concepto V8 se captura en cada línea Chase y no sirve para nada (32); las 12 preferencias de Ajustes (27).

**12. Escalabilidad — mediano, y crece solo.**
`listPurchaseOrders`, `listSalesOrders`, `listLots`, `listInvoices`, `listPayables` cargan toda la tabla con todas sus líneas y el navegador filtra en memoria; `listSettlements` recalcula cada OC (37). Funciona con 50 OCs; con un año de operación cada pantalla carga miles de filas. Falta paginar/filtrar en servidor y precalcular saldos.

**13. Consistencia de catálogos — chico.**
Un solo vocabulario para tipo de orden, calidad, ubicación y método de pago (hoy inglés y español mezclados en la base, hallazgo 41); sincronía de contrapartes duales (30); inactivos filtrados en todos los selectores; recepción con ubicación por lote y merma con ubicación.

**14. Zona horaria del negocio — chico.** Fechar todo en America/Phoenix en lugar del reloj del servidor (45).

**15. Ajustes que no hacen nada — chico.** Conectar los tres que valen (auto_fulfill, términos default, gastos en break-even) y quitar los demás para que la pantalla no prometa automatizaciones que no existen (27).

---

## Lo que parece intencional (no lo cuento como bug)

- Los documentos públicos por token (`getPrintDoc`, `getVendorPortal`) sin sesión: es la decisión de "compartir por liga".
- "Por remitir a productores" separado del KPI de CxP: está documentado como ancla del corte.
- Borrar pruebas elimina también líneas de banco y movimientos reales posteriores al corte: el texto de la pantalla lo advierte.
- Consignación con costo en cero hasta liquidar y comisión pura con costo cero permanente: es el modelo de `0022`; lo que no es intencional es lo que ese cero hace en el P&L (hallazgo 6).
- Los botones "Templates" y "Previous order" deshabilitados en Nueva OC.

## Preguntas para Miguel antes de tocar nada

1. En comisión pura, ¿el ingreso de Plein en el P&L debe ser solo la comisión (y los gastos que recupera), o quieres ver la venta bruta y una línea de "remitido al productor"? Cambia cómo se corrige el hallazgo 6.
2. Cuando ya emitiste una liquidación y se venden cajas después, ¿qué esperas: liquidación complementaria con folio nuevo, o que la carga quede cerrada y esas cajas no se puedan despachar? Define el hallazgo 8.
3. ¿El pago a proveedor por OC (Gastos → Pay vendor) lo usas para algo que la bill no cubra, o se puede quitar ese camino? Define el hallazgo 3.
4. ¿Las "reservas" de lote al capturar una OV te sirven, o prefieres que el lote se asigne solo al surtir?
