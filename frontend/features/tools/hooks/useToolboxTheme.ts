"use client";

import { useState, useEffect, useCallback } from "react";

const STORAGE_KEY = "flumenx_tools_theme";

export type ToolboxTheme = "light" | "dark";

export function useToolboxTheme() {
  const [theme, setTheme] = useState<ToolboxTheme>("light");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    let initial: ToolboxTheme = "light";
    try {
      const stored = localStorage.getItem(STORAGE_KEY) as ToolboxTheme | null;
      if (stored === "dark") {
        // Reset stored dark mode to light to match FLUMENX BOS white portal aesthetic
        initial = "light";
        localStorage.setItem(STORAGE_KEY, "light");
      } else {
        initial = "light";
      }
    } catch {
      // ignore
    }
    setTheme(initial);
    document.documentElement.setAttribute("data-theme", "light");
    document.documentElement.classList.remove("dark");
    setMounted(true);
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme((prev) => {
      const next: ToolboxTheme = prev === "dark" ? "light" : "dark";
      try {
        localStorage.setItem(STORAGE_KEY, next);
      } catch {
        // ignore
      }
      document.documentElement.setAttribute("data-theme", next);
      if (next === "dark") {
        document.documentElement.classList.add("dark");
      } else {
        document.documentElement.classList.remove("dark");
      }
      return next;
    });
  }, []);

  return { theme, toggleTheme, mounted };
}
