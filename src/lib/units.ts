/**
 * Conversión de unidades compartida. Vive aquí — no en una pantalla — porque
 * más de un lugar la necesita: el BOL imprime todo en libras aunque el catálogo
 * mezcle lb y kg (128 SKUs en lb, 19 en kg), y el total de peso de la OC debe
 * sumar convirtiendo en vez de sumar números en unidades distintas en crudo.
 */

export const KG_TO_LB = 2.20462;

/**
 * Convierte un peso entre lb y kg. Una unidad desconocida regresa el valor tal
 * cual (mismo criterio laxo que convertTemp): en la base weight_unit es
 * not null con default, así que en la práctica solo llegan 'lb' y 'kg'.
 */
export function convertWeight(value: number, from: string, to: string): number {
  const f = (from || "").toLowerCase();
  const t = (to || "").toLowerCase();
  if (f === t) return value;
  if (f === "kg" && t === "lb") return value * KG_TO_LB;
  if (f === "lb" && t === "kg") return value / KG_TO_LB;
  return value;
}

/** Convierte °F ↔ °C. Extraída de compras.tsx sin cambio de comportamiento. */
export function convertTemp(value: number, from: string, to: string): number {
  if (from === to) return value;
  return from === "C" ? (value * 9) / 5 + 32 : ((value - 32) * 5) / 9;
}
