import { createContext, ReactNode, useContext } from "react";
import { useSignalProcessing } from "../hooks/useSignalProcessing";

type SignalProcessingContextValue = ReturnType<typeof useSignalProcessing>;

const SignalProcessingContext = createContext<SignalProcessingContextValue | null>(null);

export function SignalProcessingProvider({ children }: { children: ReactNode }) {
  const value = useSignalProcessing();
  return <SignalProcessingContext.Provider value={value}>{children}</SignalProcessingContext.Provider>;
}

export function useSignalProcessingContext(): SignalProcessingContextValue {
  const ctx = useContext(SignalProcessingContext);
  if (!ctx) throw new Error("useSignalProcessingContext must be used within a SignalProcessingProvider");
  return ctx;
}
