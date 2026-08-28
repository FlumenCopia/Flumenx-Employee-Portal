'use client';

import React, { ReactNode } from 'react';
import { TOKENS } from './tokens';

// --- BASE CARD ---
export interface CardProps {
  children: ReactNode;
  padding?: 'none' | 'sm' | 'md' | 'lg';
  elevation?: 'flat' | 'low' | 'mid';
  style?: React.CSSProperties;
  className?: string;
  onClick?: () => void;
}

export function Card({ children, padding = 'md', elevation = 'low', style, className = '', onClick }: CardProps) {
  const getPadding = () => {
    switch (padding) {
      case 'none': return '0';
      case 'sm': return '12px 16px';
      case 'md': return '20px';
      case 'lg': return '28px';
    }
  };

  const getShadow = () => {
    switch (elevation) {
      case 'flat': return TOKENS.shadows.flat;
      case 'low': return TOKENS.shadows.sm;
      case 'mid': return TOKENS.shadows.md;
    }
  };

  return (
    <div
      onClick={onClick}
      style={{
        backgroundColor: TOKENS.colors.surfacePanel,
        border: `1px solid ${TOKENS.colors.borderLight}`,
        borderRadius: TOKENS.radius.lg,
        padding: getPadding(),
        boxShadow: getShadow(),
        transition: 'all 0.15s ease',
        cursor: onClick ? 'pointer' : 'default',
        ...style,
      }}
      className={`ds-card ${className}`}
    >
      {children}
    </div>
  );
}

// --- STAT CARD ---
export interface StatCardProps {
  label: string;
  value: string | number;
  note?: string;
  icon?: ReactNode;
  accent?: boolean;
  trend?: 'up' | 'down' | 'neutral';
  style?: React.CSSProperties;
}

export function StatCard({ label, value, note, icon, accent, style }: StatCardProps) {
  return (
    <Card
      elevation="low"
      style={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        minHeight: '120px',
        borderTop: accent ? `3px solid ${TOKENS.colors.brandPrimary}` : `1px solid ${TOKENS.colors.borderLight}`,
        ...style,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
        <span style={{ fontSize: '11px', fontWeight: 600, color: TOKENS.colors.textSecondary, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          {label}
        </span>
        {icon && (
          <div
            style={{
              width: '32px',
              height: '32px',
              borderRadius: TOKENS.radius.sm,
              backgroundColor: accent ? TOKENS.colors.brandSubtle : TOKENS.colors.surfaceSubtle,
              color: accent ? TOKENS.colors.brandPrimary : TOKENS.colors.textSecondary,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: `1px solid ${accent ? TOKENS.colors.brandBorder : TOKENS.colors.borderLight}`,
            }}
          >
            {icon}
          </div>
        )}
      </div>

      <div>
        <div style={{ fontSize: '26px', fontWeight: 700, color: TOKENS.colors.textPrimary, letterSpacing: '-0.02em', lineHeight: 1.1 }}>
          {value}
        </div>
        {note && (
          <div style={{ fontSize: '12px', color: TOKENS.colors.textMuted, marginTop: '4px' }}>
            {note}
          </div>
        )}
      </div>
    </Card>
  );
}

// --- SECTION PANEL ---
export interface SectionProps {
  title: string;
  kicker?: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
  style?: React.CSSProperties;
  bodyStyle?: React.CSSProperties;
  className?: string;
}

export function Section({ title, kicker, description, action, children, style, bodyStyle, className = '' }: SectionProps) {
  return (
    <div
      style={{
        backgroundColor: TOKENS.colors.surfacePanel,
        border: `1px solid ${TOKENS.colors.borderLight}`,
        borderRadius: TOKENS.radius.lg,
        boxShadow: TOKENS.shadows.sm,
        marginBottom: '24px',
        overflow: 'hidden',
        ...style,
      }}
      className={`ds-section ${className}`}
    >
      <div
        style={{
          padding: '16px 20px',
          borderBottom: `1px solid ${TOKENS.colors.borderLight}`,
          backgroundColor: TOKENS.colors.surfaceSubtle,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '16px',
        }}
      >
        <div>
          {kicker && (
            <div style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.08em', color: TOKENS.colors.brandPrimary, textTransform: 'uppercase', marginBottom: '2px' }}>
              {kicker}
            </div>
          )}
          <h2 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: TOKENS.colors.textPrimary }}>
            {title}
          </h2>
          {description && (
            <p style={{ margin: '2px 0 0 0', fontSize: '12px', color: TOKENS.colors.textMuted }}>
              {description}
            </p>
          )}
        </div>
        {action && <div>{action}</div>}
      </div>

      <div style={{ padding: '20px', ...bodyStyle }}>{children}</div>
    </div>
  );
}
