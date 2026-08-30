import { GraphGeometry, PADDING } from "./graphGeometry";
import { useProjectsContext } from "../../../context/ProjectsContext";

const { left: paddingLeft, right: paddingRight } = PADDING;

/** In-canvas chart title and the per-project colour key, drawn inside the SVG. */
export default function GraphLegend({ geo }: { geo: GraphGeometry }) {
  const { projects, activeProjectId } = useProjectsContext();
  const { width, title } = geo;

  return (
    <>
      {/* SVG Chart Title */}
      <text
        x={paddingLeft}
        y={26}
        fill="var(--text-color)"
        fontSize="12.5"
        fontWeight="bold"
        className="opacity-90 tracking-wide"
      >
        {title}
      </text>

      {/* SVG Chart Legend */}
      {projects.filter(p => p.showOnGraph).map((project, idx) => {
        const spacing = 125;
        const activeProjs = projects.filter(p => p.showOnGraph);
        const x = width - paddingRight - (activeProjs.length - idx) * spacing;
        const isActive = project.id === activeProjectId;
        return (
          <g key={`legend-${project.id}`} transform={`translate(${x}, 18)`}>
            <circle
              cx="5"
              cy="7"
              r="3.5"
              fill={project.color}
            />
            <text
              x="14"
              y="10.5"
              fill="var(--text-color)"
              fontSize="9.5"
              fontWeight={isActive ? "bold" : "normal"}
              className="font-sans opacity-75"
            >
              {project.name.length > 18 ? `${project.name.slice(0, 15)}...` : project.name}
            </text>
          </g>
        );
      })}
    </>
  );
}
