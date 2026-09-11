"use client";

import React, { useRef, useEffect } from "react";
import { Search, X, Sparkles, Filter } from "lucide-react";
import { DepartmentId, ToolCategoryId } from "../types";
import { departmentsConfig } from "../config/departments.config";
import { categoriesConfig } from "../config/categories.config";

interface ToolboxHeroProps {
  searchQuery: string;
  onSearchChange: (q: string) => void;
  selectedDept: DepartmentId;
  onSelectDept: (dept: DepartmentId) => void;
  selectedCategory: ToolCategoryId;
  onSelectCategory: (cat: ToolCategoryId) => void;
  totalToolsCount: number;
  filteredCount: number;
}

export function ToolboxHero({
  searchQuery,
  onSearchChange,
  selectedDept,
  onSelectDept,
  selectedCategory,
  onSelectCategory,
  totalToolsCount,
  filteredCount,
}: ToolboxHeroProps) {
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "/" && document.activeElement !== searchInputRef.current) {
        if (
          document.activeElement?.tagName === "INPUT" ||
          document.activeElement?.tagName === "TEXTAREA"
        ) {
          return;
        }
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <section className="tools-hero">
      <div className="tools-hero-badge">
        <Sparkles size={14} className="text-emerald-500" />
        <span>Flumenx Internal Productivity Hub</span>
      </div>

      <h1 className="tools-hero-title">Your Everyday Utility Toolbox</h1>
      <p className="tools-hero-subtitle">
        Fast, zero-install tools running 100% locally in your browser. No files uploaded, no accounts required.
      </p>

      {/* Main Search Input */}
      <div className="tools-search-box">
        <div className="tools-search-icon">
          <Search size={20} />
        </div>
        <input
          ref={searchInputRef}
          type="text"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search by tool name, department, category or keywords (e.g. 'QR', 'GST', 'image', 'JSON')..."
          className="tools-search-input"
          aria-label="Search tools"
        />
        {searchQuery ? (
          <button
            type="button"
            onClick={() => onSearchChange("")}
            className="tools-search-clear"
            aria-label="Clear search"
          >
            <X size={16} />
          </button>
        ) : (
          <div className="tools-search-hint">Press / to focus</div>
        )}
      </div>

      {/* Department Filter Pills */}
      <div className="tools-filter-section">
        <div className="tools-dept-pills-wrap">
          <button
            type="button"
            className={`tools-dept-pill ${selectedDept === "all" ? "active" : ""}`}
            onClick={() => onSelectDept("all")}
          >
            All Departments
          </button>

          {departmentsConfig.map((dept) => (
            <button
              key={dept.id}
              type="button"
              className={`tools-dept-pill ${selectedDept === dept.id ? "active" : ""}`}
              onClick={() => onSelectDept(dept.id)}
            >
              {dept.name}
            </button>
          ))}
        </div>

        {/* Secondary Category Filter */}
        <div className="tools-cat-pills-wrap">
          <button
            type="button"
            className={`tools-cat-pill ${selectedCategory === "all" ? "active" : ""}`}
            onClick={() => onSelectCategory("all")}
          >
            All Types
          </button>
          {categoriesConfig.map((cat) => (
            <button
              key={cat.id}
              type="button"
              className={`tools-cat-pill ${selectedCategory === cat.id ? "active" : ""}`}
              onClick={() => onSelectCategory(cat.id)}
            >
              {cat.name}
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
