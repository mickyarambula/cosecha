# Cosecha

ERP de produce fresco para un trader que hoy opera en Drive. Lotes, calidad PACA, compras, ventas, facturas con membrete, CxC/CxP y tesorería.

El producto se llama **Cosecha**. Los documentos que salen al cliente/proveedor llevan membrete de **Plein Produce LLC**.

## Qué cubre hoy

- Catálogos: productos, proveedores, clientes
- Compras: OC → recepción PACA (Aceptada / incidencia / Rechazada) → lote sano o retenido
- Inventario por lote y cámara; no se despacha lo retenido
- Ventas: OV → despacho solo de lotes sanos → factura
- Documentos imprimibles (Invoice, Purchase Order, Sales Order) con aviso PACA
- CxC / CxP / Tesorería

## Arranque

```bash
npm install
npm run dev
```

Sin `DATABASE_URL` corre Postgres embebido (PGLite) con semilla de demo. En producción, con Neon, se aplican las migraciones de `migrations/`.

## Semilla para probar

1. Compras → **OC-2608-022** Papayas & More: recibir con incidencia (100 cajas afectadas).
2. Inventario: debe nacer un lote Sano y uno Retenido.
3. Ventas → **OV-2608-060** Northgate: despachar solo el sano → Facturar.
4. CxC: **Documento** abre la Invoice; cobrar.
5. CxP: capturar factura del proveedor y pagar.
6. Tesorería: cobro y pago en caja.

## Repo

Privado en `mickyarambula/cosecha`. No copiar a `erp-plein` (ese es el sistema anterior).
