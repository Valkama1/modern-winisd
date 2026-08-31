import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";

vi.mock("../context/ModalsContext", () => ({
  useModalsContext: () => ({ showSettings: false }),
}));

import { useGraphViewport } from "./useGraphViewport";

/** A scroller occupying y = 0..800, as the dashboard panel does. */
function fakeScroller() {
  const el = document.createElement("div");
  el.getBoundingClientRect = () =>
    ({ top: 0, bottom: 800, left: 0, right: 1000, width: 1000, height: 800, x: 0, y: 0 }) as DOMRect;
  let scrollTop = 0;
  Object.defineProperty(el, "scrollTop", {
    get: () => scrollTop,
    // Real scrollers clamp; this one lets it grow, which is the case that matters.
    set: (v: number) => { scrollTop = Math.max(0, v); },
  });
  return el;
}

const mouseDown = (clientY: number) =>
  ({ preventDefault: vi.fn(), clientY }) as unknown as React.MouseEvent;

describe("graph resizing", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers();
  });
  afterEach(() => vi.useRealTimers());

  const start = () => {
    const { result } = renderHook(() => useGraphViewport());
    (result.current.dashboardContainerRef as { current: HTMLElement | null }).current =
      fakeScroller();
    return result;
  };

  it("follows the pointer for an ordinary drag", () => {
    const result = start();
    const before = result.current.graphHeights.spl;

    act(() => result.current.handleResizeStart(mouseDown(400), "spl"));
    act(() => {
      window.dispatchEvent(new MouseEvent("mousemove", { clientY: 460 }));
    });
    expect(result.current.graphHeights.spl).toBe(before + 60);

    act(() => { window.dispatchEvent(new MouseEvent("mouseup")); });
  });

  it("keeps growing while the pointer is held against the bottom edge", () => {
    // The bug: the last visible graph's handle sits at the edge of the window, so a
    // pointer-delta drag runs out of room and the graph cannot be enlarged.
    const result = start();
    const before = result.current.graphHeights.spl;

    act(() => result.current.handleResizeStart(mouseDown(780), "spl"));
    act(() => {
      window.dispatchEvent(new MouseEvent("mousemove", { clientY: 795 })); // hard against it
    });
    const afterPointer = result.current.graphHeights.spl;

    // No further pointer movement is possible — only time passes.
    act(() => { vi.advanceTimersByTime(500); });

    expect(result.current.graphHeights.spl).toBeGreaterThan(afterPointer + 50);
    expect(result.current.graphHeights.spl).toBeGreaterThan(before + 50);

    act(() => { window.dispatchEvent(new MouseEvent("mouseup")); });
  });

  it("stops growing once the drag ends", () => {
    const result = start();
    act(() => result.current.handleResizeStart(mouseDown(780), "spl"));
    act(() => { window.dispatchEvent(new MouseEvent("mousemove", { clientY: 795 })); });
    act(() => { vi.advanceTimersByTime(200); });

    act(() => { window.dispatchEvent(new MouseEvent("mouseup")); });
    const settled = result.current.graphHeights.spl;

    act(() => { vi.advanceTimersByTime(1000); });
    expect(result.current.graphHeights.spl).toBe(settled);
  });

  it("never exceeds the allowed range however long the edge is held", () => {
    const result = start();
    act(() => result.current.handleResizeStart(mouseDown(780), "spl"));
    act(() => { window.dispatchEvent(new MouseEvent("mousemove", { clientY: 799 })); });
    act(() => { vi.advanceTimersByTime(10_000); });
    expect(result.current.graphHeights.spl).toBe(600);

    act(() => { window.dispatchEvent(new MouseEvent("mouseup")); });
  });

  it("releases the cursor override when the drag ends", () => {
    const result = start();
    act(() => result.current.handleResizeStart(mouseDown(400), "spl"));
    expect(document.body.style.cursor).toBe("row-resize");

    act(() => { window.dispatchEvent(new MouseEvent("mouseup")); });
    expect(document.body.style.cursor).toBe("");
  });
});
