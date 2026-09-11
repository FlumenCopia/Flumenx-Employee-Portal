"use client";

import React from "react";
import Link from "next/link";
import { Sun, Moon, Star, ArrowLeft, Wrench, Search, Sparkles } from "lucide-react";
import { FlumenxMark } from "@/components/icons";

interface ToolboxHeaderProps {
  theme: "light" | "dark";
  onToggleTheme: () => void;
  favoritesCount: number;
  showOnlyFavorites?: boolean;
  onToggleShowFavorites?: () => void;
  onOpenSearch?: () => void;
  isDetailPage?: boolean;
}

export function ToolboxHeader({
  theme,
  onToggleTheme,
  favoritesCount,
  showOnlyFavorites = false,
  onToggleShowFavorites,
  onOpenSearch,
  isDetailPage = false,
}: ToolboxHeaderProps) {
  return (
    <header className="tools-header">
      <div className="tools-header-container">
        {/* Brand Left */}
        <div className="tools-header-brand">
          <Link href="/tools" className="tools-brand-link">
            <FlumenxMark small height={26} />
            <div className="tools-brand-text">
              <span className="tools-brand-title">Flumenx Toolbox</span>
              <span className="tools-brand-badge">Internal Utilities</span>
            </div>
          </Link>
        </div>

        {/* Actions Right */}
        <div className="tools-header-actions">
          {onOpenSearch && !isDetailPage && (
            <button
              type="button"
              onClick={onOpenSearch}
              className="tools-search-trigger-btn"
              title="Search tools (Press / to focus)"
            >
              <Search size={15} />
              <span className="tools-search-trigger-text">Search tools...</span>
              <kbd className="tools-search-kbd">/</kbd>
            </button>
          )}

          {onToggleShowFavorites && !isDetailPage && (
            <button
              type="button"
              onClick={onToggleShowFavorites}
              className={`tools-header-icon-btn ${showOnlyFavorites ? "active" : ""}`}
              title={showOnlyFavorites ? "Show all tools" : "Show starred favorites"}
            >
              <Star
                size={17}
                fill={showOnlyFavorites ? "#EAB308" : "none"}
                stroke={showOnlyFavorites ? "#EAB308" : "currentColor"}
              />
              <span className="tools-header-fav-count">{favoritesCount}</span>
            </button>
          )}

          <button
            type="button"
            onClick={onToggleTheme}
            className="tools-header-icon-btn"
            title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
            aria-label="Toggle theme"
          >
            {theme === "dark" ? <Sun size={17} className="text-amber-400" /> : <Moon size={17} />}
          </button>

          <Link href="/" className="tools-back-portal-link" title="Return to main portal">
            <ArrowLeft size={15} />
            <span className="tools-back-portal-text">Back to Portal</span>
          </Link>
        </div>
      </div>
    </header>
  );
}
