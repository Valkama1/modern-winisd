import { ButtonHTMLAttributes, ReactNode } from "react";

type ButtonVariant = "primary" | "secondary" | "icon";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  children: ReactNode;
}

const base = "rounded transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed";

export function Button({ variant = "secondary", className = "", children, style, ...rest }: ButtonProps) {
  if (variant === "primary") {
    return (
      <button
        {...rest}
        className={`${base} px-4 py-2 text-sm font-semibold border hover:brightness-110 active:brightness-95 ${className}`}
        style={{ backgroundColor: "var(--accent-color)", borderColor: "var(--accent-color)", color: "#fff", ...style }}
      >
        {children}
      </button>
    );
  }
  if (variant === "icon") {
    return (
      <button
        {...rest}
        className={`${base} p-1.5 border hover:opacity-80 flex items-center justify-center ${className}`}
        style={{ backgroundColor: "var(--bg-color)", borderColor: "var(--graph-grid-color)", color: "var(--accent-color)", ...style }}
      >
        {children}
      </button>
    );
  }
  return (
    <button
      {...rest}
      className={`${base} px-4 py-2 text-sm font-medium border hover:opacity-90 ${className}`}
      style={{ backgroundColor: "var(--bg-color)", borderColor: "var(--graph-grid-color)", color: "var(--text-color)", ...style }}
    >
      {children}
    </button>
  );
}
