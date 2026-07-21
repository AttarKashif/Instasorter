import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import { GlobalErrorBoundary } from "./components/ui/GlobalErrorBoundary.tsx";
import "./index.css";

declare global {
  interface Window {
    deferredPrompt: any;
  }
}

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/service-worker.js").catch((err) => {
      console.error("ServiceWorker registration failed: ", err);
    });
  });
}

window.addEventListener("beforeinstallprompt", (e) => {
  // Prevent Chrome 67 and earlier from automatically showing the prompt
  e.preventDefault();
  // Stash the event so it can be triggered later.
  window.deferredPrompt = e;
  // Dispatch custom event to notify components that the app is installable
  window.dispatchEvent(new CustomEvent("app-installable"));
});

window.addEventListener("appinstalled", () => {
  window.deferredPrompt = null;
  window.dispatchEvent(new CustomEvent("app-installed"));
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <GlobalErrorBoundary>
      <App />
    </GlobalErrorBoundary>
  </StrictMode>,
);
