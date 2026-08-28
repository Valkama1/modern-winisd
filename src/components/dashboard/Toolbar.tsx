import { useState } from "react";
import { Undo2, Redo2, Ruler, Download, ChevronDown, FileText, Plus, Copy, Trash2, Edit3 } from "lucide-react";
import { Tooltip, useDialog } from "../ui";
import { useProjectsContext } from "../../context/ProjectsContext";
import { useGraphViewportContext } from "../../context/GraphViewportContext";
import { useSimulationContext } from "../../context/SimulationContext";
import { CurveType } from "../../types";

export default function Toolbar() {
  const { confirmDialog } = useDialog();
  const {
    projects, activeProjectId, setActiveProjectId, activeProject, setProjectsWithHistory,
    canUndo, canRedo, undo, redo,
    handleAddNewProject, handleDuplicateProject, handleRenameProject, handleRemoveProject,
  } = useProjectsContext();
  const { visibleGraphs, setVisibleGraphs, rulerFreq, setRulerFreq } = useGraphViewportContext();
  const { showExportMenu, setShowExportMenu, handleExportSVG, handleExportPNG, handleExportSummary } = useSimulationContext();

  const [showDropdown, setShowDropdown] = useState(false);

  return (
    <>
      <div className="flex justify-between items-center shrink-0">
        <div>
          <h2 className="text-xl font-bold">Simulation Dashboard</h2>
          <p className="text-xs opacity-75">
            Scroll through active curves. Hover coordinate lines sync across all graphs simultaneously.
          </p>
        </div>

        {/* Multiselect Toggle Dropdown */}
        <div className="relative">
          <button
            onClick={() => setShowDropdown(!showDropdown)}
            className="border rounded px-4 py-1.5 text-xs font-semibold focus:outline-none flex items-center gap-1.5 transition hover:opacity-90 cursor-pointer"
            style={{
              backgroundColor: "var(--sidebar-color)",
              borderColor: "var(--graph-grid-color)",
              color: "var(--text-color)",
            }}
          >
            Configure Graphs ({visibleGraphs.length})
            <span className="text-2xs">▼</span>
          </button>

          {showDropdown && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setShowDropdown(false)} />
              <div
                className="absolute right-0 mt-1.5 w-52 rounded-lg border shadow-xl p-3 flex flex-col gap-2.5 z-20 animate-fadeIn text-xs"
                style={{
                  backgroundColor: "var(--sidebar-color)",
                  borderColor: "var(--graph-grid-color)",
                  color: "var(--text-color)",
                }}
              >
                <div className="font-bold border-b pb-1.5 mb-1 opacity-75" style={{ borderColor: "var(--graph-grid-color)" }}>
                  Visible Graphs
                </div>
                {[
                  { key: "transfer",    label: "Gain (dB)" },
                  { key: "spl",         label: "SPL (dB SPL)" },
                  { key: "phase",       label: "Phase Response (°)" },
                  { key: "group_delay", label: "Group Delay (ms)" },
                  { key: "excursion",   label: "Cone Excursion (mm)" },
                  ...(activeProject.enclosureType !== "sealed" ? [{ key: "velocity", label: "Port Air Velocity (m/s)" }] : []),
                  { key: "impedance",   label: "System Impedance (Ω)" },
                ].map((item) => {
                  const isChecked = visibleGraphs.includes(item.key as CurveType);
                  return (
                    <label key={item.key} className="flex items-center gap-2.5 cursor-pointer py-1 hover:opacity-85">
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => {
                          if (isChecked) {
                            if (visibleGraphs.length > 1) {
                              setVisibleGraphs(visibleGraphs.filter((g) => g !== item.key));
                            }
                          } else {
                            setVisibleGraphs([...visibleGraphs, item.key as CurveType]);
                          }
                        }}
                        className="rounded text-[var(--accent-color)] focus:ring-[var(--accent-color)] accent-[var(--accent-color)] h-4 w-4 cursor-pointer"
                      />
                      <span>{item.label}</span>
                    </label>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Projects Tab Toolbar */}
      <div className="flex flex-wrap items-center gap-2 border-b pb-3.5" style={{ borderColor: "var(--graph-grid-color)" }}>
        {projects.map((project) => {
          const isActive = project.id === activeProjectId;
          return (
            <div
              key={project.id}
              onClick={() => setActiveProjectId(project.id)}
              className={`group flex items-center gap-2.5 px-3.5 py-2 rounded-lg border text-xs font-semibold cursor-pointer transition select-none ${
                isActive
                  ? "border-[var(--accent-color)] shadow-md"
                  : "opacity-75 hover:opacity-100 hover:bg-black/10"
              }`}
              style={{
                backgroundColor: isActive ? "var(--sidebar-color)" : "transparent",
                borderColor: isActive ? "var(--accent-color)" : "var(--graph-grid-color)",
                color: "var(--text-color)",
              }}
            >
              {/* Visibility Checkbox */}
              <input
                type="checkbox"
                checked={project.showOnGraph}
                onClick={(e) => e.stopPropagation()}
                onChange={() => {
                  setProjectsWithHistory(projects.map(p =>
                    p.id === project.id ? { ...p, showOnGraph: !p.showOnGraph } : p
                  ));
                }}
                className="rounded text-[var(--accent-color)] focus:ring-[var(--accent-color)] accent-[var(--accent-color)] h-3.5 w-3.5 cursor-pointer shrink-0"
                title="Toggle visibility on graph"
              />

              {/* Project color circle with picker */}
              <div className="relative flex items-center shrink-0">
                <input
                  type="color"
                  value={project.color}
                  onClick={(e) => e.stopPropagation()}
                  onChange={(e) => {
                    setProjectsWithHistory(projects.map(p =>
                      p.id === project.id ? { ...p, color: e.target.value } : p
                    ));
                  }}
                  className="w-5 h-5 rounded-full overflow-hidden border border-white/20 shadow-inner cursor-pointer p-0 shrink-0 bg-transparent transition-transform hover:scale-110"
                  style={{
                    WebkitAppearance: "none",
                    border: "none",
                  }}
                  title="Change project line color"
                />
              </div>

              {/* Project Name (double click to rename) */}
              <span
                onDoubleClick={() => handleRenameProject(project.id)}
                className="truncate max-w-[120px]"
                title="Double click to rename"
              >
                {project.name}
              </span>

              {/* Active Controls: Rename, Duplicate, Delete */}
              <div className="flex items-center gap-1.5 ml-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRenameProject(project.id);
                  }}
                  className="hover:text-sky-400 p-0.5"
                  title="Rename project"
                >
                  <Edit3 className="h-3 w-3" />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDuplicateProject(project.id);
                  }}
                  className="hover:text-[var(--accent-color)] p-0.5"
                  title="Duplicate project"
                >
                  <Copy className="h-3 w-3" />
                </button>
                {projects.length > 1 && (
                  <button
                    onClick={async (e) => {
                      e.stopPropagation();
                      const ok = await confirmDialog({
                        title: "Remove Project?",
                        body: `Remove project "${project.name}"? This cannot be undone.`,
                        confirmLabel: "Remove",
                      });
                      if (ok) handleRemoveProject(project.id);
                    }}
                    className="hover:text-red-400 p-0.5"
                    title="Remove project"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                )}
              </div>
            </div>
          );
        })}

        {/* Action buttons */}
        <div className="flex items-center gap-2 ml-auto shrink-0">
          <Tooltip label="Undo (Ctrl+Z)">
            <button
              onClick={undo}
              disabled={!canUndo}
              className="p-1.5 rounded text-xs transition cursor-pointer disabled:opacity-25 hover:enabled:bg-black/20"
              style={{ color: "var(--text-color)" }}
            >
              <Undo2 className="h-3.5 w-3.5" />
            </button>
          </Tooltip>
          <Tooltip label="Redo (Ctrl+Y)">
            <button
              onClick={redo}
              disabled={!canRedo}
              className="p-1.5 rounded text-xs transition cursor-pointer disabled:opacity-25 hover:enabled:bg-black/20"
              style={{ color: "var(--text-color)" }}
            >
              <Redo2 className="h-3.5 w-3.5" />
            </button>
          </Tooltip>
          <Tooltip label="Toggle Draggable Measurement Ruler Line">
            <button
              onClick={() => setRulerFreq(prev => prev === null ? 80.0 : null)}
              className={`p-1.5 rounded transition-colors cursor-pointer flex items-center justify-center ${rulerFreq !== null ? "text-[var(--accent-color)] bg-[var(--accent-color)]/15 border border-[var(--accent-color)]/40" : "hover:bg-black/20"}`}
              style={{ color: rulerFreq !== null ? undefined : "var(--text-color)" }}
            >
              <Ruler className="h-3.5 w-3.5" />
            </button>
          </Tooltip>
          <div className="relative" data-export-menu>
            <Tooltip label="Export graph or design summary">
              <button
                onClick={() => setShowExportMenu(showExportMenu ? null : (visibleGraphs[0] ?? "transfer"))}
                className="p-1.5 rounded text-xs transition cursor-pointer hover:bg-black/20 flex items-center gap-1"
                style={{ color: "var(--text-color)" }}
              >
                <Download className="h-3.5 w-3.5" />
                <ChevronDown className="h-2.5 w-2.5 opacity-60" />
              </button>
            </Tooltip>
            {showExportMenu !== null && (
              <div
                className="absolute right-0 top-full mt-1 z-50 rounded-lg shadow-xl border text-xs min-w-[220px]"
                style={{ backgroundColor: "var(--sidebar-color)", borderColor: "var(--graph-grid-color)", color: "var(--text-color)" }}
              >
                <div className="px-3 pt-2.5 pb-1 text-2xs font-semibold opacity-50 uppercase tracking-wider">Graph</div>
                <div className="flex flex-col px-1 pb-1">
                  {visibleGraphs.map(m => (
                    <div key={m} className="flex items-center gap-1">
                      <span className="flex-1 px-2 py-1 opacity-70 capitalize">{m.replace("_"," ")}</span>
                      <button onClick={() => { handleExportSVG(m); setShowExportMenu(null); }}
                        className="px-2 py-1 rounded hover:bg-black/20 cursor-pointer">SVG</button>
                      <button onClick={() => { handleExportPNG(m); setShowExportMenu(null); }}
                        className="px-2 py-1 rounded hover:bg-black/20 cursor-pointer">PNG</button>
                    </div>
                  ))}
                </div>
                <div className="border-t px-1 pb-1" style={{ borderColor: "var(--graph-grid-color)" }}>
                  <button
                    onClick={() => { handleExportSummary(); setShowExportMenu(null); }}
                    className="w-full flex items-center gap-2 px-2 py-1.5 rounded hover:bg-black/20 cursor-pointer"
                  >
                    <FileText className="h-3.5 w-3.5 opacity-70" />
                    Design Summary (HTML/PDF)
                  </button>
                </div>
              </div>
            )}
          </div>
          <button
            onClick={handleAddNewProject}
            className="px-3 py-1.5 text-white font-semibold text-xs rounded-lg shadow transition flex items-center gap-1 cursor-pointer hover:brightness-110"
            style={{ backgroundColor: "var(--accent-color)" }}
          >
            <Plus className="h-3.5 w-3.5" />
            New Project
          </button>
        </div>
      </div>
    </>
  );
}
