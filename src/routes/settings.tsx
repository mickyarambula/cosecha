import { createFileRoute } from "@tanstack/react-router";
import { Monitor, Moon, Sun } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { useAccess } from "@/components/access-gate";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/input";
import { MODULE_IDS, MODULE_LABELS, modulesForRole } from "@/lib/access";
import { COMPANY } from "@/lib/company";
import { useT } from "@/lib/i18n";
import { usePrefs, type Locale, type Theme } from "@/lib/prefs";
import {
  addDepartment,
  addConcept,
  getAppSettings,
  getCompany,
  grantStaff,
  listConcepts,
  listDepartments,
  listSendEvents,
  listStaff,
  previewLiveWipe,
  saveAppSetting,
  saveCompany,
  saveStaff,
  setConceptActive,
  wipeLiveTests,
} from "@/lib/produce-server";
import { useAsync } from "@/lib/use-async";
import { cn, errorMessage, fecha } from "@/lib/utils";

type Search = { tab?: string };
export const Route = createFileRoute("/settings")({
  validateSearch: (s: Record<string, unknown>): Search => ({
    tab: typeof s.tab === "string" ? s.tab : "appearance",
  }),
  component: Page,
});

const SELLER = [
  "View only my sales orders",
  "Create sales orders",
  "Edit sales orders before they are fulfilled",
  "Edit sales orders after they are fulfilled",
  "Edit sales orders after payments have been applied",
  "Edit cash sales orders",
  "Edit terms sales orders after cutoff time",
  "Edit lot assignments and picked quantities",
  "Mark sales orders as fulfilled",
  "Mark sales orders as unfulfilled",
  "View sales by all salespeople in pricing intelligence",
  "View prices on sales orders",
  "Edit prices on sales orders",
  "Edit sales rep on sales orders",
  "Create credit invoices",
  "Edit credit invoices",
];

function Page() {
  const { tab } = Route.useSearch();
  const access = useAccess();
  const admin = access?.role === "admin";
  const settings = useAsync(() => getAppSettings(), []);
  const map = settings.data ?? {};
  const ready = settings.loading ? "pending" : "ready";
  async function setKey(key: string, value: string) {
    await saveAppSetting({ data: { key, value } });
    await settings.reload();
  }

  if (tab === "appearance") return <Appearance />;
  if (tab === "inventory") return <InventorySettings key={ready} map={map} setKey={setKey} />;
  if (tab === "business") return admin ? <Business /> : <Appearance />;
  if (tab === "features") return <SellerTable />;
  if (tab === "orders") return <OrdersSettings map={map} setKey={setKey} />;
  if (tab === "accounting") return <AccountingSettings key={ready} map={map} setKey={setKey} />;
  if (tab === "departments") return <Departments />;
  if (tab === "concepts") return <Concepts />;
  if (tab === "online") return <OnlineSettings map={map} setKey={setKey} />;
  if (tab === "sent") return <SentLog />;
  if (tab === "tests") return admin ? <WipeTests /> : <Appearance />;
  return admin ? <Teams /> : <Appearance />;
}

