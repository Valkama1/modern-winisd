import { ReactNode, useEffect, useId, useRef, useState } from "react";

interface FieldWrapperProps {
  label?: string;
  /** id of the control this labels. Without it the <label> is a sibling that names
   *  nothing, and the control announces as an unnamed spinbutton or textbox. */
  htmlFor?: string;
  className?: string;
  children: ReactNode;
}

export function FieldWrapper({ label, htmlFor, className, children }: FieldWrapperProps) {
  return (
    <div className={className}>
      {label && (
        <label
          htmlFor={htmlFor}
          className="text-xs font-semibold opacity-70 uppercase tracking-wider flex items-end mb-1 min-h-8 break-words"
        >
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
  const id = useId();
  return (
    <FieldWrapper label={label} htmlFor={id} className={className}>
      <input
        id={id}
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

interface NumberInputBoxProps {
  /** Set by whichever variant owns the <label>, so the two can be associated. */
  id?: string;
  value: number | string;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number | "any";
  required?: boolean;
  disabled?: boolean;
  unit?: string;
  accent?: boolean;
  className?: string;
  compact?: boolean;
}

// Shared by NumberField (label-above) and NumberRow (label-left): the actual
// bordered value box. Keeps the raw-string typing tolerance that fixed an
// earlier Critical bug (intermediate states like "30." or "" no longer get
// clobbered mid-keystroke), adds scroll-to-adjust while focused, and fuses
// the unit suffix inside the same box instead of floating it outside.
function NumberInputBox({
  id, value, onChange, min, max, step, required, disabled, unit, accent = true, className, compact = true,
}: NumberInputBoxProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [rawValue, setRawValue] = useState(String(value));
  // The wheel handler must read the *typed* value without re-subscribing on every
  // keystroke, so it goes through a ref rather than the dep array. Synced in an
  // effect, not during render: writing a ref while rendering is a tear in concurrent
  // React, and the handler only ever fires after paint, so nothing observes the
  // difference.
  const rawValueRef = useRef(rawValue);
  useEffect(() => {
    rawValueRef.current = rawValue;
  }, [rawValue]);

  // Resync the visible string when the *committed* value changes underneath us — an
  // undo, a preset, the alignment solver writing a box volume.
  //
  // `rawValue` is deliberately not a dependency, and this is the one place in the file
  // where that is load-bearing rather than an oversight: re-running on every keystroke
  // would overwrite intermediate states like "30." or "" mid-edit, which is precisely
  // the bug the raw-string tolerance exists to prevent. It is read here only to decide
  // whether the two have actually diverged.
  useEffect(() => {
    const parsedRaw = parseFloat(rawValue);
    const parsedValue = typeof value === "number" ? value : parseFloat(value);
    if (isNaN(parsedRaw) || parsedRaw !== parsedValue) {
      setRawValue(String(value));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const stepValue = typeof step === "number" ? step : 1;

  // React's onWheel prop attaches a passive listener by default, so calling
  // preventDefault() from it is silently ignored (and warns) — only a
  // manually-attached, { passive: false } native listener can actually stop
  // the page from also scrolling while a focused field is being adjusted.
  // Scroll-adjust only fires while this exact input is focused, so normal
  // page/sidebar scrolling is untouched otherwise.
  useEffect(() => {
    const el = inputRef.current;
    if (!el || disabled) return;
    const handleWheel = (e: WheelEvent) => {
      if (document.activeElement !== el) return;
      if (e.ctrlKey || e.metaKey || e.deltaY === 0) return;
      e.preventDefault();
      const current = parseFloat(rawValueRef.current);
      const base = isNaN(current) ? (typeof value === "number" ? value : parseFloat(value) || 0) : current;
      const decimals = (String(stepValue).split(".")[1] ?? "").length;
      let next = base + (e.deltaY < 0 ? stepValue : -stepValue);
      next = parseFloat(next.toFixed(decimals));
      if (min !== undefined) next = Math.max(min, next);
      if (max !== undefined) next = Math.min(max, next);
      setRawValue(String(next));
      onChange(next);
    };
    el.addEventListener("wheel", handleWheel, { passive: false });
    return () => el.removeEventListener("wheel", handleWheel);
  }, [min, max, stepValue, onChange, value, disabled]);

  return (
    <div
      className={`flex items-center border rounded overflow-hidden focus-within:ring-2 focus-within:ring-[var(--accent-color)]/50 ${className ?? "w-24"}`}
      style={{ backgroundColor: "var(--bg-color)", borderColor: "var(--border-color)" }}
    >
      <input
        id={id}
        ref={inputRef}
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
        onBlur={() => {
          const parsed = parseFloat(rawValue);
          if (isNaN(parsed)) return;
          let clamped = parsed;
          if (min !== undefined) clamped = Math.max(min, clamped);
          if (max !== undefined) clamped = Math.min(max, clamped);
          if (clamped !== parsed) {
            setRawValue(String(clamped));
            onChange(clamped);
          }
        }}
        className={`nf-input min-w-0 flex-1 border-none bg-transparent text-right font-mono focus:outline-none disabled:cursor-not-allowed ${compact ? "px-1.5 py-1 text-xs" : "px-2.5 py-1.5 text-sm"}`}
        style={{ color: disabled ? "var(--text-muted-color)" : accent ? "var(--accent-color)" : "var(--text-color)" }}
      />
      {unit && (
        <span className="pr-1.5 text-2xs shrink-0" style={{ color: "var(--text-muted-color)" }}>
          {unit}
        </span>
      )}
    </div>
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
  const id = useId();
  return (
    <FieldWrapper label={label} htmlFor={id} className={className}>
      <NumberInputBox
        id={id}
        value={value}
        onChange={onChange}
        min={min}
        max={max}
        step={step}
        required={required}
        disabled={disabled}
        unit={unit}
        accent={accent}
        className="w-full"
        compact={false}
      />
    </FieldWrapper>
  );
}

interface NumberRowProps {
  label: string;
  value: number | string;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number | "any";
  unit?: string;
  className?: string;
  boxClassName?: string;
  accent?: boolean;
}

// Compact single-line variant: label to the left, fixed-width value box to
// the right (default w-24, override via boxClassName for narrower contexts).
// Used wherever a field sits in a "label left, value right" row instead of
// a label-above grid — see NumberField for that shape.
export function NumberRow({ label, value, onChange, min, max, step, unit, className, boxClassName, accent = true }: NumberRowProps) {
  // A <label>, not the <span> this used to be: some forty row-style fields across the
  // sidebar had no label element at all and announced as unnamed spinbuttons. label is
  // inline like span, so the row is laid out exactly as before.
  const id = useId();
  return (
    <div className={`flex justify-between items-center text-xs ${className ?? ""}`}>
      <label htmlFor={id} className="opacity-70">{label}</label>
      <NumberInputBox
        id={id}
        value={value}
        onChange={onChange}
        min={min}
        max={max}
        step={step}
        unit={unit}
        accent={accent}
        className={boxClassName}
      />
    </div>
  );
}

