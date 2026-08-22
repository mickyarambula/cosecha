import { useEffect, useLayoutEffect } from "react";
import { applyDocumentTheme, usePrefs } from "@/lib/prefs";

/** Keeps <html> class, lang and color-scheme in sync with stored prefs. */
export function PrefsSync() {
  const theme = usePrefs((s) => s.theme);
  const locale = usePrefs((s) => s.locale);

  useLayoutEffect(() => {
    applyDocumentTheme(theme, locale);
  }, [theme, locale]);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => applyDocumentTheme(usePrefs.getState().theme, usePrefs.getState().locale);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  return null;
}
