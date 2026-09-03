import type { jsPDF } from "jspdf";
import { COMPANY } from "@/lib/company";
import {
  GREEN,
  INK,
  MUTED,
  RULE,
  WARN,
  getPdfEngine,
  safeFilename,
  triggerDownload,
} from "@/lib/doc-pdf";
import type { getBolDoc } from "@/lib/produce-server";
import { convertTemp, convertWeight } from "@/lib/units";
import { fecha, todayISO } from "@/lib/utils";

/**
 * BOL propio de Plein: el documento de embarque que Plein emite al despachar
 * una venta. TODO el peso se imprime en libras — el catálogo mezcla lb y kg
 * (los mangos vienen en kg) y un BOL con unidades mezcladas no lo acepta
 * nadie en el cruce. La conversión vive en lib/units, compartida con la OC.
 */

export type BolDoc = Awaited<ReturnType<typeof getBolDoc>>;

const PAGE_W = 612;
const PAGE_H = 792;
const M = 48;
const CONTENT_W = PAGE_W - M * 2;
const BOTTOM = PAGE_H - 48;

function fmtLb(v: number): string {
  return v.toLocaleString("en-US", { maximumFractionDigits: 1 });
}

/**
 * Set point en las dos unidades ("45–48°F / 7–9°C"), sin importar en cuál se
 * capturó. El convertido se redondea a entero: es una instrucción al operador
 * del thermo, no una medición de laboratorio.
 */
function setPointBoth(
  min: number | null,
  max: number | null,
  unit: string | null,
): string | null {
  if (min == null && max == null) return null;
  const u = unit === "C" ? "C" : "F";
  const other = u === "C" ? "F" : "C";
  const range = (a: number | null, b: number | null) =>
    a != null && b != null && a !== b ? `${a}–${b}` : `${a ?? b}`;
  const conv = (v: number | null) => (v == null ? null : Math.round(convertTemp(v, u, other)));
  const native = `${range(min, max)}°${u}`;
  const converted = `${range(conv(min), conv(max))}°${other}`;
  return u === "F" ? `${native} / ${converted}` : `${converted} / ${native}`;
}

export async function downloadBolPdf(doc: BolDoc): Promise<void> {
  const { JsPDF, wordmark } = await getPdfEngine();
  const pdf = buildBolPdf(JsPDF, doc, wordmark);
  triggerDownload(
    pdf.output("blob"),
    `${safeFilename(doc.shipment.bol_number || `BOL-${doc.shipment.shipment_number}`)}.pdf`,
  );
}

