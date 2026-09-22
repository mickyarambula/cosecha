import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { dateLocaleTag } from "@/lib/prefs";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function num(value: unknown): number {
  if (value == null || value === "") return 0;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : 0;
}

export function money(value: unknown, digits = 2): string {
  const v = num(value);
  const s = Math.abs(v).toLocaleString(dateLocaleTag(), {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
  return (v < 0 ? "−$" : "$") + s;
}

export function qty(value: unknown, unit?: string): string {
  const n = num(value);
  const formatted = n.toLocaleString(dateLocaleTag(), {
    maximumFractionDigits: n % 1 === 0 ? 0 : 2,
  });
  return unit ? `${formatted} ${unit}` : formatted;
}

export function pct(value: unknown, digits = 1): string {
  const v = num(value);
  return `${v.toFixed(digits)}%`;
}

export function daysUntil(dateStr: string | null | undefined): number | null {
  if (!dateStr) return null;
  const d = new Date(`${dateStr}T00:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((d.getTime() - today.getTime()) / 86400000);
}

export function fechaDoc(f: string | null | undefined): string {
  if (!f) return "—";
  const d = new Date(String(f).length <= 10 ? `${f}T12:00:00` : f);
  if (Number.isNaN(d.getTime())) return String(f);
  return d.toLocaleDateString(dateLocaleTag(), { month: "long", day: "numeric", year: "numeric" });
}

export function fecha(f: string | null | undefined): string {
  if (!f) return "—";
  const d = new Date(String(f).length <= 10 ? `${f}T12:00:00` : f);
  if (Number.isNaN(d.getTime())) return String(f);
  return d.toLocaleDateString(dateLocaleTag(), {
    month: "numeric",
    day: "2-digit",
    year: "numeric",
  });
}

export function fechaLong(f: string | null | undefined): string {
  if (!f) return "—";
  const d = new Date(String(f).length <= 10 ? `${f}T12:00:00` : f);
  if (Number.isNaN(d.getTime())) return String(f);
  return d.toLocaleDateString(dateLocaleTag(), { month: "short", day: "numeric", year: "numeric" });
}

/**
 * Zona horaria del negocio. Plein vende desde Nogales, AZ y compra en Nogales,
 * Sonora: las dos están en UTC-7 todo el año (Arizona no mueve el reloj y
 * Sonora dejó de moverlo en 2022). El servidor corre en UTC, así que sin esto
 * todo lo que se captura después de las 5 de la tarde nace fechado al día
 * siguiente — folios de lote y de CPO incluidos.
 */
export const BUSINESS_TZ = "America/Phoenix";

const NOGALES_YMD = (() => {
  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: BUSINESS_TZ,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
  } catch {
    // Un runtime sin datos de zonas horarias: mejor la hora local que nada.
    return null;
  }
})();

/** Hoy en Nogales, `YYYY-MM-DD`. Da lo mismo en el servidor y en el navegador. */
export function todayISO(): string {
  if (NOGALES_YMD) {
    const parts = NOGALES_YMD.formatToParts(new Date());
    const get = (t: string) => parts.find((x) => x.type === t)?.value ?? "";
    const [y, m, d] = [get("year"), get("month"), get("day")];
    if (y && m && d) return `${y}-${m}-${d}`;
  }
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** `YYMM` de hoy en Nogales — la parte de fecha de los folios (`LOT-2609-`, `CPO-2609-`). */
export function todayYYMM(): string {
  const iso = todayISO();
  return `${iso.slice(2, 4)}${iso.slice(5, 7)}`;
}

export function addDaysISO(iso: string, days: number): string {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/**
 * Días de plazo de un texto como "Net 21", "COD" o "Contado".
 * `null` cuando no dice nada: sin plazo capturado el vencimiento va **en
 * blanco**, no inventado. Antes devolvía 14 días de la nada, y del lado
 * proveedor el código ni siquiera preguntaba — se vencía a 7 (hallazgo 51).
 */
export function termsDays(terms: string | null | undefined): number | null {
  const t = String(terms || "").trim().toLowerCase();
  if (!t) return null;
  if (t.includes("cod") || t.includes("contado")) return 0;
  const m = t.match(/(\d+)/);
  return m ? Number(m[1]) : null;
}

/** El vencimiento que corresponde a una emisión y un plazo; `null` sin plazo. */
export function dueFromTerms(
  issueISO: string,
  terms: string | null | undefined,
): string | null {
  const d = termsDays(terms);
  return d === null ? null : addDaysISO(issueISO, d);
}

/**
 * Antigüedad por **fecha compromiso**, que es la que decide cuándo pagar y
 * cuándo cobrar. Un documento sin vencimiento capturado cae en `no_terms`: ni
 * corriente ni vencido — falta el dato, y esconderlo en "corriente" es lo que
 * hacía que un gasto se viera al corriente para siempre.
 */
export function agingByDue(
  dueDate: string | null | undefined,
  asOf = todayISO(),
): "no_terms" | "current" | "b30" | "b60" | "b90" | "b91" {
  if (!dueDate) return "no_terms";
  return aging30(dueDate, asOf);
}

export const AGING_BUCKETS = ["current", "b30", "b60", "b90", "b91", "no_terms"] as const;
export type AgingBucket = (typeof AGING_BUCKETS)[number];
export const AGING_LABEL: Record<AgingBucket, string> = {
  current: "Current",
  b30: "1-30",
  b60: "31-60",
  b90: "61-90",
  b91: "91+",
  no_terms: "No terms",
};
export const emptyAging = (): Record<AgingBucket, number> => ({
  current: 0,
  b30: 0,
  b60: 0,
  b90: 0,
  b91: 0,
  no_terms: 0,
});

export const INSPECCION_TIPOS = [
  "Ninguna",
  "Propia",
  "USDA",
  "Federal-Estatal",
  "Privada",
] as const;

export const RESULTADOS_REC = ["Aceptada", "Aceptada con incidencia", "Rechazada"] as const;

export const DEFECTOS = {
  calidad: [
    "Mancha",
    "Madurez irregular",
    "Daño mecánico",
    "Calibre fuera de spec",
    "Color desigual",
  ],
  condicion: ["Deshidratación", "Pudrición", "Temperatura", "Daño por frío", "Ablandamiento"],
  otro: ["Producto equivocado", "Fuera de ventana", "Sin documentación", "Empaque dañado"],
} as const;

export const CALIDAD_LABEL: Record<string, string> = {
  sano: "Sound",
  retenido: "Hold",
  castigado: "Culled",
  destruido: "Destroyed",
};

export const DESTINO_TIPO: Record<string, string> = {
  camara: "Cooler",
  bodega: "Warehouse",
  empaque: "Packing",
  cross_dock: "Cross-dock",
};

export const DESTINO_DUENO: Record<string, string> = {
  propia: "Owned",
  tercero: "Third party",
  cliente: "Customer",
  grower: "Grower",
};

export const GASTO_CATEGORIAS = [
  "Freight",
  "Inspection Services",
  "Quality Control",
  "Advertising",
  "Commissions and fees",
  "Cost of Labor",
  "Disposal fees",
  "Dues & Subscriptions",
  "Equipment",
  "Boxes",
  "Supplies",
  "Insurance",
  "Legal & Professional fees",
  "Maintenance & Repairs",
  "Materials",
  "Utilities",
] as const;

export const PAY_METHODS = ["ACH", "Check", "Cash", "Credit card", "Wire"] as const;

/**
 * Tramos cortos (7/14/21 días) sobre la fecha que se le pase — hoy siempre la
 * **fecha compromiso**. Un nulo cae en "current" por comodidad del llamador;
 * quien quiera separar "sin plazo" usa `agingByDue`, que lo dice aparte.
 */
export function agingBucket(
  dueDate: string | null | undefined,
  asOf = todayISO(),
): "current" | "d1" | "d8" | "d15" | "d22" {
  if (!dueDate) return "current";
  const days = Math.round(
    (new Date(`${asOf}T12:00:00`).getTime() - new Date(`${dueDate}T12:00:00`).getTime()) /
      86400000,
  );
  if (days <= 0) return "current";
  if (days <= 7) return "d1";
  if (days <= 14) return "d8";
  if (days <= 21) return "d15";
  return "d22";
}

export function aging30(
  issueDate: string | null | undefined,
  asOf = todayISO(),
): "current" | "b30" | "b60" | "b90" | "b91" {
  if (!issueDate) return "current";
  const days = Math.round(
    (new Date(`${asOf}T12:00:00`).getTime() - new Date(`${issueDate}T12:00:00`).getTime()) /
      86400000,
  );
  if (days <= 0) return "current";
  if (days <= 30) return "b30";
  if (days <= 60) return "b60";
  if (days <= 90) return "b90";
  return "b91";
}

// Catálogo en español: el valor se guarda tal cual (mismo patrón que
// RESULTADOS_REC) y termina impreso en el account of sales del productor —
// no pasa por t(). No se reescriben los renglones ya guardados en inglés.
export const WASTE_REASONS = [
  "Baja por calidad",
  "Donación",
  "Ajuste de inventario",
  "Reempaque",
  "Muestra",
  "Otro",
] as const;

export function skuLabel(s: {
  sku_code?: string | null;
  sku?: string | null;
  product_name?: string | null;
  name?: string | null;
  variety?: string | null;
  empaque?: string | null;
  calibre?: string | null;
}): string {
  const code = s.sku_code || s.sku || "";
  const name = [s.product_name || s.name, s.variety].filter(Boolean).join(" ");
  const spec = [s.empaque, s.calibre].filter(Boolean).join(" · ");
  return [code, name, spec].filter(Boolean).join(" · ");
}

export function skuCodeOf(productSku: string, empaque: string, calibre: string): string {
  const prefix =
    (productSku || "SKU")
      .trim()
      .replace(/[^a-zA-Z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .toUpperCase() || "SKU";
  const empKey = empaque.trim().toLowerCase();
  const empMap: Record<string, string> = {
    carton: "CARTON",
    clamshell: "CLAM",
    "plastic crate": "CRATE",
    crate: "CRATE",
    caja: "CAJA",
    bolsa: "BOLSA",
    saco: "SACO",
    bin: "BIN",
    manojo: "MANOJO",
  };
  const emp =
    empMap[empKey] ||
    empaque
      .replace(/[^a-zA-Z0-9]+/g, "")
      .toUpperCase()
      .slice(0, 10);
  const cal = calibre.replace(/[^a-zA-Z0-9]+/g, "").toUpperCase();
  return `${prefix}-${emp}-${cal}`;
}

/**
 * Turns a thrown server-function error into a message the user can act on,
 * and logs the real one to the console for whoever is debugging.
 *
 * "Unauthorized" is the literal message of `UnauthorizedError`
 * (src/lib/auth/verify.server.ts) — a stable contract, so we can translate it
 * instead of showing the English string to the user.
 */
export function errorMessage(e: unknown, fallback = "No se pudo guardar."): string {
  console.error("[cosecha]", e);
  const raw = e instanceof Error ? e.message : typeof e === "string" ? e : "";
  if (raw === "Unauthorized") {
    return "Tu sesión no se reconoció en el servidor. Vuelve a entrar y reintenta.";
  }
  if (raw.toLowerCase().includes("cross-site")) {
    return "La petición se bloqueó por seguridad. Recarga la página y reintenta.";
  }
  if (raw.toLowerCase().includes("failed to fetch") || raw.toLowerCase().includes("networkerror")) {
    return "No se pudo contactar al servidor. Revisa la conexión y reintenta.";
  }
  return raw || fallback;
}

// ── Embarques (Fase C aduanal) ──────────────────────────────────────────────

/**
 * Single source of truth for shipment statuses per type — the DB stores
 * status as free text with no constraint, so THIS map is the lock. The modal
 * select, the /embarques inline select and the server-side validation all
 * read from here; 'cruzado' only exists for entradas (a salida is domestic
 * freight — it never crosses the border).
 */
export const SHIPMENT_STATUSES = {
  entrada: ["pendiente", "en_transito", "cruzado", "entregado"],
  salida: ["pendiente", "en_transito", "entregado"],
} as const;

export const SHIPMENT_STATUS_LABEL: Record<string, string> = {
  pendiente: "Pendiente",
  en_transito: "En tránsito",
  cruzado: "Cruzado",
  entregado: "Entregado",
};

/**
 * Temperature ALWAYS carries its unit — 45–48 °F and 7 °C coexist in the same
 * list and a bare number is meaningless. No conversion: shown as captured.
 */
export function formatTempRange(
  min: number | null | undefined,
  max: number | null | undefined,
  unit: string | null | undefined,
): string {
  if (min == null && max == null) return "—";
  const u = unit === "C" ? "°C" : unit === "F" ? "°F" : unit || "";
  if (min != null && max != null && min !== max) return `${min}–${max} ${u}`.trim();
  return `${min ?? max} ${u}`.trim();
}
