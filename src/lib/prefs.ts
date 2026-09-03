import { create } from "zustand";
import { persist } from "zustand/middleware";

export type Theme = "light" | "dark" | "system";
export type Locale = "en" | "es";

type PrefsState = {
  theme: Theme;
  locale: Locale;
  setTheme: (theme: Theme) => void;
  setLocale: (locale: Locale) => void;
};

export const PREFS_STORAGE_KEY = "cosecha-prefs";

export const usePrefs = create<PrefsState>()(
  persist(
    (set) => ({
      theme: "system",
      locale: "es",
      setTheme: (theme) => set({ theme }),
      setLocale: (locale) => set({ locale }),
    }),
    { name: PREFS_STORAGE_KEY },
  ),
);

export function resolvedDark(theme: Theme, systemDark = false): boolean {
  if (theme === "dark") return true;
  if (theme === "light") return false;
  return systemDark;
}

export function applyDocumentTheme(theme: Theme, locale: Locale) {
  if (typeof document === "undefined") return;
  const systemDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  const dark = resolvedDark(theme, systemDark);
  const el = document.documentElement;
  el.classList.toggle("dark", dark);
  el.style.colorScheme = dark ? "dark" : "light";
  el.lang = locale === "es" ? "es" : "en";
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", dark ? "#0e1318" : "#1B6B4C");
}

export function dateLocaleTag(locale?: Locale): string {
  const l = locale ?? usePrefs.getState().locale;
  return l === "es" ? "es-MX" : "en-US";
}

export const THEME_BOOT_SCRIPT = `(function(){try{var r=localStorage.getItem(${JSON.stringify(PREFS_STORAGE_KEY)});var d=r?JSON.parse(r):{};var s=d.state||d;var t=s.theme||"system";var l=s.locale||"es";var dark=t==="dark"||(t!=="light"&&window.matchMedia("(prefers-color-scheme: dark)").matches);var el=document.documentElement;el.classList.toggle("dark",!!dark);el.style.colorScheme=dark?"dark":"light";el.lang=l==="es"?"es":"en";}catch(e){}})();`;