function buildBolPdf(
  JsPDF: typeof import("jspdf").jsPDF,
  doc: BolDoc,
  logo: string | null,
): jsPDF {
  const pdf = new JsPDF({ unit: "pt", format: "letter", compress: true });
  const s = doc.shipment;
  const c = doc.company;
  const legal = c?.legal_name || COMPANY.legalName;
  const city = c?.city || COMPANY.city;
  const country = c?.country || COMPANY.country;
  const email = c?.email || COMPANY.email;
  const phone = c?.phone || COMPANY.phone;
  const address = c?.address_line || COMPANY.addressLine;
  const pacaLicense = c?.paca_license || COMPANY.pacaLicense;

  let y = M;
  const ensure = (need: number) => {
    if (y + need <= BOTTOM) return;
    pdf.addPage();
    y = M;
  };
  const label = (text: string, x: number, at: number) => {
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(7);
    pdf.setTextColor(...MUTED);
    pdf.text(text.toUpperCase(), x, at);
  };
  // Mismo estilo de aviso visible para cualquier mínimo legal que falte —
  // avisa, no bloquea la emisión.
  const warnBox = (text: string) => {
    ensure(34);
    pdf.setDrawColor(...WARN);
    pdf.setLineWidth(0.8);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(8.5);
    pdf.setTextColor(...WARN);
    const warnLines = pdf.splitTextToSize(text, CONTENT_W - 16) as string[];
    const boxH = warnLines.length * 11 + 12;
    pdf.rect(M, y - 4, CONTENT_W, boxH);
    pdf.text(warnLines, M + 8, y + 8);
    y += boxH + 6;
  };

  // ── Encabezado: wordmark izquierda, título y folio derecha ────────────────
  if (logo) {
    try {
      const h = 26;
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
  pdf.setFontSize(15);
  pdf.setTextColor(...GREEN);
  pdf.text("STRAIGHT BILL OF LADING", PAGE_W - M, y + 12, { align: "right" });
  pdf.setFontSize(8.5);
  pdf.setTextColor(...MUTED);
  pdf.text("NOT NEGOTIABLE", PAGE_W - M, y + 24, { align: "right" });
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(11);
  pdf.setTextColor(...INK);
  pdf.text(s.bol_number || "—", PAGE_W - M, y + 40, { align: "right" });
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(9);
  pdf.setTextColor(...MUTED);
  pdf.text(`Fecha: ${fecha(todayISO())}`, PAGE_W - M, y + 53, { align: "right" });

  y += 34;
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(8);
  pdf.setTextColor(...MUTED);
  const meta = [
    [address, city, country].filter(Boolean).join(" · "),
    [email, phone].filter(Boolean).join(" · "),
    pacaLicense ? `PACA ${pacaLicense}` : "",
  ].filter((t) => t && t.trim());
  pdf.text(meta.join("\n"), M, y);
  y += Math.max(30, meta.length * 10 + 8);

  pdf.setDrawColor(...GREEN);
  pdf.setLineWidth(1.6);
  pdf.line(M, y, PAGE_W - M, y);
  y += 18;

  // ── SHIPPER / CONSIGNEE ───────────────────────────────────────────────────
  const colW = (CONTENT_W - 18) / 2;
  const party = (x: number, at: number, title: string, name: string, lines: string[]) => {
    label(title, x, at);
    let py = at + 13;
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(10);
    pdf.setTextColor(...INK);
    const nameLines = pdf.splitTextToSize(name || "—", colW - 8) as string[];
    pdf.text(nameLines, x, py);
    py += nameLines.length * 12;
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(9);
    pdf.setTextColor(...MUTED);
    for (const ln of lines) {
      if (!ln) continue;
      const wrapped = pdf.splitTextToSize(ln, colW - 8) as string[];
      pdf.text(wrapped, x, py);
      py += wrapped.length * 11;
    }
    return py;
  };
  const consigneeLines = [
    s.ship_to_label || "",
    s.ship_to_address || "",
    [s.ship_to_city, s.ship_to_state, s.ship_to_zip].filter(Boolean).join(", "),
  ];
  y = Math.max(
    party(M, y, "Embarcador", legal, [address || "", [city, country].filter(Boolean).join(", "), phone || ""]),
    party(M + colW + 18, y, "Consignatario", s.customer_name, consigneeLines),
  );
  y += 16;

  // Mínimos legales de un bill of lading. "Calle y código postal" se
  // aproxima buscando un dígito en la dirección — "Nogales, Arizona, USA"
  // no lo tiene; una dirección real (número de calle o zip) sí.
  const hasStreetAddress = (text: string | null | undefined) => /\d/.test(text || "");
  const missing: string[] = [];
  if (!s.ship_to_address) missing.push("dirección del consignee (destino de la orden)");
  if (!hasStreetAddress(address)) missing.push("dirección de origen con calle y código postal");
  if (s.pallet_count == null) missing.push("conteo de pallets");
  if (!s.ship_date) missing.push("fecha de embarque");
  if (missing.length) {
    warnBox(`BOL INCOMPLETO — falta capturar: ${missing.join(", ")}.`);
  }

  // ── Referencias y transporte ──────────────────────────────────────────────
  const factRows: Array<Array<[string, string]>> = [
    [
      ["PO del cliente", s.customer_po_number || "—"],
      ["Orden de venta", s.so_number || "—"],
      ["Fecha de embarque", s.ship_date ? fecha(s.ship_date) : "—"],
      ["Hora", s.load_time || "—"],
    ],
    [
      ["Transportista", s.carrier_name || "—"],
      [
        "Camión",
        s.truck_plates
          ? `${s.truck_plates}${s.truck_economic ? ` · Eco ${s.truck_economic}` : ""}`
          : "—",
      ],
      ["Remolque", s.trailer_plates || "—"],
      [
        "Chofer",
        s.driver_name
          ? `${s.driver_name}${s.driver_license ? ` · Lic. ${s.driver_license}` : ""}`
          : "—",
      ],
    ],
  ];
  if (s.seals) factRows.push([["Sellos", s.seals]]);
  for (const row of factRows) {
    ensure(30);
    const fw = CONTENT_W / row.length;
    row.forEach(([lab, value], i) => {
      const x = M + i * fw;
      label(lab, x, y);
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(9.5);
      pdf.setTextColor(...INK);
      const wrapped = pdf.splitTextToSize(value, fw - 12) as string[];
      pdf.text(wrapped, x, y + 12);
    });
    y += 30;
  }
  y += 2;

  // ── Tabla de líneas — peso SIEMPRE en libras ──────────────────────────────
  const qtyW = 70;
  const packW = 120;
  const weightW = 90;
  const descW = CONTENT_W - qtyW - packW - weightW;
  ensure(30);
  label("Cajas", M, y);
  label("Presentación", M + qtyW, y);
  label("Descripción", M + qtyW + packW, y);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(7);
  pdf.setTextColor(...MUTED);
  pdf.text("PESO NETO (LB)", PAGE_W - M, y, { align: "right" });
  y += 6;
  pdf.setDrawColor(...RULE);
  pdf.setLineWidth(0.6);
  pdf.line(M, y, PAGE_W - M, y);
  y += 12;

  let totalCases = 0;
  let totalLb = 0;
  const missingWeight: string[] = [];
  for (const l of doc.lines) {
    const pack = [l.empaque, l.calibre].filter(Boolean).join(" · ") || "—";
    const desc = [l.product_name, l.variety].filter(Boolean).join(" ") + (l.sku_code ? `\n${l.sku_code}` : "");
    const lineLb =
      l.net_weight != null ? convertWeight(l.quantity * l.net_weight, l.weight_unit, "lb") : null;
    totalCases += l.quantity;
    if (lineLb != null) totalLb += lineLb;
    else missingWeight.push([l.product_name, l.calibre].filter(Boolean).join(" · "));

    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(9);
    const descLines = pdf.splitTextToSize(desc, descW - 10) as string[];
    const packLines = pdf.splitTextToSize(pack, packW - 10) as string[];
    const rowH = Math.max(16, Math.max(descLines.length, packLines.length) * 11 + 4);
    ensure(rowH + 6);
    pdf.setTextColor(...INK);
    pdf.text(`${l.quantity.toLocaleString("en-US")} ${l.unit}`, M, y);
    pdf.text(packLines, M + qtyW, y);
    pdf.setTextColor(...MUTED);
    pdf.text(descLines, M + qtyW + packW, y);
    pdf.setTextColor(...INK);
    pdf.text(lineLb != null ? fmtLb(lineLb) : "—", PAGE_W - M, y, { align: "right" });
    y += rowH;
    pdf.setDrawColor(...RULE);
    pdf.setLineWidth(0.4);
    pdf.line(M, y - 6, PAGE_W - M, y - 6);
  }

  // Totales
  ensure(26);
  y += 4;
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(10);
  pdf.setTextColor(...INK);
  pdf.text(
    `Total: ${totalCases.toLocaleString("en-US")} cajas · ${
      s.pallet_count != null ? s.pallet_count : "—"
    } pallets`,
    M,
    y + 4,
  );
  pdf.text(`PESO NETO TOTAL: ${fmtLb(totalLb)} lb`, PAGE_W - M, y + 4, { align: "right" });
  y += 18;

  // Un total callado con líneas sin peso es un total falso: se avisa siempre.
  if (missingWeight.length) {
    warnBox(
      `PESO INCOMPLETO — sin peso neto capturado: ${missingWeight.join(", ")}. El total suma solo las líneas con peso.`,
    );
  }

  // ── Frío ──────────────────────────────────────────────────────────────────
  ensure(64);
  y += 6;
  pdf.setDrawColor(...RULE);
  pdf.setLineWidth(0.6);
  pdf.line(M, y, PAGE_W - M, y);
  y += 14;
  const setPoint = setPointBoth(s.temp_min, s.temp_max, s.temp_unit);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(10);
  pdf.setTextColor(...INK);
  pdf.text(`Punto de ajuste: ${setPoint ?? "no capturado"}`, M, y);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(9);
  pdf.setTextColor(...MUTED);
  pdf.text("Unidad de refrigeración en modo CONTINUO — no ciclado (cycle-sentry).", M, y + 13);
  y += 30;
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(9.5);
  pdf.setTextColor(...INK);
  pdf.text("Temperatura de pulpa al cargar:", M, y);
  const pulpX = M + pdf.getTextWidth("Temperatura de pulpa al cargar:") + 8;
  pdf.setDrawColor(...INK);
  pdf.setLineWidth(0.8);
  pdf.line(pulpX, y + 1, pulpX + 160, y + 1);
  y += 20;

  // ── Leyendas ──────────────────────────────────────────────────────────────
  ensure(30);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(9.5);
  pdf.setTextColor(...INK);
  pdf.text("SHIPPER LOAD AND COUNT", M, y);
  y += 14;

  if (s.notes) {
    ensure(30);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(9);
    pdf.setTextColor(...INK);
    pdf.text("Observaciones", M, y);
    y += 11;
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(9);
    pdf.setTextColor(...MUTED);
    const noteLines = pdf.splitTextToSize(s.notes, CONTENT_W) as string[];
    for (const ln of noteLines) {
      ensure(11);
      pdf.text(ln, M, y);
      y += 11;
    }
    y += 6;
  }

  // ── Firmas ────────────────────────────────────────────────────────────────
  ensure(74);
  y = Math.max(y + 26, Math.min(BOTTOM - 48, y + 26));
  const sigW = (CONTENT_W - 40) / 2;
  const sig = (x: number, title: string, sub: string) => {
    pdf.setDrawColor(...INK);
    pdf.setLineWidth(0.8);
    pdf.line(x, y, x + sigW, y);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(8.5);
    pdf.setTextColor(...INK);
    pdf.text(title, x, y + 12);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(8);
    pdf.setTextColor(...MUTED);
    pdf.text(sub, x, y + 23);
  };
  sig(
    M,
    "Chofer — nombre y firma",
    s.driver_name ? `${s.driver_name}${s.driver_license ? ` · Lic. ${s.driver_license}` : ""}` : " ",
  );
  sig(M + sigW + 40, "Recibido por — nombre, fecha y firma", " ");
  y += 34;

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
