import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  BarChart3,
  BookOpen,
  ChevronDown,
  ClipboardList,
  HelpCircle,
  LayoutGrid,
  Menu,
  Search,
  Settings,
  Star,
  Truck,
  Users,
  Wallet,
  Warehouse,
  X,
} from "lucide-react";
import { createContext, useContext, useLayoutEffect, useMemo, useState, type ReactNode } from "react";
import { COMPANY } from "@/lib/company";
import { MODULES, moduleForPath, sectionForPath, type ModuleDef } from "@/lib/nav";
import { cn } from "@/lib/utils";

const RAIL_ICONS: Record<string, typeof Star> = {
  favorites: Star,
  orders: ClipboardList,
  warehouse: Warehouse,
  contacts: Users,
  finance: Wallet,
  reports: BarChart3,
  settings: Settings,
};

type ChromeValue = {
  setTabActions: (n: ReactNode) => void;
  setTabOverride: (n: ReactNode | null) => void;
};

const ChromeContext = createContext<ChromeValue>({
  setTabActions: () => {},
  setTabOverride: () => {},
});

export function TabActions({ children }: { children: ReactNode }) {
  const { setTabActions } = useContext(ChromeContext);
  useLayoutEffect(() => {
    setTabActions(children);
    return () => setTabActions(null);
    // children captured on mount; handlers are stable setState
    // eslint-disable-next-line react-hooks/exhaustive-deps -- avoid render loops from new element identity
  }, [setTabActions]);
  return null;
}

