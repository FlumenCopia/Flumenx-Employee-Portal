"use client";

import React, { use } from "react";
import Link from "next/link";
import "../tools.css";
import { toolsConfig } from "@/features/tools/config/tools.config";
import { ToolboxHeader } from "@/features/tools/components/ToolboxHeader";
import { ToolPageLayout } from "@/features/tools/components/ToolPageLayout";
import { useToolboxTheme } from "@/features/tools/hooks/useToolboxTheme";
import { useFavorites } from "@/features/tools/hooks/useFavorites";
import { Wrench, ArrowLeft } from "lucide-react";

export default function ToolDetailPage({ params }: { params: Promise<{ toolId: string }> }) {
  const { toolId } = use(params);
  const { theme, toggleTheme } = useToolboxTheme();
  const { favorites } = useFavorites();

  const tool = toolsConfig.find((t) => t.id === toolId);

  if (!tool) {
    return (
      <div className="tools-root">
        <ToolboxHeader
          theme={theme}
          onToggleTheme={toggleTheme}
          favoritesCount={favorites.length}
          isDetailPage
        />
        <div style={{ maxWidth: "600px", margin: "80px auto", textAlign: "center", padding: "30px" }}>
          <Wrench size={48} style={{ color: "var(--tools-text-muted)", margin: "0 auto 16px auto" }} />
          <h2 style={{ fontSize: "1.5rem", fontWeight: 800 }}>Tool Not Found</h2>
          <p style={{ color: "var(--tools-text-secondary)", marginBottom: "20px" }}>
            The requested utility '{toolId}' does not exist or has been relocated.
          </p>
          <Link href="/tools" className="tool-btn-primary">
            <ArrowLeft size={16} />
            <span>Browse All Tools</span>
          </Link>
        </div>
      </div>
    );
  }

  const relatedTools = toolsConfig.filter(
    (t) => t.id !== tool.id && t.departments.some((d) => tool.departments.includes(d))
  );

  const ToolComponent = tool.component;

  return (
    <div className="tools-root">
      <ToolboxHeader
        theme={theme}
        onToggleTheme={toggleTheme}
        favoritesCount={favorites.length}
        isDetailPage
      />
      <ToolPageLayout tool={tool} relatedTools={relatedTools}>
        <ToolComponent />
      </ToolPageLayout>
    </div>
  );
}
