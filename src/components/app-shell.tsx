import { Link, useRouterState } from "@tanstack/react-router";
import {
  ArrowDownLeft,
  ArrowUpRight,
  BookOpen,
  Boxes,
  ClipboardList,
  Home,
  LayoutDashboard,
  Leaf,
  Menu,
  Package,
  ShoppingCart,
  Truck,
  Users,
  Wallet,
  Warehouse,
  X,
} from "lucide-react";
import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";

type NavItem = { to: string; label: string; short?: string; icon: typeof Home };
type NavGroup = { id: string; label: string; rail: string; icon: typeof Home; items: NavItem[] };

const GROUPS: NavGroup[] = [
  {
    id: "inicio",
    label: "Inicio",
    rail: "Inicio",
    icon: Home,
    items: [{ to: "/", label: "Tablero", icon: LayoutDashboard }],
  },
  {
    id: "operacion",
    label: "Operación",
    rail: "Oper.",
    icon: Package,
    items: [
      { to: "/cpo", label: "Customer PO", short: "CPO", icon: ClipboardList },
      { to: "/ventas", label: "Ventas", icon: ShoppingCart },
      { to: "/inventario", label: "Inventario", icon: Warehouse },
      { to: "/compras", label: "Compras", icon: Truck },
    ],
  },
  {
    id: "dinero",
    label: "Dinero",
    rail: "Dinero",
    icon: Wallet,
    items: [
      { to: "/cxc", label: "Cuentas por cobrar", short: "CxC", icon: ArrowDownLeft },
      { to: "/cxp", label: "Cuentas por pagar", short: "CxP", icon: ArrowUpRight },
      { to: "/tesoreria", label: "Tesorería", icon: Wallet },
    ],
  },
  {
    id: "catalogos",
    label: "Catálogos",
    rail: "Catál.",
    icon: BookOpen,
    items: [
      { to: "/productos", label: "Productos", icon: Leaf },
      { to: "/proveedores", label: "Proveedores", icon: Boxes },
      { to: "/clientes", label: "Clientes", icon: Users },
    ],
  },
];

function groupForPath(pathname: string) {
  return (
    GROUPS.find((g) => g.items.some((i) => (i.to === "/" ? pathname === "/" : pathname.startsWith(i.to)))) ?? GROUPS[0]
  );
}

