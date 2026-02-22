import React from "react";
import ReactDOM from "react-dom/client";
import "@/index.css";
import App from "@/App";

// Suppress ResizeObserver loop error (known browser bug, doesn't affect functionality)
// This error is harmless and occurs in many UI libraries with resize observers
if (typeof window !== 'undefined') {
  const errorHandler = (e) => {
    if (e.message && (
      e.message.includes('ResizeObserver loop') ||
      e.message.includes('ResizeObserver loop completed with undelivered notifications')
    )) {
      const resizeObserverErrDiv = document.getElementById('webpack-dev-server-client-overlay-div');
      const resizeObserverErr = document.getElementById('webpack-dev-server-client-overlay');
      if (resizeObserverErrDiv) resizeObserverErrDiv.style.display = 'none';
      if (resizeObserverErr) resizeObserverErr.style.display = 'none';
      e.stopImmediatePropagation?.();
      return true;
    }
  };
  window.addEventListener('error', errorHandler);
  window.addEventListener('unhandledrejection', (e) => {
    if (e.reason?.message?.includes('ResizeObserver')) {
      e.preventDefault();
    }
  });
}

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
