"use client";

import React, { useEffect } from "react";
import Link from "next/link";
import { ArrowLeft, Star, Share2, ShieldCheck, Check } from "lucide-react";
import { ToolDefinition } from "../types";
import { ToolIcon } from "./ToolIcon";
import { PrivacyBadge } from "./PrivacyBadge";
import { useFavorites } from "../hooks/useFavorites";
import { useRecentlyUsed } from "../hooks/useRecentlyUsed";
import { departmentsConfig } from "../config/departments.config";
import { toast } from "@/components/ToastContext";

interface ToolPageLayoutProps {
  tool: ToolDefinition;
  relatedTools?: ToolDefinition[];
  children: React.ReactNode;
}

export function ToolPageLayout({ tool, relatedTools = [], children }: ToolPageLayoutProps) {
  const { isFavorite, toggleFavorite } = useFavorites();
  const { markRecent } = useRecentlyUsed();
  const favorited = isFavorite(tool.id);

  useEffect(() => {
    markRecent(tool.id);
  }, [tool.id, markRecent]);

  const handleCopyShareLink = () => {
    if (typeof window !== "undefined") {
      navigator.clipboard.writeText(window.location.href);
      toast.success("Tool link copied to clipboard!");
    }
  };

  const primaryDept =
    departmentsConfig.find((d) => d.id === tool.departments[0]) || departmentsConfig[0];

  return (
    <div className="tool-detail-container">
      {/* Top Nav & Breadcrumbs */}
      <div className="tool-detail-top-nav">
        <Link href="/tools" className="tool-back-btn">
          <ArrowLeft size={16} />
          <span>Back to all tools</span>
        </Link>

        <div className="tool-detail-breadcrumbs">
          <Link href="/tools">Toolbox</Link>
          <span className="tool-sep">/</span>
          <span>{primaryDept.name}</span>
          <span className="tool-sep">/</span>
          <span className="tool-current-crumb">{tool.name}</span>
        </div>
      </div>

      {/* Tool Header Card */}
      <div className="tool-header-card">
        <div className="tool-header-content">
          <div
            className="tool-header-icon"
            style={{
              backgroundColor: primaryDept.badgeBg,
              color: primaryDept.accentColor,
            }}
          >
            <ToolIcon name={tool.iconName} size={30} />
          </div>

          <div className="tool-header-meta">
            <div className="tool-header-badges">
              {tool.departments.map((deptId) => {
                const d = departmentsConfig.find((dept) => dept.id === deptId);
                if (!d) return null;
                return (
                  <span
                    key={deptId}
                    className="tool-dept-badge"
                    style={{
                      backgroundColor: d.badgeBg,
                      color: d.accentColor,
                    }}
                  >
                    {d.name}
                  </span>
                );
              })}
            </div>
            <h1 className="tool-header-title">{tool.name}</h1>
            <p className="tool-header-description">{tool.description}</p>
          </div>
        </div>

        <div className="tool-header-actions">
          <button
            type="button"
            onClick={(e) => toggleFavorite(tool.id)}
            className={`tool-header-action-btn ${favorited ? "active" : ""}`}
            title={favorited ? "Remove from favorites" : "Add to favorites"}
          >
            <Star
              size={18}
              fill={favorited ? "#EAB308" : "none"}
              stroke={favorited ? "#EAB308" : "currentColor"}
            />
            <span>{favorited ? "Favorited" : "Favorite"}</span>
          </button>

          <button
            type="button"
            onClick={handleCopyShareLink}
            className="tool-header-action-btn"
            title="Share tool URL"
          >
            <Share2 size={17} />
            <span>Share</span>
          </button>
        </div>
      </div>

      {/* Privacy Guarantee Banner */}
      <PrivacyBadge customText={tool.privacyBadge} />

      {/* Interactive Tool Workspace */}
      <main className="tool-workspace">{children}</main>

      {/* Related Tools Section */}
      {relatedTools.length > 0 && (
        <section className="tool-related-section">
          <h2 className="tool-related-title">Related Tools in {primaryDept.name}</h2>
          <div className="tool-related-grid">
            {relatedTools.slice(0, 3).map((rel) => (
              <Link key={rel.id} href={`/tools/${rel.id}`} className="tool-related-card">
                <div className="tool-related-icon">
                  <ToolIcon name={rel.iconName} size={20} />
                </div>
                <div>
                  <h4 className="tool-related-name">{rel.name}</h4>
                  <p className="tool-related-desc">{rel.shortDescription}</p>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
