import { createFileRoute, Navigate } from "@tanstack/react-router";
import { Eye, EyeOff } from "lucide-react";
import { useState } from "react";
import { BrandWordmark } from "@/components/brand";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { GROK_PROVIDERS, authClient, authEnabled, signIn } from "@/lib/auth/client";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { COMPANY } from "@/lib/company";
import { useT } from "@/lib/i18n";

export const Route = createFileRoute("/login")({ component: Login });

function Login() {
  const t = useT();
  const { user, isPending } = useCurrentUserState();
  const [mode, setMode] = useState<"in" | "up">("in");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  if (isPending) {
    return (
      <main className="grid min-h-dvh place-items-center bg-bg">
        <div className="h-10 w-48 animate-pulse rounded-md bg-surface-2" />
      </main>
    );
  }
  if (user) return <Navigate to="/" />;

  async function onEmail(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      if (mode === "up") {
        if (password !== confirm) throw new Error("Passwords do not match");
        const { error } = await authClient.signUp.email({ email: email.trim(), password, name: name.trim() || email.trim() });
        if (error) throw new Error(error.message || "Could not create account");
      } else {
        const { error } = await authClient.signIn.email({ email: email.trim(), password });
        if (error) throw new Error(error.message || "Could not sign in");
      }
      window.location.href = "/";
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : "Could not sign in");
      setBusy(false);
    }
  }

  return (
    <main className="grid min-h-dvh place-items-center bg-bg px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-6">
          <BrandWordmark className="h-12" />
          <p className="mt-2 text-xs text-muted">Cosecha · {COMPANY.legalName}</p>
        </div>
        <div className="rounded-lg border border-border bg-surface p-5 shadow-sm">
          <h1 className="text-lg font-semibold">{mode === "up" ? t("Create account") : t("Sign in")}</h1>
          <p className="mt-1 text-sm text-muted">
            {mode === "up"
              ? t("Creating an account does not open the desk. Miguel grants each person their modules.")
              : t("Warehouse, sales and finance share this company workspace.")}
          </p>

          {authEnabled ? (
            <div className="mt-4 grid gap-2">
              {GROK_PROVIDERS.map((p) => (
                <Button
                  key={p.providerId}
                  type="button"
                  variant="outline"
                  className="w-full justify-center"
                  onClick={() => void signIn(p.providerId, { callbackURL: "/" })}
                >
                  {t("Continue with")} {p.label}
                </Button>
              ))}
            </div>
          ) : (
            <p className="mt-4 text-sm text-muted">{t("Sign-in is disabled.")}</p>
          )}

          <div className="my-4 flex items-center gap-3 text-[11px] uppercase tracking-wide text-subtle">
            <span className="h-px flex-1 bg-border" />
            {t("or email")}
            <span className="h-px flex-1 bg-border" />
          </div>

          <form className="grid gap-3" onSubmit={onEmail}>
            {mode === "up" ? (
              <Field label="Name">
                <Input value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
              </Field>
            ) : null}
            <Field label="Email">
              <Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
            </Field>
            <PasswordField
              label="Password"
              value={password}
              onChange={setPassword}
              show={show}
              onToggle={() => setShow((v) => !v)}
              autoComplete={mode === "up" ? "new-password" : "current-password"}
            />
            {mode === "up" ? (
              <PasswordField
                label="Confirm password"
                value={confirm}
                onChange={setConfirm}
                show={show}
                onToggle={() => setShow((v) => !v)}
                autoComplete="new-password"
              />
            ) : null}
            {err ? <p className="text-sm text-danger">{t(err)}</p> : null}
            <Button type="submit" disabled={busy || !authEnabled} className="w-full">
              {busy ? t("Signing in…") : mode === "up" ? t("Create account") : t("Sign in")}
            </Button>
          </form>

          <button
            type="button"
            className="mt-3 text-sm text-link"
            onClick={() => {
              setMode(mode === "up" ? "in" : "up");
              setErr(null);
            }}
          >
            {mode === "up" ? t("Already have an account? Sign in") : t("Need an account? Create one")}
          </button>
        </div>
      </div>
    </main>
  );
}

function PasswordField({
  label,
  value,
  onChange,
  show,
  onToggle,
  autoComplete,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  show: boolean;
  onToggle: () => void;
  autoComplete: string;
}) {
  const t = useT();
  return (
    <Field label={label}>
      <div className="relative">
        <Input
          type={show ? "text" : "password"}
          required
          minLength={8}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoComplete={autoComplete}
          className="pr-11"
        />
        <button
          type="button"
          className="absolute right-0.5 top-1/2 flex size-9 -translate-y-1/2 items-center justify-center rounded-md text-muted hover:bg-surface-2 hover:text-fg"
          aria-label={show ? t("Hide password") : t("Show password")}
          onClick={onToggle}
        >
          {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
        </button>
      </div>
    </Field>
  );
}
