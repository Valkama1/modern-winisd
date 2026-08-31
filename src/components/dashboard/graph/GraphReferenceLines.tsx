import { memo } from "react";
import { GraphGeometry } from "./graphGeometry";
import PhaseReferences from "./reference/PhaseReferences";
import RolloffReferences from "./reference/RolloffReferences";
import LimitReferences from "./reference/LimitReferences";

/**
 * Guides drawn over a curve, grouped by what they tell you: where the scale sits,
 * where the response gives out, and where the design runs into something physical.
 *
 * Each group draws only on the curves it applies to, so this composes all three
 * unconditionally.
 */
function GraphReferenceLines({ geo }: { geo: GraphGeometry }) {
  return (
    <>
      <PhaseReferences geo={geo} />
      <RolloffReferences geo={geo} />
      <LimitReferences geo={geo} />
    </>
  );
}

export default memo(GraphReferenceLines);
