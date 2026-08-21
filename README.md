# Cosecha

ERP de produce fresco para un trader que hoy opera en Drive. Lotes, calidad PACA, compras, ventas, facturas con membrete, CxC/CxP y tesorería.

El producto se llama **Cosecha**. Los documentos que salen al cliente/proveedor llevan membrete de **Plein Produce LLC**.

## Qué cubre hoy

- Catálogos: matriz SKU Papaya × empaque × calibre; contraparte dual proveedor/cliente
- Customer PO: captura el PO del cliente (N° Northgate, adjunto Drive) y lo convierte a OV
- Ventas: tablero Pedido / Despachado / Comprado / Open · Generar compra al grower
- Compras: OC ligada a la OV → recepción PACA (Aceptada / incidencia / Rechazada) → lote sano o retenido
- Inventario por lote y cámara; no se despacha lo retenido
- Documentos imprimibles (Invoice, Purchase Order, Sales Order) con aviso PACA
- CxC / CxP / Tesorería

## Arranque

```bash
npm install
npm run dev
```

Sin `DATABASE_URL` corre Postgres embebido (PGLite) con semilla de demo. En producción, con Neon, se aplican las migraciones de `migrations/`.

## Semilla para probar

1. Productos → Papaya Maradol: **PAP-CARTON-10CT** en la matriz (Carton / Clamshell / Crate × 7–18 ct).
2. Proveedores y Clientes → **Papayas & More** es dual (te vende y te compra).
3. Customer PO → **CPO-2608-001** Northgate **NGM247514**: Convertir a venta.
4. Ventas: tablero RAPO 1,056 open → **Generar compra** a Papayas & More.
5. Compras: la OC nueva (ligada a la OV) → recibir con incidencia.
6. Inventario: lote Sano + lote Retenido. El retenido no se vende.
7. Ventas: despachar solo el sano → Facturar.
8. CxC: **Documento** abre la Invoice; cobrar.
9. CxP: capturar factura del proveedor y pagar.
10. Tesorería: cobro y pago en caja.

## Repo

Privado en `mickyarambula/cosecha`. No copiar a `erp-plein` (ese es el sistema anterior).