function itemForPath(pathname: string) {
  for (const g of GROUPS) {
    const item = g.items.find((i) => (i.to === "/" ? pathname === "/" : pathname.startsWith(i.to)));
    if (item) return item;
  }
  return GROUPS[0].items[0];
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [open, setOpen] = useState(false);
  const group = useMemo(() => groupForPath(pathname), [pathname]);
  const page = useMemo(() => itemForPath(pathname), [pathname]);

  if (pathname.startsWith("/doc/")) {
    return children;
  }

  const links = (onNavigate?: () => void) => (
    <nav className="flex flex-col gap-5">
      {GROUPS.map((g) => (
        <div key={g.id}>
          <p className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-subtle">{g.label}</p>
          <div className="flex flex-col gap-0.5">
            {g.items.map((item) => {
              const active = item.to === "/" ? pathname === "/" : pathname.startsWith(item.to);
              const Icon = item.icon;
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  onClick={onNavigate}
                  className={cn(
                    "flex min-h-11 items-center gap-3 rounded-md px-3 text-sm font-medium transition-colors duration-150",
                    active ? "bg-primary/12 text-primary" : "text-muted hover:bg-surface-2 hover:text-fg",
                  )}
                >
                  <Icon className="size-4 shrink-0" />
                  {item.short ?? item.label}
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );

  return (
    <div className="min-h-dvh bg-bg text-fg lg:grid lg:grid-cols-[4rem_1fr]">
      <aside className="hidden flex-col items-center border-r border-border bg-surface py-3 lg:flex">
        <Link to="/" className="mb-4 flex size-9 items-center justify-center rounded-md bg-primary text-primary-fg" aria-label="Cosecha">
          <Leaf className="size-4" />
        </Link>
        <div className="flex flex-1 flex-col items-center gap-1">
          {GROUPS.map((g) => {
            const Icon = g.icon;
            const on = g.id === group.id;
            const first = g.items[0];
            return (
              <Link
                key={g.id}
                to={first.to}
                title={g.label}
                className={cn(
                  "flex size-12 flex-col items-center justify-center gap-0.5 rounded-lg text-[9px] font-semibold tracking-wide transition-colors duration-150",
                  on ? "bg-primary/12 text-primary" : "text-subtle hover:bg-surface-2 hover:text-muted",
                )}
              >
                <Icon className="size-5" />
                {g.rail}
              </Link>
            );
          })}
        </div>
      </aside>

      <div className="flex min-w-0 flex-col">
        <header className="sticky top-0 z-20 flex h-12 items-center gap-3 border-b border-border bg-surface/95 px-3 backdrop-blur sm:px-5">
          <button
            type="button"
            className="flex size-11 items-center justify-center rounded-md hover:bg-surface-2 lg:hidden"
            onClick={() => setOpen((v) => !v)}
            aria-label={open ? "Cerrar menú" : "Abrir menú"}
          >
            {open ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
          <div className="flex min-w-0 items-center gap-2">
            <span className="hidden items-center gap-1.5 rounded-md bg-primary/12 px-2.5 py-1 text-xs font-semibold text-primary sm:inline-flex">
              {group.label}
            </span>
            <span className="hidden text-subtle sm:inline">/</span>
            <span className="truncate text-sm font-semibold">{page.label}</span>
          </div>
          <div className="ml-auto hidden items-baseline gap-2 sm:flex">
            <span className="font-display text-base font-semibold tracking-tight">Cosecha</span>
            <span className="text-xs text-subtle">ERP de produce</span>
          </div>
        </header>

        {open ? (
          <div className="fixed inset-0 z-40 bg-fg/40 lg:hidden" onClick={() => setOpen(false)}>
            <div className="absolute left-0 top-0 h-full w-72 overflow-y-auto bg-surface p-5 shadow-lg" onClick={(e) => e.stopPropagation()}>
              <Brand />
              <div className="mt-8">{links(() => setOpen(false))}</div>
            </div>
          </div>
        ) : null}

        <div className="flex min-h-0 flex-1">
          <aside className="hidden w-52 shrink-0 overflow-y-auto border-r border-border bg-surface p-4 xl:block">
            {links()}
          </aside>
          <main className="min-w-0 flex-1">
            <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8">{children}</div>
          </main>
        </div>
      </div>
    </div>
  );
}

function Brand() {
  return (
    <div className="flex items-center gap-2.5">
      <span className="flex size-9 items-center justify-center rounded-md bg-primary text-primary-fg">
        <Leaf className="size-4" />
      </span>
      <div>
        <div className="font-display text-lg font-semibold tracking-tight">Cosecha</div>
        <div className="text-xs text-muted">ERP de produce</div>
      </div>
    </div>
  );
}

export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="font-display text-3xl font-semibold tracking-tight text-fg">{title}</h1>
        {subtitle ? <p className="mt-1 text-sm text-muted">{subtitle}</p> : null}
      </div>
      {action}
    </div>
  );
}

export function Panel({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("rounded-xl border border-border bg-surface p-5", className)}>{children}</div>;
}

export function Modal({
  title,
  subtitle,
  onClose,
  children,
  wide = false,
}: {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-fg/40 p-0 sm:items-center sm:p-6">
      <div
        className={cn(
          "max-h-[92dvh] w-full overflow-y-auto rounded-t-xl border border-border bg-surface p-5 shadow-xl sm:rounded-xl",
          wide ? "max-w-2xl" : "max-w-lg",
        )}
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 className="font-display text-xl font-semibold">{title}</h2>
            {subtitle ? <p className="mt-0.5 text-xs text-muted">{subtitle}</p> : null}
          </div>
          <button type="button" className="flex size-11 items-center justify-center rounded-md hover:bg-surface-2" onClick={onClose}>
            <X className="size-4" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Kpi({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "ok" | "warn" | "danger" | "mute";
}) {
  return (
    <Panel className="p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-muted">{label}</p>
      <p
        className={cn(
          "mt-1 font-display text-2xl font-semibold tabular-nums tracking-tight",
          tone === "ok" && "text-ok",
          tone === "warn" && "text-warn",
          tone === "danger" && "text-danger",
        )}
      >
        {value}
      </p>
      {hint ? <p className="mt-1 text-xs text-subtle">{hint}</p> : null}
    </Panel>
  );
}
