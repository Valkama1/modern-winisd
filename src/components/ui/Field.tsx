import { ReactNode, useEffect, useState } from "react";
import { ChevronUp, ChevronDown } from "lucide-react";

interface FieldWrapperProps {
  label?: string;
  className?: string;
  children: ReactNode;
}

export function FieldWrapper({ label, className, children }: FieldWrapperProps) {
  return (
    <div className={className}>
      {label && (
        <label className="text-xs font-semibold opacity-70 uppercase tracking-wider block mb-1 min-h-8">
          {label}
        </label>
      )}
      {children}
    </div>
  );
}

interface TextFieldProps {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  className?: string;
  monospace?: boolean;
  list?: string;
}

export function TextField({ label, value, onChange, placeholder, required, className, monospace, list }: TextFieldProps) {
  return (
    <FieldWrapper label={label} className={className}>
      <input
        type="text"
        required={required}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        list={list}
        className={`w-full border rounded px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent-color)]/50 ${monospace ? "font-mono" : ""}`}
        style={{ backgroundColor: "var(--bg-color)", borderColor: "var(--border-color)", color: "var(--text-color)" }}
      />
    </FieldWrapper>
  );
}

interface NumberFieldProps {
  label?: string;
  value: number | string;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number | "any";
  required?: boolean;
  disabled?: boolean;
  unit?: string;
  className?: string;
  accent?: boolean;
}

export function NumberField({
  label, value, onChange, min, max, step, required, disabled, unit, className, accent = true,
}: NumberFieldProps) {
  // Track the raw typed string locally so intermediate states ("30.", "", "-")
  // aren't clobbered by re-parsing on every keystroke; only sync from the
  // external value when it actually diverges from what's been typed.
  const [rawValue, setRawValue] = useState(String(value));

  useEffect(() => {
    const parsedRaw = parseFloat(rawValue);
    const parsedValue = typeof value === "number" ? value : parseFloat(value);
    if (isNaN(parsedRaw) || parsedRaw !== parsedValue) {
      setRawValue(String(value));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const applyDelta = (delta: number) => {
    const current = parseFloat(rawValue);
    const base = isNaN(current) ? (typeof value === "number" ? value : parseFloat(value) || 0) : current;
    let next = base + delta;
    if (min !== undefined) next = Math.max(min, next);
    if (max !== undefined) next = Math.min(max, next);
    setRawValue(String(next));
    onChange(next);
  };

  const stepValue = typeof step === "number" ? step : 1;

  return (
    <FieldWrapper label={label} className={className}>
      <div className="flex items-center gap-1">
        <input
          type="number"
          min={min}
          max={max}
          step={step ?? "any"}
          required={required}
          disabled={disabled}
          value={rawValue}
          onChange={(e) => {
            const raw = e.target.value;
            setRawValue(raw);
            const parsed = parseFloat(raw);
            if (!isNaN(parsed)) onChange(parsed);
          }}
          className="nf-input w-full border rounded px-2.5 py-1.5 text-sm font-mono text-right focus:outline-none focus:ring-2 focus:ring-[var(--accent-color)]/50 disabled:cursor-not-allowed"
          style={{
            backgroundColor: "var(--bg-color)",
            borderColor: "var(--border-color)",
            color: disabled ? "var(--text-muted-color)" : accent ? "var(--accent-color)" : "var(--text-color)",
          }}
        />
        {!disabled && (
          <div className="flex flex-col shrink-0">
            <button
              type="button"
              tabIndex={-1}
              onClick={() => applyDelta(stepValue)}
              className="h-3 w-4 flex items-center justify-center rounded-t hover:bg-[var(--accent-color)]/20 cursor-pointer"
              style={{ color: "var(--text-muted-color)" }}
              aria-label="Increment"
            >
              <ChevronUp className="h-2.5 w-2.5" />
            </button>
            <button
              type="button"
              tabIndex={-1}
              onClick={() => applyDelta(-stepValue)}
              className="h-3 w-4 flex items-center justify-center rounded-b hover:bg-[var(--accent-color)]/20 cursor-pointer"
              style={{ color: "var(--text-muted-color)" }}
              aria-label="Decrement"
            >
              <ChevronDown className="h-2.5 w-2.5" />
            </button>
          </div>
        )}
        {unit && <span className="text-xs opacity-60 shrink-0">{unit}</span>}
      </div>
    </FieldWrapper>
  );
}

