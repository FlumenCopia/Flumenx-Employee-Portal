'use client';

import React, { ReactNode } from 'react';
import { TOKENS } from './tokens';

export type BadgeTone = 'neutral' | 'brand' | 'success' | 'warning' | 'danger' | 'info';
export type BadgeSize = 'sm' | 'md';

export interface BadgeProps {
  tone?: BadgeTone;
  size?: BadgeSize;
  dot?: boolean;
  children: ReactNode;
  style?: React.CSSProperties;
  className?: string;
}

export function Badge({ tone = 'neutral', size = 'md', dot = false, children, style, className = '' }: BadgeProps) {
  const getToneStyles = (): React.CSSProperties => {
    switch (tone) {
      case 'brand':
        return {
          backgroundColor: TOKENS.colors.brandSubtle,
          color: TOKENS.colors.brandPrimary,
          border: `1px solid ${TOKENS.colors.brandBorder}`,
        };
      case 'success':
        return {
          backgroundColor: TOKENS.colors.successBg,
          color: TOKENS.colors.success,
          border: `1px solid ${TOKENS.colors.successBorder}`,
        };
      case 'warning':
        return {
          backgroundColor: TOKENS.colors.warningBg,
          color: TOKENS.colors.warning,
          border: `1px solid ${TOKENS.colors.warningBorder}`,
        };
      case 'danger':
        return {
          backgroundColor: TOKENS.colors.dangerBg,
          color: TOKENS.colors.danger,
          border: `1px solid ${TOKENS.colors.dangerBorder}`,
        };
      case 'info':
        return {
          backgroundColor: TOKENS.colors.infoBg,
          color: TOKENS.colors.info,
          border: `1px solid ${TOKENS.colors.infoBorder}`,
        };
      case 'neutral':
      default:
        return {
          backgroundColor: TOKENS.colors.surfaceMuted,
          color: TOKENS.colors.textSecondary,
          border: `1px solid ${TOKENS.colors.borderMedium}`,
        };
    }
  };

  const isSmall = size === 'sm';

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '5px',
        padding: isSmall ? '2px 6px' : '3px 9px',
        fontSize: isSmall ? '11px' : '12px',
        fontWeight: 600,
        lineHeight: 1,
        borderRadius: TOKENS.radius.sm,
        fontFamily: TOKENS.fonts.body,
        whiteSpace: 'nowrap',
        ...getToneStyles(),
        ...style,
      }}
      className={`ds-badge ds-badge-${tone} ${className}`}
    >
      {dot && (
        <span
          style={{
            width: '6px',
            height: '6px',
            borderRadius: TOKENS.radius.full,
            backgroundColor: 'currentColor',
          }}
        />
      )}
      {children}
    </span>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const norm = (status || '').toLowerCase().trim();

  let tone: BadgeTone = 'neutral';

  if (['active', 'approved', 'paid', 'present', 'completed', 'on time', 'verified', 'healthy', 'delivered'].includes(norm)) {
    tone = 'success';
  } else if (['pending', 'in review', 'in progress', 'grace', 'late', 'warning', 'half day'].includes(norm)) {
    tone = 'warning';
  } else if (['rejected', 'inactive', 'failed', 'absent', 'danger', 'unpaid', 'terminated', 'cancelled'].includes(norm)) {
    tone = 'danger';
  } else if (['calculated', 'info', 'scheduled', 'live'].includes(norm)) {
    tone = 'info';
  } else if (['draft', 'locked', 'probation', 'regular'].includes(norm)) {
    tone = 'neutral';
  } else if (['permanent', 'company', 'admin'].includes(norm)) {
    tone = 'brand';
  }

  return <Badge tone={tone} dot>{status}</Badge>;
}
