/**
 * Moneda y tipo de cambio en los documentos de compra (peso–dólar, parte A;
 * MODELO-NEGOCIO.md § 1, migración 0050).
 *
 * Plein compra en PESOS y lleva libros en DÓLARES. Todo lo que convierte vive
 * aquí y corre ANTES de que un número entre al costo del lote, al total de la
 * factura del proveedor o al monto del gasto: esas columnas siguen en dólares
 * y el resto del motor no sabe de monedas. Lo nuevo es el registro del
 * original (`*_fx`, en pesos) y del tipo de cambio con que se convirtió.
 *
 * El molde es el motor de Azagro (`src/lib/erp/fx.ts` de ese proyecto),
 * INVERTIDO: allá los libros van en pesos y el dólar es lo extranjero, así
 * que allá se multiplica y aquí se divide.
 *
 *   · `fx` son PESOS POR DÓLAR (17.23). Un TC fuera de 5–50 no es un tipo de
 *     cambio: es un dedazo (172.3) o el inverso (0.058), y se rechaza.
 *   · Un documento en pesos SIN TC no se guarda. Nunca se inventa uno.
 *   · La factura del proveedor se CONGELA al TC pactado de su carga: no se
 *     revalúa, porque `saldo = total − paid` no se toca. Lo que se mueva el
 *     dólar entre pactar y pagar es resultado cambiario (parte B), no un
 *     cambio al documento.
 */
export const CURRENCIES = ["USD", "MXN"] as const;
export type Currency = (typeof CURRENCIES)[number];

/** Pesos por dólar: fuera de este rango no es un tipo de cambio, es un error de captura. */
export const FX_MIN = 5;
export const FX_MAX = 50;

const r2 = (n: number) => Math.round(n * 100) / 100;
const r4 = (n: number) => Math.round(n * 10000) / 10000;

export function asCurrency(v: unknown): Currency {
  return v === "MXN" ? "MXN" : "USD";
}

/** "17,23" (como se escribe en Nogales) y "17.23" son el mismo número; vacío es `undefined`. */
export function parseFx(v: number | string | null | undefined): number | undefined {
  if (v == null || v === "") return undefined;
  const n = Number(typeof v === "string" ? v.trim().replace(",", ".") : v);
  return Number.isFinite(n) ? n : undefined;
}

/** Un tipo de cambio de verdad: número, dentro del rango. `null`, 0 o 1 nunca lo son. */
export function isFx(fx: number | string | null | undefined): fx is number | string {
  const n = parseFx(fx);
  return n != null && n >= FX_MIN && n <= FX_MAX;
}

export function fxError(what: string, fx?: number | string | null): string {
  const n = Number(fx);
  if (fx != null && fx !== "" && Number.isFinite(n) && n > 0)
    return `El tipo de cambio de ${what} (${fx}) no está entre ${FX_MIN} y ${FX_MAX} pesos por dólar. Revisa la captura.`;
  return `${what} está en pesos y no trae tipo de cambio. Captúralo (pesos por dólar) — sin él no se puede convertir a dólares, y no se inventa.`;
}

/**
 * Un monto en la moneda del documento, a lo que se guarda: dólares, y aparte el
 * original en pesos con su TC. En USD el original queda en `null` — no hay
 * nada que registrar. En MXN exige el TC y sin él se detiene.
 */
export function toUsd(i: {
  amount: number | string;
  currency: Currency | string | null | undefined;
  fx?: number | string | null;
  what: string;
}): { usd: number; amount_fx: number | null; fx: number | null; currency: Currency } {
  const amount = Number(i.amount) || 0;
  if (asCurrency(i.currency) === "MXN") {
    if (!isFx(i.fx)) throw new Error(fxError(i.what, i.fx));
    const fx = parseFx(i.fx) as number;
    return { usd: r2(amount / fx), amount_fx: r2(amount), fx, currency: "MXN" };
  }
  return { usd: r2(amount), amount_fx: null, fx: null, currency: "USD" };
}

/** El costo por unidad de una línea de compra, a dólares con cuatro decimales (como vive `lots.unit_cost`). */
export function unitCostToUsd(i: {
  unit_cost: number | string;
  currency: Currency | string | null | undefined;
  fx?: number | string | null;
  what: string;
}): { usd: number; unit_cost_fx: number | null } {
  const unit = Number(i.unit_cost) || 0;
  if (asCurrency(i.currency) === "MXN") {
    if (!isFx(i.fx)) throw new Error(fxError(i.what, i.fx));
    return { usd: r4(unit / (parseFx(i.fx) as number)), unit_cost_fx: r4(unit) };
  }
  return { usd: r4(unit), unit_cost_fx: null };
}

/** Dólares → lo que se enseña en la moneda del documento (para precargar un formulario que se edita en pesos). */
export function usdShownIn(usd: number | string, currency: Currency | string | null | undefined, fx?: number | string | null): number {
  const n = Number(usd) || 0;
  if (asCurrency(currency) === "MXN" && isFx(fx)) return r4(n * (parseFx(fx) as number));
  return n;
}

