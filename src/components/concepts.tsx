import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/input";
import { addConcept, listConcepts } from "@/lib/produce-server";
import { useAsync } from "@/lib/use-async";
import { useT } from "@/lib/i18n";

const PARTIDAS: Record<"ingreso" | "gasto", string[]> = {
  ingreso: ["Venta", "Abono"],
  gasto: ["Costo", "Gasto de Venta", "Gasto Nómina", "Gasto Administrativo", "Gasto Financiero"],
};

export function ConceptSelect({
  kind,
  value,
  onChange,
}: {
  kind: "ingreso" | "gasto";
  value: string;
  onChange: (name: string) => void;
}) {
  const t = useT();
  const concepts = useAsync(() => listConcepts({ data: { kind, activeOnly: true } }), [kind]);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [partida, setPartida] = useState(PARTIDAS[kind][0]);
  const [saving, setSaving] = useState(false);

  const groups = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const r of concepts.data ?? []) {
      const list = map.get(r.partida) ?? [];
      list.push(r.name);
      map.set(r.partida, list);
    }
    return [...map.entries()];
  }, [concepts.data]);

  async function saveNew() {
    if (!name.trim()) return;
    setSaving(true);
    try {
      const r = await addConcept({ data: { kind, partida, name: name.trim() } });
      onChange(r.name);
      setName("");
      setAdding(false);
      await concepts.reload();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="grid gap-2">
      <Select
        value={adding ? "__new__" : value}
        onChange={(e) => {
          if (e.target.value === "__new__") setAdding(true);
          else {
            setAdding(false);
            onChange(e.target.value);
          }
        }}
      >
        <option value="">{t("Select a type")}</option>
        {groups.map(([g, names]) => (
          <optgroup key={g} label={g}>
            {names.map((n) => (
              <option key={`${g}-${n}`} value={n}>
                {n}
              </option>
            ))}
          </optgroup>
        ))}
        <option value="__new__">+ {t("New type")}</option>
      </Select>
      {adding ? (
        <div className="grid gap-2 rounded-md border border-border bg-surface-2 p-2 sm:grid-cols-[1fr_1fr_auto]">
          <Field label={t("Class")}>
            <Select value={partida} onChange={(e) => setPartida(e.target.value)}>
              {PARTIDAS[kind].map((p) => (
                <option key={p}>{p}</option>
              ))}
            </Select>
          </Field>
          <Field label={t("Concept")}>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={t("e.g. Certificados")} />
          </Field>
          <div className="flex items-end">
            <Button type="button" size="sm" disabled={saving || !name.trim()} onClick={() => void saveNew()}>
              {t("Add")}
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export { PARTIDAS };
