"use client";

import { useState, useEffect, useCallback } from "react";

const STORAGE_KEY = "flumenx_tools_recent";
const MAX_RECENTS = 12;

export interface RecentToolItem {
  id: string;
  visitedAt: number;
}

export function useRecentlyUsed() {
  const [recents, setRecents] = useState<RecentToolItem[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          setRecents(parsed);
        }
      }
    } catch {
      // ignore
    } finally {
      setLoaded(true);
    }
  }, []);

  const markRecent = useCallback((toolId: string) => {
    setRecents((prev) => {
      const filtered = prev.filter((item) => item.id !== toolId);
      const next = [{ id: toolId, visitedAt: Date.now() }, ...filtered].slice(0, MAX_RECENTS);
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });
  }, []);

  const clearRecents = useCallback(() => {
    setRecents([]);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
  }, []);

  return { recents, markRecent, clearRecents, loaded };
}
