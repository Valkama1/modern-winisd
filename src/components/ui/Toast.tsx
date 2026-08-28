import { createContext, ReactNode, useCallback, useContext, useRef, useState } from "react";
import { CheckCircle2, X, XCircle } from "lucide-react";

type ToastTone = "success" | "error";
interface ToastItem {
  id: number;
  tone: ToastTone;
  message: string;
}

interface ToastContextValue {
  success: (message: string) => void;
  error: (message: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const nextId = useRef(0);

  const dismiss = useCallback((id: number) => {
    setItems((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const push = useCallback(
    (tone: ToastTone, message: string) => {
      const id = nextId.current++;
      setItems((prev) => [...prev, { id, tone, message }]);
      const duration = tone === "success" ? 3000 : 6000;
      setTimeout(() => dismiss(id), duration);
    },
    [dismiss]
  );

  const value: ToastContextValue = {
    success: (message) => push("success", message),
    error: (message) => push("error", message),
  };

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="fixed bottom-5 right-5 z-100 flex flex-col gap-2 w-80">
        {items.map((item) => (
          <div
            key={item.id}
            className="flex items-start gap-2 rounded-lg border shadow-xl p-3 text-sm animate-fadeIn"
            style={{
              backgroundColor: "var(--sidebar-color)",
              borderColor: item.tone === "error" ? "var(--danger-color)" : "var(--accent-color)",
              color: "var(--text-color)",
            }}
          >
            {item.tone === "success" ? (
              <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" style={{ color: "var(--accent-color)" }} />
            ) : (
              <XCircle className="h-4 w-4 shrink-0 mt-0.5" style={{ color: "var(--danger-color)" }} />
            )}
            <span className="flex-1 whitespace-pre-line">{item.message}</span>
            <button onClick={() => dismiss(item.id)} className="opacity-60 hover:opacity-100 cursor-pointer shrink-0">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
