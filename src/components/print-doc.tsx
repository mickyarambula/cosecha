import { Link } from "@tanstack/react-router";
import { Printer } from "lucide-react";
import { useEffect, useState } from "react";
import { BrandWordmark } from "@/components/brand";
import { COMPANY } from "@/lib/company";
import { downloadDocPdfNow, fromPrintDoc, preloadDocPdf } from "@/lib/doc-pdf";
import { useT } from "@/lib/i18n";
import type { PrintDoc, PrintParty } from "@/lib/produce-server";
import { fechaDoc, money, qty } from "@/lib/utils";
import { SendButton } from "@/components/send-doc";
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
  const t = useT();
  const [pdfBusy, setPdfBusy] = useState(false);
  const [pdfErr, setPdfErr] = useState("");
  const pdfInput = fromPrintDoc(doc);
  const c = doc.company ?? {
    legal_name: COMPANY.legalName,
    short_name: COMPANY.shortName,
    tagline: COMPANY.tagline,
    city: COMPANY.city,
    country: COMPANY.country,
    email: COMPANY.email,
    phone: COMPANY.phone,
    address_line: COMPANY.addressLine,
    paca_license: COMPANY.pacaLicense,
    paca_notice: COMPANY.pacaNotice,
  };
  const loc = [c.address_line, c.city, c.country].filter(Boolean).join(" · ");

  useEffect(() => {
    void preloadDocPdf();
  }, []);

  function savePdf() {
    if (pdfBusy) return;
    setPdfErr("");
    if (downloadDocPdfNow(pdfInput)) return;
    setPdfBusy(true);
    void preloadDocPdf()
      .then(() => {
        if (!downloadDocPdfNow(pdfInput)) setPdfErr(t("Could not save the PDF."));
      })
      .catch(() => setPdfErr(t("Could not save the PDF.")))
      .finally(() => setPdfBusy(false));
  }

  return (
    <div className="min-h-dvh bg-bg text-fg">
      <div className="doc-toolbar sticky top-0 z-10 flex flex-wrap items-center justify-between gap-3 border-b border-border bg-surface px-4 py-3">
        <Link
          to={doc.tipo === "oc" || doc.tipo === "liq" ? "/compras" : doc.tipo === "factura" ? "/cxc" : doc.tipo === "cuenta" ? "/proveedores" : "/ventas"}
          className="text-sm font-medium text-primary"
        >
          ← {t("Back")}
        </Link>
        <div className="flex items-center gap-2">
          <p className="hidden text-xs text-muted sm:block">
            {pdfErr || t("Downloads the PDF so you can attach it in Outlook or WhatsApp.")}
          </p>
          <SendButton
            title={doc.kindLabel}
            number={doc.number}
            partyName={doc.party.name}
            email={doc.party.email}
            phone={doc.party.phone}
            docs={[{ tipo: doc.tipo, id: doc.id, label: doc.kindLabel }]}
            lines={doc.lines.map((l) => ({
              qty: l.qty,
              unit: l.unit,
              name: l.description,
              sku: l.sku,
              unit_price: l.unit_price,
              amount: l.amount,
            }))}
            total={doc.total}
            pdf={pdfInput}
          />
          <Button size="sm" disabled={pdfBusy} onClick={savePdf}>
            <Printer className="size-4" />
            {pdfBusy ? t("Saving PDF…") : t("Print / PDF")}
          </Button>
        </div>
      </div>

      <article className="doc-sheet mx-auto my-6 w-full max-w-3xl rounded-xl border border-border bg-paper px-8 py-10 sm:px-12">
        <header className="flex flex-wrap items-start justify-between gap-6 border-b-2 border-primary pb-5">
          <div className="flex items-start gap-3">
            <BrandWordmark className="h-12" />
            <div className="pt-1">
              <p className="text-xs text-muted">{c.tagline}</p>
              <p className="text-xs text-muted">{loc}</p>
              {c.email || c.phone ? (
                <p className="text-xs text-muted">
                  {[c.email, c.phone].filter(Boolean).join(" · ")}
                </p>
              ) : null}
              {c.paca_license ? <p className="text-xs text-muted">PACA {c.paca_license}</p> : null}
            </div>
          </div>
          <div className="text-right">
            <p className="font-display text-3xl font-semibold tracking-tight text-primary">{doc.kindLabel}</p>
            <p className="mt-1 font-mono text-sm font-medium">{doc.number}</p>
          </div>
        </header>

        {doc.warning ? (
          <p className="mt-6 rounded-md border border-warn/50 bg-warn/5 p-3 text-sm text-warn">
            {doc.warning}
          </p>
        ) : null}

        <div className="mt-6 grid gap-6 sm:grid-cols-2">
          <PartyBlock title={doc.partyTitle} party={doc.party} />
          {doc.ship && doc.shipTitle ? <PartyBlock title={doc.shipTitle} party={doc.ship} /> : <div />}
        </div>

        <dl className="mt-6 grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-4">
          <div>
            <dt className="text-[10px] font-semibold uppercase tracking-[0.14em] text-subtle">Fecha</dt>
            <dd>{fechaDoc(doc.date)}</dd>
          </div>
          {doc.due ? (
            <div>
              <dt className="text-[10px] font-semibold uppercase tracking-[0.14em] text-subtle">
                {doc.tipo === "oc" ? "ETA" : "Vence"}
              </dt>
              <dd>{fechaDoc(doc.due)}</dd>
            </div>
          ) : null}
          {doc.terms ? (
            <div>
              <dt className="text-[10px] font-semibold uppercase tracking-[0.14em] text-subtle">Términos</dt>
              <dd>{doc.terms}</dd>
            </div>
          ) : null}
          {doc.reference ? (
            <div>
              <dt className="text-[10px] font-semibold uppercase tracking-[0.14em] text-subtle">OC / OV</dt>
              <dd className="font-mono">{doc.reference}</dd>
            </div>
          ) : null}
        </dl>

        <table className="mt-8 w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-border text-left text-[10px] font-semibold uppercase tracking-[0.14em] text-subtle">
              <th className="pb-2 pr-3">Artículo</th>
              <th className="pb-2 pr-3">Descripción</th>
              <th className="pb-2 pr-3 text-right">Cant.</th>
              <th className="pb-2 pr-3 text-right">Precio unit.</th>
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
            <span className="font-medium text-fg">Notas. </span>
            {doc.notes}
          </p>
        ) : null}

        {doc.showPaca ? (
          <p className="mt-8 border-t border-border pt-4 text-[11px] leading-relaxed text-muted">{c.paca_notice || COMPANY.pacaNotice}</p>
        ) : null}

        <footer className="mt-10 text-center text-[11px] text-subtle">
          {c.legal_name} · {c.city}
        </footer>
      </article>
    </div>
  );
}
