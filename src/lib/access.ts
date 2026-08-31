export const MODULE_IDS = [
  "orders",
  "warehouse",
  "contacts",
  "finance",
  "reports",
  "settings",
] as const;
export type ModuleId = (typeof MODULE_IDS)[number];

export const MODULE_LABELS: Record<ModuleId, string> = {
  orders: "Orders",
  warehouse: "Warehouse",
  contacts: "Contacts",
  finance: "Finance",
  reports: "Reports",
  settings: "Settings",
};

export const ROLE_MODULES: Record<string, ModuleId[]> = {
  admin: [...MODULE_IDS],
  seller: ["orders", "contacts", "reports"],
  buyer: ["orders", "warehouse", "contacts"],
  warehouse: ["warehouse", "orders"],
};

export type StaffAccess = {
  id: number;
  name: string;
  email: string | null;
  role: string;
  status: "pending" | "invited" | "active" | "disabled";
  modules: string[];
  linked: boolean;
};

const PATH_MODULE: { prefix: string; module: ModuleId }[] = [
  { prefix: "/settings", module: "settings" },
  { prefix: "/reportes", module: "reports" },
  { prefix: "/compras", module: "orders" },
  { prefix: "/ventas", module: "orders" },
  { prefix: "/cpo", module: "orders" },
  { prefix: "/listas", module: "orders" },
  { prefix: "/destinos", module: "orders" },
  { prefix: "/embarques", module: "orders" },
  { prefix: "/etiquetas", module: "orders" },
  { prefix: "/agencias", module: "orders" },
  { prefix: "/cruces", module: "orders" },
  { prefix: "/transportistas", module: "orders" },
  { prefix: "/inventario", module: "warehouse" },
  { prefix: "/productos", module: "warehouse" },
  { prefix: "/clientes", module: "contacts" },
  { prefix: "/proveedores", module: "contacts" },
  { prefix: "/gastos", module: "finance" },
  { prefix: "/cxc", module: "finance" },
  { prefix: "/cxp", module: "finance" },
  { prefix: "/tesoreria", module: "finance" },
  { prefix: "/cuentas", module: "finance" },
];

export function moduleForAppPath(pathname: string): ModuleId | "home" {
  if (!pathname || pathname === "/") return "home";
  const hit = PATH_MODULE.find((p) => pathname === p.prefix || pathname.startsWith(`${p.prefix}/`));
  return hit?.module ?? "home";
}

export function canAccess(staff: StaffAccess | null | undefined, pathname: string): boolean {
  if (!staff || staff.status !== "active") return false;
  if (staff.role === "admin") return true;
  const mod = moduleForAppPath(pathname);
  if (mod === "home") return true;
  return staff.modules.includes(mod);
}

export function modulesForRole(role: string): ModuleId[] {
  return ROLE_MODULES[role] ? [...ROLE_MODULES[role]] : [];
}
