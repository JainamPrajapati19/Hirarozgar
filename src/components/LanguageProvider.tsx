import React, {
  createContext,
  useCallback,
  useEffect,
  useState,
  PropsWithChildren,
} from 'react';
import * as SecureStore from 'expo-secure-store';
import { I18nextProvider } from 'react-i18next';

import i18n, { DEFAULT_LOCALE, Locale, SUPPORTED_LOCALES } from '../i18n';

// ─── Storage key ────────────────────────────────────────────────────────────
const LOCALE_STORAGE_KEY = 'hirarozgar_locale';

// ─── Context type ────────────────────────────────────────────────────────────
export interface LanguageContextValue {
  /** Currently active locale, e.g. 'gu-IN' */
  locale: Locale;
  /**
   * Switch the app language.
   * Applies translations immediately (within 2 s per Req 1.5) and
   * persists the choice to expo-secure-store (Req 1.6).
   */
  changeLocale: (locale: Locale) => Promise<void>;
}

export const LanguageContext = createContext<LanguageContextValue | null>(null);

// ─── Provider ────────────────────────────────────────────────────────────────

/**
 * LanguageProvider
 *
 * - Reads persisted locale from expo-secure-store on mount.
 * - Falls back to 'gu-IN' (Gujarati) when no preference is stored (Req 1.1).
 * - Exposes `changeLocale(locale)` via LanguageContext:
 *     1. Calls i18n.changeLanguage() — synchronous in-memory switch (<< 2 s).
 *     2. Persists selection to secure store asynchronously.
 * - Wraps children with I18nextProvider so every component gets access to `t()`.
 */
export function LanguageProvider({ children }: PropsWithChildren) {
  const [locale, setLocale] = useState<Locale>(DEFAULT_LOCALE);
  const [ready, setReady] = useState(false);

  // ── Load persisted locale on first mount ──────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const stored = await SecureStore.getItemAsync(LOCALE_STORAGE_KEY);
        const resolved =
          stored && (SUPPORTED_LOCALES as string[]).includes(stored)
            ? (stored as Locale)
            : DEFAULT_LOCALE;

        // Apply the locale to i18next before rendering children
        await i18n.changeLanguage(resolved);
        setLocale(resolved);
      } catch {
        // If SecureStore is unavailable, fall back to default (Req 1.1)
        await i18n.changeLanguage(DEFAULT_LOCALE);
        setLocale(DEFAULT_LOCALE);
      } finally {
        setReady(true);
      }
    })();
  }, []);

  // ── changeLocale: apply + persist ─────────────────────────────────────────
  const changeLocale = useCallback(async (newLocale: Locale): Promise<void> => {
    // Validate the requested locale
    if (!(SUPPORTED_LOCALES as string[]).includes(newLocale)) {
      return;
    }

    // Apply translation immediately (satisfies "within 2 s" — Req 1.5)
    await i18n.changeLanguage(newLocale);
    setLocale(newLocale);

    // Persist asynchronously (Req 1.6)
    try {
      await SecureStore.setItemAsync(LOCALE_STORAGE_KEY, newLocale);
    } catch {
      // Persistence failure is non-fatal; language is still applied in memory
    }
  }, []);

  // ── Don't render children until the persisted locale has been applied ─────
  if (!ready) {
    return null;
  }

  return (
    <LanguageContext.Provider value={{ locale, changeLocale }}>
      <I18nextProvider i18n={i18n}>{children}</I18nextProvider>
    </LanguageContext.Provider>
  );
}
