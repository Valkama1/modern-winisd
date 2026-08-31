import { describe, it, expect, vi } from "vitest";
import { useRef } from "react";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { useModalShell } from "./useModalShell";

/**
 * No modal in the app trapped focus, handled Escape, or announced itself as a dialog.
 * Tab from the confirm dialog walked into the Toolbar behind the overlay, and the
 * destructive "Remove Project?" confirm could not be dismissed from the keyboard at all.
 */
function Harness({ open, onClose }: { open: boolean; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const shell = useModalShell({ open, onClose, ref });
  return (
    <>
      <button>behind</button>
      {open && (
        <div ref={ref} {...shell}>
          <h2 id={shell["aria-labelledby"]}>Remove Project?</h2>
          <button>Cancel</button>
          <button>Remove</button>
        </div>
      )}
    </>
  );
}

const openDialog = (onClose = vi.fn()) => {
  const view = render(<Harness open onClose={onClose} />);
  return { onClose, view };
};

describe("useModalShell", () => {
  it("announces itself as a modal dialog with a name", () => {
    openDialog();
    const dialog = screen.getByRole("dialog");
    expect(dialog.getAttribute("aria-modal")).toBe("true");
    expect(dialog).toHaveProperty("ariaLabel", null);
    // The name comes from the heading it points at.
    const labelledBy = dialog.getAttribute("aria-labelledby")!;
    expect(document.getElementById(labelledBy)?.textContent).toBe("Remove Project?");
  });

  it("closes on Escape", () => {
    const { onClose } = openDialog();
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("moves focus into the dialog when it opens", () => {
    openDialog();
    expect(screen.getByRole("dialog").contains(document.activeElement)).toBe(true);
  });

  it("wraps Tab from the last control back to the first", () => {
    openDialog();
    const dialog = screen.getByRole("dialog");
    const remove = screen.getByText("Remove");
    act(() => remove.focus());

    fireEvent.keyDown(dialog, { key: "Tab" });

    expect(document.activeElement).toBe(screen.getByText("Cancel"));
  });

  it("wraps Shift+Tab from the first control to the last", () => {
    openDialog();
    const dialog = screen.getByRole("dialog");
    act(() => screen.getByText("Cancel").focus());

    fireEvent.keyDown(dialog, { key: "Tab", shiftKey: true });

    expect(document.activeElement).toBe(screen.getByText("Remove"));
  });

  it("never lets Tab reach the page behind the overlay", () => {
    openDialog();
    const dialog = screen.getByRole("dialog");
    for (let i = 0; i < 6; i++) fireEvent.keyDown(dialog, { key: "Tab" });
    expect(dialog.contains(document.activeElement)).toBe(true);
    expect(document.activeElement).not.toBe(screen.getByText("behind"));
  });

  it("gives focus back to whatever had it before", () => {
    const onClose = vi.fn();
    const { rerender } = render(<Harness open={false} onClose={onClose} />);
    const opener = screen.getByText("behind");
    act(() => opener.focus());

    rerender(<Harness open onClose={onClose} />);
    expect(screen.getByRole("dialog").contains(document.activeElement)).toBe(true);

    rerender(<Harness open={false} onClose={onClose} />);
    expect(document.activeElement).toBe(opener);
  });
});
