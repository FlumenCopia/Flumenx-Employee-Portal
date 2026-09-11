"use client";

import React from "react";
import Link from "next/link";
import { Star, ArrowRight, Flame } from "lucide-react";
import { ToolDefinition } from "../types";
import { ToolIcon } from "./ToolIcon";
import { departmentsConfig } from "../config/departments.config";

interface ToolCardProps {
  tool: ToolDefinition;
  isFavorite: boolean;
  onToggleFavorite: (id: string, e: React.MouseEvent) => void;
}

export function ToolCard({ tool, isFavorite, onToggleFavorite }: ToolCardProps) {
  const primaryDept = departmentsConfig.find((d) => d.id === tool.departments[0]) || departmentsConfig[0];

  return (
    <div className="tool-card group">
      <div className="tool-card-header">
        <div
          className="tool-card-icon"
          style={{
            backgroundColor: primaryDept.badgeBg,
            color: primaryDept.accentColor,
          }}
        >
          <ToolIcon name={tool.iconName} size={22} />
        </div>

        <div className="tool-card-actions">
          {tool.popular && (
            <span className="tool-card-popular-badge">
              <Flame size={12} />
              <span>Popular</span>
            </span>
          )}
          <button
            type="button"
            className={`tool-favorite-btn ${isFavorite ? "active" : ""}`}
            onClick={(e) => onToggleFavorite(tool.id, e)}
            title={isFavorite ? "Remove from favorites" : "Add to favorites"}
            aria-label={isFavorite ? "Remove from favorites" : "Add to favorites"}
          >
            <Star size={16} fill={isFavorite ? "#EAB308" : "none"} stroke={isFavorite ? "#EAB308" : "currentColor"} />
          </button>
        </div>
      </div>

      <Link href={`/tools/${tool.id}`} className="tool-card-body">
        <h3 className="tool-card-title">{tool.name}</h3>
        <p className="tool-card-desc">{tool.shortDescription}</p>

        <div className="tool-card-footer">
          <div className="tool-card-tags">
            {tool.departments.slice(0, 2).map((depId) => {
              const dept = departmentsConfig.find((d) => d.id === depId);
              if (!dept) return null;
              return (
                <span
                  key={depId}
                  className="tool-dept-tag"
                  style={{
                    backgroundColor: dept.badgeBg,
                    color: dept.accentColor,
                  }}
                >
                  {dept.shortName}
                </span>
              );
            })}
          </div>

          <span className="tool-launch-link">
            <span>Open</span>
            <ArrowRight size={14} className="tool-launch-arrow" />
          </span>
        </div>
      </Link>
    </div>
  );
}
