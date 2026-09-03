import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  BarChart3,
  BookOpen,
  ChevronDown,
  ClipboardList,
  HelpCircle,
  LayoutGrid,
  Menu,
  Moon,
  Search,
  Settings,
  Star,
  Sun,
  Truck,
  Users,
  Wallet,
  Warehouse,
  X,
} from "lucide-react";
import { createContext, useContext, useEffect, useLayoutEffect, useMemo, useState, type ReactNode } from "react";
import { useAccess } from "@/components/access-gate";
import { BrandMark } from "@/components/brand";
import { BodyPortal } from "@/components/portal";
import { UserButton } from "@/lib/auth/gates";
import { canAccess } from "@/lib/access";
import { COMPANY } from "@/lib/company";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { useT } from "@/lib/i18n";
import { MODULES, moduleForPath, sectionForPath, type ModuleDef } from "@/lib/nav";
import { usePrefs } from "@/lib/prefs";
import { getCompany } from "@/lib/produce-server";
import { useAsync } from "@/lib/use-async";
import { cn, money } from "@/lib/utils";

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
  const locale = usePrefs((s) => s.locale);
  useLayoutEffect(() => {
    setTabActions(children);
    return () => setTabActions(null);
    // recapture when language changes so chrome actions re-translate
    // eslint-disable-next-line react-hooks/exhaustive-deps -- avoid render loops from new element identity
  }, [setTabActions, locale]);
  return null;
}

