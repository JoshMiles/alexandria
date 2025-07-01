# Changelog

## [Unreleased] - 2024-07-01

### 🌍 Added - Internationalization (i18n) System

#### Core Features
- **Complete i18n System**: Implemented comprehensive internationalization support with React Context
- **Language Context**: Created `I18nContext.tsx` with language state management and translation functions
- **Persistent Language Selection**: Language choice is saved in localStorage and persists across app restarts
- **Dynamic Language Switching**: Real-time language changes without app restart

#### Language Support
Added support for **13 languages** with complete translations:

- 🇺🇸 **English (en)** - Default language
- 🇪🇸 **Spanish (es)** - Español
- 🇫🇷 **French (fr)** - Français
- 🇳🇱 **Dutch (nl)** - Nederlands
- 🇵🇱 **Polish (pl)** - Polski
- 🇩🇪 **German (de)** - Deutsch
- 🇮🇹 **Italian (it)** - Italiano
- 🇵🇹 **Portuguese (pt)** - Português
- 🇷🇺 **Russian (ru)** - Русский
- 🇨🇳 **Chinese (zh)** - 中文
- 🇯🇵 **Japanese (ja)** - 日本語
- 🇰🇷 **Korean (ko)** - 한국어
- 🇸🇦 **Arabic (ar)** - العربية

#### Translation Files
- Created comprehensive JSON translation files for all 13 languages
- Structured translations with nested keys for different app sections:
  - `app`: General application strings
  - `settings`: Settings page strings
  - `libgen`: LibGen access related strings
  - `downloads`: Download manager strings
  - `book`: Book-related strings
  - `doi`: DOI-specific strings

#### UI Components Updated
- **Settings Page**: Added language selector with flag icons and native language names
- **App Interface**: All main interface strings now use translations
- **Sidebar**: Download manager strings translated
- **Header**: App name translated
- **BookCard**: Download states and metadata labels translated
- **DoiResult**: DOI-specific strings translated
- **Startup Screen**: Loading screen translated

#### Technical Implementation
- **TypeScript Configuration**: Added `resolveJsonModule: true` to support JSON imports
- **Context Integration**: Wrapped app with `I18nProvider` in main App component
- **Translation Function**: Implemented `t()` function with nested key support
- **Language Detection**: Automatic fallback to English for missing translations

#### Styling
- **Language Selector**: Beautiful radio button interface matching existing theme selector
- **Flag Icons**: Each language displays with its corresponding country flag
- **Responsive Design**: Language selector adapts to different screen sizes
- **Consistent UI**: Maintains existing design patterns and color schemes

#### Documentation
- **README**: Comprehensive documentation for the i18n system
- **Adding Languages**: Clear instructions for adding new languages
- **Usage Examples**: Code examples for implementing translations in components

### 🔧 Technical Improvements
- **Type Safety**: Full TypeScript support for all translation files
- **Performance**: Optimized translation loading with memoization
- **Maintainability**: Centralized translation management
- **Extensibility**: Easy to add new languages and translation keys

### 🎯 User Experience
- **Seamless Integration**: Language changes apply immediately
- **Intuitive Interface**: Clear language selection with visual indicators
- **Accessibility**: Proper labels and keyboard navigation
- **Global Reach**: Support for users from 13 different language regions

### 📁 Files Added
```
src/
├── contexts/
│   └── I18nContext.tsx
├── locales/
│   ├── en.json
│   ├── es.json
│   ├── fr.json
│   ├── nl.json
│   ├── pl.json
│   ├── de.json
│   ├── it.json
│   ├── pt.json
│   ├── ru.json
│   ├── zh.json
│   ├── ja.json
│   ├── ko.json
│   ├── ar.json
│   └── README.md
└── components/
    └── Settings.css (updated)
```

### 📝 Files Modified
- `src/App.tsx` - Added I18nProvider wrapper
- `src/components/Settings.tsx` - Added language selector and translations
- `src/components/Sidebar.tsx` - Added download manager translations
- `src/components/Header.tsx` - Added app name translation
- `src/components/BookCard.tsx` - Added book-related translations
- `src/components/DoiResult.tsx` - Added DOI translations
- `src/startup.tsx` - Added startup screen translations
- `src/index.tsx` - Fixed TypeScript null check
- `src/components/Header.test.tsx` - Updated test for i18n support
- `tsconfig.json` - Added resolveJsonModule support

### 🚀 Breaking Changes
None - This is a purely additive feature that maintains backward compatibility.

### 🔮 Future Enhancements
- Support for right-to-left (RTL) languages (Arabic)
- Automatic language detection based on system locale
- Translation memory for improved performance
- Community translation contributions
- Language-specific formatting (dates, numbers, currencies) 