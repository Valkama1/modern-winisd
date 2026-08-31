import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { UnitsProvider } from "./UnitsContext";
import { NumberField } from "../components/ui/Field";

describe("units shared across fields", () => {
  it("switches every field of that quantity together, and persists the choice", () => {
    const vas = vi.fn();
    const vb = vi.fn();
    render(
      <UnitsProvider>
        <NumberField label="Vas" unit="L" value={278} onChange={vas} />
        <NumberField label="Vb" unit="L" value={100} onChange={vb} />
        <NumberField label="Fs" unit="Hz" value={33} onChange={() => {}} />
      </UnitsProvider>,
    );

    expect(screen.getByDisplayValue("278")).toBeDefined();
    expect(screen.getByDisplayValue("100")).toBeDefined();

    fireEvent.click(screen.getAllByRole("button", { name: /change unit/i })[0]);

    // Both litres fields moved; hertz has no toggle at all.
    expect(screen.getByDisplayValue("9.817")).toBeDefined();
    expect(screen.getByDisplayValue("3.531")).toBeDefined();
    expect(screen.getByDisplayValue("33")).toBeDefined();
    expect(screen.getAllByRole("button", { name: /change unit/i })).toHaveLength(2);
    expect(vas).not.toHaveBeenCalled();
    expect(vb).not.toHaveBeenCalled();
  });

  it("starts in a unit restored from a saved workspace", () => {
    render(
      <UnitsProvider initial={{ mm: "in" }}>
        <NumberField label="Xmax" unit="mm" value={14} onChange={() => {}} />
      </UnitsProvider>,
    );
    expect(screen.getByDisplayValue("0.551")).toBeDefined();
  });
});
