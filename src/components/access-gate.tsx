import { createContext, useContext } from "react";
import { Navigate, useRouterState } from "@tanstack/react-router";
import { BrandMark } from "@/components/brand";
import { UserButton } from "@/lib/auth/gates";
import { canAccess, MODULE_LABELS, type ModuleId, type StaffAccess } from "@/lib/access";
import { useT } from "@/lib/i18n";
import { getMyAccess } from "@/lib/produce-server";
import { useAsync } from "@/lib/use-async";

const AccessContext = createContext<StaffAccess | null>(null);

export function useAccess(): StaffAccess | null {
  return useContext(AccessContext);
}

/**
 * ¿Esta persona trae el módulo? Es la misma pregunta que el servidor le hace a
 * `moduleMiddleware`, hecha en la pantalla para no ofrecer un botón que va a
 * tronar al guardar. La ruta ya la cuida `canAccess`; esto es para los pedazos
 * de una pantalla que pertenecen a OTRO módulo — la liquidación al productor
 * vive en Compras pero es dinero, y el P&L vive en Reportes pero es Finanzas.
 */
export function useHasModule(module: ModuleId): boolean {
  const staff = useAccess();
  if (!staff || staff.status !== "active") return false;
  return staff.role === "admin" || staff.modules.includes(module);
}

/** Lo que se pinta en lugar de la sección que esta persona no puede tocar. */
export function ModuleNotice({ module }: { module: ModuleId }) {
  const t = useT();
  return (
    <div className="rounded-md border border-border bg-surface-2 p-4 text-sm text-muted">
      {t("This section belongs to {m}. Ask an administrator to grant you access.", {
        m: t(MODULE_LABELS[module]),
      })}
    </div>
  );
}

function asStaff(s: {
  id: number;
  name: string;
  email: string | null;
  role: string;
  status: string;
  modules: string[];
  linked: boolean;
} | null): StaffAccess | null {
  if (!s) return null;
  const status: StaffAccess["status"] =
    s.status === "invited" || s.status === "active" || s.status === "disabled" ? s.status : "pending";
  return { ...s, status };
}

export function RequireAccess({ children }: { children: React.ReactNode }) {
  const box = useAsync(() => getMyAccess(), []);
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  if (box.loading) {
    return (
      <div className="grid min-h-dvh place-items-center bg-bg">
        <div className="h-10 w-48 animate-pulse rounded-md bg-surface-2" />
      </div>
    );
  }
  if (box.error) {
    return (
      <WaitingRoom
        title="Could not load access"
        body={box.error}
      />
    );
  }
  const staff = asStaff(box.data);
  if (!staff || staff.status !== "active") {
    return <WaitingRoom staff={staff} />;
  }
  if (!canAccess(staff, pathname)) {
    return <Navigate to="/" />;
  }
  return <AccessContext.Provider value={staff}>{children}</AccessContext.Provider>;
}

function WaitingRoom({
  staff,
  title,
  body,
}: {
  staff?: StaffAccess | null;
  title?: string;
  body?: string;
}) {
  const t = useT();
  const off = staff?.status === "disabled";
  return (
    <main className="grid min-h-dvh place-items-center bg-bg px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-6 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="flex size-11 items-center justify-center">
              <BrandMark className="size-11" />
            </span>
            <div>
              <p className="font-display text-xl font-semibold tracking-tight">Plein Produce</p>
              <p className="text-xs text-muted">Cosecha</p>
            </div>
          </div>
          <UserButton />
        </div>
        <div className="rounded-lg border border-border bg-surface p-5 shadow-sm">
          <h1 className="text-lg font-semibold">
            {t(title || (off ? "Access turned off" : "Waiting for access"))}
          </h1>
          <p className="mt-2 text-sm text-muted">
            {t(
              body ||
                (off
                  ? "An admin turned off this login. Ask Miguel to turn it back on."
                  : "Your account is in. Miguel grants each person the modules they need — orders, warehouse, contacts, finance, reports."),
            )}
          </p>
          {staff?.email ? (
            <p className="mt-3 text-xs text-subtle">
              {staff.name} · {staff.email}
            </p>
          ) : null}
        </div>
      </div>
    </main>
  );
}
