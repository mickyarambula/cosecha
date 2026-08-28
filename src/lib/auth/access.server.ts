import { getSql } from "@/lib/db";
import type { ModuleId } from "@/lib/access";

/**
 * Server-side mirror of `canAccess` in `@/lib/access` — that one only decides
 * whether the UI shows a screen. This is what actually stops the request when
 * someone calls the server function directly (devtools, a crafted fetch)
 * without going through the route guard.
 */
export class ModuleAccessError extends Error {
  readonly status = 403;
  constructor(message = "No tienes acceso a este módulo todavía.") {
    super(message);
    this.name = "ModuleAccessError";
  }
}

function parseModules(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.filter((x): x is string => typeof x === "string");
  if (typeof raw !== "string" || !raw) return [];
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? v.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}

/** Throws `ModuleAccessError` unless the caller is an active admin, or active with `moduleId` granted. */
export async function requireModule(userId: string, moduleId: ModuleId): Promise<void> {
  const sql = await getSql();
  let [staff] = await sql.query(
    `select role, coalesce(status,'pending') as status, coalesce(modules::text,'[]') as modules
     from staff where user_id = $1 limit 1`,
    [userId],
  );
  if (!staff) {
    const [ident] = await sql.query<{ email: string | null }>(`select email from "user" where id = $1`, [userId]);
    const email = ident?.email?.trim().toLowerCase();
    if (email) {
      [staff] = await sql.query(
        `select role, coalesce(status,'pending') as status, coalesce(modules::text,'[]') as modules
         from staff where lower(coalesce(email,'')) = $1 limit 1`,
        [email],
      );
    }
  }
  if (!staff || staff.status !== "active") throw new ModuleAccessError();
  if (staff.role === "admin") return;
  if (!parseModules(staff.modules).includes(moduleId)) throw new ModuleAccessError();
}
