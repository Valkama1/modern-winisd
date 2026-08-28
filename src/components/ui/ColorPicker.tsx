import { useEffect, useRef, useState } from "react";

interface ColorPickerProps {
  value: string;
  onChange: (hex: string) => void;
  label?: string;
  shape?: "square" | "circle";
  className?: string;
}

export function ColorPicker({ value, onChange, label, shape = "square", className }: ColorPickerProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [open]);

  const swatchClass =
    shape === "circle"
      ? "w-5 h-5 rounded-full shrink-0 border border-white/20 shadow-inner cursor-pointer transition-transform hover:scale-110"
      : "w-7 h-7 rounded shrink-0 border cursor-pointer transition hover:brightness-110";

  return (
    <div ref={containerRef} className={`relative inline-flex items-center gap-2 ${className ?? ""}`}>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((o) => !o);
        }}
        className={swatchClass}
        style={{ backgroundColor: value, borderColor: shape === "circle" ? undefined : "var(--border-color)" }}
        title={label ?? "Change color"}
      />
      {label && <span>{label}</span>}
      {open && (
        <div
          className="absolute left-0 top-full mt-1.5 z-50 rounded-lg border shadow-xl p-3 flex flex-col gap-2 animate-fadeIn"
          style={{ backgroundColor: "var(--sidebar-color)", borderColor: "var(--border-color)" }}
          onClick={(e) => e.stopPropagation()}
        >
          <input
            type="color"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="w-24 h-16 rounded border-0 bg-transparent cursor-pointer p-0"
          />
          <span className="text-2xs font-mono opacity-70 text-center uppercase" style={{ color: "var(--text-muted-color)" }}>
            {value}
          </span>
        </div>
      )}
    </div>
  );
}
