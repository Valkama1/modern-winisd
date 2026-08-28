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
    <div className="border rounded-lg overflow-hidden" style={{ borderColor: "var(--border-color)" }}>
      <div
        className="w-full flex items-center justify-between px-3 py-2 text-xs font-semibold uppercase tracking-wider"
        style={{ backgroundColor: "var(--sidebar-color)", color: "var(--text-color)" }}
      >
        {/* action (when present) renders as a sibling, not nested inside this button —
            interactive content inside a <button> is invalid HTML and unreliable for assistive tech. */}
        <button
          type="button"
          onClick={onToggle}
          className="flex-1 flex items-center justify-between gap-2 min-w-0 cursor-pointer hover:opacity-80 transition text-left"
        >
          <span className="truncate">{title}</span>
          <ChevronDown className={`h-3.5 w-3.5 opacity-60 transition-transform shrink-0 ${open ? "rotate-180" : ""}`} />
        </button>
        {action && <span className="shrink-0 ml-2">{action}</span>}
      </div>
      {open && (
        <div className="p-3 flex flex-col gap-3 shadow-[inset_0_2px_6px_-2px_rgba(0,0,0,0.35)]" style={{ backgroundColor: "var(--bg-color)" }}>
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
