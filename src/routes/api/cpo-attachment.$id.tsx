import { createFileRoute } from "@tanstack/react-router";
import { auth, authConfigured } from "@/lib/auth/server";
import { getSql } from "@/lib/db";

async function requireStaff(request: Request): Promise<boolean> {
  if (!authConfigured) return true;
  const session = await auth.api.getSession({ headers: request.headers });
  return Boolean(session?.user);
}

export const Route = createFileRoute("/api/cpo-attachment/$id")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        if (!(await requireStaff(request))) return new Response("Unauthorized", { status: 401 });
        const id = Number(params.id);
        if (!Number.isFinite(id)) return new Response("Not found", { status: 404 });
        const sql = await getSql();
        const [row] = await sql.query<{ attachment_filename: string | null; attachment_mime: string | null; attachment_data: Buffer | Uint8Array | null }>(
          `select attachment_filename, attachment_mime, attachment_data from customer_pos where id = $1`,
          [id],
        );
        if (!row || !row.attachment_data) return new Response("Not found", { status: 404 });
        const bytes = Buffer.isBuffer(row.attachment_data) ? row.attachment_data : Buffer.from(row.attachment_data);
        return new Response(new Uint8Array(bytes), {
          headers: {
            "Content-Type": row.attachment_mime || "application/octet-stream",
            "Content-Disposition": `inline; filename="${(row.attachment_filename || "adjunto").replace(/"/g, "")}"`,
            "Cache-Control": "private, no-store",
          },
        });
      },
    },
  },
});
