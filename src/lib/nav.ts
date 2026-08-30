export type TabDef = { label: string; tab?: string; hash?: string; to?: string; search?: Record<string, string> };
export type SectionDef = {
  to: string;
  label: string;
  starred?: boolean;
  tabs?: TabDef[];
  search?: Record<string, string>;
};
export type ModuleDef = {
  id: string;
  label: string;
  to: string;
  sections: SectionDef[];
};

export const MODULES: ModuleDef[] = [
  {
    id: "favorites",
    label: "Favorites",
    to: "/",
    sections: [{ to: "/", label: "Home", starred: true }],
  },
  {
    id: "orders",
    label: "Orders",
    to: "/compras",
    sections: [
      {
        to: "/compras",
        label: "Purchase Orders",
        starred: true,
        tabs: [
          { label: "All Orders", tab: "all" },
          { label: "New Order", tab: "new" },
        ],
      },
      {
        to: "/ventas",
        label: "Sales Orders",
        starred: true,
        tabs: [
          { label: "All Orders", tab: "all" },
          { label: "New Order", tab: "new" },
        ],
      },
      { to: "/cpo", label: "Online Orders" },
      { to: "/listas", label: "Price Sheets" },
      { to: "/destinos", label: "Delivery Routes" },
      { to: "/embarques", label: "Embarques" },
      { to: "/agencias", label: "Agencias aduanales" },
      { to: "/cruces", label: "Puntos de cruce" },
      { to: "/transportistas", label: "Transportistas" },
    ],
  },
  {
    id: "warehouse",
    label: "Warehouse",
    to: "/inventario",
    sections: [
      {
        to: "/inventario",
        label: "Inventory",
        starred: true,
        search: { tab: "pricing" },
        tabs: [
          { label: "Products & SKUs", to: "/productos", tab: "catalog" },
          { label: "Available Units", tab: "units" },
          { label: "Pricing", tab: "pricing" },
          { label: "Details", tab: "details" },
          { label: "Pallet Definitions", tab: "pallet" },
          { label: "Physical O/H", tab: "oh" },
          { label: "Inactive", tab: "inactive" },
        ],
      },
      { to: "/inventario", label: "Lots", search: { tab: "lots" } },
      { to: "/inventario", label: "Oversold", search: { tab: "oversold" } },
      { to: "/inventario", label: "Fulfillment", search: { tab: "fulfillment" } },
      {
        to: "/productos",
        label: "Products & SKUs",
        starred: true,
        tabs: [
          { label: "Catalog", tab: "catalog" },
          { label: "Pack-Outs & Repacks", tab: "repack" },
        ],
      },
    ],
  },
  {
    id: "contacts",
    label: "Contacts",
    to: "/clientes",
    sections: [
      {
        to: "/clientes",
        label: "Customers",
        starred: true,
        tabs: [{ label: "Customers", tab: "list" }],
      },
      { to: "/proveedores", label: "Vendors", starred: true },
    ],
  },
  {
    id: "finance",
    label: "Finance",
    to: "/gastos",
    sections: [
      {
        to: "/cuentas",
        label: "Chart of Accounts",
        starred: true,
        tabs: [
          { label: "Chart of Accounts", tab: "accounts" },
          { label: "Automations", tab: "automations" },
        ],
      },
      {
        to: "/gastos",
        label: "Expenses",
        starred: true,
        tabs: [
          { label: "Overview", tab: "overview" },
          { label: "Expenses", tab: "list" },
          { label: "Payments", tab: "payments" },
          { label: "Credits", tab: "credits" },
          { label: "Debt Aging", tab: "aging" },
        ],
      },
      {
        to: "/cxc",
        label: "Sales",
        starred: true,
        tabs: [
          { label: "Overview", tab: "overview" },
          { label: "Invoices", tab: "invoices" },
          { label: "Statements", tab: "statements" },
          { label: "Payments", tab: "payments" },
          { label: "Credits", tab: "credits" },
          { label: "Debt Aging", tab: "aging" },
          { label: "Unpaid Sales Aging", tab: "unpaid" },
        ],
      },
      {
        to: "/cxp",
        label: "Payables",
        starred: true,
      },
      {
        to: "/tesoreria",
        label: "Cash",
        starred: true,
        tabs: [
          { label: "Movements", tab: "movements" },
          { label: "Reconcile", tab: "reconcile" },
        ],
      },
    ],
  },
  {
    id: "reports",
    label: "Reports",
    to: "/reportes",
    sections: [
      {
        to: "/reportes",
        label: "Sales",
        starred: true,
        tabs: [
          { label: "Overview", tab: "overview" },
          { label: "User", tab: "user" },
          { label: "Customer", tab: "customer" },
          { label: "Vendor", tab: "vendor" },
          { label: "Inventory", tab: "inventory" },
          { label: "Purchased Lots", tab: "purchased" },
          { label: "Department", tab: "department" },
          { label: "Item Detail", tab: "items" },
        ],
      },
      {
        to: "/reportes",
        label: "Financial",
        starred: true,
        search: { tab: "pl" },
        tabs: [
          { label: "P&L", tab: "pl" },
          { label: "Balance Sheet", tab: "balance" },
          { label: "Trial Balance", tab: "trial" },
          { label: "Settlements", tab: "settlements" },
        ],
      },
    ],
  },
  {
    id: "settings",
    label: "Settings",
    to: "/settings",
    sections: [
      {
        to: "/settings",
        label: "Settings",
        tabs: [
          { label: "Appearance", tab: "appearance" },
          { label: "Teams", tab: "teams" },
          { label: "Inventory", tab: "inventory" },
          { label: "Orders", tab: "orders" },
          { label: "Accounting", tab: "accounting" },
          { label: "Features", tab: "features" },
          { label: "Departments", tab: "departments" },
          { label: "Concepts", tab: "concepts" },
          { label: "Business Info", tab: "business" },
          { label: "Sent", tab: "sent" },
          { label: "Tests", tab: "tests" },
          { label: "Online Ordering", tab: "online" },
        ],
      },
    ],
  },
];

export function moduleForPath(pathname: string): ModuleDef {
  if (pathname === "/") return MODULES[0];
  const found = MODULES.find((m) => m.sections.some((s) => s.to !== "/" && pathname.startsWith(s.to)));
  return found ?? MODULES[0];
}

export function sectionForPath(pathname: string, searchStr = ""): SectionDef {
  const mod = moduleForPath(pathname);
  const tab = new URLSearchParams(searchStr.startsWith("?") ? searchStr.slice(1) : searchStr).get("tab");
  const pathOk = (s: SectionDef) => (s.to === "/" ? pathname === "/" : pathname.startsWith(s.to));
  if (tab) {
    const bySearch = mod.sections.find((s) => s.search?.tab === tab && pathOk(s));
    if (bySearch) return bySearch;
    const byTab = mod.sections.find((s) => pathOk(s) && s.tabs?.some((t) => t.tab === tab));
    if (byTab) return byTab;
  }
  const exact = mod.sections.find((s) => pathOk(s) && !s.search);
  if (exact) return exact;
  return mod.sections.find((s) => pathOk(s)) ?? mod.sections[0];
}

export function poShort(poNumber: string) {
  const m = poNumber.match(/(\d+)(?!.*\d)/);
  return m ? String(Number(m[1])) : poNumber.replace(/^OC-/, "");
}
