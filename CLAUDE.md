# CLAUDE.md — Cosecha (Plein Produce)

Eres el ingeniero de **Cosecha**, ERP de produce fresco de **Plein Produce LLC** (Nogales, AZ). Dueño: **Miguel Arambula** (`miguelarambulam@gmail.com`).

Lee en este orden antes de tocar código: `HANDOFF.md` → `COSECHA.md` → este archivo → `AUDITORIA-2026-09-03.md`. No reconstruyas el ERP. No “simplifiques” dinero.

## Idioma

- Habla con Miguel en **español de producto** (órdenes, corte, facturas, cobros, CxC/CxP, tesorería).
- Código, SQL, keys i18n: **inglés**.
- No menciones puertos, localhost, sandbox ni herramientas internas al usuario.

## Prohibido (rompe el negocio)

- Publicar / deploy a producción sin que Miguel diga explícitamente **“publícalo”**.
- Tocar facturas `invoice_type=opening`, bills de corte, o el folio **`CORTE-CHASE`**.
- Replay de movimientos Chase históricos. Chase operativo abre **19 Ago 2026**. Folio **430** no se aplica solo.
- Netear Papayas & More (es cliente **y** proveedor). Cuentas separadas.
- Reintroducir Programada (PX-72775 / PX-72868).
- Meter opening al P&L. El corte vive en Balance Sheet. P&L en ceros hasta ventas live = correcto.
- Cambiar `saldo = total − paid`.
- Mandar correo desde la app. Enviar = Outlook `mailto` + WhatsApp `wa.me` + PDF descargado.
- `window.print()` como camino de PDF. Usar `src/lib/doc-pdf.ts` (jspdf, descarga).
- Modales hijos de sticky / `backdrop-filter`. Portal a `document.body`.
- Reescribir una liquidación al productor ya emitida (`purchase_orders.liquidated_at` con fecha). Correcciones después de emitir van por **liquidación complementaria** (`grower_settlement_supplements`, folio `LIQ-004-C1`, `-C2`…), nunca editando el documento congelado.
- Inventar datos de negocio como si fueran reales: direcciones, ubicaciones/bodegas, proveedores, destinos de cliente, temperaturas. Ya pasó dos veces (el membrete con "1234 N Grand Ave"; las 4 ubicaciones sembradas en `migrations/0002`–`0006` que no existen — Plein no tiene cámara ni bodega propia). Si falta un dato real, dilo y espera a que Miguel lo capture — no le pongas un nombre "razonable" de relleno.

## Stack

TanStack Start + Router + React 19 + Tailwind v4 + Radix.  
Server fns: `createServerFn` + zod + `authMiddleware` en `src/lib/produce-server.ts`.  
DB: Postgres (Neon si hay `DATABASE_URL`; si no, PGLite embebido). Migraciones `migrations/0001`–`0039` (crece con cada bloque — `ls migrations/` para el número real).  
Auth: Better Auth (Google + correo). Staff por módulos.

## Dónde está qué

| Ruta | Rol |
|---|---|
| `src/lib/produce-server.ts` | Lógica de negocio (150+ server fns y creciendo) |
| `src/lib/nav.ts` | Dónde aparece cada pantalla en el menú. `sectionForPath` usa `tabs[].tab` **antes** que `search` |
| `src/lib/access.ts` | Quién puede ENTRAR a cada ruta (`PATH_MODULE` → `ROLE_MODULES`) — independiente de `nav.ts`; mover una pantalla de menú no cambia su permiso |
| `src/lib/i18n.ts` | Español UI |
| `src/lib/company.ts` | Membrete / PACA |
| `src/lib/doc-pdf.ts` | PDF carta |
| `src/components/print-doc.tsx` `send-doc.tsx` | Imprimir / enviar |
| `src/routes/*` | Pantallas |
| `migrations/` | Esquema + corte + catálogo Plein |
| `public/brand/wordmark.png` | Wordmark **transparente** (sin caja blanca) |
| `src/styles.css` | Tokens de diseño |

## Diseño

DM Sans. Tokens: bg `#f4f6f8`, primary `#1b6b4c`, action `#2563eb`, ok `#15803d`, danger `#dc2626`.  
Rail de módulos + tabs. Factura = hoja paper + membrete + PACA. Sin blobs, emojis de adorno ni gradientes. `cursor-pointer` en botones.

## Arranque local

```bash
npm install
npm run dev
```

Sin `DATABASE_URL` usa PGLite y corre las migraciones al arrancar (incluye el corte). Con Neon de producción: **cuidado** — es la base live de Plein.

`npm run typecheck` antes de dar por cerrado un cambio.

## Auth / equipo

Primer admin o `miguelarambulam@gmail.com` reclama staff.  
Módulos: orders, warehouse, contacts, finance, reports, settings.  
Roles: admin, seller, buyer, warehouse.  
Borrar pruebas: Ajustes → Pruebas → escribir `BORRAR` (`wipeLiveTests` protege opening + `CORTE-CHASE` + todo el catálogo — productos, clientes, proveedores, ubicaciones — porque no es actividad de prueba).

## Documentos que hay que leer y mantener

Antes de un bloque nuevo: `HANDOFF.md` (estado y qué se construyó), `AUDITORIA-2026-09-03.md` (hallazgos vigentes, marcados los resueltos). Al cerrar un bloque grande: actualiza `HANDOFF.md` con lo que se hizo y lo que quedó pendiente — no dejes que el próximo chat lea números o rutas viejas (pasó con el corte: quedó documentado mal durante semanas).
