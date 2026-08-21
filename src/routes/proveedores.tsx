import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Modal } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/input";
import { createSupplier, listSuppliers, updateSupplier } from "@/lib/produce-server";
import { useAsync } from "@/lib/use-async";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/proveedores")({ component: Page });

function Page() {
  const { data, loading, reload } = useAsync(() => listSuppliers(), []);
  const [sel, setSel] = useState<number | null>(null);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", contact_name: "", phone: "", city: "", country: "USA", notes: "", tambien_cliente: false });
  const [edit, setEdit] = useState({
    name: "",
    contact_name: "",
    phone: "",
    city: "",
    country: "",
    notes: "",
    enabled: true,
    goods: true,
    services: true,
  });
  const [saving, setSaving] = useState(false);

  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    return (data ?? []).filter((c) => !s || c.name.toLowerCase().includes(s));
  }, [data, q]);
  const groups = useMemo(() => {
    const map = new Map<string, typeof list>();
    for (const c of list) {
      const letter = (c.name[0] || "#").toUpperCase();
      map.set(letter, [...(map.get(letter) ?? []), c]);
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [list]);
  const current = list.find((c) => c.id === sel) ?? null;

  function pick(id: number) {
    const c = (data ?? []).find((x) => x.id === id);
    if (!c) return;
    setSel(id);
    setEdit({
      name: c.name,
      contact_name: c.contact_name ?? "",
      phone: c.phone ?? "",
      city: c.city ?? "",
      country: c.country ?? "",
      notes: c.notes ?? "",
      enabled: c.is_active,
      goods: true,
      services: true,
    });
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await createSupplier({ data: { ...form, contact_name: form.contact_name || undefined } });
      setOpen(false);
      await reload();
    } finally {
      setSaving(false);
    }
  }

  async function save() {
    if (!current) return;
    setSaving(true);
    try {
      await updateSupplier({
        data: {
          id: current.id,
          name: edit.name,
          contact_name: edit.contact_name || undefined,
          phone: edit.phone || undefined,
          city: edit.city || undefined,
          country: edit.country || undefined,
          notes: edit.notes || undefined,
          is_active: edit.enabled,
        },
      });
      await reload();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex min-h-[calc(100dvh-7rem)]">
      <aside className="flex w-full max-w-xs shrink-0 flex-col border-r border-border bg-surface">
        <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2">
          <p className="text-sm font-semibold">Vendors</p>
          <div className="flex gap-2">
            <Button size="sm" variant="outline">
              Export all
            </Button>
            <Button size="sm" onClick={() => setOpen(true)}>
              + Add
            </Button>
          </div>
        </div>
        <div className="p-3">
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search vendors" />
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
                    "flex w-full flex-col items-start border-b border-border px-3 py-3 text-left text-sm font-medium",
                    sel === c.id ? "bg-action/8 ring-1 ring-inset ring-action" : "hover:bg-surface-2",
                  )}
                >
                  {c.name}
                </button>
              ))}
            </div>
          ))}
        </div>
      </aside>
      <section className="min-w-0 flex-1 overflow-y-auto p-5">
        {!current ? (
          <p className="pt-24 text-center text-muted">Select a vendor to edit details</p>
        ) : (
          <div>
            <h1 className="mb-4 text-lg font-semibold">Edit Vendor</h1>
            <div className="grid gap-4 lg:grid-cols-2">
              <div>
                <Field label="Vendor name">
                  <Input value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} />
                </Field>
                <div className="mt-3 grid grid-cols-2 gap-3">
                  <Field label="Net D">
                    <Input defaultValue="0" />
                  </Field>
                  <Field label="Vendor code">
                    <Input defaultValue={current.code} />
                  </Field>
                </div>
              </div>
              <div className="space-y-2 pt-5 text-sm">
                <label className="flex items-center gap-2">
                  <input type="checkbox" className="size-4 accent-action" checked={edit.enabled} onChange={(e) => setEdit({ ...edit, enabled: e.target.checked })} />
                  Vendor is enabled and will be visible when creating orders
                </label>
                <label className="flex items-center gap-2">
                  <input type="checkbox" className="size-4 accent-action" checked={edit.goods} onChange={(e) => setEdit({ ...edit, goods: e.target.checked })} />
                  Goods vendor
                </label>
                <label className="flex items-center gap-2">
                  <input type="checkbox" className="size-4 accent-action" checked={edit.services} onChange={(e) => setEdit({ ...edit, services: e.target.checked })} />
                  Services / Expenses vendor
                </label>
              </div>
            </div>
            <div className="mt-6 grid gap-4 lg:grid-cols-2">
              <div>
                <p className="mb-2 text-sm font-semibold">Shipping Info</p>
                <Field label="Name">
                  <Input />
                </Field>
                <Field label="Address line 1" className="mt-2">
                  <Input />
                </Field>
                <div className="mt-2 grid grid-cols-3 gap-2">
                  <Field label="City">
                    <Input value={edit.city} onChange={(e) => setEdit({ ...edit, city: e.target.value })} />
                  </Field>
                  <Field label="State">
                    <Input />
                  </Field>
                  <Field label="Zip">
                    <Input />
                  </Field>
                </div>
              </div>
              <div>
                <p className="mb-2 text-sm font-semibold">Billing Info</p>
                <Field label="Name">
                  <Input value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} />
                </Field>
                <Field label="Address line 1" className="mt-2">
                  <Input />
                </Field>
                <div className="mt-2 grid grid-cols-3 gap-2">
                  <Field label="City">
                    <Input />
                  </Field>
                  <Field label="State">
                    <Input />
                  </Field>
                  <Field label="Zip">
                    <Input />
                  </Field>
                </div>
              </div>
            </div>
            <div className="mt-6">
              <p className="mb-2 text-sm font-semibold">Contacts</p>
              <div className="grid gap-2 rounded-md border border-border p-3 sm:grid-cols-4">
                <Input placeholder="Name" value={edit.contact_name} onChange={(e) => setEdit({ ...edit, contact_name: e.target.value })} />
                <Input placeholder="Phone" value={edit.phone} onChange={(e) => setEdit({ ...edit, phone: e.target.value })} />
                <Input placeholder="Fax" />
                <Input placeholder="Email address" />
              </div>
            </div>
            <Field label="Notes" className="mt-4">
              <Textarea value={edit.notes} onChange={(e) => setEdit({ ...edit, notes: e.target.value })} />
            </Field>
            <div className="mt-4 flex items-center justify-between">
              <button type="button" className="text-sm text-danger">
                Delete vendor
              </button>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setSel(null)}>
                  Cancel
                </Button>
                <Button disabled={saving} onClick={() => void save()}>
                  Save changes
                </Button>
              </div>
            </div>
          </div>
        )}
      </section>
      {open ? (
        <Modal title="Add vendor" onClose={() => setOpen(false)}>
          <form className="grid gap-3" onSubmit={submit}>
            <Field label="Vendor name">
              <Input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </Field>
            <Field label="Phone">
              <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </Field>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                Add
              </Button>
            </div>
          </form>
        </Modal>
      ) : null}
    </div>
  );
}
