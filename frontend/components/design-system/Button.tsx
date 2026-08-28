'use client';

import React, { forwardRef, ButtonHTMLAttributes, ReactNode } from 'react';
import { Loader2 } from 'lucide-react';
import { TOKENS } from './tokens';

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'success';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
  fullWidth?: boolean;
  children?: ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'primary',
      size = 'md',
      isLoading = false,
      leftIcon,
      rightIcon,
      fullWidth = false,
      disabled,
      children,
      style,
      className = '',
      ...props
    },
    ref
  ) => {
    const getVariantStyles = (): React.CSSProperties => {
      switch (variant) {
        case 'primary':
          return {
            backgroundColor: TOKENS.colors.brandPrimary,
            color: '#FFFFFF',
            border: `1px solid ${TOKENS.colors.brandPrimary}`,
            boxShadow: TOKENS.shadows.sm,
          };
        case 'secondary':
          return {
            backgroundColor: TOKENS.colors.surfacePanel,
            color: TOKENS.colors.textPrimary,
            border: `1px solid ${TOKENS.colors.borderMedium}`,
            boxShadow: TOKENS.shadows.sm,
          };
        case 'outline':
          return {
            backgroundColor: 'transparent',
            color: TOKENS.colors.brandPrimary,
            border: `1px solid ${TOKENS.colors.brandPrimary}`,
          };
        case 'ghost':
          return {
            backgroundColor: 'transparent',
            color: TOKENS.colors.textSecondary,
            border: '1px solid transparent',
          };
        case 'danger':
          return {
            backgroundColor: TOKENS.colors.danger,
            color: '#FFFFFF',
            border: `1px solid ${TOKENS.colors.danger}`,
            boxShadow: TOKENS.shadows.sm,
          };
        case 'success':
          return {
            backgroundColor: TOKENS.colors.success,
            color: '#FFFFFF',
            border: `1px solid ${TOKENS.colors.success}`,
            boxShadow: TOKENS.shadows.sm,
          };
      }
    };

    const getSizeStyles = (): React.CSSProperties => {
      switch (size) {
        case 'sm':
          return {
            height: '32px',
            padding: '0 12px',
            fontSize: '12px',
            borderRadius: TOKENS.radius.sm,
            gap: '6px',
          };
        case 'md':
          return {
            height: '38px',
            padding: '0 16px',
            fontSize: '13px',
            borderRadius: TOKENS.radius.md,
            gap: '8px',
          };
        case 'lg':
          return {
            height: '46px',
            padding: '0 24px',
            fontSize: '14px',
            borderRadius: TOKENS.radius.md,
            gap: '10px',
          };
      }
    };

    const baseStyles: React.CSSProperties = {
      display: fullWidth ? 'flex' : 'inline-flex',
      width: fullWidth ? '100%' : 'auto',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: TOKENS.fonts.body,
      fontWeight: 600,
      lineHeight: 1,
      cursor: disabled || isLoading ? 'not-allowed' : 'pointer',
      opacity: disabled || isLoading ? 0.6 : 1,
      transition: 'all 0.15s ease-in-out',
      outline: 'none',
      userSelect: 'none',
      whiteSpace: 'nowrap',
      textDecoration: 'none',
      ...getSizeStyles(),
      ...getVariantStyles(),
      ...style,
    };

    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        style={baseStyles}
        className={`ds-button ds-button-${variant} ds-button-${size} ${className}`}
        {...props}
      >
        {isLoading ? (
          <Loader2 style={{ width: '16px', height: '16px', animation: 'spin 1s linear infinite' }} />
        ) : (
          leftIcon && <span style={{ display: 'inline-flex', alignItems: 'center' }}>{leftIcon}</span>
        )}
        {children && <span>{children}</span>}
        {!isLoading && rightIcon && (
          <span style={{ display: 'inline-flex', alignItems: 'center' }}>{rightIcon}</span>
        )}
      </button>
    );
  }
);

Button.displayName = 'Button';
