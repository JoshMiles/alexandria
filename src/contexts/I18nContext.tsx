import React, { createContext, useContext, useState, useEffect } from 'react';

// Import language files
import enTranslations from '../locales/en.json';
import esTranslations from '../locales/es.json';
import frTranslations from '../locales/fr.json';
import nlTranslations from '../locales/nl.json';
import plTranslations from '../locales/pl.json';
import deTranslations from '../locales/de.json';
import itTranslations from '../locales/it.json';
import ptTranslations from '../locales/pt.json';
import ruTranslations from '../locales/ru.json';
import zhTranslations from '../locales/zh.json';
import jaTranslations from '../locales/ja.json';
import koTranslations from '../locales/ko.json';
import arTranslations from '../locales/ar.json';

// Define available languages
export const availableLanguages = {
  en: { name: 'English', flag: '🇺🇸' },
  es: { name: 'Español', flag: '🇪🇸' },
  fr: { name: 'Français', flag: '🇫🇷' },
  nl: { name: 'Nederlands', flag: '🇳🇱' },
  pl: { name: 'Polski', flag: '🇵🇱' },
  de: { name: 'Deutsch', flag: '🇩🇪' },
  it: { name: 'Italiano', flag: '🇮🇹' },
  pt: { name: 'Português', flag: '🇵🇹' },
  ru: { name: 'Русский', flag: '🇷🇺' },
  zh: { name: '中文', flag: '🇨🇳' },
  ja: { name: '日本語', flag: '🇯🇵' },
  ko: { name: '한국어', flag: '🇰🇷' },
  ar: { name: 'العربية', flag: '🇸🇦' },
  // Add more languages as needed
};

// Type for translations
type Translations = typeof enTranslations;

// Type for the context
interface I18nContextType {
  language: string;
  setLanguage: (lang: string) => void;
  t: (key: string) => string;
  availableLanguages: typeof availableLanguages;
}

// Create context
const I18nContext = createContext<I18nContextType>({
  language: 'en',
  setLanguage: () => {},
  t: (key: string) => key,
  availableLanguages,
});

// Translation function to get nested object values
const getNestedValue = (obj: any, path: string): string => {
  return path.split('.').reduce((current, key) => {
    return current && current[key] !== undefined ? current[key] : path;
  }, obj);
};

// Hook to use i18n
export const useI18n = () => useContext(I18nContext);

// Provider component
export const I18nProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState(() => {
    return localStorage.getItem('language') || 'en';
  });

  // Get translations for current language
  const getTranslations = (): Translations => {
    switch (language) {
      case 'es':
        return esTranslations;
      case 'fr':
        return frTranslations;
      case 'nl':
        return nlTranslations;
      case 'pl':
        return plTranslations;
      case 'de':
        return deTranslations;
      case 'it':
        return itTranslations;
      case 'pt':
        return ptTranslations;
      case 'ru':
        return ruTranslations;
      case 'zh':
        return zhTranslations;
      case 'ja':
        return jaTranslations;
      case 'ko':
        return koTranslations;
      case 'ar':
        return arTranslations;
      case 'en':
      default:
        return enTranslations;
    }
  };

  const [translations, setTranslations] = useState<Translations>(getTranslations());

  // Update translations when language changes
  useEffect(() => {
    setTranslations(getTranslations());
    localStorage.setItem('language', language);
  }, [language]);

  // Translation function
  const t = (key: string): string => {
    const value = getNestedValue(translations, key);
    return typeof value === 'string' ? value : key;
  };

  // Set language function
  const setLanguage = (lang: string) => {
    if (availableLanguages[lang as keyof typeof availableLanguages]) {
      setLanguageState(lang);
    }
  };

  return (
    <I18nContext.Provider
      value={{
        language,
        setLanguage,
        t,
        availableLanguages,
      }}
    >
      {children}
    </I18nContext.Provider>
  );
}; 