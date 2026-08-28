'use client';

import React, { ReactNode } from 'react';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { TOKENS } from './tokens';

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

export interface BreadcrumbProps {
  items: BreadcrumbItem[];
  style?: React.CSSProperties;
}

export function Breadcrumb({ items, style }: BreadcrumbProps) {
  return (
    <nav style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: TOKENS.colors.textMuted, marginBottom: '8px', ...style }}>
      {items.map((item, idx) => (
        <React.Fragment key={item.label + idx}>
          {idx > 0 && <ChevronRight size={12} style={{ opacity: 0.6 }} />}
          {item.href ? (
            <Link href={item.href} style={{ color: TOKENS.colors.textSecondary, textDecoration: 'none', fontWeight: 500 }}>
              {item.label}
            </Link>
          ) : (
            <span style={{ color: TOKENS.colors.textPrimary, fontWeight: 600 }}>{item.label}</span>
          )}
        </React.Fragment>
      ))}
    </nav>
  );
}

export interface PageHeaderProps {
  title: string;
  subtitle?: string;
  eyebrow?: string;
  breadcrumb?: BreadcrumbItem[];
  actions?: ReactNode;
  style?: React.CSSProperties;
}

export function PageHeader({ title, subtitle, eyebrow, breadcrumb, actions, style }: PageHeaderProps) {
  return (
    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        gap: '16px',
        marginBottom: '24px',
        ...style,
      }}
      className="ds-page-header"
    >
      <div>
        {breadcrumb && <Breadcrumb items={breadcrumb} />}
        {eyebrow && (
          <div style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.08em', color: TOKENS.colors.brandPrimary, textTransform: 'uppercase', marginBottom: '4px' }}>
            {eyebrow}
          </div>
        )}
        <h1 style={{ margin: 0, fontSize: '24px', fontWeight: 700, color: TOKENS.colors.textPrimary, letterSpacing: '-0.02em', lineHeight: 1.2 }}>
          {title}
        </h1>
        {subtitle && (
          <p style={{ margin: '6px 0 0 0', fontSize: '13px', color: TOKENS.colors.textSecondary, maxWidth: '700px', lineHeight: 1.45 }}>
            {subtitle}
          </p>
        )}
      </div>

      {actions && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          {actions}
        </div>
      )}
    </div>
  );
}
