import React from "react";
import { createRoot } from "react-dom/client";
import { initMonitoring } from "@/infrastructure/monitoring/sentry";
import App from "./App.tsx";
import "./index.css";

// Initialise error monitoring before anything else renders.
// No-op in development or when VITE_SENTRY_DSN is not set.
initMonitoring();

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
