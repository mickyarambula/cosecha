import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/input";
import { useT } from "@/lib/i18n";
import { deletePartySku, listPartySkus, listProducts, savePartySku } from "@/lib/produce-server";
import { useAsync } from "@/lib/use-async";

export function PartySkuPanel({
  partyKind,
  partyId,
}: {
  partyKind: "customer" | "vendor";
  partyId: number;
}) {
  const t = useT();
  const products = useAsync(() => listProducts(), []);
  const links = useAsync(() => listPartySkus({ data: { party_kind: partyKind, party_id: partyId } }), [partyKind, partyId]);
  const [packId, setPackId] = useState("");
  const [alias, setAlias] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const options = useMemo(
    () =>
      (products.data ?? []).flatMap((p) =>
        p.packs
          .filter((k) => k.sku_code)
          .map((k) => ({
            id: k.id,
            label: `${k.sku_code} · ${p.name}${p.variety ? ` ${p.variety}` : ""}`,
          })),
      ),
    [products.data],
  );

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!packId) return;
    setSaving(true);
    try {
      await savePartySku({
        data: {
          party_kind: partyKind,
          party_id: partyId,
          pack_style_id: Number(packId),
          alias_sku: alias || undefined,
          notes: notes || undefined,
        },
      });
      setPackId("");
      setAlias("");
      setNotes("");
      await links.reload();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mt-6">
      <p className="mb-1 text-sm font-semibold">{t("Preferred SKUs")}</p>
      <p className="mb-3 text-xs text-muted">
        {partyKind === "customer"
          ? t("SKUs this customer usually orders, plus their item code if it differs from yours.")
          : t("SKUs this vendor grows or packs, plus their item code if it differs from yours.")}
      </p>
      <div className="overflow-x-auto rounded-md border border-border">
        <table className="w-full text-left text-sm">
          <thead className="bg-surface-2 text-[11px] uppercase text-muted">
            <tr>
              <th className="px-3 py-2">{t("Our SKU")}</th>
              <th className="px-3 py-2">{t("Product")}</th>
              <th className="px-3 py-2">{t("Their SKU")}</th>
              <th className="px-3 py-2">{t("Notes")}</th>
              <th className="w-16 px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {(links.data ?? []).map((r) => (
              <tr key={r.id} className="border-t border-border">
                <td className="px-3 py-2 font-mono text-xs">{r.sku_code}</td>
                <td className="px-3 py-2">
                  {r.product_name}
                  {r.variety ? ` · ${r.variety}` : ""}
                </td>
                <td className="px-3 py-2 font-mono text-xs">{r.alias_sku || "—"}</td>
                <td className="px-3 py-2 text-muted">{r.notes || "—"}</td>
                <td className="px-3 py-2 text-right">
                  <button
                    type="button"
                    className="text-xs text-danger"
                    onClick={async () => {
                      await deletePartySku({ data: { id: r.id } });
                      await links.reload();
                    }}
                  >
                    {t("Remove")}
                  </button>
                </td>
              </tr>
            ))}
            {(links.data ?? []).length === 0 ? (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center text-sm text-muted">
                  {t("No linked SKUs yet.")}
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
      <form className="mt-3 grid gap-2 sm:grid-cols-4" onSubmit={add}>
        <Field label={t("SKU")} className="sm:col-span-2">
          <Select value={packId} onChange={(e) => setPackId(e.target.value)}>
            <option value="">{t("Select SKU")}</option>
            {options.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={t("Their SKU")}>
          <Input value={alias} onChange={(e) => setAlias(e.target.value)} placeholder="NGM-PAP-10CT" />
        </Field>
        <Field label={t("Notes")}>
          <Input value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Field>
        <div className="sm:col-span-4 flex justify-end">
          <Button type="submit" size="sm" disabled={saving || !packId}>
            {t("Link SKU")}
          </Button>
        </div>
      </form>
    </div>
  );
}

export function ProductPartyPanel({ productId }: { productId: number }) {
  const t = useT();
  const links = useAsync(() => listPartySkus({ data: { product_id: productId } }), [productId]);
  const customers = links.data?.filter((r) => r.party_kind === "customer") ?? [];
  const vendors = links.data?.filter((r) => r.party_kind === "vendor") ?? [];
  if (!customers.length && !vendors.length) return null;
  return (
    <div className="mt-3 grid gap-2 text-xs sm:grid-cols-2">
      {customers.length ? (
        <p className="text-muted">
          <span className="font-semibold text-fg">{t("Customers")}: </span>
          {customers.map((c) => `${c.party_name}${c.alias_sku ? ` (${c.alias_sku})` : ""}`).join(", ")}
        </p>
      ) : null}
      {vendors.length ? (
        <p className="text-muted">
          <span className="font-semibold text-fg">{t("Vendors")}: </span>
          {vendors.map((c) => `${c.party_name}${c.alias_sku ? ` (${c.alias_sku})` : ""}`).join(", ")}
        </p>
      ) : null}
    </div>
  );
}
