# Handoff — Cosecha → Claude

**Fecha:** 27 Ago 2026  
**Dueño:** Miguel Arambula · Plein Produce LLC · Nogales, AZ  
**Producto:** Cosecha (ERP). Membrete de documentos: Plein Produce LLC.

Este archivo es el estado de la conversación. El código está en GitHub. Juntos son la base.

## GitHub (el desarrollo entero)

| Repo | Visibilidad | Usar para Claude |
|---|---|---|
| https://github.com/mickyarambula/cosecha | **Privado** | **Sí — este** |
| https://github.com/mickyarambula/erppleinproduce | Privado (mismo código, nombre viejo) | No hace falta |

Commit de corte + PDF + auth: `9ad090c` (22 Ago 2026). Rama `main`.

Clone:

```bash
git clone https://github.com/mickyarambula/cosecha.git
cd cosecha
npm install
npm run dev
```

Repo privado: Claude Code necesita GitHub login de `mickyarambula`.

## Qué está hecho y vivo

- Catálogo Plein (SKU = producto × empaque × calibre). Contrapartes duales (Papayas, Carrifoods, etc.).
- CPO → OV → OC → recepción PACA → lote. Ship → factura. Bill desde OC.
- Liquidación PAS, merma, hold/cierre, portal vendor.
- CxC / CxP / gastos / tesorería / conciliación Chase / P&L / Balance / trial.
- Corte apertura **2026-06-30** desde libros V8 Drive (Ingresos/Egresos/Chase), **no Cargas**.
- PDF descargable (jspdf) + Outlook + WhatsApp. La app **no** envía el correo.
- Auth Google + correo. Staff y módulos. Ajustes → Pruebas para borrar tests.
- App **publicada** (Vercel) para que Miguel y socios prueben. Lo live se borra con Pruebas; el corte no.

## Corte (números sagrados)

- AR opening `$673,014.43` — 50 facturas `invoice_type=opening` (fuera del P&L)
- AP opening `$564,670.16` — 52 bills **sin PO**
- Chase `$19,066.20` folio `CORTE-CHASE` — **no replay** de historia
- JEAMS `$23,030.33` GL `20250`
- Equity plug `$104,380.14` GL `30000`
- Chase operativo desde **19 Ago 2026**. Folio **430** no aplicado.
- Programada (PX-72775 / PX-72868) **fuera**.
- Papayas & More: cliente y proveedor, **no netear**.

GL: `16000` JP Morgan Chase, `12000` AR, `20100` AP.

## Decisiones de producto (no “mejorarlas”)

1. Libros = V8 Drive, no Cargas.
2. Enviar documentos = como el ERP viejo: usuario descarga PDF y lo pega en Outlook/WhatsApp.
3. Cri International: el correo del catálogo puede ir vacío; se escribe a mano. El teléfono sí está.
4. P&L en ceros es correcto hasta que haya ventas live (opening no es revenue).
5. Nav Reportes: tabs Financial usan `search.tab=pl` para no saltar al chrome de Sales.
6. Wordmark del login: PNG transparente, sin caja blanca.
7. Miguel habla producto, no ingeniería. No le muestres puertos ni diffs enormes.

## Huecos conocidos (no son bugs de “arranque”)

- Email de algunos clientes (Cri) vacío en `0014_plein_catalog.sql`.
- Chase histórico no se importa a propósito.
- Preview embebido (iframe) bloquea WhatsApp/`window.print`; por eso PDF = descarga. En la app publicada funciona mejor.

## Cómo seguir (primer mensaje para Claude)

Pega esto en Claude Code / Claude.ai (con el repo abierto):

```
Clona o abre github.com/mickyarambula/cosecha (privado).
Lee HANDOFF.md, COSECHA.md y CLAUDE.md.
Eres el ingeniero de Cosecha (Plein Produce, Miguel). No reconstruyas. No publiques. No toques corte ni CORTE-CHASE.
Habla español de producto.
Lo que quiero ahora: [Miguel escribe la tarea]
```

## Si Miguel usa Claude.ai (chat, no Code)

1. Conectar GitHub a Claude y agregar el repo **privado** `mickyarambula/cosecha`.
2. O Project → pegar `HANDOFF.md` + `COSECHA.md` + `CLAUDE.md` y decirle que el código está en ese repo.
3. No subas un zip a un Project público. Hay CxC/CxP reales.

Claude Code es el camino correcto: clona, edita, corre, commit.
