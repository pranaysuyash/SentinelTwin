"use client";

import { useEffect } from "react";

export function ReactScan() {
  useEffect(() => {
    if (process.env.NODE_ENV === "development") {
      import("react-scan").then(({ scan }) => {
        scan({ enabled: true });
      }).catch(() => {
        /* react-scan is dev-only; silent fail if missing */
      });
    }
  }, []);

  return null;
}
