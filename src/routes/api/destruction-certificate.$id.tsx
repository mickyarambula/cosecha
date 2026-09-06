import { createFileRoute } from "@tanstack/react-router";
import { auth, authConfigured } from "@/lib/auth/server";
import { getSql } from "@/lib/db";

// Certificado oficial de destrucción (bloque B): el archivo vive en la base,
// mismo patrón que /api/cpo-attachment. Solo staff con sesión.
async function requireStaff(request: Request): Promise<boolean> {
  if (!authConfigured) return true;
  const session = await auth.api.getSession({ headers: request.headers });
  return Boolean(session?.user);
}

export const Route = createFileRoute("/api/destruction-certificate/$id")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        if (!(await requireStaff(request))) return new Response("Unauthorized", { status: 401 });
        const id = Number(params.id);
        if (!Number.isFinite(id)) return new Response("Not found", { status: 404 });
        const sql = await getSql();
        const [row] = await sql.query<{ filename: string | null; mime: string | null; data: Buffer | Uint8Array | null }>(
          `select filename, mime, data from destruction_certificates where id = $1`,
          [id],
        );
        if (!row || !row.data) return new Response("Not found", { status: 404 });
        const bytes = Buffer.isBuffer(row.data) ? row.data : Buffer.from(row.data);
        return new Response(new Uint8Array(bytes), {
          headers: {
            "Content-Type": row.mime || "application/octet-stream",
            "Content-Disposition": `inline; filename="${(row.filename || "certificado").replace(/"/g, "")}"`,
            "Cache-Control": "private, no-store",
          },
        });
      },
    },
  },
});
