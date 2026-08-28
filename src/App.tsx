import { useEffect } from "react";
import { EnclosureType } from "./types";
import Sidebar from "./components/sidebar/Sidebar";
import DriverTab from "./components/sidebar/DriverTab";
import EnclosureTab from "./components/sidebar/EnclosureTab";
import SignalTab from "./components/sidebar/SignalTab";
import Dashboard from "./components/dashboard/Dashboard";
import GraphPanel from "./components/dashboard/GraphPanel";
import SettingsModal from "./components/modals/SettingsModal";
import DriverBrowserModal from "./components/modals/DriverBrowserModal";
import AddDriverModal from "./components/modals/AddDriverModal";
import { ThemeProvider } from "./context/ThemeContext";
import { ModalsProvider, useModalsContext } from "./context/ModalsContext";
import { DriverDatabaseProvider } from "./context/DriverDatabaseContext";
import { SignalProcessingProvider, useSignalProcessingContext } from "./context/SignalProcessingContext";
import { ProjectsProvider, useProjectsContext } from "./context/ProjectsContext";
import { GraphViewportProvider, useGraphViewportContext } from "./context/GraphViewportContext";
import { SimulationProvider, useSimulationContext } from "./context/SimulationContext";
import "./App.css";

function AppShell() {
  const {
    projects, activeProjectId, activeProject,
    undo, redo,
  } = useProjectsContext();

  const { sidebarTab, sidebarSectionState } = useModalsContext();

  const { filters, roomConfig, cabinConfig } = useSignalProcessingContext();

  const {
    visibleGraphs, setVisibleGraphs,
    graphHeights,
    graphConfigs,
    globalXMin, globalXMax, overrideXLimits,
    rulerFreq,
  } = useGraphViewportContext();

  const { showExportMenu, setShowExportMenu } = useSimulationContext();

  // Keyboard shortcuts: Ctrl+Z undo, Ctrl+Y / Ctrl+Shift+Z redo
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const el = document.activeElement as HTMLElement | null;
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT")) return;
      if (e.ctrlKey && e.key === "z" && !e.shiftKey) { e.preventDefault(); undo(); }
      if (e.ctrlKey && ((e.key === "y") || (e.key === "z" && e.shiftKey))) { e.preventDefault(); redo(); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  // Close export menu on outside click
  useEffect(() => {
    if (showExportMenu === null) return;
    const handler = (e: MouseEvent) => {
      const t = e.target as HTMLElement;
      if (!t.closest("[data-export-menu]")) setShowExportMenu(null);
    };
    window.addEventListener("mousedown", handler);
    return () => window.removeEventListener("mousedown", handler);
  }, [showExportMenu]);

  // Auto-save session state to localStorage on state changes
  useEffect(() => {
    try {
      const sessionState = {
        projects,
        activeProjectId,
        visibleGraphs,
        sidebarTab,
        sidebarSectionState,
        globalXMin,
        globalXMax,
        overrideXLimits,
        graphConfigs,
        filters,
        roomConfig,
        cabinConfig,
        rulerFreq,
        graphHeights,
      };
      localStorage.setItem("winisd_session_state", JSON.stringify(sessionState));
    } catch (e) {
      console.error("Failed to auto-save session state:", e);
    }
  }, [projects, activeProjectId, visibleGraphs, sidebarTab, sidebarSectionState, globalXMin, globalXMax, overrideXLimits, graphConfigs, filters, roomConfig, cabinConfig, rulerFreq, graphHeights]);

  // Remove velocity graph when switching to sealed (no ports)
  useEffect(() => {
    const noPortTypes: EnclosureType[] = ["sealed"];
    if (noPortTypes.includes(activeProject.enclosureType) && visibleGraphs.includes("velocity")) {
      setVisibleGraphs(visibleGraphs.filter((g) => g !== "velocity"));
    }
  }, [activeProject.enclosureType, visibleGraphs]);

  return (
    <div
      className="flex h-screen w-screen overflow-hidden font-sans transition-colors duration-150"
      style={{ backgroundColor: "var(--bg-color)", color: "var(--text-color)" }}
    >
      <Sidebar>
          {sidebarTab === "driver" && <DriverTab />}

          {sidebarTab === "enclosure" && <EnclosureTab />}

          {sidebarTab === "signal" && <SignalTab />}
      </Sidebar>

      {/* Main stacked graph list dashboard */}
      <Dashboard>
        {visibleGraphs.map((mode) => (
          <GraphPanel key={mode} mode={mode} />
        ))}
      </Dashboard>

      <SettingsModal />

      <DriverBrowserModal />

      <AddDriverModal />
    </div>
  );
}

export default function App() {
  return (
    <DriverDatabaseProvider>
      <ModalsProvider>
        <ThemeProvider>
          <ProjectsProvider>
            <SignalProcessingProvider>
              <GraphViewportProvider>
                <SimulationProvider>
                  <AppShell />
                </SimulationProvider>
              </GraphViewportProvider>
            </SignalProcessingProvider>
          </ProjectsProvider>
        </ThemeProvider>
      </ModalsProvider>
    </DriverDatabaseProvider>
  );
}
