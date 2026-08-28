import { createContext, ReactNode, useCallback, useContext, useState } from "react";

interface ConfirmOptions {
  title: string;
  body: string;
  confirmLabel?: string;
  cancelLabel?: string;
  okOnly?: boolean;
}
interface PromptOptions {
  title: string;
  label: string;
  defaultValue?: string;
  confirmLabel?: string;
}

interface DialogContextValue {
  confirmDialog: (opts: ConfirmOptions) => Promise<boolean>;
  promptDialog: (opts: PromptOptions) => Promise<string | null>;
}

const DialogContext = createContext<DialogContextValue | null>(null);

export function useDialog(): DialogContextValue {
  const ctx = useContext(DialogContext);
  if (!ctx) throw new Error("useDialog must be used within DialogProvider");
  return ctx;
}

type Pending =
  | (ConfirmOptions & { kind: "confirm"; resolve: (v: boolean) => void })
  | (PromptOptions & { kind: "prompt"; resolve: (v: string | null) => void });

export function DialogProvider({ children }: { children: ReactNode }) {
  const [pending, setPending] = useState<Pending | null>(null);
  const [promptValue, setPromptValue] = useState("");

  const confirmDialog = useCallback((opts: ConfirmOptions) => {
    return new Promise<boolean>((resolve) => {
      setPending({ ...opts, kind: "confirm", resolve });
    });
  }, []);

  const promptDialog = useCallback((opts: PromptOptions) => {
    setPromptValue(opts.defaultValue ?? "");
    return new Promise<string | null>((resolve) => {
      setPending({ ...opts, kind: "prompt", resolve });
    });
  }, []);

  const closeConfirm = (result: boolean) => {
    if (!pending || pending.kind !== "confirm") return;
    pending.resolve(result);
    setPending(null);
  };

  const closePrompt = (result: string | null) => {
    if (!pending || pending.kind !== "prompt") return;
    pending.resolve(result);
    setPending(null);
  };

  return (
    <DialogContext.Provider value={{ confirmDialog, promptDialog }}>
      {children}
      {pending && (
        <div className="fixed inset-0 z-200 bg-black/60 backdrop-blur-sm flex items-center justify-center p-6">
          <div
            className="border w-full max-w-sm rounded-xl shadow-2xl p-5 flex flex-col gap-4"
            style={{ backgroundColor: "var(--sidebar-color)", borderColor: "var(--border-color)", color: "var(--text-color)" }}
          >
            <h3 className="text-base font-bold">{pending.title}</h3>
            {pending.kind === "confirm" ? (
              <p className="text-sm opacity-80 whitespace-pre-line">{pending.body}</p>
            ) : (
              <div>
                <label className="text-xs opacity-70 block mb-1">{pending.label}</label>
                <input
                  autoFocus
                  type="text"
                  value={promptValue}
                  onChange={(e) => setPromptValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") closePrompt(promptValue.trim());
                  }}
                  className="w-full border rounded px-2.5 py-1.5 text-sm focus:outline-none"
                  style={{ backgroundColor: "var(--bg-color)", borderColor: "var(--border-color)", color: "var(--text-color)" }}
                />
              </div>
            )}
            <div className="flex justify-end gap-2 mt-1">
              {pending.kind === "confirm" && !pending.okOnly && (
                <button
                  onClick={() => closeConfirm(false)}
                  className="px-4 py-2 rounded text-sm font-medium cursor-pointer hover:opacity-90"
                  style={{ backgroundColor: "var(--bg-color)", color: "var(--text-color)" }}
                >
                  {pending.cancelLabel ?? "Cancel"}
                </button>
              )}
              {pending.kind === "prompt" && (
                <button
                  onClick={() => closePrompt(null)}
                  className="px-4 py-2 rounded text-sm font-medium cursor-pointer hover:opacity-90"
                  style={{ backgroundColor: "var(--bg-color)", color: "var(--text-color)" }}
                >
                  Cancel
                </button>
              )}
              <button
                onClick={() => (pending.kind === "confirm" ? closeConfirm(true) : closePrompt(promptValue.trim()))}
                className="px-4 py-2 rounded text-sm font-semibold cursor-pointer hover:brightness-110"
                style={{ backgroundColor: "var(--accent-color)", color: "#fff" }}
              >
                {pending.confirmLabel ?? "OK"}
              </button>
            </div>
          </div>
        </div>
      )}
    </DialogContext.Provider>
  );
}
