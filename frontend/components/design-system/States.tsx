'use client';

import React, { ReactNode } from 'react';
import { AlertCircle, FolderOpen, RefreshCw } from 'lucide-react';
import { TOKENS } from './tokens';
import { Button } from './Button';

// --- EMPTY STATE ---
export interface EmptyStateProps {
  title: string;
  description: string;
  icon?: ReactNode;
  action?: {
    label: string;
    onClick: () => void;
    icon?: ReactNode;
  };
  style?: React.CSSProperties;
}

export function EmptyState({ title, description, icon, action, style }: EmptyStateProps) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '48px 24px',
        textAlign: 'center',
        backgroundColor: TOKENS.colors.surfacePanel,
        border: `1px dashed ${TOKENS.colors.borderMedium}`,
        borderRadius: TOKENS.radius.lg,
        ...style,
      }}
      className="ds-empty-state"
    >
      <div
        style={{
          width: '48px',
          height: '48px',
          borderRadius: TOKENS.radius.full,
          backgroundColor: TOKENS.colors.brandSubtle,
          color: TOKENS.colors.brandPrimary,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: '16px',
        }}
      >
        {icon || <FolderOpen size={24} />}
      </div>

      <h3 style={{ margin: '0 0 6px 0', fontSize: '15px', fontWeight: 700, color: TOKENS.colors.textPrimary }}>
        {title}
      </h3>
      <p style={{ margin: 0, fontSize: '13px', color: TOKENS.colors.textMuted, maxWidth: '400px', lineHeight: 1.45 }}>
        {description}
      </p>

      {action && (
        <div style={{ marginTop: '20px' }}>
          <Button variant="primary" size="sm" onClick={action.onClick} leftIcon={action.icon}>
            {action.label}
          </Button>
        </div>
      )}
    </div>
  );
}

// --- ERROR STATE ---
export interface ErrorStateProps {
  title?: string;
  message: string;
  onRetry?: () => void;
  style?: React.CSSProperties;
}

export function ErrorState({ title = 'Something went wrong', message, onRetry, style }: ErrorStateProps) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '40px 24px',
        textAlign: 'center',
        backgroundColor: TOKENS.colors.dangerBg,
        border: `1px solid ${TOKENS.colors.dangerBorder}`,
        borderRadius: TOKENS.radius.lg,
        ...style,
      }}
      className="ds-error-state"
    >
      <div
        style={{
          width: '44px',
          height: '44px',
          borderRadius: TOKENS.radius.full,
          backgroundColor: '#FFFFFF',
          color: TOKENS.colors.danger,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: '14px',
          boxShadow: TOKENS.shadows.sm,
        }}
      >
        <AlertCircle size={24} />
      </div>

      <h3 style={{ margin: '0 0 4px 0', fontSize: '15px', fontWeight: 700, color: TOKENS.colors.danger }}>
        {title}
      </h3>
      <p style={{ margin: 0, fontSize: '13px', color: TOKENS.colors.textSecondary, maxWidth: '440px', lineHeight: 1.45 }}>
        {message}
      </p>

      {onRetry && (
        <div style={{ marginTop: '16px' }}>
          <Button variant="outline" size="sm" onClick={onRetry} leftIcon={<RefreshCw size={14} />}>
            Retry
          </Button>
        </div>
      )}
    </div>
  );
}

// --- LOADING SKELETON ---
export interface SkeletonProps {
  width?: string;
  height?: string;
  borderRadius?: string;
  style?: React.CSSProperties;
}

export function Skeleton({ width = '100%', height = '20px', borderRadius = TOKENS.radius.sm, style }: SkeletonProps) {
  return (
    <div
      style={{
        width,
        height,
        borderRadius,
        backgroundColor: TOKENS.colors.surfaceMuted,
        animation: 'pulse 1.5s ease-in-out infinite',
        ...style,
      }}
    />
  );
}
