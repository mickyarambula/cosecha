import { RequireAccess } from "@/components/access-gate";
import { AppShell } from "@/components/app-shell";
import { PrefsSync } from "@/components/prefs-sync";
import { PreviewHostBridge } from "@/components/preview-host-bridge";
import { RedirectToSignIn } from "@/lib/auth/gates";
import { AuthProvider } from "@/lib/auth/provider";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { THEME_BOOT_SCRIPT } from "@/lib/prefs";
import { createRootRoute, HeadContent, Outlet, Scripts, useRouterState } from "@tanstack/react-router";
import appCss from "../styles.css?url";

const APP_NAME = "Cosecha";

function isPublicPath(pathname: string) {
  return pathname.startsWith("/login") || pathname.startsWith("/portal/") || pathname.startsWith("/doc/");
}

function RequireSession({ children }: { children: React.ReactNode }) {
  const { user, isPending } = useCurrentUserState();
  if (isPending) {
    return (
      <div className="grid min-h-dvh place-items-center bg-bg">
        <div className="h-10 w-48 animate-pulse rounded-md bg-surface-2" />
      </div>
    );
  }
  if (!user) return <RedirectToSignIn />;
  return <>{children}</>;
}

function RootBody() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  if (isPublicPath(pathname)) return <Outlet />;
  return (
    <RequireSession>
      <RequireAccess>
        <AppShell>
          <Outlet />
        </AppShell>
      </RequireAccess>
    </RequireSession>
  );
}

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: APP_NAME },
      { name: "theme-color", content: "#1B6B4C" },
      { name: "description", content: "Produce operations for buyers and sellers: purchase orders, lots, sales, expenses, and reports." },
    ],
    links: [
      { rel: "icon", type: "image/svg+xml", href: "/favicon.svg" },
      { rel: "icon", type: "image/png", sizes: "192x192", href: "/brand/icon-192.png" },
      { rel: "stylesheet", href: appCss },
      { rel: "manifest", href: "/__grok/manifest.webmanifest" },
      { rel: "apple-touch-icon", href: "/brand/icon-180.png" },
    ],
  }),
  component: () => (
    <html lang="es" suppressHydrationWarning>
      <head>
        <HeadContent />
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT_SCRIPT }} />
      </head>
      <body>
        <PreviewHostBridge />
        <PrefsSync />
        <AuthProvider>
          <RootBody />
        </AuthProvider>
        <Scripts />
      </body>
    </html>
  ),
});
