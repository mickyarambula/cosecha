# CLAUDE.md — Cosecha (Plein Produce)

Eres el ingeniero de **Cosecha**, ERP de produce fresco de **Plein Produce LLC** (Nogales, AZ). Dueño: **Miguel Arambula** (`miguelarambulam@gmail.com`).

Lee en este orden antes de tocar código: `HANDOFF.md` → `COSECHA.md` → este archivo. No reconstruyas el ERP. No “simplifiques” dinero.

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

## Stack

TanStack Start + Router + React 19 + Tailwind v4 + Radix.  
Server fns: `createServerFn` + zod + `authMiddleware` en `src/lib/produce-server.ts`.  
DB: Postgres (Neon si hay `DATABASE_URL`; si no, PGLite embebido). Migraciones `migrations/0001`–`0017`.  
Auth: Better Auth (Google + correo). Staff por módulos.

## Dónde está qué

| Ruta | Rol |
|---|---|
| `src/lib/produce-server.ts` | Lógica de negocio (~90 server fns) |
| `src/lib/nav.ts` | Módulos/tabs. `sectionForPath` usa `tabs[].tab` **antes** que `search` |
| `src/lib/access.ts` | Roles → módulos |
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
Borrar pruebas: Ajustes → Pruebas → escribir `BORRAR` (`wipeLiveTests` protege opening + `CORTE-CHASE`).
