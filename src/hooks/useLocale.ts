import { useContext } from 'react';
import { LanguageContext, LanguageContextValue } from '../components/LanguageProvider';

/**
 * Returns the current locale and the changeLocale function exposed by LanguageProvider.
 * Must be used inside a LanguageProvider tree.
 */
export function useLocale(): LanguageContextValue {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLocale must be used within a LanguageProvider');
  }
  return context;
}
