"use client";

import React from "react";
import * as LucideIcons from "lucide-react";
import { Wrench } from "lucide-react";

interface ToolIconProps {
  name: string;
  size?: number;
  className?: string;
}

export function ToolIcon({ name, size = 20, className = "" }: ToolIconProps) {
  // @ts-ignore
  const IconComponent = LucideIcons[name] || Wrench;
  return <IconComponent size={size} className={className} />;
}
