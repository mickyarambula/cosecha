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

type StaffRow = { role: string; status: string; modules: unknown };

/** La fila de staff del usuario, por `user_id` y si no por correo (invitación aún sin ligar). */
async function loadStaff(userId: string): Promise<StaffRow | undefined> {
  const sql = await getSql();
  let [staff] = await sql.query<StaffRow>(
    `select role, coalesce(status,'pending') as status, coalesce(modules::text,'[]') as modules
     from staff where user_id = $1 limit 1`,
    [userId],
  );
  if (!staff) {
    const [ident] = await sql.query<{ email: string | null }>(`select email from "user" where id = $1`, [userId]);
    const email = ident?.email?.trim().toLowerCase();
    if (email) {
      [staff] = await sql.query<StaffRow>(
        `select role, coalesce(status,'pending') as status, coalesce(modules::text,'[]') as modules
         from staff where lower(coalesce(email,'')) = $1 limit 1`,
        [email],
      );
    }
  }
  return staff;
}

/**
 * Throws `ModuleAccessError` unless the caller is an active admin, or active
 * with (at least one of) `moduleId` granted. A list is for the handful of
 * functions that live on screens of two different modules — el catálogo de SKU
 * por contraparte sale en Productos y en Clientes, por ejemplo: quien puede
 * abrir cualquiera de las dos pantallas puede usarlo.
 */
export async function requireModule(userId: string, moduleId: ModuleId | ModuleId[]): Promise<void> {
  const staff = await loadStaff(userId);
  if (!staff || staff.status !== "active") throw new ModuleAccessError();
  if (staff.role === "admin") return;
  const wanted = Array.isArray(moduleId) ? moduleId : [moduleId];
  const granted = parseModules(staff.modules);
  if (!wanted.some((m) => granted.includes(m))) throw new ModuleAccessError();
}

/**
 * Throws `ModuleAccessError` unless the caller is active staff — sin exigir un
 * módulo en particular. Para lo que cualquiera que ya está dentro puede hacer
 * (leer catálogos, anotar que un documento se envió), pero un alta recién
 * creada que sigue en `pending` no.
 */
export async function requireActiveStaff(userId: string): Promise<void> {
  const staff = await loadStaff(userId);
  if (!staff || staff.status !== "active") throw new ModuleAccessError();
}
