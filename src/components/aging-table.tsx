import { useT } from "@/lib/i18n";
import { AGING_BUCKETS, agingByDue, emptyAging, money, type AgingBucket } from "@/lib/utils";

/**
 * La antigüedad de una cartera, por **fecha compromiso** (hallazgo 51).
 *
 * Un solo cálculo para las tres pantallas que la enseñan — CxC, CxP y Gastos —
 * porque antes cada una lo hacía a su manera: Gastos medía por fecha de
 * emisión aunque el servidor ya le mandaba el vencimiento, CxP no tenía
 * antigüedad, y lo que no traía vencimiento se escondía en "corriente".
 *
 * La columna **"Sin plazo"** es el punto: un documento sin fecha compromiso no
 * está al corriente ni vencido — le falta el dato, y así se ve que hay que
 * capturarlo en vez de dar por bueno un vencimiento inventado.
 */
export type AgingRow = { due_date?: string | null; saldo: number };

export function groupAging<T extends AgingRow>(rows: readonly T[], keyOf: (r: T) => string) {
  const by = new Map<string, Record<AgingBucket, number> & { total: number }>();
  for (const r of rows) {
    if (r.saldo <= 0.009) continue;
    const key = keyOf(r);
    const cur = by.get(key) ?? { ...emptyAging(), total: 0 };
    cur[agingByDue(r.due_date)] += r.saldo;
    cur.total += r.saldo;
    by.set(key, cur);
  }
  return [...by.entries()].sort((a, b) => b[1].total - a[1].total);
}

export function AgingTable({
  header,
  groups,
  note,
}: {
  header: string;
  groups: [string, Record<AgingBucket, number> & { total: number }][];
  note?: string;
}) {
  const t = useT();
  const tot = groups.reduce(
    (s, [, v]) => {
      for (const b of AGING_BUCKETS) s[b] += v[b];
      s.total += v.total;
      return s;
    },
    { ...emptyAging(), total: 0 },
  );
  const hayS = tot.no_terms > 0.009;
  return (
    <div>
      {note ? <p className="px-5 pt-4 text-sm text-muted">{note}</p> : null}
      {hayS ? (
        <p className="mx-5 mt-4 rounded-md border border-border bg-surface-2 p-3 text-sm">
          <strong>{money(tot.no_terms)}</strong> sin fecha de vencimiento capturada. No se cuenta
          como corriente ni como vencido — captura el plazo y aparece donde va.
        </p>
      ) : null}
      <div className="overflow-x-auto p-4">
        <table className="w-full min-w-[860px] text-left text-sm">
          <thead className="border-y border-border bg-surface-2 text-[11px] uppercase text-muted">
            <tr>
              <th className="px-3 py-2">{t(header)}</th>
              <th className="px-3 py-2 text-right">{t("Current")}</th>
              <th className="px-3 py-2 text-right">1-30</th>
              <th className="px-3 py-2 text-right">31-60</th>
              <th className="px-3 py-2 text-right">61-90</th>
              <th className="px-3 py-2 text-right">91+</th>
              <th className="px-3 py-2 text-right">Sin plazo</th>
              <th className="px-3 py-2 text-right">{t("Total")}</th>
            </tr>
          </thead>
          <tbody className="tabular-nums">
            {groups.map(([name, v]) => (
              <tr key={name} className="border-b border-border">
                <td className="px-3 py-2">{name}</td>
                <td className="px-3 py-2 text-right">{money(v.current)}</td>
                <td className="px-3 py-2 text-right">{money(v.b30)}</td>
                <td className="px-3 py-2 text-right">{money(v.b60)}</td>
                <td className="px-3 py-2 text-right">{money(v.b90)}</td>
                <td className="px-3 py-2 text-right">{money(v.b91)}</td>
                <td className="px-3 py-2 text-right text-muted">
                  {v.no_terms > 0.009 ? money(v.no_terms) : "—"}
                </td>
                <td className="px-3 py-2 text-right font-medium">{money(v.total)}</td>
              </tr>
            ))}
            {groups.length ? (
              <tr className="border-b-2 border-border font-medium">
                <td className="px-3 py-2">{t("Total")}</td>
                <td className="px-3 py-2 text-right">{money(tot.current)}</td>
                <td className="px-3 py-2 text-right">{money(tot.b30)}</td>
                <td className="px-3 py-2 text-right">{money(tot.b60)}</td>
                <td className="px-3 py-2 text-right">{money(tot.b90)}</td>
                <td className="px-3 py-2 text-right">{money(tot.b91)}</td>
                <td className="px-3 py-2 text-right">{tot.no_terms > 0.009 ? money(tot.no_terms) : "—"}</td>
                <td className="px-3 py-2 text-right">{money(tot.total)}</td>
              </tr>
            ) : (
              <tr>
                <td className="px-3 py-6 text-center text-muted" colSpan={8}>
                  {t("Nothing here yet.")}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
