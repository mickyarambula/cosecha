import type { jsPDF } from "jspdf";
import { COMPANY } from "@/lib/company";

export type DocPdfLine = {
  sku?: string | null;
  description: string;
  qty: number;
  unit?: string;
  unit_price?: number;
  amount?: number;
};

export type DocPdfParty = { name: string; lines?: string[] };

export type DocPdfInput = {
  kindLabel: string;
  number: string;
  date?: string | null;
  due?: string | null;
  dueLabel?: string;
  terms?: string | null;
  reference?: string | null;
  partyTitle?: string;
  party: DocPdfParty;
  shipTitle?: string | null;
  ship?: DocPdfParty | null;
  lines: DocPdfLine[];
  subtotal?: number;
  total?: number;
  notes?: string | null;
  showPaca?: boolean;
  company?: {
    legal_name?: string;
    tagline?: string | null;
    city?: string | null;
    country?: string | null;
    email?: string | null;
    phone?: string | null;
    address_line?: string | null;
    paca_license?: string | null;
    paca_notice?: string | null;
  } | null;
};

export const GREEN: [number, number, number] = [27, 107, 76];
export const INK: [number, number, number] = [28, 36, 48];
export const MUTED: [number, number, number] = [91, 101, 115];
export const RULE: [number, number, number] = [210, 216, 224];
export const WARN: [number, number, number] = [180, 83, 9];
const PAGE_W = 612;
const PAGE_H = 792;
const M = 48;
const CONTENT_W = PAGE_W - M * 2;
const BOTTOM = PAGE_H - 40;

let wordmarkData: string | null | undefined;
let jsPdfCtor: typeof import("jspdf").jsPDF | null = null;
let preloadPromise: Promise<void> | null = null;

async function loadWordmark(): Promise<string | null> {
  if (wordmarkData !== undefined) return wordmarkData;
  try {
    const res = await fetch("/brand/wordmark.png");
    if (!res.ok) {
      wordmarkData = null;
      return null;
    }
    const blob = await res.blob();
    wordmarkData = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(blob);
    });
    return wordmarkData;
  } catch {
    wordmarkData = null;
    return null;
  }
}

export function preloadDocPdf(): Promise<void> {
  if (!preloadPromise) {
    preloadPromise = Promise.all([import("jspdf"), loadWordmark()])
      .then(([mod]) => {
        jsPdfCtor = mod.jsPDF ?? mod.default;
      })
      .catch((err) => {
        preloadPromise = null;
        throw err;
      });
  }
  return preloadPromise;
}

function pdfMoney(value: unknown): string {
  const n = typeof value === "number" ? value : Number(value);
  const v = Number.isFinite(n) ? n : 0;
  const abs = Math.abs(v).toFixed(2);
  const [int, dec] = abs.split(".");
  const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `${v < 0 ? "-$" : "$"}${grouped}.${dec}`;
}

function pdfQty(value: unknown, unit?: string): string {
  const n = typeof value === "number" ? value : Number(value);
  const v = Number.isFinite(n) ? n : 0;
  const body = Number.isInteger(v) ? String(v) : v.toFixed(2);
  return unit ? `${body} ${unit}` : body;
}