function InventorySettings({ map, setKey }: { map: Record<string, string>; setKey: (k: string, v: string) => Promise<void> }) {
  const t = useT();
  return (
    <div className="mx-auto max-w-3xl p-6">
      <p className="label-caps">{t("Inventory management")}</p>
      <div className="mt-4 space-y-8">
        <Setting
          title="Allow deactivating inventory items with open lots"
          body="Deactivating such inventories will automatically close any open lots belonging to it and waste remaining O/H quantities. Pending transfers will also be cancelled."
        >
          <Toggle on={flag(map, "deactivate_open_lots", false)} onChange={(v) => void setKey("deactivate_open_lots", String(v))} />
        </Setting>
        <Setting
          title="Days after which to auto-deactivate empty inventory items"
          body='Specify the number of days after which an inventory item with no open lots and no O/H quantity should be automatically deactivated. Set to "-1" to opt out.'
        >
          <Input
            className="w-40"
            defaultValue={map.deactivate_empty_days ?? ""}
            onBlur={(e) => void setKey("deactivate_empty_days", e.target.value)}
          />
        </Setting>
        <Setting
          title="Days after which to auto-close received lots with 0 O/H"
          body="Automatic closing occurs once a day, so you may need to wait a day to see updates."
        >
          <Input
            className="w-40"
            defaultValue={map.auto_close_empty_days ?? ""}
            onBlur={(e) => void setKey("auto_close_empty_days", e.target.value)}
          />
        </Setting>
        <Setting title="Repack pack date default" body="Select the default date that should appear in the Pack Date field for each output lot when creating a repack.">
          <Select
            value={map.repack_pack_date || "Current date"}
            className="w-48"
            onChange={(e) => void setKey("repack_pack_date", e.target.value)}
          >
            <option>{t("Earliest pack date")}</option>
            <option>{t("Current date")}</option>
            <option>{t("No default date")}</option>
          </Select>
        </Setting>
        <p className="label-caps pt-4">{t("Purchases")}</p>
        <Setting
          title="Purchase lot number generation method"
          body="Select how lot numbers will be generated for items on purchase orders. Sequential uses the first three letters of the product name plus a counter. PO # Prefaced combines the PO number with those letters."
        >
          <Select
            value={map.lot_number_method || "PO # Prefaced"}
            className="w-48"
            onChange={(e) => void setKey("lot_number_method", e.target.value)}
          >
            <option>{t("Sequential")}</option>
            <option>{t("PO # Prefaced")}</option>
          </Select>
        </Setting>
      </div>
    </div>
  );
}

function Business() {
  const t = useT();
  const co = useAsync(() => getCompany(), []);
  const [form, setForm] = useState({
    legal_name: COMPANY.legalName as string,
    short_name: COMPANY.shortName as string,
    tagline: COMPANY.tagline as string,
    city: COMPANY.city as string,
    country: COMPANY.country as string,
    email: COMPANY.email as string,
    phone: COMPANY.phone as string,
    address_line: COMPANY.addressLine as string,
    paca_license: COMPANY.pacaLicense as string,
  });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    const d = co.data;
    if (!d) return;
    setForm({
      legal_name: d.legal_name,
      short_name: d.short_name,
      tagline: d.tagline,
      city: d.city,
      country: d.country,
      email: d.email || "",
      phone: d.phone || "",
      address_line: d.address_line || "",
      paca_license: d.paca_license || "",
    });
  }, [co.data]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMsg(null);
    try {
      await saveCompany({ data: form });
      setMsg(t("Saved"));
      await co.reload();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : t("Could not save"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="mx-auto max-w-xl p-6" onSubmit={save}>
      <p className="mb-4 text-sm text-muted">{t("This letterhead prints on purchase orders, invoices and WhatsApp documents.")}</p>
      <Field label="Legal name">
        <Input required value={form.legal_name} onChange={(e) => setForm({ ...form, legal_name: e.target.value })} />
      </Field>
      <Field label="Short name" className="mt-3">
        <Input value={form.short_name} onChange={(e) => setForm({ ...form, short_name: e.target.value })} />
      </Field>
      <Field label="Tagline" className="mt-3">
        <Input value={form.tagline} onChange={(e) => setForm({ ...form, tagline: e.target.value })} />
      </Field>
      <Field label="Address" className="mt-3">
        <Input value={form.address_line} onChange={(e) => setForm({ ...form, address_line: e.target.value })} />
      </Field>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <Field label="City">
          <Input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
        </Field>
        <Field label="Country">
          <Input value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} />
        </Field>
      </div>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <Field label="Email">
          <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        </Field>
        <Field label="Phone">
          <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
        </Field>
      </div>
      <Field label="PACA license" className="mt-3">
        <Input value={form.paca_license} onChange={(e) => setForm({ ...form, paca_license: e.target.value })} />
      </Field>
      {msg ? <p className="mt-3 text-sm text-ok">{msg}</p> : null}
      <Button className="mt-4" type="submit" disabled={saving}>
        {saving ? t("Saving…") : t("Save")}
      </Button>
    </form>
  );
}

