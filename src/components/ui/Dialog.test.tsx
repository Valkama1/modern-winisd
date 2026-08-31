import { describe, it, expect } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { DialogProvider, useDialog } from "./Dialog";

function Opener() {
  const { confirmDialog } = useDialog();
  return (
    <button
      onClick={async () => {
        (window as unknown as { result?: boolean }).result = await confirmDialog({
          title: "Remove Project?",
          body: "This cannot be undone.",
          confirmLabel: "Remove",
        });
      }}
    >
      open
    </button>
  );
}

const open = () => {
  render(
    <DialogProvider>
      <Opener />
    </DialogProvider>,
  );
  fireEvent.click(screen.getByText("open"));
};

describe("confirm dialog", () => {
  it("announces itself as a dialog named by its title", () => {
    open();
    const dialog = screen.getByRole("dialog");
    expect(dialog.getAttribute("aria-modal")).toBe("true");
    const labelledBy = dialog.getAttribute("aria-labelledby")!;
    expect(document.getElementById(labelledBy)?.textContent).toBe("Remove Project?");
  });

  it("can be dismissed from the keyboard", async () => {
    // The analysis's example: the destructive "Remove Project?" confirm had no
    // Escape handling and no way out but the mouse.
    open();
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    await act(async () => {});
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("resolves Escape as a refusal, never as agreement", async () => {
    // Dismissing a destructive confirm must not be read as confirming it.
    open();
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    await act(async () => {});
    expect((window as unknown as { result?: boolean }).result).toBe(false);
  });

  it("keeps Tab inside the overlay", () => {
    open();
    const dialog = screen.getByRole("dialog");
    for (let i = 0; i < 5; i++) fireEvent.keyDown(dialog, { key: "Tab" });
    expect(dialog.contains(document.activeElement)).toBe(true);
    expect(document.activeElement).not.toBe(screen.getByText("open"));
  });
});