function pdfDate(raw: string | null | undefined): string {
  if (!raw) return "-";
  const d = new Date(String(raw).length <= 10 ? `${raw}T12:00:00` : raw);
  if (Number.isNaN(d.getTime())) return String(raw);
  const months = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  return `${months[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

export function safeFilename(raw: string): string {
  const cleaned = raw
    .replace(/[^\w.\-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return cleaned || "documento";
}

export function fromPrintDoc(doc: {
  kindLabel: string;
  number: string;
  date: string;
  due: string | null;
  tipo?: string;
  terms: string | null;
  reference: string | null;
  partyTitle: string;
  party: { name: string; lines: string[] };
  shipTitle: string | null;
  ship: { name: string; lines: string[] } | null;
  lines: Array<{
    sku: string;
    description: string;
    qty: number;
    unit: string;
    unit_price: number;
    amount: number;
  }>;
  subtotal: number;
  total: number;
  notes: string | null;
  showPaca: boolean;
  company?: DocPdfInput["company"];
}): DocPdfInput {
  return {
    kindLabel: doc.kindLabel,
    number: doc.number,
    date: doc.date,
    due: doc.due,
    dueLabel: doc.tipo === "oc" ? "ETA" : "Due",
    terms: doc.terms,
    reference: doc.reference,
    partyTitle: doc.partyTitle,
    party: doc.party,
    shipTitle: doc.shipTitle,
    ship: doc.ship,
    lines: doc.lines,
    subtotal: doc.subtotal,
    total: doc.total,
    notes: doc.notes,
    showPaca: doc.showPaca,
    company: doc.company,
  };
}

function inIframe() {
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
}

export function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const framed = inIframe();
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener noreferrer";
  if (framed) a.target = "_blank";
  document.body.appendChild(a);
  a.click();
  a.remove();
  if (framed) {
    window.open(url, "_blank", "noopener,noreferrer");
  }
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

export function downloadDocPdfNow(input: DocPdfInput): boolean {
  if (!jsPdfCtor) return false;
  const pdf = buildPdf(jsPdfCtor, input, wordmarkData ?? null);
  const filename = `${safeFilename(`${input.kindLabel}-${input.number}`)}.pdf`;
  triggerDownload(pdf.output("blob"), filename);
  return true;
}

export async function downloadDocPdf(input: DocPdfInput): Promise<void> {
  if (downloadDocPdfNow(input)) return;
  await preloadDocPdf();
  if (!downloadDocPdfNow(input)) throw new Error("PDF engine failed to load");
}

function buildPdf(
  JsPDF: typeof import("jspdf").jsPDF,
  input: DocPdfInput,
  logo: string | null,
): jsPDF {
  const pdf = new JsPDF({ unit: "pt", format: "letter", compress: true });
  const c = input.company;
  const legal = c?.legal_name || COMPANY.legalName;
  const tagline = c?.tagline || COMPANY.tagline;
  const city = c?.city || COMPANY.city;
  const country = c?.country || COMPANY.country;
  const email = c?.email || COMPANY.email;
  const phone = c?.phone || COMPANY.phone;
  const address = c?.address_line || COMPANY.addressLine;
  const pacaLicense = c?.paca_license || COMPANY.pacaLicense;
  const pacaNotice = c?.paca_notice || COMPANY.pacaNotice;
  const loc = [address, city, country].filter(Boolean).join(" · ");

  let y = M;

  const ensure = (need: number) => {
    if (y + need <= BOTTOM) return;
    pdf.addPage();
    y = M;
  };

  if (logo) {
    try {
      const h = 28;
      const w = (700 / 213) * h;
      pdf.addImage(logo, "PNG", M, y, w, h, undefined, "FAST");
    } catch {
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(14);
      pdf.setTextColor(...GREEN);
      pdf.text(legal, M, y + 16);
    }
  } else {
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(14);
    pdf.setTextColor(...GREEN);
    pdf.text(legal, M, y + 16);
  }

  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(22);
  pdf.setTextColor(...GREEN);
  pdf.text(input.kindLabel, PAGE_W - M, y + 14, { align: "right" });
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(10);
  pdf.setTextColor(...INK);
  pdf.text(input.number, PAGE_W - M, y + 30, { align: "right" });

  y += 38;
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(8);
  pdf.setTextColor(...MUTED);
  const meta = [
    tagline,
    loc,
    [email, phone].filter(Boolean).join(" · "),
    pacaLicense ? `PACA ${pacaLicense}` : "",
  ]
    .filter((s) => s && s.trim())
    .join("\n");
  const metaLines = pdf.splitTextToSize(meta, 280) as string[];
  pdf.text(metaLines, M, y);
  y += Math.max(36, metaLines.length * 11 + 8);

  pdf.setDrawColor(...GREEN);
  pdf.setLineWidth(1.6);
  pdf.line(M, y, PAGE_W - M, y);
  y += 18;

  const colW = (CONTENT_W - 18) / 2;
  const partyY = y;
  y = Math.max(
    drawParty(pdf, M, partyY, input.partyTitle || "Bill to", input.party),
    input.ship && input.shipTitle
      ? drawParty(pdf, M + colW + 18, partyY, input.shipTitle, input.ship)
      : partyY,
  );
  y += 14;

  const facts: Array<[string, string]> = [
    ["Date", pdfDate(input.date)],
    input.due ? [input.dueLabel || "Due", pdfDate(input.due)] : null,
    input.terms ? ["Terms", input.terms] : null,
    input.reference ? ["PO / SO", input.reference] : null,
  ].filter((x): x is [string, string] => Boolean(x));
  if (facts.length) {
    const fw = CONTENT_W / facts.length;
    facts.forEach(([label, value], i) => {
      const x = M + i * fw;
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(7);
      pdf.setTextColor(...MUTED);
      pdf.text(label.toUpperCase(), x, y);
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(10);
      pdf.setTextColor(...INK);
      pdf.text(value, x, y + 13);
    });
    y += 28;
  }

  const hasPrice =
    input.lines.some((l) => l.unit_price != null || l.amount != null) || input.total != null;
  const skuW = 78;
  const qtyW = 64;
  const priceW = hasPrice ? 72 : 0;
  const amtW = hasPrice ? 72 : 0;
  const descW = CONTENT_W - skuW - qtyW - priceW - amtW;

  ensure(36);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(7);
  pdf.setTextColor(...MUTED);
  const headY = y;
  pdf.text("ITEM", M, headY);
  pdf.text("DESCRIPTION", M + skuW, headY);
  pdf.text("QTY", M + skuW + descW + qtyW, headY, { align: "right" });
  if (hasPrice) {
    pdf.text("UNIT PRICE", M + skuW + descW + qtyW + priceW, headY, { align: "right" });
    pdf.text("TOTAL", PAGE_W - M, headY, { align: "right" });
  }
  y += 6;
  pdf.setDrawColor(...RULE);
  pdf.setLineWidth(0.6);
  pdf.line(M, y, PAGE_W - M, y);
  y += 12;

  if (!input.lines.length) {
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(9);
    pdf.setTextColor(...MUTED);
    pdf.text("-", M, y);
    y += 16;
  }

  for (const line of input.lines) {
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(9);
    const descLines = pdf.splitTextToSize(line.description || "-", descW - 8) as string[];
    const rowH = Math.max(16, descLines.length * 12);
    ensure(rowH + 8);
    pdf.setTextColor(...MUTED);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(8);
    pdf.text(line.sku || "-", M, y);
    pdf.setTextColor(...INK);
    pdf.setFontSize(9);
    pdf.text(descLines, M + skuW, y);
    pdf.text(pdfQty(line.qty, line.unit), M + skuW + descW + qtyW, y, { align: "right" });
    if (hasPrice) {
      pdf.text(
        line.unit_price != null ? pdfMoney(line.unit_price) : "-",
        M + skuW + descW + qtyW + priceW,
        y,
        {
          align: "right",
        },
      );
      pdf.text(line.amount != null ? pdfMoney(line.amount) : "-", PAGE_W - M, y, {
        align: "right",
      });
    }
    y += rowH;
    pdf.setDrawColor(...RULE);
    pdf.setLineWidth(0.4);
    pdf.line(M, y - 6, PAGE_W - M, y - 6);
  }

  if (input.subtotal != null || input.total != null) {
    ensure(48);
    y += 8;
    const boxX = PAGE_W - M - 170;
    if (input.subtotal != null) {
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(9);
      pdf.setTextColor(...MUTED);
      pdf.text("Subtotal", boxX, y);
      pdf.text(pdfMoney(input.subtotal), PAGE_W - M, y, { align: "right" });
      y += 16;
    }
    pdf.setDrawColor(...GREEN);
    pdf.setLineWidth(1);
    pdf.line(boxX, y - 6, PAGE_W - M, y - 6);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(12);
    pdf.setTextColor(...INK);
    pdf.text("Total", boxX, y + 10);
    pdf.text(pdfMoney(input.total ?? input.subtotal ?? 0), PAGE_W - M, y + 10, { align: "right" });
    y += 28;
  }

  if (input.notes) {
    ensure(40);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(9);
    pdf.setTextColor(...INK);
    pdf.text("Notes", M, y);
    y += 12;
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(9);
    pdf.setTextColor(...MUTED);
    const noteLines = pdf.splitTextToSize(input.notes, CONTENT_W) as string[];
    for (const ln of noteLines) {
      ensure(12);
      pdf.text(ln, M, y);
      y += 12;
    }
    y += 8;
  }

  if (input.showPaca && pacaNotice) {
    ensure(60);
    pdf.setDrawColor(...RULE);
    pdf.setLineWidth(0.6);
    pdf.line(M, y, PAGE_W - M, y);
    y += 12;
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(7.5);
    pdf.setTextColor(...MUTED);
    const pacaLines = pdf.splitTextToSize(pacaNotice, CONTENT_W) as string[];
    for (const ln of pacaLines) {
      ensure(10);
      pdf.text(ln, M, y);
      y += 10;
    }
  }

  const pages = pdf.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    pdf.setPage(i);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(8);
    pdf.setTextColor(...MUTED);
    pdf.text(`${legal} · ${city}`, PAGE_W / 2, PAGE_H - 22, { align: "center" });
  }

  return pdf;
}

function drawParty(pdf: jsPDF, x: number, y: number, title: string, party: DocPdfParty): number {
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(7);
  pdf.setTextColor(...MUTED);
  pdf.text(title.toUpperCase(), x, y);
  y += 12;
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(10);
  pdf.setTextColor(...INK);
  const nameLines = pdf.splitTextToSize(party.name || "-", 230) as string[];
  pdf.text(nameLines, x, y);
  y += nameLines.length * 12;
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(9);
  pdf.setTextColor(...MUTED);
  for (const line of party.lines || []) {
    if (!line) continue;
    const wrapped = pdf.splitTextToSize(line, 230) as string[];
    pdf.text(wrapped, x, y);
    y += wrapped.length * 11;
  }
  return y;
}
