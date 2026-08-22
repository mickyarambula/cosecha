import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

/** Render overlays on document.body so sticky / backdrop-blur ancestors cannot trap `position: fixed`. */
export function BodyPortal({ children }: { children: ReactNode }) {
  const [target, setTarget] = useState<HTMLElement | null>(null);
  useEffect(() => setTarget(document.body), []);
  if (!target) return null;
  return createPortal(children, target);
}
