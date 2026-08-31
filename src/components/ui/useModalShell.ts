import { RefObject, useEffect, useId, useRef } from "react";

/** Anything a user can Tab to. Disabled and negative-tabindex controls are excluded. */
const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), ' +
  'textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

function focusableWithin(el: HTMLElement): HTMLElement[] {
  // `checkVisibility` is the accurate test but jsdom does not implement it, and
  // `offsetParent` is null for everything there — either would make the trap look
  // correct in tests and skip real controls, or the reverse. Guarding on the method
  // existing keeps the browser precise and the tests honest, with the `hidden`
  // attribute covering the case that matters in both.
  return Array.from(el.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((n) => {
    if (n.closest("[hidden]")) return false;
    return typeof n.checkVisibility === "function" ? n.checkVisibility() : true;
  });
}

/**
 * The behaviour a modal owes its keyboard users, in one place.
 *
 * No modal in the app had any of it: no role, no aria-modal, no Escape, no focus
 * management. Tab from the confirm dialog walked into the Toolbar behind the overlay,
 * and the destructive "Remove Project?" confirm could not be dismissed from the
 * keyboard at all — the only way out was the mouse.
 *
 * Spread the returned props onto the dialog element and give the heading the returned
 * `aria-labelledby` id, so the dialog is announced by its own title.
 */
export function useModalShell({
  open,
  onClose,
  ref,
}: {
  open: boolean;
  onClose: () => void;
  ref: RefObject<HTMLElement | null>;
}) {
  const labelId = useId();
  const restoreTo = useRef<HTMLElement | null>(null);

  // Remember what had focus, move it inside, and hand it back on close. Without the
  // last step, dismissing a dialog drops the caret at the top of the document and a
  // keyboard user has to Tab back to where they were.
  useEffect(() => {
    if (!open) return;
    restoreTo.current = document.activeElement as HTMLElement | null;

    const el = ref.current;
    if (el) {
      const first = focusableWithin(el)[0];
      if (first) {
        first.focus();
      } else {
        el.setAttribute("tabindex", "-1");
        el.focus();
      }
    }

    return () => restoreTo.current?.focus?.();
  }, [open, ref]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      e.stopPropagation();
      onClose();
      return;
    }
    if (e.key !== "Tab") return;

    const el = ref.current;
    if (!el) return;
    const items = focusableWithin(el);
    if (items.length === 0) return;

    // Cycle within the dialog rather than letting Tab escape to the page behind it.
    const active = document.activeElement as HTMLElement | null;
    const idx = active ? items.indexOf(active) : -1;
    const next = e.shiftKey
      ? items[(idx <= 0 ? items.length : idx) - 1]
      : items[(idx + 1) % items.length];
    e.preventDefault();
    next.focus();
  };

  return {
    role: "dialog" as const,
    "aria-modal": true,
    "aria-labelledby": labelId,
    onKeyDown,
  };
}
