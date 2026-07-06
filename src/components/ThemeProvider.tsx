import React, {
  createContext,
  useCallback,
  useEffect,
  useState,
  PropsWithChildren,
} from 'react';
import * as SecureStore from 'expo-secure-store';

import { Theme, ThemeTokens, themeTokens } from '../theme/tokens';

// ─── Storage key ────────────────────────────────────────────────────────────
const THEME_STORAGE_KEY = 'hirarozgar_theme';

// ─── Default theme ──────────────────────────────────────────────────────────
const DEFAULT_THEME: Theme = 'light'; // Req 9.3

// ─── Context type ────────────────────────────────────────────────────────────
export interface ThemeContextValue {
  /** Currently active theme: 'light' | 'dark' */
  theme: Theme;
  /** Active design token set derived from the current theme */
  tokens: ThemeTokens;
  /**
   * Switch the app theme.
   * Applies CSS-in-JS tokens immediately (within 300 ms per Req 9.1) and
   * persists the choice to expo-secure-store (Req 9.2).
   */
  setTheme: (theme: Theme) => Promise<void>;
}

export const ThemeContext = createContext<ThemeContextValue | null>(null);

// ─── Provider ────────────────────────────────────────────────────────────────

/**
 * ThemeProvider
 *
 * - Reads persisted theme from expo-secure-store on mount.
 * - Falls back to 'light' when no preference is stored or when the stored value
 *   is unreadable (Req 9.3, 9.4).
 * - Exposes `setTheme(theme)` via ThemeContext:
 *     1. Updates React state immediately (< 16 ms, well within 300 ms budget).
 *     2. Persists selection to secure store asynchronously.
 * - Unlike LanguageProvider, this provider does NOT delay rendering. It starts
 *   with 'light' and updates once SecureStore resolves, avoiding a white-flash.
 */
export function ThemeProvider({ children }: PropsWithChildren) {
  const [theme, setThemeState] = useState<Theme>(DEFAULT_THEME);

  // ── Load persisted theme on first mount ──────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const stored = await SecureStore.getItemAsync(THEME_STORAGE_KEY);
        // Validate stored value is a valid Theme; otherwise fall back (Req 9.4)
        if (stored === 'light' || stored === 'dark') {
          setThemeState(stored);
        }
        // If stored is null, invalid, or unreadable → stay on default 'light'
      } catch {
        // SecureStore unavailable or read failure → fall back to 'light' (Req 9.4)
        // No action needed; theme is already DEFAULT_THEME
      }
    })();
  }, []);

  // ── setTheme: apply + persist ─────────────────────────────────────────────
  const setTheme = useCallback(async (newTheme: Theme): Promise<void> => {
    // Apply immediately (satisfies "within 300 ms" — Req 9.1)
    // React setState is synchronous; tokens update on next render (<< 300 ms)
    setThemeState(newTheme);

    // Persist asynchronously (Req 9.2)
    try {
      await SecureStore.setItemAsync(THEME_STORAGE_KEY, newTheme);
    } catch {
      // Persistence failure is non-fatal; theme is still applied in memory
    }
  }, []);

  // ── Context value ─────────────────────────────────────────────────────────
  const value: ThemeContextValue = {
    theme,
    tokens: themeTokens[theme],
    setTheme,
  };

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}
