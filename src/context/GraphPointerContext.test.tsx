import { describe, it, expect } from "vitest";
import { render, act } from "@testing-library/react";
import {
  GraphPointerProvider,
  useHoveredFreq,
  useRulerFreq,
  useGraphPointerActions,
} from "./GraphPointerContext";

/**
 * hoveredFreq updates on every pointer move over any graph. The whole reason this
 * context exists apart from GraphViewportContext is to stop that churn reaching
 * consumers that do not draw from it — but a context subscription is all-or-nothing,
 * so while one value carried both frequencies, reading `rulerFreq` subscribed you to
 * `hoveredFreq` too. AppShell did exactly that, and re-rendered the entire
 * application at pointer-event rate.
 */
function counter() {
  const renders = { count: 0 };
  return renders;
}

describe("GraphPointerProvider", () => {
  it("does not re-render a ruler-only consumer when the pointer moves", () => {
    const ruler = counter();
    let setHovered: (f: number) => void = () => {};

    function RulerOnly() {
      ruler.count++;
      useRulerFreq();
      return null;
    }
    function Mover() {
      const { setHoveredFreq } = useGraphPointerActions();
      setHovered = setHoveredFreq;
      return null;
    }

    render(
      <GraphPointerProvider>
        <RulerOnly />
        <Mover />
      </GraphPointerProvider>,
    );
    const before = ruler.count;

    act(() => setHovered(120));
    act(() => setHovered(240));

    expect(ruler.count).toBe(before);
  });

  it("does not re-render an actions-only consumer when either frequency moves", () => {
    // GraphPanel takes only the setters. Setter identities are stable, so it has no
    // reason to render again — but it did, because the value object was rebuilt.
    const actions = counter();
    let setHovered: (f: number) => void = () => {};
    let setRuler: (f: number) => void = () => {};

    function ActionsOnly() {
      actions.count++;
      const a = useGraphPointerActions();
      setHovered = a.setHoveredFreq;
      setRuler = a.setRulerFreq;
      return null;
    }

    render(
      <GraphPointerProvider>
        <ActionsOnly />
      </GraphPointerProvider>,
    );
    const before = actions.count;

    act(() => setHovered(120));
    act(() => setRuler(60));

    expect(actions.count).toBe(before);
  });

  it("still delivers both frequencies to a consumer that draws from them", () => {
    let seen: [number | null, number | null] = [null, null];
    let setHovered: (f: number) => void = () => {};
    let setRuler: (f: number) => void = () => {};

    function Both() {
      seen = [useHoveredFreq(), useRulerFreq()];
      const a = useGraphPointerActions();
      setHovered = a.setHoveredFreq;
      setRuler = a.setRulerFreq;
      return null;
    }

    render(
      <GraphPointerProvider>
        <Both />
      </GraphPointerProvider>,
    );

    act(() => setHovered(120));
    act(() => setRuler(60));

    expect(seen).toEqual([120, 60]);
  });
});
