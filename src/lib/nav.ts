export type TabDef = { label: string; tab?: string; hash?: string };
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
      { to: "/productos", label: "Pack-Outs & Repacks" },
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
      { to: "/cxp", label: "Payments" },
      { to: "/cxc", label: "Credits" },
      { to: "/tesoreria", label: "Debt Aging" },
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
          { label: "Teams", tab: "teams" },
          { label: "Inventory", tab: "inventory" },
          { label: "Orders", tab: "orders" },
          { label: "Accounting", tab: "accounting" },
          { label: "Features", tab: "features" },
          { label: "Departments", tab: "departments" },
          { label: "Business Info", tab: "business" },
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
  if (tab) {
    const bySearch = mod.sections.find((s) => s.search?.tab === tab && pathname.startsWith(s.to));
    if (bySearch) return bySearch;
  }
  const exact = mod.sections.find((s) => (s.to === "/" ? pathname === "/" : pathname.startsWith(s.to)) && !s.search);
  if (exact) return exact;
  return mod.sections.find((s) => (s.to === "/" ? pathname === "/" : pathname.startsWith(s.to))) ?? mod.sections[0];
}

export function poShort(poNumber: string) {
  const m = poNumber.match(/(\d+)(?!.*\d)/);
  return m ? String(Number(m[1])) : poNumber.replace(/^OC-/, "");
}
