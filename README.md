# Cosecha

ERP de produce fresco para un trader que hoy opera en Drive. Lotes, calidad PACA, compras, ventas, facturas con membrete, CxC/CxP y tesorería.

El producto se llama **Cosecha**. Los documentos que salen al cliente/proveedor llevan membrete de **Plein Produce LLC**.

La lógica de negocio, el corte, el diseño y las reglas que no se tocan están en **[COSECHA.md](COSECHA.md)**. Léelo antes de cambiar dinero, Chase o facturas de apertura.

## Qué cubre hoy

- Catálogos: SKUs reales de Plein (producto × empaque × calibre), contrapartes duales, listas de empaque/calibre
- Customer PO → OV; OC ligada a OV → recepción PACA → lote
- Inventario por lote y cámara; liquidación PAS; merma; portal vendor
- Documentos PDF (Invoice, OC, OV) con aviso PACA; Outlook + WhatsApp (el usuario envía)
- CxC / CxP / Tesorería / P&L / Balance
- Corte de apertura 2026-06-30 (Ingresos/Egresos/Chase). Lo live se puede borrar en Ajustes → Pruebas

## Repo

Privado en [`mickyarambula/cosecha`](https://github.com/mickyarambula/cosecha). No copiar a `erp-plein` (ese es el sistema anterior).

Si otro chat de Grok usa este proyecto como base: clona este repo, lee `COSECHA.md`, no reconstruyas Cosecha, no publiques, no toques el corte.
