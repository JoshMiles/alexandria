export const API_URLS = {
  LIBGEN: 'https://libgen.li',
  GOOGLE_BOOKS: 'https://www.googleapis.com/books/v1/volumes',
  CROSSREF: 'https://api.crossref.org/works',
  SCIHUB: 'https://sci-hub.box',
  ANNAS_ARCHIVE: 'https://annas-archive.org',
  QUOTES: 'https://api.quotable.kurokeita.dev/api/quotes/random'
} as const;

export const WINDOW_CONFIG = {
  STARTUP: {
    width: 400,
    height: 200,
    frame: false
  },
  MAIN: {
    width: 1400,
    height: 900,
    frame: false,
    titleBarStyle: 'hidden' as const,
    trafficLightPosition: { x: 15, y: 15 }
  }
} as const;

export const DOWNLOAD_STATES = {
  RESOLVING: 'resolving',
  DOWNLOADING: 'downloading',
  COMPLETED: 'completed',
  FAILED: 'failed',
  CANCELLED: 'cancelled',
  BROWSER_DOWNLOAD: 'browser-download'
} as const;

export const SEARCH_CONFIG = {
  RESULTS_LIMIT: 100,
  DOI_REGEX: /10\.\d{4,9}\/[-._;()/:A-Z0-9]+$/i
} as const;

export const FILE_EXTENSIONS = {
  PDF: 'pdf',
  EPUB: 'epub',
  MOBI: 'mobi',
  DJVU: 'djvu'
} as const;

export const LANGUAGES = {
  ENGLISH: 'english',
  FRENCH: 'french',
  GERMAN: 'german',
  SPANISH: 'spanish',
  RUSSIAN: 'russian'
} as const;

export const NOTIFICATION_TYPES = {
  SUCCESS: 'success',
  ERROR: 'error',
  INFO: 'info'
} as const;