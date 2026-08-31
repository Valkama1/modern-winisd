import { useId, useState } from "react";
import { AlertTriangle, Info } from "lucide-react";
import { CurveType } from "../../../types";
import { Caveat, caveatsFor, modelCaveats, worstTier } from "../../../lib/modelCaveats";
import { useProjectsContext } from "../../../context/ProjectsContext";
import { useSimulationContext } from "../../../context/SimulationContext";

/**
 * One glyph carrying everything the model had to assume for this curve.
 *
 * This replaces a line of always-visible text that said one thing (the radiation
 * limit) whether or not it mattered, and said nothing about the far more consequential
 * case of a missing Le. The rule here is that a design with nothing wrong with it
 * renders nothing at all — an indicator that is always present is an indicator nobody
 * reads.
 *
 * No count badge, deliberately: a number invites reading the count instead of the
 * reason.
 */
export default function GraphCaveats({ mode, fMax }: { mode: CurveType; fMax: number }) {
  const { projects } = useProjectsContext();
  const { kaLimitByProject } = useSimulationContext();
  const [open, setOpen] = useState(false);
  const panelId = useId();

  const shown = projects.filter((p) => p.showOnGraph);
  const perProject = shown
    .map((p) => ({
      project: p,
      caveats: caveatsFor(modelCaveats(p, kaLimitByProject[p.id] ?? Infinity), mode, fMax),
    }))
    .filter((entry) => entry.caveats.length > 0);

  const all = perProject.flatMap((entry) => entry.caveats);
  const tier = worstTier(all);
  if (!tier) return null;

  const Glyph = tier === "warning" ? AlertTriangle : Info;
  const colour = tier === "warning" ? "var(--accent-color)" : "var(--text-muted-color)";

  return (
    <span
      className="relative inline-flex"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        data-tier={tier}
        aria-label={`Model caveats for this graph (${all.length})`}
        aria-expanded={open}
        aria-describedby={open ? panelId : undefined}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        // No onClick: a mouse click reaches this button only after the wrapping
        // span's onMouseEnter and the native pre-click focus have both already set
        // open=true, so a toggle here would close the popover the instant it was
        // clicked. Matches Tooltip.tsx (hover/focus only, no click), and it fixes
        // touch for free — there is no hover there, so a tap's focus is what opens it.
        className="inline-flex items-center cursor-pointer opacity-70 hover:opacity-100 focus:outline-none focus-visible:ring-1 focus-visible:ring-[var(--accent-color)] rounded"
        style={{ color: colour }}
      >
        <Glyph className="h-3.5 w-3.5" />
      </button>

      {open && (
        <span
          id={panelId}
          role="note"
          className="absolute z-50 top-full left-0 mt-1.5 w-80 p-2.5 rounded shadow-lg text-2xs flex flex-col gap-2 text-left"
          style={{
            backgroundColor: "var(--sidebar-color)",
            color: "var(--text-color)",
            border: "1px solid var(--border-color)",
          }}
        >
          {perProject.map(({ project, caveats }) => (
            <span key={project.id} className="flex flex-col gap-1.5">
              {/* Keyed on how many projects are on the graph, not how many have
                  something to say — a lone caveat still needs a name attached when a
                  second, clean project is sharing the axes. */}
              {shown.length > 1 && (
                <span className="font-semibold" style={{ color: project.color }}>
                  {project.name}
                </span>
              )}
              {caveats.map((c: Caveat) => (
                <span key={c.id} className="flex flex-col">
                  <span
                    className="font-semibold"
                    style={{
                      color:
                        c.tier === "warning" ? "var(--accent-color)" : "var(--text-muted-color)",
                    }}
                  >
                    {c.title}
                  </span>
                  <span className="opacity-75 leading-snug">{c.detail}</span>
                </span>
              ))}
            </span>
          ))}
        </span>
      )}
    </span>
  );
}
