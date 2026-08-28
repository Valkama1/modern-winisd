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
import { SimulationProvider } from "./context/SimulationContext";
import "./App.css";

function AppShell() {
  const {
    projects, activeProjectId, activeProject,
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

// Provider order matters: each provider below can only read context from providers
// that wrap it (outer providers cannot see state from providers nested inside them).
// DriverDatabaseProvider is outermost because useProjects (inside ProjectsProvider)
// reads openDriverBrowser from it. ModalsProvider wraps GraphViewportProvider because
// useGraphViewport reads showSettings from it. ProjectsProvider wraps
// SignalProcessingProvider and GraphViewportProvider because useSimulation
// (inside SimulationProvider) reads from Projects, SignalProcessing, and
// GraphViewport context, so SimulationProvider must be nested inside all three and
// is therefore innermost. ThemeProvider reads no context from other providers here,
// so its position is flexible. If you add a new provider, check what context hooks
// it reads from and place it accordingly — reordering these without checking can
// produce a "must be used within a Provider" runtime error.
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
