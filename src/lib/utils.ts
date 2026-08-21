import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

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
  const s = Math.abs(v).toLocaleString("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
  return (v < 0 ? "−$" : "$") + s;
}

export function qty(value: unknown, unit?: string): string {
  const n = num(value);
  const formatted = n.toLocaleString("en-US", {
    maximumFractionDigits: n % 1 === 0 ? 0 : 2,
  });
  return unit ? `${formatted} ${unit}` : formatted;
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
  return d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

export function fecha(f: string | null | undefined): string {
  if (!f) return "—";
  const d = new Date(String(f).length <= 10 ? `${f}T12:00:00` : f);
  if (Number.isNaN(d.getTime())) return String(f);
  return d.toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "2-digit" });
}

export function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function addDaysISO(iso: string, days: number): string {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function termsDays(terms: string | null | undefined): number {
  const t = String(terms || "").toLowerCase();
  if (t.includes("cod") || t.includes("contado")) return 0;
  const m = t.match(/(\d+)/);
  return m ? Number(m[1]) : 14;
}

export const INSPECCION_TIPOS = ["Ninguna", "Propia", "USDA", "Federal-Estatal", "Privada"] as const;

export const RESULTADOS_REC = ["Aceptada", "Aceptada con incidencia", "Rechazada"] as const;

export const DEFECTOS = {
  calidad: ["Mancha", "Madurez irregular", "Daño mecánico", "Calibre fuera de spec", "Color desigual"],
  condicion: ["Deshidratación", "Pudrición", "Temperatura", "Daño por frío", "Ablandamiento"],
  otro: ["Producto equivocado", "Fuera de ventana", "Sin documentación", "Empaque dañado"],
} as const;

export const CALIDAD_LABEL: Record<string, string> = {
  sano: "Sano",
  retenido: "Retenido",
  castigado: "Castigado",
  destruido: "Destruido",
};

export const DESTINO_TIPO: Record<string, string> = {
  camara: "Cámara",
  bodega: "Bodega",
  empaque: "Empaque",
  cross_dock: "Cross-dock",
};

export const DESTINO_DUENO: Record<string, string> = {
  propia: "Propia",
  cliente: "De cliente",
  proveedor: "De proveedor",
};

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
  const prefix = (productSku.split("-")[0] || "SKU").toUpperCase();
  const empKey = empaque.trim().toLowerCase();
  const empMap: Record<string, string> = {
    carton: "CARTON",
    clamshell: "CLAM",
    "plastic crate": "CRATE",
    crate: "CRATE",
    caja: "CAJA",
  };
  const emp = empMap[empKey] || empaque.replace(/[^a-zA-Z0-9]+/g, "").toUpperCase().slice(0, 10);
  const cal = calibre.replace(/[^a-zA-Z0-9]+/g, "").toUpperCase();
  return `${prefix}-${emp}-${cal}`;
}
