'use client';

import React, { ReactNode } from 'react';
import { TOKENS } from './tokens';

export interface Column<T> {
  key: string;
  header: string;
  render?: (item: T, index: number) => ReactNode;
  width?: string;
  align?: 'left' | 'center' | 'right';
}

export interface TableProps<T> {
  columns: Column<T>[];
  data: T[];
  keyExtractor: (item: T, index: number) => string | number;
  isLoading?: boolean;
  emptyState?: ReactNode;
  onRowClick?: (item: T) => void;
  style?: React.CSSProperties;
  className?: string;
}

export function Table<T>({
  columns,
  data,
  keyExtractor,
  isLoading = false,
  emptyState,
  onRowClick,
  style,
  className = '',
}: TableProps<T>) {
  return (
    <div
      style={{
        width: '100%',
        overflowX: 'auto',
        border: `1px solid ${TOKENS.colors.borderLight}`,
        borderRadius: TOKENS.radius.lg,
        backgroundColor: TOKENS.colors.surfacePanel,
        boxShadow: TOKENS.shadows.sm,
        ...style,
      }}
      className={`ds-table-wrapper ${className}`}
    >
      <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
        <thead>
          <tr
            style={{
              backgroundColor: TOKENS.colors.surfaceSubtle,
              borderBottom: `1px solid ${TOKENS.colors.borderLight}`,
            }}
          >
            {columns.map((col) => (
              <th
                key={col.key}
                style={{
                  padding: '12px 16px',
                  fontSize: '11px',
                  fontWeight: 700,
                  color: TOKENS.colors.textSecondary,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  width: col.width,
                  textAlign: col.align || 'left',
                  whiteSpace: 'nowrap',
                }}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {isLoading ? (
            <tr>
              <td colSpan={columns.length} style={{ padding: '32px 16px', textAlign: 'center', color: TOKENS.colors.textMuted }}>
                Loading records...
              </td>
            </tr>
          ) : data.length === 0 ? (
            <tr>
              <td colSpan={columns.length} style={{ padding: '32px 16px', textAlign: 'center' }}>
                {emptyState || <span style={{ color: TOKENS.colors.textMuted }}>No records found.</span>}
              </td>
            </tr>
          ) : (
            data.map((item, rowIdx) => (
              <tr
                key={keyExtractor(item, rowIdx)}
                onClick={() => onRowClick && onRowClick(item)}
                style={{
                  borderBottom: `1px solid ${TOKENS.colors.borderLight}`,
                  cursor: onRowClick ? 'pointer' : 'default',
                  transition: 'background-color 0.12s ease',
                  backgroundColor: rowIdx % 2 === 0 ? TOKENS.colors.surfacePanel : TOKENS.colors.surfaceSubtle,
                }}
                className="ds-table-row"
              >
                {columns.map((col) => (
                  <td
                    key={col.key}
                    style={{
                      padding: '12px 16px',
                      color: TOKENS.colors.textPrimary,
                      textAlign: col.align || 'left',
                      verticalAlign: 'middle',
                    }}
                  >
                    {col.render ? col.render(item, rowIdx) : (item as any)[col.key]}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
