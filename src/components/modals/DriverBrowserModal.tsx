import { Database, X, Plus, Edit3 } from "lucide-react";
import { TextField, Button } from "../ui";
import { Driver } from "../../types";
import { useDriverDatabaseContext } from "../../context/DriverDatabaseContext";
import { useProjectsContext } from "../../context/ProjectsContext";

export default function DriverBrowserModal() {
  const {
    searchQuery, setSearchQuery, filteredDrivers,
    showBrowser, setShowBrowser, setShowAddForm,
    browserCallback, setBrowserCallback, setEditingDriverId,
  } = useDriverDatabaseContext();

  const { activeProject, updateActiveProject } = useProjectsContext();

  if (!showBrowser) return null;

  const handleStartEditDriver = (driver: Driver) => {
    setEditingDriverId(driver.id);
    setShowAddForm(true);
  };

  const handleStartAddDriver = () => {
    setEditingDriverId(null);
    setShowAddForm(true);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-6" style={{ color: "var(--text-color)" }}>
      <div className="border w-full max-w-3xl rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]" style={{ backgroundColor: "var(--sidebar-color)", borderColor: "var(--border-color)" }}>
        <div className="p-5 border-b flex items-center justify-between" style={{ borderColor: "var(--border-color)" }}>
          <div>
            <h3 className="text-lg font-bold">Driver Database</h3>
            <p className="text-xs opacity-70">Select an existing driver or add a new one to the database</p>
          </div>
          <button
            onClick={() => setShowBrowser(false)}
            className="p-1 rounded transition cursor-pointer opacity-70 hover:opacity-100"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-5 border-b flex gap-3 items-center" style={{ borderColor: "var(--border-color)" }}>
          <TextField
            className="flex-1"
            placeholder="Search by manufacturer or model..."
            value={searchQuery}
            onChange={setSearchQuery}
          />
          <Button variant="primary" onClick={handleStartAddDriver} className="flex items-center gap-1.5 animate-fadeIn">
            <Plus className="h-4 w-4" />
            Add Driver
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {filteredDrivers.map((driver) => (
              <div
                key={driver.id}
                className="border rounded-lg p-4 transition duration-150 flex flex-col justify-between"
                style={{
                  backgroundColor: "var(--bg-color)",
                  borderColor: activeProject.driver.id === driver.id ? "var(--accent-color)" : "var(--border-color)",
                }}
              >
                <div>
                  <div className="flex justify-between items-start">
                    <h4 className="font-bold text-sm">{driver.manufacturer}</h4>
                    {activeProject.driver.id === driver.id && (
                      <span className="text-2xs font-semibold border px-2 py-0.5 rounded-full" style={{ color: "var(--accent-color)", borderColor: "var(--accent-color)" }}>
                        Active
                      </span>
                    )}
                  </div>
                  <p className="text-xs opacity-70 font-medium mb-3">{driver.model}</p>

                  <div className="grid grid-cols-3 gap-2 border-t pt-2.5 text-xs opacity-70 font-mono" style={{ borderColor: "var(--border-color)" }}>
                    <div>Fs: <span style={{ color: "var(--text-color)" }}>{driver.fs}Hz</span></div>
                    <div>Qts: <span style={{ color: "var(--text-color)" }}>{driver.qts}</span></div>
                    <div>Vas: <span style={{ color: "var(--text-color)" }}>{driver.vas}L</span></div>
                    <div className="col-span-3 mt-1 text-2xs opacity-60">
                      Sens: <span className="font-semibold" style={{ color: "var(--accent-color)" }}>{driver.sens} dB @ 1W/1m</span>
                    </div>
                  </div>
                </div>

                <div className="flex gap-2 mt-4 shrink-0">
                  <button
                    onClick={() => {
                      if (browserCallback) {
                        browserCallback(driver);
                      } else {
                        updateActiveProject({
                          driver,
                          vBox: driver.vas / 2,
                        });
                      }
                      setShowBrowser(false);
                      setBrowserCallback(null);
                    }}
                    className="flex-1 py-1.5 text-xs rounded border transition font-medium cursor-pointer hover:brightness-110"
                    style={{ backgroundColor: "var(--sidebar-color)", borderColor: "var(--border-color)", color: "var(--text-color)" }}
                  >
                    Load Driver
                  </button>
                  <button
                    type="button"
                    onClick={() => handleStartEditDriver(driver)}
                    className="px-2.5 py-1.5 text-xs hover:bg-sky-600 hover:text-white rounded border hover:border-sky-500 transition cursor-pointer flex items-center justify-center shrink-0"
                    style={{ backgroundColor: "var(--sidebar-color)", borderColor: "var(--border-color)", color: "var(--text-color)" }}
                    title="Edit driver specs"
                  >
                    <Edit3 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))}
            {filteredDrivers.length === 0 && (
              <div className="col-span-2 flex flex-col items-center gap-2 text-center py-10 opacity-60">
                <Database className="h-6 w-6" />
                <span className="text-sm">No drivers found matching your search.</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
