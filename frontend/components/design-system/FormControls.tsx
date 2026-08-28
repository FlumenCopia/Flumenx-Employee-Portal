'use client';

import React, { forwardRef, InputHTMLAttributes, SelectHTMLAttributes, TextareaHTMLAttributes, ReactNode } from 'react';
import { TOKENS } from './tokens';

// --- FORM FIELD WRAPPER ---
export interface FormFieldProps {
  label?: string;
  helperText?: string;
  error?: string;
  required?: boolean;
  children: ReactNode;
  style?: React.CSSProperties;
  className?: string;
}

export function FormField({ label, helperText, error, required, children, style, className = '' }: FormFieldProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '16px', ...style }} className={className}>
      {label && (
        <label style={{ fontSize: '12px', fontWeight: 600, color: TOKENS.colors.textPrimary, display: 'flex', alignItems: 'center', gap: '4px' }}>
          {label}
          {required && <span style={{ color: TOKENS.colors.danger }}>*</span>}
        </label>
      )}
      {children}
      {error ? (
        <span style={{ fontSize: '11px', color: TOKENS.colors.danger, fontWeight: 500 }}>{error}</span>
      ) : helperText ? (
        <span style={{ fontSize: '11px', color: TOKENS.colors.textMuted }}>{helperText}</span>
      ) : null}
    </div>
  );
}

// --- INPUT ---
export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
  error?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ leftIcon, rightIcon, error, style, disabled, className = '', ...props }, ref) => {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          backgroundColor: disabled ? TOKENS.colors.surfaceMuted : TOKENS.colors.surfacePanel,
          border: `1px solid ${error ? TOKENS.colors.danger : TOKENS.colors.borderMedium}`,
          borderRadius: TOKENS.radius.md,
          padding: '0 12px',
          height: '38px',
          transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
          boxShadow: TOKENS.shadows.sm,
          ...style,
        }}
        className={`ds-input-wrapper ${className}`}
      >
        {leftIcon && <span style={{ display: 'inline-flex', marginRight: '8px', color: TOKENS.colors.textMuted }}>{leftIcon}</span>}
        <input
          ref={ref}
          disabled={disabled}
          style={{
            border: 'none',
            outline: 'none',
            background: 'transparent',
            width: '100%',
            fontSize: '13px',
            color: TOKENS.colors.textPrimary,
            fontFamily: TOKENS.fonts.body,
          }}
          {...props}
        />
        {rightIcon && <span style={{ display: 'inline-flex', marginLeft: '8px', color: TOKENS.colors.textMuted }}>{rightIcon}</span>}
      </div>
    );
  }
);

Input.displayName = 'Input';

// --- SELECT ---
export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  error?: boolean;
  options?: Array<{ label: string; value: string | number; disabled?: boolean }>;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ error, options, children, disabled, style, className = '', ...props }, ref) => {
    return (
      <select
        ref={ref}
        disabled={disabled}
        style={{
          width: '100%',
          height: '38px',
          padding: '0 12px',
          fontSize: '13px',
          fontFamily: TOKENS.fonts.body,
          color: TOKENS.colors.textPrimary,
          backgroundColor: disabled ? TOKENS.colors.surfaceMuted : TOKENS.colors.surfacePanel,
          border: `1px solid ${error ? TOKENS.colors.danger : TOKENS.colors.borderMedium}`,
          borderRadius: TOKENS.radius.md,
          outline: 'none',
          cursor: disabled ? 'not-allowed' : 'pointer',
          boxShadow: TOKENS.shadows.sm,
          ...style,
        }}
        className={`ds-select ${className}`}
        {...props}
      >
        {options
          ? options.map((opt) => (
              <option key={opt.value} value={opt.value} disabled={opt.disabled}>
                {opt.label}
              </option>
            ))
          : children}
      </select>
    );
  }
);

Select.displayName = 'Select';

// --- TEXTAREA ---
export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: boolean;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ error, disabled, style, className = '', ...props }, ref) => {
    return (
      <textarea
        ref={ref}
        disabled={disabled}
        style={{
          width: '100%',
          padding: '10px 12px',
          fontSize: '13px',
          fontFamily: TOKENS.fonts.body,
          color: TOKENS.colors.textPrimary,
          backgroundColor: disabled ? TOKENS.colors.surfaceMuted : TOKENS.colors.surfacePanel,
          border: `1px solid ${error ? TOKENS.colors.danger : TOKENS.colors.borderMedium}`,
          borderRadius: TOKENS.radius.md,
          outline: 'none',
          minHeight: '80px',
          resize: 'vertical',
          boxShadow: TOKENS.shadows.sm,
          ...style,
        }}
        className={`ds-textarea ${className}`}
        {...props}
      />
    );
  }
);

Textarea.displayName = 'Textarea';

// --- SWITCH / TOGGLE ---
export interface SwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  disabled?: boolean;
  style?: React.CSSProperties;
}

export function Switch({ checked, onChange, label, disabled = false, style }: SwitchProps) {
  return (
    <label
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '10px',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.6 : 1,
        userSelect: 'none',
        ...style,
      }}
    >
      <div
        onClick={() => !disabled && onChange(!checked)}
        style={{
          width: '38px',
          height: '22px',
          backgroundColor: checked ? TOKENS.colors.brandPrimary : TOKENS.colors.borderMedium,
          borderRadius: TOKENS.radius.full,
          position: 'relative',
          transition: 'background-color 0.2s ease',
        }}
      >
        <div
          style={{
            width: '16px',
            height: '16px',
            backgroundColor: '#FFFFFF',
            borderRadius: TOKENS.radius.full,
            position: 'absolute',
            top: '3px',
            left: checked ? '19px' : '3px',
            transition: 'left 0.2s ease',
            boxShadow: TOKENS.shadows.sm,
          }}
        />
      </div>
      {label && <span style={{ fontSize: '13px', fontWeight: 500, color: TOKENS.colors.textPrimary }}>{label}</span>}
    </label>
  );
}

// --- CHECKBOX ---
export interface CheckboxProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: ReactNode;
  disabled?: boolean;
  style?: React.CSSProperties;
}

export function Checkbox({ checked, onChange, label, disabled = false, style }: CheckboxProps) {
  return (
    <label
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '8px',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.6 : 1,
        userSelect: 'none',
        fontSize: '13px',
        color: TOKENS.colors.textPrimary,
        ...style,
      }}
    >
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        style={{
          width: '16px',
          height: '16px',
          accentColor: TOKENS.colors.brandPrimary,
          cursor: disabled ? 'not-allowed' : 'pointer',
        }}
      />
      {label && <span>{label}</span>}
    </label>
  );
}
