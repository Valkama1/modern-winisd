import { ReactNode } from "react";
import Toolbar from "./Toolbar";
import { useGraphViewportContext } from "../../context/GraphViewportContext";

export default function Dashboard({ children }: { children: ReactNode }) {
  const { dashboardContainerRef } = useGraphViewportContext();

  return (
    <div className="flex-1 p-8 flex flex-col gap-6 overflow-hidden">
      <Toolbar />
      <div ref={dashboardContainerRef} className="flex-1 overflow-y-auto flex flex-col gap-8 pr-2">
        {children}
      </div>
    </div>
  );
}
