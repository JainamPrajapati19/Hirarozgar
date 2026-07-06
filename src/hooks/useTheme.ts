import { useContext } from 'react';
import { ThemeContext, ThemeContextValue } from '../components/ThemeProvider';

/**
 * Returns the current theme, active design tokens, and the setTheme function
 * exposed by ThemeProvider.
 * Must be used inside a ThemeProvider tree.
 */
export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
