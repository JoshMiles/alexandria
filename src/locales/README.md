# Internationalization (i18n) System

This directory contains language files for the Alexandria application's internationalization system.

## Structure

Each language file follows the same JSON structure with nested keys for different sections of the application:

- `app`: General application strings (app name, settings, search, etc.)
- `settings`: Settings page strings
- `libgen`: LibGen access related strings
- `downloads`: Download manager strings
- `book`: Book-related strings
- `doi`: DOI-specific strings

## Adding a New Language

1. Create a new JSON file in this directory (e.g., `de.json` for German)
2. Copy the structure from `en.json` and translate all values
3. Update `src/contexts/I18nContext.tsx`:
   - Import the new translation file
   - Add the language to the `availableLanguages` object
   - Add a case in the `getTranslations()` function

## Example

```typescript
// In I18nContext.tsx
import deTranslations from '../locales/de.json';

export const availableLanguages = {
  en: { name: 'English', flag: '🇺🇸' },
  es: { name: 'Español', flag: '🇪🇸' },
  fr: { name: 'Français', flag: '🇫🇷' },
  de: { name: 'Deutsch', flag: '🇩🇪' }, // Add new language
};

const getTranslations = (): Translations => {
  switch (language) {
    case 'es':
      return esTranslations;
    case 'fr':
      return frTranslations;
    case 'de':
      return deTranslations; // Add new case
    case 'en':
    default:
      return enTranslations;
  }
};
```

## Usage in Components

```typescript
import { useI18n } from '../contexts/I18nContext';

const MyComponent = () => {
  const { t, language, setLanguage } = useI18n();
  
  return (
    <div>
      <h1>{t('app.name')}</h1>
      <p>{t('settings.title')}</p>
    </div>
  );
};
```

## Available Languages

- **English (en)**: Default language
- **Spanish (es)**: Español
- **French (fr)**: Français
- **Dutch (nl)**: Nederlands
- **Polish (pl)**: Polski
- **German (de)**: Deutsch
- **Italian (it)**: Italiano
- **Portuguese (pt)**: Português
- **Russian (ru)**: Русский
- **Chinese (zh)**: 中文
- **Japanese (ja)**: 日本語
- **Korean (ko)**: 한국어
- **Arabic (ar)**: العربية

## Language Selection

Users can change the application language in the Settings page under the "Language" section. The selected language is persisted in localStorage and will be remembered across application restarts. 