function OrdersSettings({ map, setKey }: { map: Record<string, string>; setKey: (k: string, v: string) => Promise<void> }) {
  return (
    <div className="mx-auto max-w-3xl space-y-8 p-6">
      <Setting title="Print order when placed" body="Automatically open a printable purchase order after Place order.">
        <Toggle on={flag(map, "print_po_on_place", false)} onChange={(v) => void setKey("print_po_on_place", String(v))} />
      </Setting>
      <Setting title="Share vendor portal by default" body="When placing a PO, pre-check Share vendor portal to contacts.">
        <Toggle on={flag(map, "share_vendor_portal", true)} onChange={(v) => void setKey("share_vendor_portal", String(v))} />
      </Setting>
      <Setting title="Auto-fulfill sales orders" body="Mark sales orders fulfilled when lot assignment covers every line.">
        <Toggle on={flag(map, "auto_fulfill", true)} onChange={(v) => void setKey("auto_fulfill", String(v))} />
      </Setting>
    </div>
  );
}

function AccountingSettings({ map, setKey }: { map: Record<string, string>; setKey: (k: string, v: string) => Promise<void> }) {
  return (
    <div className="mx-auto max-w-3xl space-y-8 p-6">
      <Setting title="PACA trust language on invoices" body="Print the statutory trust notice on customer invoices.">
        <Toggle on={flag(map, "paca_on_invoices", true)} onChange={(v) => void setKey("paca_on_invoices", String(v))} />
      </Setting>
      <Setting title="Default customer terms (Net D)" body="Used when a new customer is created without terms.">
        <Input
          className="w-24"
          defaultValue={map.default_terms_days ?? "0"}
          onBlur={(e) => void setKey("default_terms_days", e.target.value || "0")}
        />
      </Setting>
      <Setting title="Include expenses in break-even" body="Distribute connected PO expenses into lot B/E.">
        <Toggle on={flag(map, "expenses_in_breakeven", true)} onChange={(v) => void setKey("expenses_in_breakeven", String(v))} />
      </Setting>
    </div>
  );
}

function OnlineSettings({ map, setKey }: { map: Record<string, string>; setKey: (k: string, v: string) => Promise<void> }) {
  return (
    <div className="mx-auto max-w-3xl space-y-8 p-6">
      <Setting title="Enable online ordering" body="Customers can submit orders from the price-sheet portal.">
        <Toggle on={flag(map, "online_ordering", false)} onChange={(v) => void setKey("online_ordering", String(v))} />
      </Setting>
      <Setting title="Require customer PO #" body="Online orders cannot be submitted without a PO number.">
        <Toggle on={flag(map, "require_cpo", false)} onChange={(v) => void setKey("require_cpo", String(v))} />
      </Setting>
    </div>
  );
}