export function TabOverride({ children }: { children: ReactNode }) {
  const { setTabOverride } = useContext(ChromeContext);
  useLayoutEffect(() => {
    setTabOverride(children);
    return () => setTabOverride(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- avoid render loops from new element identity
  }, [setTabOverride]);
  return null;
}

function tabFromSearch(search: string) {
  const q = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  return q.get("tab");
}

function tabTone(pathname: string): "buyer" | "seller" | "light" {
  if (pathname.startsWith("/compras")) return "buyer";
  if (pathname.startsWith("/ventas")) return "seller";
  return "light";
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const search = useRouterState({ select: (s) => s.location.searchStr || "" });
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [modOpen, setModOpen] = useState(false);
  const [secOpen, setSecOpen] = useState(false);
  const [find, setFind] = useState(false);
  const [tabActions, setTabActions] = useState<ReactNode>(null);
  const [tabOverride, setTabOverride] = useState<ReactNode>(null);
  const chrome = useMemo(() => ({ setTabActions, setTabOverride }), []);

  const mod = useMemo(() => moduleForPath(pathname), [pathname]);
  const section = useMemo(() => sectionForPath(pathname, search), [pathname, search]);
  const currentTab = tabFromSearch(search) || section.tabs?.[0]?.tab || "all";
  const tone = tabTone(pathname);
  const bleed = ["/", "/compras", "/ventas", "/clientes", "/proveedores", "/gastos", "/inventario", "/reportes", "/settings"].some(
    (p) => pathname === p || (p !== "/" && pathname.startsWith(p)),
  );
  const padded = !bleed;

  if (pathname.startsWith("/doc/")) {
    return children;
  }

  const railItem = (m: ModuleDef, compact = false) => {
    const Icon = RAIL_ICONS[m.id] ?? BookOpen;
    const on = m.id === mod.id;
    return (
      <Link
        key={m.id}
        to={m.to}
        title={m.label}
        onClick={() => setOpen(false)}
        className={cn(
          "flex flex-col items-center justify-center gap-0.5 rounded-lg text-[10px] font-medium transition-colors duration-150",
          compact ? "h-14 w-full" : "size-14",
          on ? "bg-primary/10 text-primary" : "text-subtle hover:bg-surface-2 hover:text-muted",
        )}
      >
        <Icon className={cn("size-5", m.id === "favorites" && on && "fill-primary")} />
        {m.label === "Favorites" ? "Favorites" : m.label}
      </Link>
    );
  };

  return (
    <ChromeContext.Provider value={chrome}>
      <div className="min-h-dvh bg-bg text-fg lg:grid lg:grid-cols-[4.25rem_1fr]">
        <aside className="hidden border-r border-border bg-surface lg:flex lg:flex-col lg:items-center lg:py-3">
          <Link to="/" className="mb-3 flex items-center justify-center" aria-label="Cosecha">
            <LogoMark />
          </Link>
          <div className="flex flex-1 flex-col items-center gap-0.5">
            {MODULES.filter((m) => m.id !== "settings").map((m) => railItem(m))}
          </div>
          <div className="flex flex-col items-center gap-0.5">
            <span className="flex size-14 flex-col items-center justify-center text-subtle">
              <HelpCircle className="size-5" />
            </span>
            {railItem(MODULES.find((m) => m.id === "settings")!)}
          </div>
        </aside>

        <div className="flex min-w-0 flex-col">
          <header className="sticky top-0 z-30 flex h-12 items-center gap-2 border-b border-border bg-surface px-2 sm:px-4">
            <button
              type="button"
              className="flex size-11 items-center justify-center rounded-md hover:bg-surface-2 lg:hidden"
              onClick={() => setOpen((v) => !v)}
              aria-label={open ? "Close menu" : "Open menu"}
            >
              {open ? <X className="size-5" /> : <Menu className="size-5" />}
            </button>

            <div className="relative flex min-w-0 items-center gap-1">
              <button
                type="button"
                className="flex h-9 items-center gap-1 rounded-md px-2 text-sm font-semibold hover:bg-surface-2"
                onClick={() => {
                  setModOpen((v) => !v);
                  setSecOpen(false);
                }}
              >
                {mod.label}
                <ChevronDown className="size-4 text-subtle" />
              </button>
              {modOpen ? (
                <MenuList
                  items={MODULES.filter((m) => m.id !== "favorites" && m.id !== "settings").map((m) => ({
                    to: m.to,
                    label: m.label,
                  }))}
                  onClose={() => setModOpen(false)}
                />
              ) : null}
              <span className="hidden text-border sm:inline">|</span>
              <button
                type="button"
                className="flex h-9 min-w-0 items-center gap-1 rounded-md px-2 text-sm font-medium hover:bg-surface-2"
                onClick={() => {
                  setSecOpen((v) => !v);
                  setModOpen(false);
                }}
              >
                <span className="truncate">{section.label}</span>
                <Star className={cn("size-3.5", section.starred ? "fill-warn text-warn" : "text-subtle")} />
                <ChevronDown className="size-4 text-subtle" />
              </button>
              {secOpen ? (
                <MenuList
                  className="left-16"
                  items={mod.sections.map((s) => ({ to: s.to, label: s.label, search: s.search }))}
                  onClose={() => setSecOpen(false)}
                />
              ) : null}
            </div>

            <div className="ml-auto flex items-center gap-2">
              <button
                type="button"
                className="flex size-9 items-center justify-center rounded-md text-muted hover:bg-surface-2"
                aria-label="Search"
                onClick={() => setFind(true)}
              >
                <Search className="size-4" />
              </button>
              <div className="hidden items-center gap-2 sm:flex">
                <span className="flex size-8 items-center justify-center rounded-full bg-primary/15 text-xs font-bold text-primary">
                  {COMPANY.shortName.slice(0, 1)}
                </span>
                <div className="leading-tight">
                  <div className="text-xs font-semibold">{COMPANY.legalName}</div>
                  <div className="text-[11px] text-muted">{COMPANY.userName}</div>
                </div>
              </div>
            </div>
          </header>

          {tabOverride ? (
            tabOverride
          ) : section.tabs?.length ? (
            <div
              className={cn(
                "flex h-11 items-center gap-1 overflow-x-auto px-3",
                tone === "buyer" && "bg-tab text-tab-fg",
                tone === "seller" && "bg-seller text-seller-fg",
                tone === "light" && "border-b border-border bg-surface",
              )}
            >
              {section.tabs.map((t) => {
                const tabVal = t.tab || "all";
                const isActive = currentTab === tabVal;
                return (
                  <button
                    key={t.label}
                    type="button"
                    onClick={() =>
                      navigate({
                        to: section.to,
                        search: { ...(section.search ?? {}), tab: tabVal } as never,
                      })
                    }
                    className={cn(
                      "relative h-11 shrink-0 px-3 text-sm font-medium",
                      tone === "light"
                        ? isActive
                          ? "text-action"
                          : "text-muted hover:text-fg"
                        : isActive
                          ? "text-white"
                          : "text-white/70 hover:text-white",
                    )}
                  >
                    {t.label}
                    {isActive ? (
                      <span
                        className={cn(
                          "absolute inset-x-2 bottom-0 h-0.5 rounded-full",
                          tone === "light" ? "bg-action" : "bg-white",
                        )}
                      />
                    ) : null}
                  </button>
                );
              })}
              {tabActions ? (
                <div className="ml-auto flex items-center gap-2">{tabActions}</div>
              ) : tone !== "light" ? (
                <span className="ml-auto hidden text-white/70 sm:flex">
                  <LayoutGrid className="size-4" />
                </span>
              ) : null}
            </div>
          ) : null}

          {open ? (
            <div className="fixed inset-0 z-40 bg-fg/40 lg:hidden" onClick={() => setOpen(false)}>
              <div className="absolute left-0 top-0 flex h-full w-72 flex-col bg-surface p-4 shadow-lg" onClick={(e) => e.stopPropagation()}>
                <div className="mb-4 flex items-center gap-2">
                  <LogoMark />
                  <div>
                    <div className="text-sm font-semibold">Cosecha</div>
                    <div className="text-xs text-muted">Produce ops</div>
                  </div>
                </div>
                <nav className="flex flex-col gap-1 overflow-y-auto">
                  {MODULES.map((m) => {
                    const Icon = RAIL_ICONS[m.id] ?? Truck;
                    const on = m.id === mod.id;
                    return (
                      <div key={m.id}>
                        <Link
                          to={m.to}
                          onClick={() => setOpen(false)}
                          className={cn(
                            "flex min-h-11 items-center gap-3 rounded-md px-3 text-sm font-medium",
                            on ? "bg-primary/10 text-primary" : "text-fg hover:bg-surface-2",
                          )}
                        >
                          <Icon className="size-4" />
                          {m.label}
                        </Link>
                        {on
                          ? m.sections.map((s) => (
                              <Link
                                key={s.to + s.label}
                                to={s.to}
                                search={(s.search ?? {}) as never}
                                onClick={() => setOpen(false)}
                                className={cn(
                                  "ml-7 flex min-h-10 items-center rounded-md px-3 text-sm",
                                  pathname.startsWith(s.to) && (!s.search || currentTab === s.search.tab)
                                    ? "text-primary"
                                    : "text-muted hover:text-fg",
                                )}
                              >
                                {s.label}
                              </Link>
                            ))
                          : null}
                      </div>
                    );
                  })}
                </nav>
              </div>
            </div>
          ) : null}

          {find ? (
            <div className="fixed inset-0 z-50 flex items-start justify-center bg-fg/40 p-4 pt-[12vh]" onClick={() => setFind(false)}>
              <div className="w-full max-w-lg rounded-lg border border-border bg-surface p-3 shadow-xl" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center gap-2 border-b border-border px-2 pb-2">
                  <Search className="size-4 text-subtle" />
                  <input
                    autoFocus
                    className="h-10 flex-1 bg-transparent text-sm outline-none"
                    placeholder="Search orders, customers, lots…"
                  />
                </div>
                <p className="px-2 py-3 text-xs text-muted">Jump to a module from the sidebar, or open an order from its list.</p>
              </div>
            </div>
          ) : null}

          <main className={cn("min-w-0 flex-1 bg-bg", padded ? "px-4 py-5 sm:px-6" : "")}>{children}</main>
        </div>
      </div>
    </ChromeContext.Provider>
  );
}

function LogoMark() {
  return (
    <span className="flex h-8 items-center justify-center rounded-md bg-primary px-1.5 text-[13px] font-bold tracking-tight text-primary-fg">
      Co
    </span>
  );
}

function MenuList({
  items,
  onClose,
  className,
}: {
  items: { to: string; label: string; search?: Record<string, string> }[];
  onClose: () => void;
  className?: string;
}) {
  return (
    <>
      <button type="button" className="fixed inset-0 z-40 cursor-default" aria-label="Close" onClick={onClose} />
      <div className={cn("absolute top-10 z-50 min-w-48 rounded-md border border-border bg-surface py-1 shadow-lg", className)}>
        {items.map((it) => (
          <Link
            key={it.to + it.label}
            to={it.to}
            search={(it.search ?? {}) as never}
            onClick={onClose}
            className="flex min-h-10 items-center px-3 text-sm hover:bg-surface-2"
          >
            {it.label}
          </Link>
        ))}
      </div>
    </>
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
    <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-fg">{title}</h1>
        {subtitle ? <p className="mt-0.5 text-sm text-muted">{subtitle}</p> : null}
      </div>
      {action}
    </div>
  );
}

export function Panel({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("rounded-lg border border-border bg-surface p-4", className)}>{children}</div>;
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
          "max-h-[92dvh] w-full overflow-y-auto rounded-t-xl border border-border bg-surface shadow-xl sm:rounded-xl",
          wide ? "max-w-6xl" : "max-w-lg",
        )}
      >
        <div className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b border-border bg-surface px-5 py-4">
          <div>
            <h2 className="text-lg font-semibold">{title}</h2>
            {subtitle ? <p className="mt-0.5 text-xs text-muted">{subtitle}</p> : null}
          </div>
          <button type="button" className="flex size-10 items-center justify-center rounded-md hover:bg-surface-2" onClick={onClose}>
            <X className="size-4" />
          </button>
        </div>
        <div className="p-5">{children}</div>
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
      <p className="label-caps">{label}</p>
      <p
        className={cn(
          "mt-1 text-2xl font-semibold tabular-nums tracking-tight",
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

export function MetaCard({
  label,
  children,
  action,
  className,
}: {
  label: string;
  children?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("rounded-md border border-border bg-surface px-3 py-2.5", className)}>
      <div className="flex items-start justify-between gap-2">
        <p className="label-caps">{label}</p>
        {action}
      </div>
      <div className="mt-1 text-sm font-medium">{children}</div>
    </div>
  );
}
