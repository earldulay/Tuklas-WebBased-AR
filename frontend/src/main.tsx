import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./styles.css";

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

// Registers the service worker and makes sure a newly deployed version
// actually takes effect. Without this, skipWaiting()/clients.claim() in
// service-worker.js let a new worker take control in the background, but
// the already-loaded page keeps running the old JS bundle until something
// reloads it - in practice that meant the app only ever picked up an
// update after a manual hard refresh / cache clear. `controllerchange`
// fires exactly when a new worker takes over, so reloading there closes
// that gap: a deploy takes effect on this device's very next check.
if ("serviceWorker" in navigator) {
  window.addEventListener("load", async () => {
    try {
      const registration = await navigator.serviceWorker.register("/service-worker.js");

      const checkForUpdate = () => registration.update().catch(() => undefined);
      document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "visible") checkForUpdate();
      });
      window.addEventListener("focus", checkForUpdate);
      window.setInterval(checkForUpdate, 5 * 60 * 1000);
    } catch {
      // Service worker registration is a progressive enhancement - the app
      // still works online without it.
    }
  });

  let reloading = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (reloading) return;
    reloading = true;
    window.location.reload();
  });
}
