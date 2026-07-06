import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import guIN from './locales/gu-IN.json';
import hiIN from './locales/hi-IN.json';
import enIN from './locales/en-IN.json';

export type Locale = 'gu-IN' | 'hi-IN' | 'en-IN';

export const SUPPORTED_LOCALES: Locale[] = ['gu-IN', 'hi-IN', 'en-IN'];
export const DEFAULT_LOCALE: Locale = 'gu-IN';

export const resources = {
  'gu-IN': { translation: guIN },
  'hi-IN': { translation: hiIN },
  'en-IN': { translation: enIN },
} as const;

i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: DEFAULT_LOCALE,
    fallbackLng: DEFAULT_LOCALE,
    interpolation: {
      // React already escapes by default
      escapeValue: false,
    },
    compatibilityJSON: 'v4',
  });

export default i18n;
