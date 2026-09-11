import { LucideIcon } from "lucide-react";
import React from "react";

export type DepartmentId =
  | "all"
  | "accounting"
  | "marketing"
  | "design"
  | "video"
  | "development"
  | "operations"
  | "business"
  | "general";

export type ToolCategoryId =
  | "all"
  | "generators"
  | "converters"
  | "calculators"
  | "formatters"
  | "media"
  | "seo"
  | "productivity"
  | "finance";

export interface DepartmentMeta {
  id: DepartmentId;
  name: string;
  shortName: string;
  description: string;
  iconName: string;
  accentColor: string;
  badgeBg: string;
}

export interface CategoryMeta {
  id: ToolCategoryId;
  name: string;
  description: string;
  iconName: string;
}

export interface ToolDefinition {
  id: string;
  name: string;
  shortDescription: string;
  description: string;
  category: ToolCategoryId;
  departments: DepartmentId[];
  iconName: string;
  keywords: string[];
  popular?: boolean;
  privacyBadge?: string;
  component: React.ComponentType<any>;
}

export interface ToolPresetItem {
  name: string;
  category?: string;
  [key: string]: any;
}
