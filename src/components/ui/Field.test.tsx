import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { NumberField } from "./Field";

/**
 * Scroll-to-adjust reads the value the user has typed, not the value the prop last
 * committed. Those two disagree exactly while a field is mid-edit — which is when the
 * raw-string tolerance is holding an intermediate state like "30." — so the wheel
 * handler keeps its own ref rather than closing over the prop.
 *
 * The handler is a manually-attached { passive: false } native listener, because
 * React's onWheel prop is passive and cannot preventDefault. That means these tests
 * dispatch a real WheelEvent rather than using fireEvent.wheel's React synthetic path.
 */
const wheel = (el: Element, deltaY: number) =>
  el.dispatchEvent(new WheelEvent("wheel", { deltaY, bubbles: true, cancelable: true }));

describe("NumberField scroll-to-adjust", () => {
  it("steps up from the committed value when the field is focused", () => {
    const onChange = vi.fn();
    render(<NumberField label="Vb" value={100} step={5} onChange={onChange} />);
    const input = screen.getByDisplayValue("100");

    input.focus();
    wheel(input, -1);

    expect(onChange).toHaveBeenCalledWith(105);
  });

  it("steps down, and respects a minimum", () => {
    const onChange = vi.fn();
    render(<NumberField label="Vb" value={2} step={5} min={0} onChange={onChange} />);
    const input = screen.getByDisplayValue("2");

    input.focus();
    wheel(input, 1);

    expect(onChange).toHaveBeenCalledWith(0);
  });

  it("ignores the wheel unless the field is focused", () => {
    const onChange = vi.fn();
    render(<NumberField label="Vb" value={100} step={5} onChange={onChange} />);
    const input = screen.getByDisplayValue("100");

    wheel(input, -1);

    expect(onChange).not.toHaveBeenCalled();
  });

  it("steps from what the user has typed, not from the last committed prop", () => {
    // The reason the handler keeps a ref at all: typing 250 without blurring leaves
    // the prop at 100, and a wheel step must move from 250.
    const onChange = vi.fn();
    render(<NumberField label="Vb" value={100} step={5} onChange={onChange} />);
    const input = screen.getByDisplayValue("100");

    input.focus();
    fireEvent.change(input, { target: { value: "250" } });
    onChange.mockClear();
    wheel(input, -1);

    expect(onChange).toHaveBeenCalledWith(255);
  });
});
