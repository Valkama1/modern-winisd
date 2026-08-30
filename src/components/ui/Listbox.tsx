import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, Check } from "lucide-react";
import { FieldWrapper } from "./Field";

interface ListboxOption<T extends string> {
  value: T;
  label: string;
}

interface ListboxProps<T extends string> {
  label?: string;
  value: T;
  onChange: (value: T) => void;
  options: readonly ListboxOption<T>[];
  className?: string;
  buttonClassName?: string;
}

const defaultButtonClass =
  "w-full border rounded px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent-color)]/50 flex items-center justify-between gap-2 cursor-pointer text-left";

interface PopoverRect {
  top: number;
  left: number;
  width: number;
}

export function Listbox<T extends string>({ label, value, onChange, options, className, buttonClassName }: ListboxProps<T>) {
  const [open, setOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(0);
  const [popoverRect, setPopoverRect] = useState<PopoverRect | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  const selectedIndex = Math.max(0, options.findIndex((o) => o.value === value));
  const selectedLabel = options.find((o) => o.value === value)?.label ?? "";

  const openPopover = () => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (rect) {
      setPopoverRect({ top: rect.bottom, left: rect.left, width: rect.width });
    }
    setOpen(true);
  };

  // Reset the highlighted option to the current selection each time the popover opens,
  // and close on outside click while it's open.
  useEffect(() => {
    if (!open) return;
    setHighlighted(selectedIndex);
    const handlePointerDown = (e: MouseEvent) => {
      const target = e.target as Node;
      const insideTrigger = containerRef.current && containerRef.current.contains(target);
      const insidePopover = popoverRef.current && popoverRef.current.contains(target);
      if (!insideTrigger && !insidePopover) {
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
        openPopover();
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
        onClick={() => (open ? setOpen(false) : openPopover())}
        onKeyDown={handleTriggerKeyDown}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={buttonClassName ?? defaultButtonClass}
        style={{ backgroundColor: "var(--bg-color)", borderColor: "var(--border-color)", color: "var(--text-color)" }}
      >
        <span className="truncate">{selectedLabel}</span>
        <ChevronDown className={`h-3.5 w-3.5 opacity-60 shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open &&
        popoverRect &&
        createPortal(
          <div
            ref={popoverRef}
            role="listbox"
            className="fixed z-50 mt-1 rounded-lg border shadow-xl py-1 max-h-60 overflow-y-auto animate-fadeIn"
            style={{
              top: popoverRect.top,
              left: popoverRect.left,
              width: popoverRect.width,
              backgroundColor: "var(--sidebar-color)",
              borderColor: "var(--border-color)",
            }}
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
          </div>,
          document.body
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
