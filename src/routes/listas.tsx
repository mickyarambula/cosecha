import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader, Panel } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { useT } from "@/lib/i18n";
import { addValueList, listValueLists } from "@/lib/produce-server";
import { useAsync } from "@/lib/use-async";

export const Route = createFileRoute("/listas")({ component: Page });

const KINDS = [
  { id: "empaque" as const, title: "Pack", hint: "Caja, Bolsa, Saco…" },
  { id: "calibre" as const, title: "Count", hint: "7 ct, 10 ct, 12 ct…" },
  { id: "grado" as const, title: "Grade", hint: "Fancy, Choice, Extra…" },
];

function Page() {
  const t = useT();
  const lists = useAsync(() => listValueLists(), []);
  const [draft, setDraft] = useState<Record<string, string>>({ empaque: "", calibre: "", grado: "" });
  const [saving, setSaving] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function add(kind: "empaque" | "calibre" | "grado") {
    const value = (draft[kind] || "").trim();
    if (!value) return;
    setSaving(kind);
    setErr(null);
    setMsg(null);
    try {
      await addValueList({ data: { kind, value } });
      setDraft((d) => ({ ...d, [kind]: "" }));
      setMsg(`“${value}” agregado a ${kind}`);
      await lists.reload();
    } catch (e) {
      setErr(e instanceof Error ? e.message : t("Could not add"));
    } finally {
      setSaving(null);
    }
  }

  const data = lists.data;

  return (
    <div>
      <PageHeader
        title={t("Price Sheets")}
        subtitle={t("Pack, count and grade vocabulary that feeds SKU builders.")}
      />
      {msg ? <p className="mb-3 text-sm text-ok">{msg}</p> : null}
      {err ? <p className="mb-3 text-sm text-danger">{err}</p> : null}
      {lists.loading ? <p className="text-sm text-muted">{t("Loading…")}</p> : null}
      {lists.error ? <p className="text-sm text-danger">{lists.error}</p> : null}
      <div className="grid gap-4 lg:grid-cols-3">
        {KINDS.map((k) => {
          const rows = data?.[k.id] ?? [];
          return (
            <Panel key={k.id}>
              <h2 className="font-display text-lg font-semibold">{t(k.title)}</h2>
              <p className="mb-3 text-xs text-muted">{k.hint}</p>
              <ul className="mb-4 space-y-1">
                {rows.map((r) => (
                  <li key={r.id} className="rounded-md bg-surface-2 px-3 py-2 text-sm">
                    {r.value}
                  </li>
                ))}
                {rows.length === 0 ? <li className="text-sm text-muted">{t("Empty")}</li> : null}
              </ul>
              <form
                className="grid gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  void add(k.id);
                }}
              >
                <Field label={`New ${k.title.toLowerCase()}`}>
                  <Input
                    value={draft[k.id]}
                    onChange={(e) => setDraft((d) => ({ ...d, [k.id]: e.target.value }))}
                    placeholder={k.id === "calibre" ? "20 ct" : undefined}
                  />
                </Field>
                <Button type="submit" size="sm" disabled={saving === k.id || !draft[k.id].trim()}>
                  {saving === k.id ? t("Adding…") : t("Add")}
                </Button>
              </form>
            </Panel>
          );
        })}
      </div>
    </div>
  );
}
