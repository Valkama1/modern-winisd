import { ReactNode } from "react";

interface FieldWrapperProps {
  label?: string;
  className?: string;
  children: ReactNode;
}

function FieldWrapper({ label, className, children }: FieldWrapperProps) {
  return (
    <div className={className}>
      {label && <label className="text-xs opacity-70 block mb-1">{label}</label>}
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
}

export function TextField({ label, value, onChange, placeholder, required, className, monospace }: TextFieldProps) {
  return (
    <FieldWrapper label={label} className={className}>
      <input
        type="text"
        required={required}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`w-full border rounded px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent-color)]/50 ${monospace ? "font-mono" : ""}`}
        style={{ backgroundColor: "var(--bg-color)", borderColor: "var(--graph-grid-color)", color: "var(--text-color)" }}
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
          value={value}
          onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
          className="w-full border rounded px-2.5 py-1.5 text-sm font-mono text-right focus:outline-none focus:ring-2 focus:ring-[var(--accent-color)]/50 disabled:cursor-not-allowed"
          style={{
            backgroundColor: "var(--bg-color)",
            borderColor: "var(--graph-grid-color)",
            color: disabled ? "var(--text-muted-color)" : accent ? "var(--accent-color)" : "var(--text-color)",
          }}
        />
        {unit && <span className="text-xs opacity-60 shrink-0">{unit}</span>}
      </div>
    </FieldWrapper>
  );
}

interface SelectProps {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  className?: string;
}

export function Select({ label, value, onChange, options, className }: SelectProps) {
  return (
    <FieldWrapper label={label} className={className}>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full border rounded px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent-color)]/50"
        style={{ backgroundColor: "var(--bg-color)", borderColor: "var(--graph-grid-color)", color: "var(--text-color)" }}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
    </FieldWrapper>
  );
}
