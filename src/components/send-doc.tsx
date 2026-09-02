import { Check, Copy, Mail, MessageCircle, Printer } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Modal } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/input";
import { COMPANY } from "@/lib/company";
import { downloadDocPdfNow, preloadDocPdf, type DocPdfInput } from "@/lib/doc-pdf";
import { useT } from "@/lib/i18n";
import { recordSend } from "@/lib/produce-server";
import { money } from "@/lib/utils";

export type SendDocItem = { tipo: string; id: number; label: string };
export type SendLine = {
  qty: number;
  unit?: string;
  name: string;
  sku?: string | null;
  unit_price?: number;
  amount?: number;
};
export type SendExtraLink = { label: string; href: string };

export function waDigits(raw: string | null | undefined): string {
  const d = String(raw || "").replace(/\D/g, "");
  if (!d) return "";
  if (d.length >= 11) return d;
  if (d.length === 10 && d.startsWith("55")) return `52${d}`;
  if (d.length === 10) return `1${d}`;
  return d;
}

function buildBody(opts: {
  title: string;
  number: string;
  partyName: string;
  lines: SendLine[];
  total?: number;
  extra?: string;
}) {
  const items = opts.lines
    .slice(0, 12)
    .map((l) => `• ${l.qty} ${l.unit || ""} ${l.name}${l.sku ? ` (${l.sku})` : ""}`.replace(/\s+/g, " ").trim())
    .join("\n");
  const more = opts.lines.length > 12 ? `\n• +${opts.lines.length - 12} más` : "";
  const total = opts.total != null ? `\nTotal: ${money(opts.total)}` : "";
  return [
    `${COMPANY.legalName}`,
    `${opts.title} ${opts.number}`,
    opts.partyName ? `Para: ${opts.partyName}` : "",
    "",
    items + more,
    total,
    opts.extra ? `\n${opts.extra}` : "",
  ]
    .filter((x) => x !== "")
    .join("\n");
}

function openOutside(href: string) {
  const w = window.open(href, "_blank", "noopener,noreferrer");
  if (w) return;
  const a = document.createElement("a");
  a.href = href;
  a.target = "_blank";
  a.rel = "noopener noreferrer";
  document.body.appendChild(a);
  a.click();
  a.remove();
}

