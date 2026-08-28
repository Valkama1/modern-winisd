import { ReactNode, useState } from "react";
import { Activity, Database, Settings, FilePlus, FolderOpen, Save, Speaker, Box, Waves, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { Tooltip, Button, TextField, CollapsibleSection } from "../ui";
import { useDriverDatabaseContext } from "../../context/DriverDatabaseContext";
import { useModalsContext } from "../../context/ModalsContext";
import { useProjectsContext } from "../../context/ProjectsContext";
import { useSimulationContext } from "../../context/SimulationContext";

const MIN_WIDTH = 240;
const MAX_WIDTH = 480;
const COLLAPSED_WIDTH = 56;

const SIDEBAR_TABS = [
  { id: "driver", label: "Driver", icon: Speaker },
  { id: "enclosure", label: "Enclosure", icon: Box },
  { id: "signal", label: "Signal", icon: Waves },
] as const;

export default function Sidebar({ children }: { children: ReactNode }) {
  const { setShowBrowser } = useDriverDatabaseContext();
  const { setShowSettings, sidebarTab, setSidebarTab, sidebarSectionState, toggleSidebarSection } = useModalsContext();
  const { activeProject, updateActiveProject, handleNewProject, handleOpenProject, handleSaveProject } = useProjectsContext();
  const { systemStats } = useSimulationContext();

  const [width, setWidth] = useState(320);
  const [collapsed, setCollapsed] = useState(false);

  const handleResizeStart = (e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = width;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = moveEvent.clientX - startX;
      setWidth(Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, startWidth + deltaX)));
    };

    const handleMouseUp = () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
  };

  return (
    <div
      className="relative border-r flex flex-col overflow-hidden transition-[width] duration-150 shrink-0 shadow-xl"
      style={{ backgroundColor: "var(--sidebar-color)", borderRightColor: "var(--border-color)", width: collapsed ? COLLAPSED_WIDTH : width }}
    >
      {/* Logo */}
      <div className={`p-5 border-b flex items-center ${collapsed ? "flex-col gap-3" : "justify-between"}`} style={{ borderColor: "var(--border-color)" }}>
        {!collapsed && (
          <div className="flex items-center gap-2 min-w-0">
            <Activity className="h-6 w-6 shrink-0" style={{ color: "var(--accent-color)" }} />
            <span className="font-bold tracking-wide truncate">WinISD Modern</span>
          </div>
        )}
        <div className={`flex gap-1.5 ${collapsed ? "flex-col" : ""}`}>
          <Tooltip label={collapsed ? "Expand sidebar" : "Collapse sidebar"}>
            <Button variant="icon" onClick={() => setCollapsed((c) => !c)}>
              {collapsed ? <PanelLeftOpen className="h-4.5 w-4.5" /> : <PanelLeftClose className="h-4.5 w-4.5" />}
            </Button>
          </Tooltip>
          <Tooltip label="Driver Database">
            <Button variant="icon" onClick={() => setShowBrowser(true)}>
              <Database className="h-4.5 w-4.5" />
            </Button>
          </Tooltip>
          <Tooltip label="Settings">
            <Button variant="icon" onClick={() => setShowSettings(true)}>
              <Settings className="h-4.5 w-4.5" />
            </Button>
          </Tooltip>
        </div>
      </div>

      {/* Project Section */}
      {!collapsed && (
      <div className="p-5 border-b flex flex-col gap-3" style={{ borderColor: "var(--border-color)" }}>
        <TextField
          label="Project Name"
          value={activeProject.name}
          onChange={(v) => updateActiveProject({ name: v })}
        />
        <div>
          <label className="text-xs font-semibold opacity-70 uppercase tracking-wider block mb-1">
            Notes
          </label>
          <textarea
            value={activeProject.notes ?? ""}
            onChange={(e) => updateActiveProject({ notes: e.target.value })}
            placeholder="e.g. ported version, tuned for car install…"
            rows={3}
            className="w-full text-xs border rounded px-2.5 py-1.5 focus:outline-none resize-none leading-relaxed"
            style={{
              backgroundColor: "var(--bg-color)",
              borderColor: "var(--border-color)",
              color: "var(--text-color)",
            }}
          />
        </div>
        <div className="grid grid-cols-3 gap-2">
          <button
            onClick={handleNewProject}
            className="flex flex-col items-center justify-center gap-1 py-2 text-xs rounded border transition opacity-80 hover:opacity-100 cursor-pointer"
            style={{ backgroundColor: "var(--bg-color)", borderColor: "var(--border-color)", color: "var(--text-color)" }}
          >
            <FilePlus className="h-4 w-4" />
            New
          </button>
          <button
            onClick={handleOpenProject}
            className="flex flex-col items-center justify-center gap-1 py-2 text-xs rounded border transition opacity-80 hover:opacity-100 cursor-pointer"
            style={{ backgroundColor: "var(--bg-color)", borderColor: "var(--border-color)", color: "var(--text-color)" }}
          >
            <FolderOpen className="h-4 w-4" />
            Open
          </button>
          <button
            onClick={handleSaveProject}
            className="flex flex-col items-center justify-center gap-1 py-2 text-xs border rounded transition font-medium hover:opacity-90 cursor-pointer"
            style={{
              backgroundColor: "var(--bg-color)",
              borderColor: "var(--accent-color)",
              color: "var(--accent-color)",
            }}
          >
            <Save className="h-4 w-4" />
            Save
          </button>
        </div>
      </div>
      )}

      {/* Sidebar Tabs */}
      <div className={`flex text-xs font-semibold select-none shrink-0 ${collapsed ? "flex-col border-b" : "border-b"}`} style={{ borderColor: "var(--border-color)" }}>
        {SIDEBAR_TABS.map((tab) => {
          const isSelected = sidebarTab === tab.id;
          const Icon = tab.icon;
          const button = (
            <button
              onClick={() => setSidebarTab(tab.id)}
              className={`w-full py-3 flex items-center justify-center gap-1.5 text-center border-b-2 transition-all font-bold cursor-pointer ${
                isSelected
                  ? "text-[var(--accent-color)] border-[var(--accent-color)] bg-black/5"
                  : "opacity-60 border-transparent hover:opacity-100"
              }`}
            >
              {collapsed ? <Icon className="h-4.5 w-4.5" /> : tab.label}
            </button>
          );
          return collapsed ? (
            <Tooltip key={tab.id} label={tab.label}>
              {button}
            </Tooltip>
          ) : (
            <div key={tab.id} className="flex-1">
              {button}
            </div>
          );
        })}
      </div>

      {/* Scrollable inputs */}
      {!collapsed && (
        <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-5">
          {children}
        </div>
      )}
      {collapsed && <div className="flex-1" />}

      {/* Permanently Docked System Statistics */}
      {!collapsed && systemStats.length > 0 && (
        <div className="p-5 border-t shrink-0 bg-black/10" style={{ borderColor: "var(--border-color)" }}>
          <CollapsibleSection
            title="System Statistics"
            open={sidebarSectionState["system-stats"]}
            onToggle={() => toggleSidebarSection("system-stats")}
          >
          <div className="text-2xs">
            {(() => {
              const full  = systemStats.filter(s => s.fullWidth);
              const pairs = systemStats.filter(s => !s.fullWidth);
              const rows: (typeof systemStats)[] = [];
              for (let i = 0; i < pairs.length; i += 2)
                rows.push(pairs.slice(i, i + 2));
              return (
                <>
                  {rows.map((row, ri) => (
                    <div
                      key={ri}
                      className="grid grid-cols-2"
                      style={{
                        borderBottom: (ri < rows.length - 1 || full.length > 0)
                          ? "1px solid var(--border-color)" : undefined,
                      }}
                    >
                      {row.map((stat, ci) => (
                        <div
                          key={stat.label}
                          className="flex flex-col gap-0.5 px-2 py-1.5"
                          style={{
                            backgroundColor: "var(--bg-color)",
                            borderLeft: ci > 0 ? "1px solid var(--border-color)" : undefined,
                          }}
                        >
                          <span className="text-2xs font-mono uppercase opacity-55 leading-none">
                            {stat.label}
                          </span>
                          <span
                            className="font-bold font-mono leading-tight text-xs"
                            style={{
                              color: stat.danger
                                ? "var(--danger-color)"
                                : stat.accent
                                ? "var(--accent-color)"
                                : stat.warn
                                ? "var(--warning-color)"
                                : "var(--text-color)",
                            }}
                          >
                            {stat.value}
                          </span>
                        </div>
                      ))}
                      {/* pad odd row to fill 2nd column */}
                      {row.length === 1 && (
                        <div className="px-2 py-1.5" style={{ backgroundColor: "var(--bg-color)", borderLeft: "1px solid var(--border-color)" }} />
                      )}
                    </div>
                  ))}
                  {full.map((stat, fi) => (
                    <div
                      key={stat.label}
                      className="flex flex-col gap-0.5 px-2 py-1.5"
                      style={{
                        backgroundColor: "var(--bg-color)",
                        borderTop: fi > 0 ? "1px solid var(--border-color)" : undefined,
                      }}
                    >
                      <span className="text-2xs font-mono uppercase opacity-55 leading-none">
                        {stat.label}
                      </span>
                      <span
                        className="font-bold font-mono leading-tight text-xs"
                        style={{
                          color: stat.danger
                            ? "#f87171"
                            : stat.accent
                            ? "var(--accent-color)"
                            : stat.warn
                            ? "#f59e0b"
                            : "var(--text-color)",
                        }}
                      >
                        {stat.value}
                      </span>
                    </div>
                  ))}
                </>
              );
            })()}
          </div>
          </CollapsibleSection>
        </div>
      )}

      {/* Resize handle */}
      {!collapsed && (
        <div
          onMouseDown={handleResizeStart}
          className="absolute top-0 right-0 h-full w-1.5 cursor-col-resize hover:bg-[var(--accent-color)]/20 active:bg-[var(--accent-color)]/30 transition-colors z-10"
        />
      )}
    </div>
  );
}
