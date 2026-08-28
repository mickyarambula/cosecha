import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";

const ExtractionSchema = z.object({
  readable: z.boolean(),
  reason: z.string().nullable(),
  customer_name: z.string().nullable(),
  customer_po_number: z.string().nullable(),
  po_date: z.string().nullable(),
  requested_date: z.string().nullable(),
  currency: z.string().nullable(),
  payment_terms: z.string().nullable(),
  ship_to_address_line: z.string().nullable(),
  ship_to_city: z.string().nullable(),
  ship_to_state: z.string().nullable(),
  ship_to_zip: z.string().nullable(),
  notes: z.string().nullable(),
  lines: z.array(
    z.object({
      sku: z.string().nullable(),
      product_name: z.string().nullable(),
      quantity: z.number().nullable(),
      unit: z.string().nullable(),
      unit_price: z.number().nullable(),
    }),
  ),
});

type Extraction = z.infer<typeof ExtractionSchema>;

const SYSTEM_PROMPT = `Lees órdenes de compra (PO) que clientes de una empresa de produce fresco (frutas y verduras) envían por fax, PDF o foto.
Extrae únicamente lo que el documento diga literalmente. Nunca inventes ni asumas un valor que no esté escrito.
Si un dato no aparece, ponlo en null — no lo adivines.
Fechas en formato ISO yyyy-mm-dd. Si el documento no trae año, asume el año actual.
Si el documento no es legible o no parece un PO, marca readable=false y explica por qué en "reason".
"unit" es la unidad de empaque (ej. caja, box, carton, bin, lb, kg) tal como aparece o se infiere del contexto — en null si no es claro.
"payment_terms" son las condiciones de pago tal como aparecen (ej. "Net 21", "COD", "Net 30") — null si no se mencionan.
"ship_to_*" son los datos del domicilio de entrega (SHIP TO), separados de cualquier domicilio de facturación (BILL TO) — null si el documento no trae uno.`;

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

    const data = response.parsed_output;
    if (!data) {
      return { ok: false, reason: "El modelo no devolvió datos estructurados — captura a mano." };
    }
    if (!data.readable) {
      return { ok: false, reason: data.reason || "No se pudo leer el documento — captura a mano." };
    }
    return { ok: true, data };
  } catch (err) {
    if (err instanceof Anthropic.AuthenticationError) {
      return { ok: false, reason: "La lectura automática no está configurada correctamente (API key inválida)." };
    }
    if (err instanceof Anthropic.APIError) {
      return { ok: false, reason: `No se pudo leer el documento (error del lector: ${err.status ?? "?"}) — captura a mano.` };
    }
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
