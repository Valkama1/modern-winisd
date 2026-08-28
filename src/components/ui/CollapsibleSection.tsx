import { ReactNode, useCallback, useState } from "react";
import { ChevronDown } from "lucide-react";

interface CollapsibleSectionProps {
  title: string;
  open: boolean;
  onToggle: () => void;
  action?: ReactNode;
  children: ReactNode;
}

export function CollapsibleSection({ title, open, onToggle, action, children }: CollapsibleSectionProps) {
  return (
    <div className="border rounded-lg overflow-hidden" style={{ borderColor: "var(--graph-grid-color)" }}>
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between px-3 py-2 text-xs font-semibold uppercase tracking-wider cursor-pointer hover:bg-black/10 transition"
        style={{ backgroundColor: "var(--sidebar-color)", color: "var(--text-color)" }}
      >
        <span>{title}</span>
        <span className="flex items-center gap-2">
          {action && <span onClick={(e) => e.stopPropagation()}>{action}</span>}
          <ChevronDown className={`h-3.5 w-3.5 opacity-60 transition-transform ${open ? "rotate-180" : ""}`} />
        </span>
      </button>
      {open && (
        <div className="p-3 flex flex-col gap-3" style={{ backgroundColor: "var(--bg-color)" }}>
          {children}
        </div>
      )}
    </div>
  );
}

/** Tracks open/closed state for a set of named sections, keyed by string id. */
export function useSectionState(initial: Record<string, boolean>) {
  const [state, setState] = useState(initial);
  const toggle = useCallback((key: string) => {
    setState((prev) => ({ ...prev, [key]: !prev[key] }));
  }, []);
  return [state, setState, toggle] as const;
}
