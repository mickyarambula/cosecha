import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";

// LÍMITE DE LA API (structured outputs): máximo 16 campos con tipos unión
// (nullable/anyOf) en todo el esquema — pasarse da un 400 invalid_request_error
// ("Schemas contains too many parameters with union types"). Eso tumbó la
// lectura en producción cuando el esquema creció a 17 nullables al agregar
// domicilio y condiciones de pago. Por eso los TEXTOS aquí son string a secas
// ("" = no aparece en el documento; normalizeExtraction los vuelve null) y
// solo los NÚMEROS siguen siendo nullable ("" no es un número). Hoy: 2 de 16.
const ExtractionSchema = z.object({
  readable: z.boolean(),
  reason: z.string(),
  customer_name: z.string(),
  customer_po_number: z.string(),
  po_date: z.string(),
  requested_date: z.string(),
  currency: z.string(),
  payment_terms: z.string(),
  ship_to_address_line: z.string(),
  ship_to_city: z.string(),
  ship_to_state: z.string(),
  ship_to_zip: z.string(),
  notes: z.string(),
  lines: z.array(
    z.object({
      sku: z.string(),
      product_name: z.string(),
      quantity: z.number().nullable(),
      unit: z.string(),
      unit_price: z.number().nullable(),
    }),
  ),
});

type RawExtraction = z.infer<typeof ExtractionSchema>;

/** "" desde el modelo significa "no aparece en el documento" → null. */
const emptyToNull = (v: string): string | null => {
  const t = v.trim();
  return t ? t : null;
};

function normalizeExtraction(raw: RawExtraction) {
  return {
    readable: raw.readable,
    reason: emptyToNull(raw.reason),
    customer_name: emptyToNull(raw.customer_name),
    customer_po_number: emptyToNull(raw.customer_po_number),
    po_date: emptyToNull(raw.po_date),
    requested_date: emptyToNull(raw.requested_date),
    currency: emptyToNull(raw.currency),
    payment_terms: emptyToNull(raw.payment_terms),
    ship_to_address_line: emptyToNull(raw.ship_to_address_line),
    ship_to_city: emptyToNull(raw.ship_to_city),
    ship_to_state: emptyToNull(raw.ship_to_state),
    ship_to_zip: emptyToNull(raw.ship_to_zip),
    notes: emptyToNull(raw.notes),
    lines: raw.lines.map((line) => ({
      sku: emptyToNull(line.sku),
      product_name: emptyToNull(line.product_name),
      quantity: line.quantity,
      unit: emptyToNull(line.unit),
      unit_price: line.unit_price,
    })),
  };
}

type Extraction = ReturnType<typeof normalizeExtraction>;

const SYSTEM_PROMPT = `Lees órdenes de compra (PO) que clientes de una empresa de produce fresco (frutas y verduras) envían por fax, PDF o foto.
Extrae únicamente lo que el documento diga literalmente. Nunca inventes ni asumas un valor que no esté escrito.
Si un dato de texto no aparece en el documento, déjalo como cadena vacía "" — no lo adivines. Si una cantidad o precio no aparece, usa null.
Fechas en formato ISO yyyy-mm-dd. Si el documento no trae año, asume el año actual.
Si el documento no es legible o no parece un PO, marca readable=false y explica por qué en "reason".
"unit" es la unidad de empaque (ej. caja, box, carton, bin, lb, kg) tal como aparece o se infiere del contexto — "" si no es claro.
"payment_terms" son las condiciones de pago tal como aparecen (ej. "Net 21", "COD", "Net 30") — "" si no se mencionan.
"ship_to_*" son los datos del domicilio de entrega (SHIP TO), separados de cualquier domicilio de facturación (BILL TO) — "" si el documento no trae uno.`;

export type ExtractResult =
  | { ok: true; data: Extraction }
  | { ok: false; reason: string };

