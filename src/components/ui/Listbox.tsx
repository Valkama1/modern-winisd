import { useEffect, useRef, useState } from "react";
import { ChevronDown, Check } from "lucide-react";
import { FieldWrapper } from "./Field";

interface ListboxOption {
  value: string;
  label: string;
}

interface ListboxProps {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  options: ListboxOption[];
  className?: string;
  buttonClassName?: string;
}

const defaultButtonClass =
  "w-full border rounded px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent-color)]/50 flex items-center justify-between gap-2 cursor-pointer text-left";

export function Listbox({ label, value, onChange, options, className, buttonClassName }: ListboxProps) {
  const [open, setOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedIndex = Math.max(0, options.findIndex((o) => o.value === value));
  const selectedLabel = options.find((o) => o.value === value)?.label ?? "";

  // Reset the highlighted option to the current selection each time the popover opens,
  // and close on outside click while it's open.
  useEffect(() => {
    if (!open) return;
    setHighlighted(selectedIndex);
    const handlePointerDown = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const handleTriggerKeyDown = (e: React.KeyboardEvent) => {
    if (!open) {
      if (e.key === "Enter" || e.key === " " || e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        setOpen(true);
      }
      return;
    }
    if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlighted((h) => Math.min(options.length - 1, h + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlighted((h) => Math.max(0, h - 1));
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      const opt = options[highlighted];
      if (opt) {
        onChange(opt.value);
        setOpen(false);
      }
    }
  };

  const body = (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        onKeyDown={handleTriggerKeyDown}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={buttonClassName ?? defaultButtonClass}
        style={{ backgroundColor: "var(--bg-color)", borderColor: "var(--border-color)", color: "var(--text-color)" }}
      >
        <span className="truncate">{selectedLabel}</span>
        <ChevronDown className={`h-3.5 w-3.5 opacity-60 shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div
          role="listbox"
          className="absolute left-0 right-0 mt-1 z-50 rounded-lg border shadow-xl py-1 max-h-60 overflow-y-auto animate-fadeIn"
          style={{ backgroundColor: "var(--sidebar-color)", borderColor: "var(--border-color)" }}
        >
          {options.map((opt, idx) => (
            <div
              key={opt.value}
              role="option"
              aria-selected={opt.value === value}
              onMouseEnter={() => setHighlighted(idx)}
              onClick={() => {
                onChange(opt.value);
                setOpen(false);
              }}
              className="flex items-center justify-between gap-2 px-3 py-1.5 text-sm cursor-pointer"
              style={{
                backgroundColor: idx === highlighted ? "var(--accent-color)" : "transparent",
                color: idx === highlighted ? "#fff" : "var(--text-color)",
              }}
            >
              <span className="truncate">{opt.label}</span>
              {opt.value === value && <Check className="h-3.5 w-3.5 shrink-0" />}
            </div>
          ))}
        </div>
      )}
    </div>
  );

  if (!label) return <div className={className}>{body}</div>;

  return (
    <FieldWrapper label={label} className={className}>
      {body}
    </FieldWrapper>
  );
}
