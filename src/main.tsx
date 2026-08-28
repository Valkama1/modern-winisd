import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { ToastProvider, DialogProvider } from "./components/ui";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <ToastProvider>
      <DialogProvider>
        <App />
      </DialogProvider>
    </ToastProvider>
  </React.StrictMode>,
);
