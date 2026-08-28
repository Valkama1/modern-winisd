import { ReactNode, useState } from "react";

interface TooltipProps {
  label: string;
  children: ReactNode;
}

export function Tooltip({ label, children }: TooltipProps) {
  const [visible, setVisible] = useState(false);
  return (
    <span
      className="relative inline-flex"
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
      onFocus={() => setVisible(true)}
      onBlur={() => setVisible(false)}
    >
      {children}
      {visible && (
        <span
          role="tooltip"
          className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-1.5 px-2 py-1 rounded text-2xs font-medium whitespace-nowrap shadow-lg pointer-events-none"
          style={{ backgroundColor: "var(--sidebar-color)", color: "var(--text-color)", border: "1px solid var(--graph-grid-color)" }}
        >
          {label}
        </span>
      )}
    </span>
  );
}