/**
 * Al re-guardar una línea en pesos, la pantalla manda el precio en pesos que
 * ella misma derivó de los dólares guardados. Si es el mismo número que ya
 * estaba, se conservan los dólares guardados — nunca un ida y vuelta que
 * mueva diezmilésimas. Si cambió, se convierte.
 */
export function snapOrConvertUnitCost(i: {
  sent: number | string;
  prevUsd: number | string | null | undefined;
  /** El original en pesos que ya estaba guardado (`unit_cost_fx`): la comparación exacta. */
  prevOriginal?: number | string | null;
  prevFx: number | string | null | undefined;
  currency: Currency | string | null | undefined;
  fx?: number | string | null;
  what: string;
}): { usd: number; unit_cost_fx: number | null } {
  if (asCurrency(i.currency) !== "MXN") return unitCostToUsd({ unit_cost: i.sent, currency: "USD", what: i.what });
  const sent = Number(i.sent) || 0;
  if (i.prevUsd != null && isFx(i.fx) && isFx(i.prevFx) && parseFx(i.fx) === parseFx(i.prevFx)) {
    // Primero contra el original guardado (exacto); si no lo hay, contra el
    // peso que la pantalla derivó de los dólares.
    const before = i.prevOriginal != null ? Number(i.prevOriginal) : usdShownIn(i.prevUsd, "MXN", i.prevFx);
    if (Math.abs(before - sent) < 0.00005) return { usd: r4(Number(i.prevUsd)), unit_cost_fx: r4(sent) };
  }
  return unitCostToUsd({ unit_cost: sent, currency: "MXN", fx: i.fx, what: i.what });
}

/** "MX$ 242,408.67" — pesos, siempre con su etiqueta, para que nunca se confundan con dólares. */
export function moneyMxn(n: number | string | null | undefined): string {
  const v = Number(n) || 0;
  return `MX$ ${v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** "TC 17.23" con hasta cuatro decimales, sin ceros de relleno. */
export function fxLabel(fx: number | string | null | undefined): string {
  if (!isFx(fx)) return "";
  return `TC ${(parseFx(fx) as number).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 4 })}`;
}

/**
 * Lo que se enseña junto a un monto en dólares cuando el documento nació en
 * pesos: "MX$ 242,408.67 · TC 17.23". Vacío si el documento es en dólares.
 */
export function originalLabel(i: { currency?: string | null; amount_fx?: number | string | null; fx?: number | string | null }): string {
  if (asCurrency(i.currency) !== "MXN" || i.amount_fx == null) return "";
  return `${moneyMxn(i.amount_fx)} · ${fxLabel(i.fx)}`;
}

/**
 * PAGAR EN PESOS UNA DEUDA PACTADA EN PESOS (peso–dólar, parte B; migración 0051).
 *
 * La deuda quedó congelada al TC pactado (`fx_agreed`); al pagar, el banco
 * convierte a SU TC del día (`fx_paid`). Salen de Chase `pesos / fx_paid`
 * dólares y se abonan a la deuda `pesos / fx_agreed`. La diferencia es de
 * Plein, nunca del productor:
 *
 *   fx_result = aplicado − caja      (+ ganancia: salieron menos dólares)
 *
 * El último pago —el que completa los pesos que se deben— abona EXACTAMENTE
 * el saldo en dólares que quedaba, para que el documento cierre en cero y los
 * centavos de redondeo vayan al resultado cambiario en vez de quedarse como
 * un saldo de $0.03 para siempre. Cualquier otro pago se topa a ese saldo.
 */
export function splitFxPayment(i: {
  pesos: number;
  fx_agreed: number | string;
  fx_paid: number | string | null | undefined;
  /** Pesos que aún se deben (total_fx − paid_fx). */
  pesos_pending: number;
  /** Dólares que aún se deben en el documento (total − paid). */
  usd_pending: number;
  what: string;
}): { applied: number; cash: number; fx_result: number; closes: boolean } {
  if (!isFx(i.fx_paid)) throw new Error(fxError(`el pago de ${i.what}`, i.fx_paid));
  if (!isFx(i.fx_agreed)) throw new Error(fxError(i.what, i.fx_agreed));
  const pesos = r2(Number(i.pesos) || 0);
  if (!(pesos > 0)) throw new Error("Captura los pesos que se pagaron.");
  if (pesos > r2(i.pesos_pending) + 0.005)
    throw new Error(`${i.what} debe ${moneyMxn(i.pesos_pending)}; no se le pueden pagar ${moneyMxn(pesos)}.`);
  const closes = pesos >= r2(i.pesos_pending) - 0.005;
  const applied = closes
    ? r2(i.usd_pending)
    : Math.min(r2(pesos / (parseFx(i.fx_agreed) as number)), r2(i.usd_pending));
  const cash = r2(pesos / (parseFx(i.fx_paid) as number));
  return { applied, cash, fx_result: r2(applied - cash), closes };
}