function Departments() {
  const t = useT();
  const depts = useAsync(() => listDepartments(), []);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    setErr(null);
    try {
      await addDepartment({ data: { name: name.trim() } });
      setName("");
      await depts.reload();
    } catch (e2) {
      setErr(errorMessage(e2, "No se pudo agregar el departamento."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="p-6">
      <p className="mb-3 text-sm text-muted">{t("Departments group sales for the Sales by Department report.")}</p>
      <div className="max-w-lg rounded-lg border border-border bg-surface">
        {(depts.data ?? []).map((d) => (
          <div key={d.id} className="flex items-center justify-between border-b border-border px-4 py-3 last:border-0">
            <span className="font-medium">{d.name}</span>
            {d.name === "Uncategorized" ? <span className="text-xs text-muted">{t("Default")}</span> : null}
          </div>
        ))}
        <form className="flex flex-wrap items-start gap-2 border-t border-border px-4 py-3" onSubmit={add}>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Department name" />
          <Button type="submit" size="sm" disabled={saving || !name.trim()}>
            + Add department
          </Button>
          {err ? <p className="w-full rounded-md border border-danger/40 bg-danger/5 p-2 text-sm text-danger">{err}</p> : null}
        </form>
      </div>
    </div>
  );
}

function Concepts() {
  const t = useT();
  const concepts = useAsync(() => listConcepts({ data: { activeOnly: false } }), []);
  const [kind, setKind] = useState<"ingreso" | "gasto">("gasto");
  const [partida, setPartida] = useState("Gasto Administrativo");
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const rows = concepts.data ?? [];
  const partidas =
    kind === "ingreso"
      ? ["Venta", "Abono"]
      : ["Costo", "Gasto de Venta", "Gasto Nómina", "Gasto Administrativo", "Gasto Financiero"];

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    setErr(null);
    try {
      await addConcept({ data: { kind, partida, name: name.trim() } });
      setName("");
      await concepts.reload();
    } catch (e2) {
      setErr(errorMessage(e2, "No se pudo agregar el concepto."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl p-6">
      <p className="mb-3 text-sm text-muted">
        {t("Same lists as the V8 Master. Add a concept here, then pick it on an expense or a Chase line.")}
      </p>
      <div className="mb-3 flex gap-2">
        <Button size="sm" variant={kind === "gasto" ? "default" : "outline"} onClick={() => { setKind("gasto"); setPartida("Costo"); }}>
          {t("Expenses")}
        </Button>
        <Button size="sm" variant={kind === "ingreso" ? "default" : "outline"} onClick={() => { setKind("ingreso"); setPartida("Venta"); }}>
          {t("Income")}
        </Button>
      </div>
      <div className="rounded-lg border border-border bg-surface">
        {rows
          .filter((r) => r.kind === kind)
          .map((r) => (
            <div key={r.id} className="flex items-center justify-between gap-3 border-b border-border px-4 py-2.5 last:border-0">
              <div>
                <p className={r.is_active ? "font-medium" : "text-muted line-through"}>{r.name}</p>
                <p className="text-xs text-muted">{r.partida}</p>
              </div>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => void setConceptActive({ data: { id: r.id, is_active: !r.is_active } }).then(() => concepts.reload())}
              >
                {r.is_active ? t("Archive") : t("Restore")}
              </Button>
            </div>
          ))}
        <form className="grid gap-2 border-t border-border px-4 py-3 sm:grid-cols-[10rem_1fr_auto]" onSubmit={add}>
          <Select
            value={partida}
            onChange={(e) => setPartida(e.target.value)}
          >
            {partidas.map((p) => (
              <option key={p}>{p}</option>
            ))}
          </Select>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={t("New concept")} />
          <Button type="submit" size="sm" disabled={saving || !name.trim()}>
            + {t("Add")}
          </Button>
          {err ? (
            <p className="col-span-full rounded-md border border-danger/40 bg-danger/5 p-2 text-sm text-danger">{err}</p>
          ) : null}
        </form>
      </div>
    </div>
  );
}

function Teams() {
  const t = useT();
  const staff = useAsync(() => listStaff(), []);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", role: "seller" });
  const [grantId, setGrantId] = useState<number | null>(null);
  const [mods, setMods] = useState<string[]>([]);
  const [role, setRole] = useState("seller");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const rows = staff.data ?? [];
  const waiting = rows.filter((s) => s.status === "pending" || s.status === "invited");
  const active = rows.filter((s) => s.status === "active");
  const off = rows.filter((s) => s.status === "disabled");

  async function invite(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMsg(null);
    try {
      await saveStaff({ data: form });
      setForm({ name: "", email: "", role: "seller" });
      setOpen(false);
      await staff.reload();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : t("Could not save"));
    } finally {
      setSaving(false);
    }
  }

  function startGrant(id: number, current: { role: string; modules: string[] }) {
    setGrantId(id);
    setRole(current.role);
    setMods(current.role === "admin" ? [...MODULE_IDS] : current.modules.length ? current.modules : modulesForRole(current.role));
  }

  async function applyGrant(status: "active" | "disabled") {
    if (grantId == null) return;
    setSaving(true);
    setMsg(null);
    try {
      await grantStaff({
        data: {
          id: grantId,
          status,
          role,
          modules: role === "admin" ? [...MODULE_IDS] : mods,
        },
      });
      setGrantId(null);
      await staff.reload();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : t("Could not save"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-5">
      <div>
        <p className="label-caps">{t("Team")}</p>
        <h2 className="text-base font-semibold">{t("Miguel grants modules")}</h2>
        <p className="mt-1 text-sm text-muted">
          {t("A new login waits here. Pick their modules, then allow. Inviting by email pre-grants the role so they walk in ready.")}
        </p>
      </div>
      {msg ? <p className="text-sm text-danger">{msg}</p> : null}

      <section className="rounded-lg border border-border bg-surface">
        <p className="border-b border-border px-4 py-3 text-sm font-semibold">{t("Waiting")}</p>
        {waiting.map((s) => (
          <StaffRow key={s.id} name={s.name} email={s.email} role={s.role} status={s.status} onGrant={() => startGrant(s.id, s)} />
        ))}
        {!waiting.length ? <p className="px-4 py-6 text-sm text-muted">{t("No one is waiting.")}</p> : null}
      </section>

      <section className="rounded-lg border border-border bg-surface">
        <p className="border-b border-border px-4 py-3 text-sm font-semibold">{t("Active")}</p>
        {active.map((s) => (
          <StaffRow
            key={s.id}
            name={s.name}
            email={s.email}
            role={s.role}
            status={s.status}
            modules={s.modules}
            onGrant={() => startGrant(s.id, s)}
          />
        ))}
        {!active.length ? <p className="px-4 py-6 text-sm text-muted">{t("No active people yet.")}</p> : null}
      </section>

      {off.length ? (
        <section className="rounded-lg border border-border bg-surface">
          <p className="border-b border-border px-4 py-3 text-sm font-semibold">{t("Turned off")}</p>
          {off.map((s) => (
            <StaffRow key={s.id} name={s.name} email={s.email} role={s.role} status={s.status} onGrant={() => startGrant(s.id, s)} />
          ))}
        </section>
      ) : null}

      {grantId != null ? (
        <div className="rounded-lg border border-action/40 bg-action/5 p-4">
          <p className="mb-3 text-sm font-semibold">{t("Grant modules")}</p>
          <Field label="Role" className="mb-3 max-w-xs">
            <Select
              value={role}
              onChange={(e) => {
                const next = e.target.value;
                setRole(next);
                setMods(modulesForRole(next));
              }}
            >
              <option value="admin">{t("Admin")}</option>
              <option value="seller">{t("Seller")}</option>
              <option value="buyer">{t("Buyer")}</option>
              <option value="warehouse">{t("Warehouse")}</option>
            </Select>
          </Field>
          <div className="grid gap-2 sm:grid-cols-2">
            {MODULE_IDS.map((id) => (
              <label key={id} className="flex min-h-10 items-center gap-2 rounded-md border border-border bg-surface px-3 text-sm">
                <input
                  type="checkbox"
                  className="size-4 accent-action"
                  checked={role === "admin" || mods.includes(id)}
                  disabled={role === "admin"}
                  onChange={(e) => {
                    setMods((cur) => (e.target.checked ? [...cur, id] : cur.filter((x) => x !== id)));
                  }}
                />
                {t(MODULE_LABELS[id])}
              </label>
            ))}
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button size="sm" disabled={saving} onClick={() => void applyGrant("active")}>
              {saving ? t("Saving…") : t("Allow")}
            </Button>
            <Button size="sm" variant="outline" disabled={saving} onClick={() => void applyGrant("disabled")}>
              {t("Turn off")}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setGrantId(null)}>
              {t("Cancel")}
            </Button>
          </div>
        </div>
      ) : null}

      {open ? (
        <form className="grid gap-3 rounded-lg border border-border bg-surface p-4 sm:grid-cols-3" onSubmit={invite}>
          <Field label="Name">
            <Input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </Field>
          <Field label="Email">
            <Input type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </Field>
          <Field label="Role">
            <Select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
              <option value="admin">{t("Admin")}</option>
              <option value="seller">{t("Seller")}</option>
              <option value="buyer">{t("Buyer")}</option>
              <option value="warehouse">{t("Warehouse")}</option>
            </Select>
          </Field>
          <div className="flex gap-2 sm:col-span-3">
            <Button type="submit" size="sm" disabled={saving}>
              {saving ? t("Saving…") : t("Invite")}
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={() => setOpen(false)}>
              {t("Cancel")}
            </Button>
          </div>
        </form>
      ) : (
        <button type="button" className="text-sm text-link" onClick={() => setOpen(true)}>
          {t("Invite new member")}
        </button>
      )}
    </div>
  );
}

function StaffRow({
  name,
  email,
  role,
  status,
  modules,
  onGrant,
}: {
  name: string;
  email: string | null;
  role: string;
  status: string;
  modules?: string[];
  onGrant: () => void;
}) {
  const t = useT();
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3 last:border-0">
      <div>
        <p className="text-sm font-medium">{name}</p>
        <p className="text-xs text-muted">{email || t("No email")}</p>
        {modules?.length ? (
          <p className="mt-1 text-[11px] text-subtle">{modules.map((m) => t(MODULE_LABELS[m as keyof typeof MODULE_LABELS] || m)).join(" · ")}</p>
        ) : null}
      </div>
      <div className="flex items-center gap-2">
        <span className="rounded-full bg-surface-2 px-2 py-0.5 text-[11px] uppercase tracking-wide text-muted">{t(status)}</span>
        <span className="text-xs text-muted">{t(role)}</span>
        <Button size="sm" variant="outline" onClick={onGrant}>
          {t("Grant")}
        </Button>
      </div>
    </div>
  );
}

function SentLog() {
  const t = useT();
  const ev = useAsync(() => listSendEvents(), []);
  return (
    <div className="p-5">
      <p className="mb-3 text-sm text-muted">{t("Each email or WhatsApp open is logged here. Delivery still happens in your mail or WhatsApp app.")}</p>
      <div className="overflow-x-auto rounded-lg border border-border bg-surface">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="border-b border-border text-xs text-muted">
            <tr>
              <th className="px-4 py-3 font-medium">{t("When")}</th>
              <th className="px-4 py-3 font-medium">{t("Channel")}</th>
              <th className="px-4 py-3 font-medium">{t("Document")}</th>
              <th className="px-4 py-3 font-medium">{t("To")}</th>
            </tr>
          </thead>
          <tbody>
            {(ev.data ?? []).map((row) => (
              <tr key={row.id} className="border-b border-border last:border-0">
                <td className="px-4 py-3 text-xs text-muted">{fecha(row.created_at)}</td>
                <td className="px-4 py-3 capitalize">{row.channel}</td>
                <td className="px-4 py-3">
                  {row.doc_number || "—"}
                  {row.party_name ? <span className="text-muted"> · {row.party_name}</span> : null}
                </td>
                <td className="px-4 py-3 text-xs">{row.address || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!ev.loading && !(ev.data ?? []).length ? <p className="px-4 py-6 text-sm text-muted">{t("Nothing sent yet.")}</p> : null}
      </div>
    </div>
  );
}

function WipeTests() {
  const t = useT();
  const preview = useAsync(() => previewLiveWipe(), []);
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState("");
  const [err, setErr] = useState("");
  const counts = preview.data?.counts;
  const total = preview.data?.total ?? 0;
  const ready = typed.trim().toUpperCase() === "BORRAR" && total > 0 && !busy;

  const rows: Array<[string, number]> = counts
    ? [
        [t("Purchase Orders"), counts.purchase_orders],
        [t("Sales Orders"), counts.sales_orders],
        [t("Live invoices"), counts.invoices],
        [t("Lots"), counts.lots],
        [t("Expenses"), counts.expenses],
        [t("Vendor invoices after corte"), counts.bills],
        [t("Chase lines after corte"), counts.cash],
        [t("Receptions"), counts.receptions],
        [t("Pack-outs"), counts.pack_outs],
        [t("Customer POs"), counts.customer_pos],
        [t("Sent log"), counts.send_events],
      ]
    : [];

  async function run() {
    if (!ready) return;
    setBusy(true);
    setErr("");
    setDone("");
    try {
      const res = await wipeLiveTests({ data: { confirm: "BORRAR" } });
      setDone(
        t("Tests cleared. Opening books are still there.") +
          (res.remaining ? ` (${res.remaining})` : ""),
      );
      setTyped("");
      await preview.reload();
    } catch (e) {
      setErr(e instanceof Error ? e.message : t("Could not save"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5 p-6">
      <div>
        <p className="label-caps">{t("Tests")}</p>
        <h2 className="text-base font-semibold">{t("Wipe tests")}</h2>
        <p className="mt-2 text-sm text-muted">
          {t("Clears every purchase, sale, live invoice, lot and Chase line after the corte. Opening Ingresos, Egresos and Chase stay. Catalog, customers and vendors stay. Real live work after the corte is also deleted — only use this after a test with your partners.")}
        </p>
      </div>

      <div className="rounded-lg border border-border bg-surface">
        {preview.loading && !counts ? <p className="px-4 py-6 text-sm text-muted">{t("Loading…")}</p> : null}
        {rows.map(([label, n]) => (
          <div key={label} className="flex items-center justify-between border-b border-border px-4 py-2.5 last:border-0">
            <span className="text-sm">{label}</span>
            <span className="tabular-nums text-sm font-medium">{n}</span>
          </div>
        ))}
      </div>

      {total === 0 && !preview.loading ? (
        <p className="text-sm text-muted">{t("Nothing after the corte. The books are already clean.")}</p>
      ) : (
        <div className="space-y-3 rounded-lg border border-danger/30 bg-danger/5 p-4">
          <Field label={t('Type BORRAR to confirm')}>
            <Input
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              placeholder="BORRAR"
              className="max-w-xs"
              autoComplete="off"
            />
          </Field>
          <Button variant="danger" disabled={!ready} onClick={() => void run()}>
            {busy ? t("Saving…") : t("Wipe tests")}
          </Button>
        </div>
      )}
      {done ? <p className="text-sm text-ok">{done}</p> : null}
      {err ? <p className="text-sm text-danger">{err}</p> : null}
    </div>
  );
}

function Appearance() {
  const t = useT();
  const theme = usePrefs((s) => s.theme);
  const locale = usePrefs((s) => s.locale);
  const setTheme = usePrefs((s) => s.setTheme);
  const setLocale = usePrefs((s) => s.setLocale);

  const themes: { id: Theme; label: string; hint: string; icon: typeof Sun }[] = [
    { id: "light", label: "Light", hint: "Always light", icon: Sun },
    { id: "dark", label: "Dark", hint: "Always dark", icon: Moon },
    { id: "system", label: "System", hint: "Match this device", icon: Monitor },
  ];
  const langs: { id: Locale; label: string; native: string }[] = [
    { id: "en", label: "English", native: "English" },
    { id: "es", label: "Español", native: "Español" },
  ];

  return (
    <div className="mx-auto max-w-2xl space-y-10 p-6">
      <div>
        <p className="label-caps">{t("Display & language")}</p>
        <h2 className="mt-1 text-lg font-semibold">{t("Appearance")}</h2>
        <p className="mt-1 text-sm text-muted">{t("Choose how Cosecha looks. System follows your device.")}</p>
      </div>

      <div>
        <p className="mb-3 text-sm font-medium">{t("Theme")}</p>
        <div className="grid grid-cols-3 gap-3">
          {themes.map((opt) => {
            const Icon = opt.icon;
            const on = theme === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => setTheme(opt.id)}
                className={cn(
                  "flex flex-col items-start gap-3 rounded-lg border px-3 py-4 text-left transition-colors",
                  on ? "border-action bg-action/8 ring-1 ring-action/40" : "border-border bg-surface hover:bg-surface-2",
                )}
              >
                <span className={cn("flex size-9 items-center justify-center rounded-md", on ? "bg-action text-action-fg" : "bg-surface-2 text-muted")}>
                  <Icon className="size-4" />
                </span>
                <span>
                  <span className="block text-sm font-semibold">{t(opt.label)}</span>
                  <span className="mt-0.5 block text-xs text-muted">{t(opt.hint)}</span>
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <p className="mb-3 text-sm font-medium">{t("Language")}</p>
        <p className="mb-3 text-sm text-muted">
          {t("Interface language for menus, buttons and labels. Product names, lots and documents stay as captured.")}
        </p>
        <div className="grid grid-cols-2 gap-3">
          {langs.map((opt) => {
            const on = locale === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => setLocale(opt.id)}
                className={cn(
                  "flex items-center justify-between rounded-lg border px-4 py-4 text-left transition-colors",
                  on ? "border-action bg-action/8 ring-1 ring-action/40" : "border-border bg-surface hover:bg-surface-2",
                )}
              >
                <span>
                  <span className="block text-sm font-semibold">{opt.native}</span>
                  <span className="mt-0.5 block text-xs text-muted">{opt.id === "en" ? "English" : "Español"}</span>
                </span>
                <span className={cn("size-2.5 rounded-full", on ? "bg-action" : "bg-border")} />
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function SellerTable() {
  const t = useT();
  return (
    <div className="overflow-x-auto p-6">
      <table className="w-full max-w-xl text-left text-sm">
        <thead className="text-xs text-muted">
          <tr>
            <th className="py-2 font-medium">{t("Seller features")}</th>
            <th className="py-2 font-medium">{t("Edit/Allow")}</th>
            <th className="py-2 font-medium">{t("View only")}</th>
          </tr>
        </thead>
        <tbody>
          {SELLER.map((row) => (
            <tr key={row} className="border-t border-border">
              <td className="py-2">{t(row)}</td>
              <td>
                <input type="checkbox" className="size-4 accent-action" />
              </td>
              <td>
                <input type="checkbox" className="size-4 accent-action" />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Setting({ title, body, children }: { title: string; body: string; children: ReactNode }) {
  const t = useT();
  return (
    <div className="grid gap-3 sm:grid-cols-[12rem_1fr] sm:items-start">
      <div>{children}</div>
      <div>
        <p className="font-medium">{t(title)}</p>
        <p className="mt-1 text-sm text-muted">{t(body)}</p>
      </div>
    </div>
  );
}

function flag(map: Record<string, string>, key: string, def: boolean) {
  const v = map[key];
  if (v == null) return def;
  return v === "true";
}

function Toggle({ on, onChange }: { on: boolean; onChange?: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={() => onChange?.(!on)}
      className={cn("inline-flex h-6 w-11 items-center rounded-full p-0.5", on ? "bg-action" : "bg-surface-2")}
    >
      <span className={cn("size-5 rounded-full bg-white shadow", on && "ml-auto")} />
    </button>
  );
}
