import { useState } from "react";
import { Modal } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Field, Textarea } from "@/components/ui/input";
import { useT } from "@/lib/i18n";

/**
 * Confirm + optional reason for any cancel action. The server does the real
 * validation (blocks with a clear message when something is chained after
 * the document) — this is just the capture + confirm step.
 */
export function CancelDialog({
  title,
  subtitle,
  onClose,
  onConfirm,
}: {
  title: string;
  subtitle?: string;
  onClose: () => void;
  onConfirm: (reason: string) => Promise<void>;
}) {
  const t = useT();
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function confirm() {
    setBusy(true);
    setErr(null);
    try {
      await onConfirm(reason.trim());
    } catch (e) {
      setErr(e instanceof Error ? e.message : t("No se pudo cancelar"));
      setBusy(false);
    }
  }

  return (
    <Modal title={title} subtitle={subtitle} onClose={onClose}>
      <div className="grid gap-3">
        <Field label={t("Motivo (opcional)")}>
          <Textarea value={reason} onChange={(e) => setReason(e.target.value)} className="min-h-20" />
        </Field>
        {err ? <p className="text-sm text-danger">{err}</p> : null}
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose} disabled={busy}>
            {t("No, regresar")}
          </Button>
          <Button onClick={() => void confirm()} disabled={busy}>
            {busy ? t("Cancelando…") : t("Sí, cancelar")}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

export function CancelledNote({ by, at, reason }: { by?: string | null; at?: string | null; reason?: string | null }) {
  const t = useT();
  if (!at) return null;
  return (
    <p className="text-xs text-danger">
      {t("Cancelado por")} {by || "—"} · {new Date(at).toLocaleString()}
      {reason ? ` · ${reason}` : ""}
    </p>
  );
}
