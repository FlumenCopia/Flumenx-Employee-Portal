/**
 * FLUMENX ENTERPRISE DESIGN TOKENS
 * Canonical tokens for colors, typography, spacing, radius, elevations, and geometry.
 */

export const TOKENS = {
  colors: {
    // Primary Brand
    brandPrimary: '#087A5B',
    brandHover: '#066348',
    brandActive: '#044B37',
    brandSubtle: '#E7F3EE',
    brandBorder: '#B2D8CB',

    // Neutrals / Surfaces
    bgApp: '#F3F5F4',
    surfacePanel: '#FFFFFF',
    surfaceSubtle: '#F8FAF9',
    surfaceMuted: '#F1F5F3',
    borderLight: '#DCE3E0',
    borderMedium: '#CBD5E1',
    borderStrong: '#94A3B8',

    // Typography
    textPrimary: '#18231F',
    textSecondary: '#4A5568',
    textMuted: '#718096',
    textInverse: '#FFFFFF',

    // Semantics
    success: '#16855B',
    successBg: '#E7F5EE',
    successBorder: '#A3D9C0',
    
    warning: '#D97706',
    warningBg: '#FEF3C7',
    warningBorder: '#FCD34D',
    
    danger: '#DC2626',
    dangerBg: '#FEE2E2',
    dangerBorder: '#FCA5A5',
    
    info: '#2563EB',
    infoBg: '#EFF6FF',
    infoBorder: '#BFDBFE',

    // Sidebar
    sidebarBg: '#13231F',
    sidebarHover: '#1F3830',
    sidebarActive: '#23463C',
    sidebarText: '#FFFFFF',
    sidebarMuted: '#A2B3AC',
  },

  radius: {
    xs: '4px',
    sm: '6px',
    md: '8px',
    lg: '12px',
    xl: '16px',
    full: '9999px',
  },

  shadows: {
    flat: 'none',
    sm: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
    md: '0 4px 6px -1px rgba(0, 0, 0, 0.07), 0 2px 4px -1px rgba(0, 0, 0, 0.04)',
    lg: '0 10px 15px -3px rgba(0, 0, 0, 0.08), 0 4px 6px -2px rgba(0, 0, 0, 0.03)',
    modal: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
  },

  spacing: {
    1: '4px',
    2: '8px',
    3: '12px',
    4: '16px',
    5: '20px',
    6: '24px',
    8: '32px',
    10: '40px',
    12: '48px',
  },

  fonts: {
    body: `'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif`,
    mono: `'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace`,
  },
};
