# Cosecha

ERP de produce fresco para un trader que hoy opera en Drive. Lotes, calidad PACA, compras, ventas, facturas con membrete, CxC/CxP y tesorería.

El producto se llama **Cosecha**. Los documentos que salen al cliente/proveedor llevan membrete de **Plein Produce LLC**.

- Lógica y reglas de dinero: **[COSECHA.md](COSECHA.md)**
- Estado para continuar en otro agente: **[HANDOFF.md](HANDOFF.md)**
- Instrucciones Claude Code: **[CLAUDE.md](CLAUDE.md)**
- Hallazgos vigentes (qué falta, qué ya se resolvió y en qué bloque): **[AUDITORIA-2026-09-03.md](AUDITORIA-2026-09-03.md)**

## GitHub

| Repo | Visibilidad |
|---|---|
| [mickyarambula/cosecha](https://github.com/mickyarambula/cosecha) | **Privado — usar este** |
| [mickyarambula/erppleinproduce](https://github.com/mickyarambula/erppleinproduce) | Privado (duplicado; no usar) |

No copiar a `erp-plein` (ese es el sistema anterior).

## Qué cubre hoy

- Catálogos: SKUs reales de Plein (producto × empaque × calibre), contrapartes duales
- Customer PO → OV; OC ligada a OV → recepción PACA → lote
- Inventario por lote; liquidación PAS; merma; portal vendor
- PDF (Invoice, OC, OV) + Outlook + WhatsApp (el usuario envía)
- CxC / CxP / Tesorería / P&L / Balance
- Corte de apertura 2026-08-19. Lo live se borra en Ajustes → Pruebas (el catálogo — productos, clientes, proveedores, ubicaciones — no se borra)
- Liquidación al productor con candados y complementaria (documento congelado al emitir, correcciones después van por complementaria)

## Arranque

```bash
npm install
npm run dev
```

Sin `DATABASE_URL` corre Postgres embebido (PGLite) y aplica `migrations/`. En producción usa Neon.
