/**
 * Design token definitions for Light and Dark themes.
 *
 * These tokens drive all CSS-in-JS styling across the app. Screens consume
 * them via the ThemeContext (useTheme hook) rather than hard-coding colours.
 */

// ─── Theme name type ─────────────────────────────────────────────────────────
export type Theme = 'light' | 'dark';

// ─── Token shape ─────────────────────────────────────────────────────────────
export interface ThemeTokens {
  // Background colors
  background: string;
  backgroundSecondary: string;
  surface: string;

  // Text colors
  textPrimary: string;
  textSecondary: string;
  textDisabled: string;

  // Brand / Action colors
  primary: string;
  primaryDisabled: string;

  // Status / Badge colors
  badgeChhutak: string; // Green for Chhutak jobs (Req 6.1)
  badgeFixed: string;   // Blue for Fixed jobs  (Req 6.1)

  // Border / Divider
  border: string;

  // Error / Warning / Success
  error: string;
  warning: string;
  success: string;

  // Card / Modal
  card: string;
  overlay: string;
}

// ─── Light tokens ────────────────────────────────────────────────────────────
export const lightTokens: ThemeTokens = {
  background:          '#FFFFFF',
  backgroundSecondary: '#F5F5F5',
  surface:             '#FAFAFA',
  textPrimary:         '#1A1A1A',
  textSecondary:       '#595959',
  textDisabled:        '#BDBDBD',
  primary:             '#1565C0',
  primaryDisabled:     '#90CAF9',
  badgeChhutak:        '#2E7D32', // green
  badgeFixed:          '#1565C0', // blue
  border:              '#E0E0E0',
  error:               '#C62828',
  warning:             '#E65100',
  success:             '#2E7D32',
  card:                '#FFFFFF',
  overlay:             'rgba(0,0,0,0.5)',
};

// ─── Dark tokens ─────────────────────────────────────────────────────────────
export const darkTokens: ThemeTokens = {
  background:          '#121212',
  backgroundSecondary: '#1E1E1E',
  surface:             '#242424',
  textPrimary:         '#FFFFFF',
  textSecondary:       '#BDBDBD',
  textDisabled:        '#616161',
  primary:             '#90CAF9',
  primaryDisabled:     '#455A64',
  badgeChhutak:        '#66BB6A', // green
  badgeFixed:          '#64B5F6', // blue
  border:              '#333333',
  error:               '#EF9A9A',
  warning:             '#FFCC80',
  success:             '#A5D6A7',
  card:                '#1E1E1E',
  overlay:             'rgba(0,0,0,0.7)',
};

// ─── Lookup map ──────────────────────────────────────────────────────────────
export const themeTokens: Record<Theme, ThemeTokens> = {
  light: lightTokens,
  dark:  darkTokens,
};