export function SendButton({
  title,
  number,
  partyName,
  email,
  phone,
  docs,
  lines = [],
  total,
  extraLinks,
  className,
  size = "sm",
  variant = "outline",
  label,
  pdf,
}: {
  title: string;
  number: string;
  partyName: string;
  email?: string | null;
  phone?: string | null;
  docs: SendDocItem[];
  lines?: SendLine[];
  total?: number;
  extraLinks?: SendExtraLink[];
  className?: string;
  size?: "sm" | "default";
  variant?: "outline" | "default";
  label?: string;
  pdf?: DocPdfInput;
}) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const text = label || t("Send / WhatsApp");
  return (
    <>
      <Button
        size={size}
        variant={variant}
        className={className}
        aria-label={text}
        onClick={() => setOpen(true)}
      >
        <Mail className="size-3.5" />
        {text}
      </Button>
      {open ? (
        <SendDocuments
          title={title}
          number={number}
          partyName={partyName}
          email={email}
          phone={phone}
          docs={docs}
          lines={lines}
          total={total}
          extraLinks={extraLinks}
          pdf={pdf}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </>
  );
}

export function SendDocuments({
  title,
  number,
  partyName,
  email,
  phone,
  docs,
  lines,
  total,
  extraLinks = [],
  pdf,
  onClose,
}: {
  title: string;
  number: string;
  partyName: string;
  email?: string | null;
  phone?: string | null;
  docs: SendDocItem[];
  lines: SendLine[];
  total?: number;
  extraLinks?: SendExtraLink[];
  pdf?: DocPdfInput;
  onClose: () => void;
}) {
  const t = useT();
  const [toEmail, setToEmail] = useState(email || "");
  const [toPhone, setToPhone] = useState(phone || "");
  const [picked, setPicked] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(docs.map((d) => [`${d.tipo}-${d.id}`, true])),
  );
  const [copied, setCopied] = useState(false);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [pdfErr, setPdfErr] = useState("");
  const selected = docs.filter((d) => picked[`${d.tipo}-${d.id}`]);
  const subject = `${title} ${number} — ${COMPANY.legalName}`;
  const body = useMemo(
    () =>
      buildBody({
        title,
        number,
        partyName,
        lines,
        total,
      }),
    [title, number, partyName, lines, total],
  );
  const [note, setNote] = useState(body);
  const canSend = selected.length > 0 || extraLinks.length > 0 || docs.length === 0;

  useEffect(() => {
    void preloadDocPdf();
  }, []);

  function pdfPayload(): DocPdfInput {
    const kind = (title || "").toLowerCase();
    const showPaca = kind.includes("invoice") || kind.includes("factura") || kind.includes("credit");
    return (
      pdf ?? {
        kindLabel: title,
        number,
        partyTitle: "Para",
        party: {
          name: partyName,
          lines: [toEmail.trim() || email || "", toPhone.trim() || phone || ""].filter(Boolean),
        },
        lines: lines.map((l) => ({
          sku: l.sku,
          description: l.name,
          qty: l.qty,
          unit: l.unit,
          unit_price: l.unit_price,
          amount: l.amount,
        })),
        total,
        showPaca,
      }
    );
  }

  function logSend(channel: "email" | "whatsapp", address: string) {
    const first = selected[0] ?? docs[0];
    void recordSend({
      data: {
        channel,
        doc_tipo: first?.tipo,
        doc_id: first?.id,
        doc_number: number,
        party_name: partyName,
        address,
      },
    }).catch(() => {
      /* public /doc has no session — still open mail/WhatsApp */
    });
  }

  function savePdf() {
    if (pdfBusy) return;
    setPdfErr("");
    const payload = pdfPayload();
    if (downloadDocPdfNow(payload)) return;
    setPdfBusy(true);
    void preloadDocPdf()
      .then(() => {
        if (!downloadDocPdfNow(payload)) setPdfErr(t("Could not save the PDF."));
      })
      .catch(() => setPdfErr(t("Could not save the PDF.")))
      .finally(() => setPdfBusy(false));
  }

  function sendEmail() {
    const addr = toEmail.trim();
    if (!addr) return;
    logSend("email", addr);
    openOutside(`mailto:${encodeURIComponent(addr)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(note)}`);
    onClose();
  }

  function sendWhatsApp() {
    const digits = waDigits(toPhone);
    if (!digits) return;
    logSend("whatsapp", digits);
    openOutside(`https://wa.me/${digits}?text=${encodeURIComponent(note)}`);
    onClose();
  }

  async function copyMsg() {
    try {
      await navigator.clipboard.writeText(note);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* ignore */
    }
  }

  return (
    <Modal title={t("Send documents")} subtitle={`${title} ${number} · ${partyName}`} onClose={onClose}>
      <div className="grid gap-3">
        <Field label={t("Email")}>
          <Input
            type="email"
            value={toEmail}
            onChange={(e) => setToEmail(e.target.value)}
            placeholder={t("No email on file — type it")}
          />
        </Field>
        <Field label="WhatsApp">
          <Input value={toPhone} onChange={(e) => setToPhone(e.target.value)} placeholder="520-300-3028" />
        </Field>
      </div>

      {docs.length > 1 ? (
        <>
          <p className="mt-4 mb-2 text-xs font-semibold uppercase tracking-wide text-subtle">{t("Documents")}</p>
          <div className="grid gap-1.5 sm:grid-cols-2">
            {docs.map((d) => {
              const key = `${d.tipo}-${d.id}`;
              return (
                <label key={key} className="flex min-h-10 items-center gap-2 rounded-md border border-border px-3 text-sm">
                  <input
                    type="checkbox"
                    className="size-4 accent-action"
                    checked={!!picked[key]}
                    onChange={(e) => setPicked((p) => ({ ...p, [key]: e.target.checked }))}
                  />
                  {t(d.label)}
                </label>
              );
            })}
          </div>
        </>
      ) : null}

      <Field label={t("Message")} className="mt-4">
        <Textarea value={note} onChange={(e) => setNote(e.target.value)} className="min-h-24 font-mono text-xs" />
      </Field>
      <p className="mt-2 text-xs text-muted">{t("Opens your Outlook or WhatsApp. Print / PDF downloads the file to attach.")}</p>
      {pdfErr ? <p className="mt-1 text-xs text-danger">{pdfErr}</p> : null}

      <div className="mt-5 flex flex-wrap justify-end gap-2">
        <Button variant="outline" onClick={copyMsg}>
          {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
          {copied ? t("Copied") : t("Copy")}
        </Button>
        <Button variant="outline" disabled={pdfBusy} onClick={savePdf}>
          <Printer className="size-3.5" />
          {pdfBusy ? t("Saving PDF…") : t("Print / PDF")}
        </Button>
        <Button variant="outline" disabled={!waDigits(toPhone) || !canSend} onClick={sendWhatsApp}>
          <MessageCircle className="size-3.5" />
          {t("Open WhatsApp")}
        </Button>
        <Button disabled={!toEmail.trim() || !canSend} onClick={sendEmail}>
          <Mail className="size-3.5" />
          {t("Open Outlook")}
        </Button>
      </div>
    </Modal>
  );
}
