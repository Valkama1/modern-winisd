import { ReactNode } from "react";

interface BadgeProps {
  children: ReactNode;
  tone?: "default" | "accent" | "warning" | "danger";
}

const toneVar: Record<string, string> = {
  default: "var(--text-muted-color)",
  accent: "var(--accent-color)",
  warning: "var(--warning-color)",
  danger: "var(--danger-color)",
};

export function Badge({ children, tone = "default" }: BadgeProps) {
  const color = toneVar[tone];
  return (
    <span
      className="text-2xs font-mono font-bold border px-1.5 py-0.5 rounded"
      style={{ backgroundColor: "var(--bg-color)", borderColor: color, color }}
    >
      {children}
    </span>
  );
}