export function TabOverride({ children }: { children: ReactNode }) {
  const { setTabOverride } = useContext(ChromeContext);
  const locale = usePrefs((s) => s.locale);
  useLayoutEffect(() => {
    setTabOverride(children);
    return () => setTabOverride(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- avoid render loops from new element identity
  }, [setTabOverride, locale]);
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
  const t = useT();
  const access = useAccess();
  const visibleModules = useMemo(
    () => MODULES.filter((m) => m.id === "favorites" || canAccess(access, m.to)),
    [access],
  );
  const locale = usePrefs((s) => s.locale);
  const setTheme = usePrefs((s) => s.setTheme);
  const setLocale = usePrefs((s) => s.setLocale);
  const [open, setOpen] = useState(false);
  const [modOpen, setModOpen] = useState(false);
  const [secOpen, setSecOpen] = useState(false);
  const [find, setFind] = useState(false);
  const [tabActions, setTabActions] = useState<ReactNode>(null);
  const [tabOverride, setTabOverride] = useState<ReactNode | null>(null);
  const chrome = useMemo(() => ({ setTabActions, setTabOverride }), []);

  const mod = useMemo(() => moduleForPath(pathname), [pathname]);
  const section = useMemo(() => sectionForPath(pathname, search), [pathname, search]);
  const currentTab = tabFromSearch(search) || section.tabs?.[0]?.tab || "all";
  const tone = tabTone(pathname);
  const bleed = ["/", "/compras", "/ventas", "/clientes", "/proveedores", "/gastos", "/inventario", "/reportes", "/settings", "/productos", "/cxc"].some(
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
        title={t(m.label)}
        onClick={() => setOpen(false)}
        className={cn(
          "flex flex-col items-center justify-center gap-0.5 rounded-lg text-[10px] font-medium transition-colors duration-150",
          compact ? "h-14 w-full" : "size-14",
          on ? "bg-primary/10 text-primary" : "text-subtle hover:bg-surface-2 hover:text-muted",
        )}
      >
        <Icon className={cn("size-5", m.id === "favorites" && on && "fill-primary")} />
        {t(m.label)}
      </Link>
    );
  };

  return (
    <ChromeContext.Provider value={chrome}>
      <div className="min-h-dvh bg-bg text-fg lg:grid lg:grid-cols-[4.25rem_1fr]">
        <aside className="hidden border-r border-border bg-surface lg:flex lg:flex-col lg:items-center lg:py-3">
          <Link to="/" className="mb-3 flex items-center justify-center" aria-label="Plein Produce">
            <BrandMark />
          </Link>
          <div className="flex flex-1 flex-col items-center gap-0.5">
            {visibleModules.filter((m) => m.id !== "settings").map((m) => railItem(m))}
          </div>
          <div className="flex flex-col items-center gap-0.5">
            <span className="flex size-14 flex-col items-center justify-center text-subtle">
              <HelpCircle className="size-5" />
            </span>
            {visibleModules.find((m) => m.id === "settings") ? railItem(visibleModules.find((m) => m.id === "settings")!) : null}
          </div>
        </aside>

        <div className="flex min-w-0 flex-col">
          <header className="sticky top-0 z-30 flex h-12 items-center gap-2 border-b border-border bg-surface px-2 sm:px-4">
            <button
              type="button"
              className="flex size-11 items-center justify-center rounded-md hover:bg-surface-2 lg:hidden"
              onClick={() => setOpen((v) => !v)}
              aria-label={open ? t("Close menu") : t("Open menu")}
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
                {t(mod.label)}
                <ChevronDown className="size-4 text-subtle" />
              </button>
              {modOpen ? (
                <MenuList
                  items={visibleModules.filter((m) => m.id !== "favorites" && m.id !== "settings").map((m) => ({
                    to: m.to,
                    label: t(m.label),
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
                <span className="truncate">{t(section.label)}</span>
                <Star className={cn("size-3.5", section.starred ? "fill-warn text-warn" : "text-subtle")} />
                <ChevronDown className="size-4 text-subtle" />
              </button>
              {secOpen ? (
                <MenuList
                  className="left-16"
                  items={mod.sections.map((s) => ({ to: s.to, label: t(s.label), search: s.search }))}
                  onClose={() => setSecOpen(false)}
                />
              ) : null}
            </div>

            <div className="ml-auto flex items-center gap-1 sm:gap-2">
              <button
                type="button"
                className="flex size-9 items-center justify-center rounded-md text-muted hover:bg-surface-2"
                aria-label={t("Search")}
                onClick={() => setFind(true)}
              >
                <Search className="size-4" />
              </button>
              <button
                type="button"
                className="flex size-9 items-center justify-center rounded-md text-muted hover:bg-surface-2"
                aria-label={t("Theme")}
                title={t("Theme")}
                onClick={() => {
                  const nowDark = document.documentElement.classList.contains("dark");
                  setTheme(nowDark ? "light" : "dark");
                }}
              >
                <Sun className="hidden size-4 dark:block" />
                <Moon className="size-4 dark:hidden" />
              </button>
              <button
                type="button"
                className="flex h-9 min-w-9 items-center justify-center rounded-md px-1.5 text-[11px] font-semibold tracking-wide text-muted hover:bg-surface-2"
                aria-label={t("Language")}
                title={locale === "en" ? "Español" : "English"}
                onClick={() => setLocale(locale === "en" ? "es" : "en")}
              >
                {locale === "en" ? "ES" : "EN"}
              </button>
              <div className="hidden min-w-0 items-center gap-2 sm:flex">
                <AccountChip />
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
              {section.tabs.map((tabDef) => {
                const tabVal = tabDef.tab || "all";
                const dest = tabDef.to ?? section.to;
                const isActive = tabDef.to ? pathname.startsWith(tabDef.to) : currentTab === tabVal;
                return (
                  <button
                    key={tabDef.label}
                    type="button"
                    onClick={() =>
                      navigate({
                        to: dest,
                        search: {
                          ...(tabDef.to ? {} : (section.search ?? {})),
                          ...(tabDef.search ?? {}),
                          tab: tabVal,
                        } as never,
                      })
                    }
                    className={cn(
                      "relative h-11 shrink-0 px-3 text-sm font-medium",
                      tone === "light"
                        ? isActive
                          ? "text-action"
                          : "text-muted hover:text-fg"
                        : isActive
                          ? ""
                          : "opacity-70 hover:opacity-100",
                    )}
                  >
                    {t(tabDef.label)}
                    {isActive ? (
                      <span
                        className={cn(
                          "absolute inset-x-2 bottom-0 h-0.5 rounded-full",
                          tone === "light" ? "bg-action" : "bg-current",
                        )}
                      />
                    ) : null}
                  </button>
                );
              })}
              {tabActions ? (
                <div className="ml-auto flex items-center gap-2">{tabActions}</div>
              ) : tone !== "light" ? (
                <span className="ml-auto hidden text-current/70 sm:flex">
                  <LayoutGrid className="size-4" />
                </span>
              ) : null}
            </div>
          ) : null}

          {open ? (
            <div className="fixed inset-0 z-40 bg-fg/40 lg:hidden" onClick={() => setOpen(false)}>
              <div className="absolute left-0 top-0 flex h-full w-72 flex-col bg-surface p-4 shadow-lg" onClick={(e) => e.stopPropagation()}>
                <div className="mb-4 flex items-center gap-2">
                  <BrandMark />
                  <div>
                    <div className="text-sm font-semibold">Plein Produce</div>
                    <div className="text-xs text-muted">{t("Produce ops")}</div>
                  </div>
                </div>
                <nav className="flex flex-col gap-1 overflow-y-auto">
                  {visibleModules.map((m) => {
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
                          {t(m.label)}
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
                                {t(s.label)}
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
                    placeholder={t("Search orders, customers, lots…")}
                  />
                </div>
                <p className="px-2 py-3 text-xs text-muted">{t("Jump to a module from the sidebar, or open an order from its list.")}</p>
              </div>
            </div>
          ) : null}

          <main className={cn("min-w-0 flex-1 bg-bg", padded ? "px-4 py-5 sm:px-6" : "")}>{children}</main>
        </div>
      </div>
    </ChromeContext.Provider>
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
  const t = useT();
  return (
    <>
      <button type="button" className="fixed inset-0 z-40 cursor-default" aria-label={t("Close")} onClick={onClose} />
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

function AccountChip() {
  const { isPending } = useCurrentUserState();
  const co = useAsync(() => getCompany(), []);
  if (isPending) return <div className="h-8 w-28 animate-pulse rounded-md bg-surface-2" />;
  return (
    <div className="cosecha-account flex min-w-0 items-center gap-2">
      <div className="hidden leading-tight xl:block">
        <div className="text-xs font-semibold">{co.data?.legal_name || COMPANY.legalName}</div>
      </div>
      <UserButton />
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
  const t = useT();
  return (
    <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-fg">{t(title)}</h1>
        {subtitle ? <p className="mt-0.5 text-sm text-muted">{t(subtitle)}</p> : null}
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
  const t = useT();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);
  return (
    <BodyPortal>
      <div
        data-cosecha-overlay
        className="fixed inset-0 z-[80] flex items-start justify-center overflow-y-auto bg-fg/40 p-3 sm:p-6"
        onClick={onClose}
        role="presentation"
      >
        <div
          className={cn(
            "relative my-2 max-h-[min(92dvh,calc(100dvh-1.5rem))] min-h-0 w-full overflow-y-auto rounded-xl border border-border bg-surface shadow-xl sm:my-4",
            wide ? "max-w-6xl" : "max-w-lg",
          )}
          onClick={(e) => e.stopPropagation()}
          role="dialog"
          aria-modal="true"
          aria-labelledby="cosecha-modal-title"
        >
          <div className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b border-border bg-surface px-5 py-3">
            <div className="min-w-0">
              <h2 id="cosecha-modal-title" className="text-lg font-semibold">
                {t(title)}
              </h2>
              {subtitle ? <p className="mt-0.5 text-xs text-muted">{t(subtitle)}</p> : null}
            </div>
            <button
              type="button"
              className="flex size-10 shrink-0 items-center justify-center rounded-md hover:bg-surface-2"
              onClick={onClose}
              aria-label={t("Close")}
            >
              <X className="size-4" />
            </button>
          </div>
          <div className="p-5">{children}</div>
        </div>
      </div>
    </BodyPortal>
  );
}

export function Drawer({
  title,
  onClose,
  children,
  footer,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  const t = useT();
  return (
    <BodyPortal>
      <div data-cosecha-overlay className="fixed inset-0 z-[80] flex justify-end bg-fg/40">
        <button type="button" className="h-full flex-1" aria-label={t("Close")} onClick={onClose} />
        <div className="flex h-full w-full max-w-xl flex-col border-l border-border bg-surface shadow-xl">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h2 className="text-lg font-semibold">{t(title)}</h2>
          <button type="button" className="flex size-10 items-center justify-center rounded-md hover:bg-surface-2" onClick={onClose}>
            <X className="size-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-5">{children}</div>
        {footer ? <div className="flex justify-end gap-2 border-t border-border px-5 py-3">{footer}</div> : null}
      </div>
    </div>
    </BodyPortal>
  );
}

export function BarSplit({
  left,
  right,
  leftLabel,
  rightLabel,
}: {
  left: number;
  right: number;
  leftLabel: string;
  rightLabel: string;
}) {
  const t = useT();
  const total = Math.max(left + right, 0.01);
  const lp = (left / total) * 100;
  return (
    <div>
      <div className="flex h-3 overflow-hidden rounded-sm bg-surface-2">
        {left > 0 ? <div className="bg-ok" style={{ width: `${lp}%` }} /> : null}
        {right > 0 ? <div className="bg-warn" style={{ width: `${100 - lp}%` }} /> : null}
      </div>
      <div className="mt-2 flex flex-wrap justify-between gap-2 text-xs">
        <span className="text-ok">
          {t(leftLabel)} {money(left)}
        </span>
        <span className="text-warn">
          {t(rightLabel)} {money(right)}
        </span>
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
  const t = useT();
  return (
    <Panel className="p-4">
      <p className="label-caps">{t(label)}</p>
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
      {hint ? <p className="mt-1 text-xs text-subtle">{t(hint)}</p> : null}
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
  const t = useT();
  return (
    <div className={cn("rounded-md border border-border bg-surface px-3 py-2.5", className)}>
      <div className="flex items-start justify-between gap-2">
        <p className="label-caps">{t(label)}</p>
        {action}
      </div>
      <div className="mt-1 text-sm font-medium">{children}</div>
    </div>
  );
}
