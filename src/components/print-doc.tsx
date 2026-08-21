import { Link } from "@tanstack/react-router";
import { Leaf, Printer } from "lucide-react";
import { COMPANY } from "@/lib/company";
import type { PrintDoc, PrintParty } from "@/lib/produce-server";
import { fechaDoc, money, qty } from "@/lib/utils";
import { Button } from "@/components/ui/button";

function PartyBlock({ title, party }: { title: string; party: PrintParty }) {
  return (
    <div>
      <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-subtle">{title}</p>
      <p className="font-medium">{party.name}</p>
      {party.lines.map((line) => (
        <p key={line} className="text-sm text-muted">
          {line}
        </p>
      ))}
    </div>
  );
}

export function PrintDocSheet({ doc }: { doc: PrintDoc }) {
  return (
    <div className="min-h-dvh bg-bg text-fg">
      <div className="doc-toolbar sticky top-0 z-10 flex flex-wrap items-center justify-between gap-3 border-b border-border bg-surface/95 px-4 py-3 backdrop-blur">
        <Link to={doc.tipo === "oc" ? "/compras" : doc.tipo === "ov" ? "/ventas" : "/cxc"} className="text-sm font-medium text-primary">
          ← Volver
        </Link>
        <div className="flex items-center gap-2">
          <p className="hidden text-xs text-muted sm:block">En el diálogo, elige «Guardar como PDF».</p>
          <Button size="sm" onClick={() => window.print()}>
            <Printer className="size-4" />
            Imprimir / PDF
          </Button>
        </div>
      </div>

      <article className="doc-sheet mx-auto my-6 w-full max-w-3xl rounded-xl border border-border bg-paper px-8 py-10 sm:px-12">
        <header className="flex flex-wrap items-start justify-between gap-6 border-b-2 border-primary pb-5">
          <div className="flex items-start gap-3">
            <span className="flex size-10 items-center justify-center rounded-md bg-primary text-primary-fg">
              <Leaf className="size-5" />
            </span>
            <div>
              <p className="font-display text-2xl font-semibold tracking-tight">{COMPANY.legalName}</p>
              <p className="text-xs text-muted">{COMPANY.tagline}</p>
              <p className="text-xs text-muted">
                {COMPANY.city}
                {COMPANY.country ? ` · ${COMPANY.country}` : ""}
              </p>
            </div>
          </div>
          <div className="text-right">
            <p className="font-display text-3xl font-semibold tracking-tight text-primary">{doc.kindLabel}</p>
            <p className="mt-1 font-mono text-sm font-medium">{doc.number}</p>
          </div>
        </header>

        <div className="mt-6 grid gap-6 sm:grid-cols-2">
          <PartyBlock title={doc.partyTitle} party={doc.party} />
          {doc.ship && doc.shipTitle ? <PartyBlock title={doc.shipTitle} party={doc.ship} /> : <div />}
        </div>

        <dl className="mt-6 grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-4">
          <div>
            <dt className="text-[10px] font-semibold uppercase tracking-[0.14em] text-subtle">Date</dt>
            <dd>{fechaDoc(doc.date)}</dd>
          </div>
          {doc.due ? (
            <div>
              <dt className="text-[10px] font-semibold uppercase tracking-[0.14em] text-subtle">
                {doc.tipo === "oc" ? "ETA" : "Due"}
              </dt>
              <dd>{fechaDoc(doc.due)}</dd>
            </div>
          ) : null}
          {doc.terms ? (
            <div>
              <dt className="text-[10px] font-semibold uppercase tracking-[0.14em] text-subtle">Terms</dt>
              <dd>{doc.terms}</dd>
            </div>
          ) : null}
          {doc.reference ? (
            <div>
              <dt className="text-[10px] font-semibold uppercase tracking-[0.14em] text-subtle">PO / SO</dt>
              <dd className="font-mono">{doc.reference}</dd>
            </div>
          ) : null}
        </dl>

        <table className="mt-8 w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-border text-left text-[10px] font-semibold uppercase tracking-[0.14em] text-subtle">
              <th className="pb-2 pr-3">Item</th>
              <th className="pb-2 pr-3">Description</th>
              <th className="pb-2 pr-3 text-right">Qty</th>
              <th className="pb-2 pr-3 text-right">Unit price</th>
              <th className="pb-2 text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {doc.lines.map((line, i) => (
              <tr key={`${line.sku}-${i}`} className="border-b border-border/70">
                <td className="py-2.5 pr-3 font-mono text-xs text-muted">{line.sku || "—"}</td>
                <td className="py-2.5 pr-3">{line.description}</td>
                <td className="py-2.5 pr-3 text-right tabular-nums">{qty(line.qty, line.unit)}</td>
                <td className="py-2.5 pr-3 text-right tabular-nums">{money(line.unit_price)}</td>
                <td className="py-2.5 text-right tabular-nums font-medium">{money(line.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="mt-6 flex justify-end">
          <div className="w-56 space-y-1.5 text-sm">
            <div className="flex justify-between text-muted">
              <span>Subtotal</span>
              <span className="tabular-nums">{money(doc.subtotal)}</span>
            </div>
            <div className="flex justify-between border-t border-primary pt-2 font-display text-lg font-semibold">
              <span>Total</span>
              <span className="tabular-nums">{money(doc.total)}</span>
            </div>
          </div>
        </div>

        {doc.notes ? (
          <p className="mt-8 text-sm text-muted">
            <span className="font-medium text-fg">Notes. </span>
            {doc.notes}
          </p>
        ) : null}

        {doc.showPaca ? (
          <p className="mt-8 border-t border-border pt-4 text-[11px] leading-relaxed text-muted">{COMPANY.pacaNotice}</p>
        ) : null}

        <footer className="mt-10 text-center text-[11px] text-subtle">
          {COMPANY.legalName} · {COMPANY.city}
        </footer>
      </article>
    </div>
  );
}
