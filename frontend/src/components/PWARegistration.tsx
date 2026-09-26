"use client";

import { useEffect } from "react";

export default function PWARegistration() {
  useEffect(() => {
    if (typeof window !== "undefined" && "serviceWorker" in navigator) {
      window.addEventListener("load", () => {
        navigator.serviceWorker
          .register("/sw.js")
          .then((reg) => {
            console.log("MRIIQ PWA ServiceWorker registered with scope:", reg.scope);
          })
          .catch((err) => {
            console.warn("MRIIQ PWA ServiceWorker registration failed:", err);
          });
      });
    }
  }, []);

  return null;
}
