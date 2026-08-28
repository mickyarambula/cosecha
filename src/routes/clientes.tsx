import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Modal, TabActions } from "@/components/app-shell";
import { PartySkuPanel } from "@/components/party-skus";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { CustomerLocationModal } from "@/components/customer-location-form";
import { createCustomer, listCustomerLocations, listCustomers, setDefaultCustomerLocation, updateCustomer } from "@/lib/produce-server";
import { useAsync } from "@/lib/use-async";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/clientes")({
  validateSearch: (s: Record<string, unknown>) => ({ tab: typeof s.tab === "string" ? s.tab : "list" }),
  component: Page,
});

function Page() {
  const { data, loading, reload } = useAsync(() => listCustomers(), []);
  const [sel, setSel] = useState<number | null>(null);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    name: "",
    address1: "",
    address2: "",
    city: "",
    state: "",
    zip: "",
    phone: "",
    email: "",
    payment_terms: "0",
    code: "",
    credit: "",
    notes: "",
  });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    return (data ?? []).filter((c) => !s || c.name.toLowerCase().includes(s) || (c.city ?? "").toLowerCase().includes(s));
  }, [data, q]);

  const groups = useMemo(() => {
    const map = new Map<string, typeof list>();
    for (const c of list) {
      const letter = (c.name[0] || "#").toUpperCase();
      const arr = map.get(letter) ?? [];
      arr.push(c);
      map.set(letter, arr);
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [list]);

  const current = list.find((c) => c.id === sel) ?? null;
  const [edit, setEdit] = useState({
    name: "",
    phone: "",
    email: "",
    payment_terms: "",
    notes: "",
    contact_name: "",
    city: "",
  });
  const locations = useAsync(() => (current ? listCustomerLocations({ data: { customer_id: current.id } }) : Promise.resolve([])), [current?.id]);
  const [locationModal, setLocationModal] = useState<"new" | number | null>(null);

  function pick(id: number) {
    const c = (data ?? []).find((x) => x.id === id);
    if (!c) return;
    setSel(id);
    setEdit({
      name: c.name,
      phone: c.phone ?? "",
      email: c.email ?? "",
      payment_terms: c.payment_terms ?? "0",
      notes: c.notes ?? "",
      contact_name: c.contact_name ?? "",
      city: c.city ?? "",
    });
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await createCustomer({
        data: {
          name: form.name,
          phone: form.phone || undefined,
          email: form.email || undefined,
          city: form.city || undefined,
          payment_terms: form.payment_terms || undefined,
          notes: form.notes || undefined,
        },
      });
      setOpen(false);
      setForm({
        name: "",
        address1: "",
        address2: "",
        city: "",
        state: "",
        zip: "",
        phone: "",
        email: "",
        payment_terms: "0",
        code: "",
        credit: "",
        notes: "",
      });
      await reload();
    } finally {
      setSaving(false);
    }
  }

  async function save() {
    if (!current) return;
    setSaving(true);
    try {
      await updateCustomer({
        data: {
          id: current.id,
          name: edit.name,
          phone: edit.phone || undefined,
          email: edit.email || undefined,
          payment_terms: edit.payment_terms || undefined,
          notes: edit.notes || undefined,
          contact_name: edit.contact_name || undefined,
          city: edit.city || undefined,
        },
      });
      setMsg("Saved");
      await reload();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex min-h-[calc(100dvh-7rem)]">
      <TabActions>
        <Button size="sm" variant="outline">
          Export all
        </Button>
        <Button size="sm" onClick={() => setOpen(true)}>
          + Add new
        </Button>
      </TabActions>
      <aside className="flex w-full max-w-xs shrink-0 flex-col border-r border-border bg-surface">
        <div className="flex gap-2 border-b border-border p-3">
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search" />
          <Button size="sm" variant="outline">
            Filters
          </Button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">
          {loading ? <p className="p-4 text-sm text-muted">Loading…</p> : null}
          {groups.map(([letter, rows]) => (
            <div key={letter}>
              <p className="bg-surface-2 px-3 py-1 text-xs font-semibold text-muted">{letter}</p>
              {rows.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => pick(c.id)}
                  className={cn(
                    "flex w-full flex-col items-start border-b border-border px-3 py-3 text-left",
                    sel === c.id ? "bg-action/8 ring-1 ring-inset ring-action" : "hover:bg-surface-2",
                  )}
                >
                  <span className="text-sm font-medium">{c.name}</span>
                  <span className="text-xs text-muted">Default</span>
                </button>
              ))}
            </div>
          ))}
        </div>
      </aside>
      <section className="min-w-0 flex-1 overflow-y-auto bg-bg p-5">
        {!current ? (
          <div className="flex h-full flex-col items-center justify-center text-center text-muted">
            <svg viewBox="0 0 80 80" className="mb-4 size-24 text-subtle" aria-hidden>
              <ellipse cx="40" cy="50" rx="18" ry="10" fill="currentColor" opacity="0.2" />
              <path d="M22 48c8-16 16-22 18-22 4 0 8 10 14 14 4 3 8 4 10 10H22z" fill="currentColor" opacity="0.25" />
            </svg>
            <p>Select a customer on the left panel to get more details</p>
          </div>
        ) : (
          <div>
            <div className="mb-4 flex items-center justify-between">
              <h1 className="text-lg font-semibold">Edit Customer</h1>
              {msg ? <span className="text-sm text-ok">{msg}</span> : null}
            </div>
            <div className="grid gap-3 lg:grid-cols-3">
              <Field label="Customer">
                <Input value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} />
              </Field>
              <Field label="Phone number">
                <Input value={edit.phone} onChange={(e) => setEdit({ ...edit, phone: e.target.value })} />
              </Field>
              <Field label="Email">
                <Input type="email" value={edit.email} onChange={(e) => setEdit({ ...edit, email: e.target.value })} />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Delivery route">
                  <Select defaultValue="">
                    <option value="">None</option>
                  </Select>
                </Field>
                <Field label="Price sheet">
                  <Select defaultValue="Default">
                    <option>Default</option>
                  </Select>
                </Field>
              </div>
            </div>
            <p className="mt-3 text-sm">
              This customer is <strong>Enabled</strong>{" "}
              <button type="button" className="text-danger">
                Disable
              </button>
            </p>
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              <Field label="Net D">
                <Input value={edit.payment_terms} onChange={(e) => setEdit({ ...edit, payment_terms: e.target.value })} />
              </Field>
              <Field label="Customer code">
                <Input defaultValue={current.code} />
              </Field>
              <Field label="Credit limit">
                <Input />
              </Field>
            </div>
            <Field label="Notes" className="mt-3">
              <Textarea value={edit.notes} onChange={(e) => setEdit({ ...edit, notes: e.target.value })} />
            </Field>
            <div className="mt-4 space-y-2 text-sm">
              <p className="label-caps">Customer options</p>
              <label className="flex items-center gap-2">
                <input type="checkbox" className="size-4 accent-action" /> Display country of origin on invoices, BOLs, and sales confirmations for this customer
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" className="size-4 accent-action" /> Display SKUs on invoices, BOLs, and sales confirmations for this customer
              </label>
            </div>
            <div className="mt-6">
              <p className="mb-2 text-sm font-semibold">Delivery destinations</p>
              <div className="grid gap-2 sm:grid-cols-2">
                {(locations.data ?? []).map((loc) => (
                  <div key={loc.id} className="rounded-md border border-border p-3 text-xs">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-medium text-fg">{loc.label || loc.address_line}</p>
                        {loc.label ? <p className="text-muted">{loc.address_line}</p> : null}
                        <p className="text-muted">{[loc.city, loc.state, loc.zip].filter(Boolean).join(", ")}</p>
                      </div>
                      {loc.is_default ? <Badge tone="ok">Default</Badge> : null}
                    </div>
                    {loc.receiving_instructions ? <p className="mt-2 whitespace-pre-wrap text-warn">{loc.receiving_instructions}</p> : null}
                    <div className="mt-2 flex gap-3">
                      <button type="button" className="font-medium text-link" onClick={() => setLocationModal(loc.id)}>
                        Edit
                      </button>
                      {!loc.is_default ? (
                        <button
                          type="button"
                          className="font-medium text-link"
                          onClick={() => void setDefaultCustomerLocation({ data: { id: loc.id } }).then(() => locations.reload())}
                        >
                          Set as default
                        </button>
                      ) : null}
                    </div>
                  </div>
                ))}
                <button
                  type="button"
                  className="rounded-md border border-dashed border-border p-3 text-xs text-muted"
                  onClick={() => setLocationModal("new")}
                >
                  + Add destination
                </button>
              </div>
            </div>
            <div className="mt-6">
              <p className="mb-2 text-sm font-semibold">Contacts</p>
              <Field label="Statement delivery method" className="max-w-xs">
                <Select defaultValue="Email">
                  <option>Email</option>
                  <option>Print</option>
                </Select>
              </Field>
              <div className="mt-3 grid gap-2 rounded-md border border-border p-3 sm:grid-cols-4">
                <Input placeholder="Name" defaultValue={edit.contact_name} />
                <Input placeholder="Phone" defaultValue={edit.phone} />
                <Input placeholder="Fax" />
                <Input placeholder="Email address" value={edit.email} onChange={(e) => setEdit({ ...edit, email: e.target.value })} />
              </div>
              <details className="mt-2 rounded-md border border-border p-3 text-sm">
                <summary className="cursor-pointer text-muted">Documents sent to this contact (0)</summary>
                <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {["Price Sheets", "Pick Tickets", "Statements", "Sales Confirmations", "Invoices", "BOLs"].map((d) => (
                    <label key={d} className="flex items-center gap-2">
                      <input type="checkbox" className="size-4 accent-action" /> {d}
                    </label>
                  ))}
                </div>
              </details>
              <button type="button" className="mt-2 text-sm text-link">
                + Add contact
              </button>
            </div>
            <PartySkuPanel partyKind="customer" partyId={current.id} />
            <div className="mt-6 rounded-md border border-dashed border-border p-8 text-center text-sm text-muted">
              Drag and drop files here
              <div>
                or <span className="text-link">Browse files</span>
              </div>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="outline" onClick={() => setSel(null)}>
                Cancel
              </Button>
              <Button disabled={saving} onClick={() => void save()}>
                Save changes
              </Button>
            </div>
          </div>
        )}
      </section>
      {open ? (
        <Modal title="Add Customer" onClose={() => setOpen(false)}>
          <form className="grid gap-3" onSubmit={submit}>
            <Field label="Company name *">
              <Input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </Field>
            <Field label="Address 1">
              <Input value={form.address1} onChange={(e) => setForm({ ...form, address1: e.target.value })} />
            </Field>
            <Field label="Address 2">
              <Input value={form.address2} onChange={(e) => setForm({ ...form, address2: e.target.value })} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="City">
                <Input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
              </Field>
              <Field label="State">
                <Input value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Zip code">
                <Input value={form.zip} onChange={(e) => setForm({ ...form, zip: e.target.value })} />
              </Field>
              <Field label="Phone number">
                <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              </Field>
            </div>
            <Field label="Email">
              <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </Field>
            <div className="grid grid-cols-3 gap-3">
              <Field label="Net D">
                <Input value={form.payment_terms} onChange={(e) => setForm({ ...form, payment_terms: e.target.value })} />
              </Field>
              <Field label="Customer code">
                <Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} />
              </Field>
              <Field label="Credit limit">
                <Input value={form.credit} onChange={(e) => setForm({ ...form, credit: e.target.value })} />
              </Field>
            </div>
            <Field label="Price sheet">
              <Select defaultValue="Default">
                <option>Default</option>
              </Select>
            </Field>
            <Field label="Statement delivery method">
              <Select defaultValue="Email">
                <option>Email</option>
                <option>Print</option>
              </Select>
            </Field>
            <button type="button" className="text-left text-sm text-link">
              + New price sheet
            </button>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                Add customer
              </Button>
            </div>
          </form>
        </Modal>
      ) : null}

      {locationModal !== null && current ? (
        <CustomerLocationModal
          customerId={current.id}
          initial={typeof locationModal === "number" ? (locations.data ?? []).find((l) => l.id === locationModal) : undefined}
          forceDefault={(locations.data ?? []).length === 0}
          onClose={() => setLocationModal(null)}
          onSaved={async () => {
            setLocationModal(null);
            await locations.reload();
          }}
        />
      ) : null}
    </div>
  );
}
