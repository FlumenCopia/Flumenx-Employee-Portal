"use client";

import React, { useState, useMemo } from "react";
import "./tools.css";
import { toolsConfig } from "@/features/tools/config/tools.config";
import { departmentsConfig } from "@/features/tools/config/departments.config";
import { categoriesConfig } from "@/features/tools/config/categories.config";
import { DepartmentId, ToolCategoryId } from "@/features/tools/types";
import { ToolboxHeader } from "@/features/tools/components/ToolboxHeader";
import { ToolboxHero } from "@/features/tools/components/ToolboxHero";
import { ToolCard } from "@/features/tools/components/ToolCard";
import { useFavorites } from "@/features/tools/hooks/useFavorites";
import { useRecentlyUsed } from "@/features/tools/hooks/useRecentlyUsed";
import { useToolboxTheme } from "@/features/tools/hooks/useToolboxTheme";
import { Sparkles, Clock, Flame, Star, SearchX, X } from "lucide-react";

export default function ToolsDashboardPage() {
  const { theme, toggleTheme } = useToolboxTheme();
  const { favorites, toggleFavorite, isFavorite } = useFavorites();
  const { recents, clearRecents } = useRecentlyUsed();

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedDept, setSelectedDept] = useState<DepartmentId>("all");
  const [selectedCategory, setSelectedCategory] = useState<ToolCategoryId>("all");
  const [showOnlyFavorites, setShowOnlyFavorites] = useState(false);

  // Filter tools based on query, department, category, and favorites
  const filteredTools = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();

    return toolsConfig.filter((tool) => {
      if (showOnlyFavorites && !favorites.includes(tool.id)) {
        return false;
      }

      if (selectedDept !== "all" && !tool.departments.includes(selectedDept)) {
        return false;
      }

      if (selectedCategory !== "all" && tool.category !== selectedCategory) {
        return false;
      }

      if (!q) return true;

      const matchesName = tool.name.toLowerCase().includes(q);
      const matchesShort = tool.shortDescription.toLowerCase().includes(q);
      const matchesDesc = tool.description.toLowerCase().includes(q);
      const matchesKeywords = tool.keywords.some((k) => k.toLowerCase().includes(q));
      const matchesCategory = tool.category.toLowerCase().includes(q);
      const matchesDepts = tool.departments.some((d) => d.toLowerCase().includes(q));

      return matchesName || matchesShort || matchesDesc || matchesKeywords || matchesCategory || matchesDepts;
    });
  }, [searchQuery, selectedDept, selectedCategory, showOnlyFavorites, favorites]);

  // Recent tools objects
  const recentToolObjects = useMemo(() => {
    if (!recents || recents.length === 0) return [];
    return recents
      .map((r) => toolsConfig.find((t) => t.id === r.id))
      .filter(Boolean) as typeof toolsConfig;
  }, [recents]);

  // Popular tools objects
  const popularTools = useMemo(() => {
    return toolsConfig.filter((t) => t.popular);
  }, []);

  const handleToggleFavorite = (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    toggleFavorite(id);
  };

  const handleClearAllFilters = () => {
    setSearchQuery("");
    setSelectedDept("all");
    setSelectedCategory("all");
    setShowOnlyFavorites(false);
  };

  const isFilteringActive =
    searchQuery !== "" || selectedDept !== "all" || selectedCategory !== "all" || showOnlyFavorites;

  return (
    <div className="tools-root">
      {/* Header */}
      <ToolboxHeader
        theme={theme}
        onToggleTheme={toggleTheme}
        favoritesCount={favorites.length}
        showOnlyFavorites={showOnlyFavorites}
        onToggleShowFavorites={() => setShowOnlyFavorites(!showOnlyFavorites)}
        onOpenSearch={() => {
          const el = document.querySelector(".tools-search-input") as HTMLInputElement | null;
          el?.focus();
        }}
      />

      {/* Hero Section with Search & Filter Pills */}
      <ToolboxHero
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        selectedDept={selectedDept}
        onSelectDept={setSelectedDept}
        selectedCategory={selectedCategory}
        onSelectCategory={setSelectedCategory}
        totalToolsCount={toolsConfig.length}
        filteredCount={filteredTools.length}
      />

      {/* Main Content Area */}
      <main className="tools-main-container">
        {/* Recently Used Row (Only shown when not actively searching) */}
        {!isFilteringActive && recentToolObjects.length > 0 && (
          <section style={{ marginBottom: "36px" }}>
            <div className="tools-section-header">
              <h2 className="tools-section-title">
                <Clock size={18} className="text-emerald-500" />
                <span>Recently Used</span>
              </h2>
              <button
                type="button"
                onClick={clearRecents}
                style={{
                  background: "none",
                  border: "none",
                  color: "var(--tools-text-muted)",
                  fontSize: "0.8rem",
                  cursor: "pointer",
                }}
              >
                Clear History
              </button>
            </div>
            <div className="tools-grid">
              {recentToolObjects.slice(0, 4).map((tool) => (
                <ToolCard
                  key={tool.id}
                  tool={tool}
                  isFavorite={isFavorite(tool.id)}
                  onToggleFavorite={handleToggleFavorite}
                />
              ))}
            </div>
          </section>
        )}

        {/* Popular Tools Quick Section (Only shown on initial homepage) */}
        {!isFilteringActive && (
          <section style={{ marginBottom: "36px" }}>
            <div className="tools-section-header">
              <h2 className="tools-section-title">
                <Flame size={18} style={{ color: "#EF4444" }} />
                <span>Popular Utilities</span>
              </h2>
              <span className="tools-section-count">{popularTools.length} tools</span>
            </div>
            <div className="tools-grid">
              {popularTools.slice(0, 8).map((tool) => (
                <ToolCard
                  key={tool.id}
                  tool={tool}
                  isFavorite={isFavorite(tool.id)}
                  onToggleFavorite={handleToggleFavorite}
                />
              ))}
            </div>
          </section>
        )}

        {/* Filtered or All Tools Section */}
        <section>
          <div className="tools-section-header">
            <h2 className="tools-section-title">
              {showOnlyFavorites ? (
                <>
                  <Star size={18} fill="#EAB308" stroke="#EAB308" />
                  <span>Starred Favorites</span>
                </>
              ) : isFilteringActive ? (
                <span>Filtered Results</span>
              ) : (
                <span>All Department Utilities</span>
              )}
            </h2>

            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <span className="tools-section-count">
                {filteredTools.length} {filteredTools.length === 1 ? "tool" : "tools"}
              </span>
              {isFilteringActive && (
                <button
                  type="button"
                  onClick={handleClearAllFilters}
                  style={{
                    background: "none",
                    border: "none",
                    color: "var(--tools-primary)",
                    fontSize: "0.82rem",
                    cursor: "pointer",
                    fontWeight: 600,
                  }}
                >
                  Reset filters
                </button>
              )}
            </div>
          </div>

          {filteredTools.length === 0 ? (
            <div className="tools-empty-state">
              <SearchX size={44} className="tools-empty-icon" />
              <h3 className="tools-empty-title">No matching tools found</h3>
              <p className="tools-empty-desc">
                We couldn't find any utility matching "{searchQuery}". Try adjusting your keywords or clearing active filters.
              </p>
              <button
                type="button"
                onClick={handleClearAllFilters}
                className="tool-btn-primary"
              >
                Clear all filters
              </button>
            </div>
          ) : (
            <div className="tools-grid">
              {filteredTools.map((tool) => (
                <ToolCard
                  key={tool.id}
                  tool={tool}
                  isFavorite={isFavorite(tool.id)}
                  onToggleFavorite={handleToggleFavorite}
                />
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