export async function extractCustomerPOFile(
  buf: Buffer,
  mime: string,
  filename: string,
): Promise<ExtractResult> {
  if (!process.env.ANTHROPIC_API_KEY) {
    return { ok: false, reason: "La lectura automática no está configurada (falta ANTHROPIC_API_KEY)." };
  }
  const supportedImage = mime === "image/png" || mime === "image/jpeg" || mime === "image/webp";
  const supportedDoc = mime === "application/pdf";
  if (!supportedImage && !supportedDoc) {
    return { ok: false, reason: `Formato "${mime || filename}" no soportado — sube un PDF o una foto (PNG/JPG).` };
  }

  const client = new Anthropic();
  const base64 = buf.toString("base64");
  const fileBlock: Anthropic.Messages.ContentBlockParam = supportedDoc
    ? { type: "document", source: { type: "base64", media_type: "application/pdf", data: base64 } }
    : { type: "image", source: { type: "base64", media_type: mime as "image/png" | "image/jpeg" | "image/webp", data: base64 } };

  try {
    const response = await client.messages.parse({
      model: "claude-opus-4-6",
      max_tokens: 4096,
      thinking: { type: "adaptive" },
      output_config: { effort: "medium", format: zodOutputFormat(ExtractionSchema) },
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: [
            fileBlock,
            { type: "text", text: "Extrae los datos de este PO de cliente en el formato acordado." },
          ],
        },
      ],
    });

    const raw = response.parsed_output;
    if (!raw) {
      return { ok: false, reason: "El modelo no devolvió datos estructurados — captura a mano." };
    }
    const data = normalizeExtraction(raw);
    if (!data.readable) {
      return { ok: false, reason: data.reason || "No se pudo leer el documento — captura a mano." };
    }
    return { ok: true, data };
  } catch (err) {
    if (err instanceof Anthropic.AuthenticationError) {
      return { ok: false, reason: "La lectura automática no está configurada correctamente (API key inválida)." };
    }
    if (err instanceof Anthropic.APIError) {
      console.error("[po-extract] Anthropic APIError", {
        status: err.status,
        name: err.name,
        message: err.message,
        error: err.error,
      });
      return { ok: false, reason: `No se pudo leer el documento (error del lector: ${err.status ?? "?"}) — captura a mano.` };
    }
    console.error("[po-extract] unexpected error", err);
    return { ok: false, reason: "No se pudo leer el documento — captura a mano." };
  }
}

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function matchCustomer(name: string | null, customers: Array<{ id: number; name: string }>): number | null {
  if (!name) return null;
  const needle = normalize(name);
  if (!needle) return null;
  const exact = customers.find((c) => normalize(c.name) === needle);
  if (exact) return exact.id;
  const partial = customers.find((c) => normalize(c.name).includes(needle) || needle.includes(normalize(c.name)));
  return partial ? partial.id : null;
}

export function matchLocation(
  shipTo: { ship_to_address_line: string | null; ship_to_city: string | null },
  locations: Array<{ id: number; address_line: string; city: string | null }>,
): number | null {
  if (!shipTo.ship_to_address_line) return null;
  const needle = normalize(shipTo.ship_to_address_line);
  if (!needle) return null;
  const exact = locations.find((l) => normalize(l.address_line) === needle);
  if (exact) return exact.id;
  const partial = locations.find((l) => {
    const addr = normalize(l.address_line);
    return addr.includes(needle) || needle.includes(addr);
  });
  if (partial) return partial.id;
  return null;
}

export function matchSku(
  line: { sku: string | null; product_name: string | null },
  skus: Array<{ id: number; product_id: number; sku_code: string | null; product_name: string; unit: string }>,
): { pack_style_id: number | null; product_id: number | null; unit: string | null } {
  if (line.sku) {
    const needle = normalize(line.sku);
    const bySku = skus.find((s) => s.sku_code && normalize(s.sku_code) === needle);
    if (bySku) return { pack_style_id: bySku.id, product_id: bySku.product_id, unit: bySku.unit };
  }
  if (line.product_name) {
    const needle = normalize(line.product_name);
    const byName = skus.find((s) => normalize(s.product_name).includes(needle) || needle.includes(normalize(s.product_name)));
    if (byName) return { pack_style_id: byName.id, product_id: byName.product_id, unit: byName.unit };
  }
  return { pack_style_id: null, product_id: null, unit: null };
}
