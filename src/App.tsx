import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FiSearch, FiSettings } from 'react-icons/fi';
import { Book } from './types';
import { DownloadProvider, useDownloads } from './contexts/DownloadContext';
import { ThemeProvider, useTheme } from './contexts/ThemeContext';
import { I18nProvider, useI18n } from './contexts/I18nContext';
import { useSearch } from './hooks/useSearch';
import Sidebar from './components/Sidebar';
import ResultsGrid from './components/ResultsGrid';
import Notification from './components/Notification';
import Settings from './components/Settings';
import Header from './components/Header';
import TitleBar from './components/TitleBar';
import DoiResult from './components/DoiResult';
import './styles.css';
import { v4 as uuidv4 } from 'uuid';

const App: React.FC = () => (
  <I18nProvider>
    <DownloadProvider>
      <ThemeProvider>
        <div className="app-container">
          {window.electron.platform !== 'darwin' && <TitleBar />}
          <div className="content-wrapper">
            <AppContent />
          </div>
          <NotificationPortal />
        </div>
      </ThemeProvider>
    </DownloadProvider>
  </I18nProvider>
);

const NOTIFICATION_DISPLAY_TIME = 2500; // ms

const SettingsButtonOverlay: React.FC<{ width: number, onClick: () => void }> = ({ width, onClick }) => {
  const { t } = useI18n();
  return (
    <button
      className="settings-button settings-button-overlay"
      style={{
        position: 'fixed',
        left: 0,
        bottom: 0,
        width: width,
        zIndex: 1000,
        borderTopLeftRadius: 0,
        borderTopRightRadius: 0,
        borderBottomLeftRadius: '0.75rem',
        borderBottomRightRadius: '0.75rem',
      }}
      onClick={onClick}
    >
      <FiSettings />
      <span>{t('app.settings')}</span>
    </button>
  );
};

const AppContent = () => {
  const { libgenUrl } = useTheme();
  const { t, language: appLanguage } = useI18n();
  const { downloads, handleDownload, handleCancelDownload, handleOpenFile, handleOpenFolder, handleClearDownloads } = useDownloads();
  
  const [expandedCard, setExpandedCard] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [randomFact, setRandomFact] = useState('');
  const [randomFactAuthor, setRandomFactAuthor] = useState('');
  const [showOnlyIsbn, setShowOnlyIsbn] = useState(false);
  const [searchStatus, setSearchStatus] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [sidebarWidth, setSidebarWidth] = useState(350);
  const sidebarResizableRef = useRef<any>(null);

  // Add state for filters
  const [languageFilter, setLanguageFilter] = useState<string>('');
  const [fileTypeFilter, setFileTypeFilter] = useState<string>('');

  const handleToggleSettings = useCallback(() => {
    setShowSettings(prev => !prev);
  }, []);

  const handleLogoClick = useCallback(() => {
    setShowSettings(false);
  }, []);

  const handleSearchComplete = useCallback(() => {
    setIsSearching(false);
  }, []);

  // Use optimized search hook
  const {
    query,
    results,
    unfilteredResults,
    doiResult,
    isDoiSearch,
    loading,
    error,
    noResults,
    search,
    searchImmediate,
    clearResults,
    setQuery
  } = useSearch(handleSearchComplete);

  const handleBack = useCallback(() => {
    clearResults();
    setQuery('');
    setSearchStatus('');
    setIsSearching(false);
  }, [clearResults, setQuery]);

  const handleSearch = useCallback(async () => {
    if (!query.trim()) return;
    
    // Clear any previous results and status
    clearResults();
    setSearchStatus('');
    
    setIsSearching(true);
    setSearchStatus(t('app.searching'));
    
    try {
      await searchImmediate(query);
    } catch (error) {
      console.error('Search error:', error);
      setIsSearching(false);
      setSearchStatus('');
    }
  }, [query, searchImmediate, clearResults]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  }, [handleSearch]);

  const handleQueryChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setQuery(e.target.value);
  }, [setQuery]);

  // Compute available languages and file types from results
  const availableLanguages = useMemo(() => {
    const langs = new Set<string>();
    unfilteredResults.forEach(book => {
      if (book.language) langs.add(book.language);
    });
    return Array.from(langs).sort();
  }, [unfilteredResults]);

  const availableFileTypes = useMemo(() => {
    const types = new Set<string>();
    unfilteredResults.forEach(book => {
      if (book.extension) types.add(book.extension);
    });
    return Array.from(types).sort();
  }, [unfilteredResults]);

  // Filter and sort results based on showOnlyIsbn, filters, and app language
  const filteredResults = useMemo(() => {
    let results = showOnlyIsbn ? unfilteredResults.filter(book => book.isbn) : unfilteredResults;
    if (languageFilter) {
      results = results.filter(book => book.language === languageFilter);
    }
    if (fileTypeFilter) {
      results = results.filter(book => book.extension === fileTypeFilter);
    }
    // Sort by app language first
    if (appLanguage) {
      const langLower = appLanguage.toLowerCase();
      results = [
        ...results.filter(book => (book.language || '').toLowerCase() === langLower),
        ...results.filter(book => (book.language || '').toLowerCase() !== langLower)
      ];
    }
    return results;
  }, [showOnlyIsbn, unfilteredResults, languageFilter, fileTypeFilter, appLanguage]);

  // Add client IDs to results
  const resultsWithIds = useMemo(() => {
    console.log('Computing resultsWithIds:', filteredResults.length, 'results');
    return filteredResults.map((book) => ({ 
      ...book, 
      client_id: book.client_id || uuidv4() 
    }));
  }, [filteredResults]);

  useEffect(() => {
    console.log('Results state changed:', {
      loading,
      isSearching,
      resultsWithIds: resultsWithIds.length,
      doiResult: !!doiResult,
      error,
      noResults
    });
  }, [loading, isSearching, resultsWithIds.length, doiResult, error, noResults]);

  useEffect(() => {
    searchInputRef.current?.focus();
    
    const handleSearchStatus = (message: string) => {
      console.log('Received search status:', message);
      setSearchStatus(message);
      let type: 'success' | 'error' | 'info' = 'info';
      if (/successfully connected|found working mirror/i.test(message)) {
        type = 'success';
      } else if (/cannot reach|failed|all mirrors and proxy failed/i.test(message)) {
        type = 'error';
      } else if (/trying libgen mirror|trying free proxy/i.test(message)) {
        type = 'info';
      }
      // Suppress toasts for connection/connecting messages
      if (
        /connecting to libgen|successfully connected|testing main libgen domain|main libgen domain is working|testing mirror|parsing search results|fetching book metadata|enriching data with google books/i.test(message)
      ) {
        return;
      }
      if (type !== 'info' || /error|failed|successfully connected|found working mirror/i.test(message)) {
        window.dispatchEvent(new CustomEvent('show-notification', {
          detail: { id: `search-status-${Date.now()}`, message, type }
        }));
      }
    };

    window.electron.on('search-status', handleSearchStatus);

    // Fetch random fact
    const fetchRandomFact = async () => {
      try {
        const response = await fetch('https://api.quotable.kurokeita.dev/api/quotes/random');
        const data = await response.json();
        setRandomFact(data.quote.content);
        setRandomFactAuthor(data.quote.author.name);
      } catch (err) {
        console.error('Failed to fetch random fact:', err);
      }
    };

    fetchRandomFact();

    return () => {
      // Cleanup event listener
      window.electron.on('search-status', () => {});
    };
  }, []);

  useEffect(() => {
    const updateWidth = () => {
      const el = document.querySelector('.sidebar-resizable') as HTMLDivElement;
      if (el) {
        setSidebarWidth(el.offsetWidth);
        sidebarResizableRef.current = el;
      }
    };
    updateWidth();
    window.addEventListener('resize', updateWidth);
    return () => window.removeEventListener('resize', updateWidth);
  }, []);

  useEffect(() => {
    const el = document.querySelector('.sidebar-resizable') as HTMLDivElement;
    if (!el) return;
    const observer = new ResizeObserver(() => {
      setSidebarWidth(el.offsetWidth);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const showWelcomeMessage = !loading && !error && !noResults && resultsWithIds.length === 0 && !doiResult && !(languageFilter || fileTypeFilter);

  return (
    <>
      <div className="left-panel">
        <Sidebar
          downloads={downloads}
          onClear={handleClearDownloads}
          onCancel={handleCancelDownload}
          onOpenFile={handleOpenFile}
          onOpenFolder={handleOpenFolder}
          onSettingsClick={handleToggleSettings}
          onLogoClick={handleLogoClick}
        />
        <SettingsButtonOverlay width={sidebarWidth} onClick={handleToggleSettings} />
      </div>
      <div className="main-content">
        <div className="main-view">
          <AnimatePresence mode="wait">
            <motion.div
              key={showSettings ? 'settings' : 'main'}
              initial={{ opacity: 0, x: showSettings ? 20 : -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: showSettings ? -20 : 20 }}
              transition={{ duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] }}
            >
              {showSettings ? (
                <Settings onClose={handleToggleSettings} />
              ) : (
                <>
                  <div className="search-bar-container">
                <div className="search-bar">
                  <FiSearch className="search-icon" />
                  <input
                    ref={searchInputRef}
                    type="text"
                    value={query}
                    onChange={handleQueryChange}
                    onKeyDown={handleKeyDown}
                    placeholder="Search for books, author(s), and DOIs..."
                    className="search-input"
                  />
                </div>
              </div>
              
              {(loading || isSearching) && (
                <div className="loading-container">
                  <div className="spinner"></div>
                  <p className="status-text">{searchStatus || 'Searching...'}</p>
                </div>
              )}
              
              {error && <p className="error-message">{error}</p>}
              {noResults && <p className="no-results-message">No results found for "{query}"</p>}
              
              {showWelcomeMessage && (
                <div className="welcome-message">
                  <p><i>"{randomFact}"</i></p>
                  <p><i>- {randomFactAuthor}</i></p>
                </div>
              )}
              
              {(resultsWithIds.length > 0 || doiResult || languageFilter || fileTypeFilter) && (
                <div className="search-results-header">
                  <div className="search-results-header-left">
                    <h2>
                      {t('app.searchResults')}
                      {resultsWithIds.length > 0 && (
                        <span className="results-count"> ({resultsWithIds.length} {t('app.found')})</span>
                      )}
                    </h2>
                  </div>
                  {!isDoiSearch && (
                    <div className="search-results-header-right">
                      <div className="toggle-container">
                        <label className="toggle-switch">
                          <input
                            type="checkbox"
                            checked={showOnlyIsbn}
                            onChange={() => setShowOnlyIsbn(!showOnlyIsbn)}
                          />
                          <span className="slider"></span>
                        </label>
                        <span>Show Only ISBN Books</span>
                      </div>
                      {(availableLanguages.length > 0 || availableFileTypes.length > 0) && (
                        <div style={{ display: 'flex', gap: '1rem' }}>
                          <select
                            value={languageFilter}
                            onChange={e => setLanguageFilter(e.target.value)}
                            style={{ padding: '0.5rem', borderRadius: '6px', border: '1px solid var(--border)' }}
                          >
                            <option value="">All Languages</option>
                            {availableLanguages.map(lang => (
                              <option key={lang} value={lang}>{lang}</option>
                            ))}
                          </select>
                          <select
                            value={fileTypeFilter}
                            onChange={e => setFileTypeFilter(e.target.value)}
                            style={{ padding: '0.5rem', borderRadius: '6px', border: '1px solid var(--border)' }}
                          >
                            <option value="">All File Types</option>
                            {availableFileTypes.map(type => (
                              <option key={type} value={type}>{type}</option>
                            ))}
                          </select>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
              {/* Show no results with filter message if filters are active and no results */}
              {((languageFilter || fileTypeFilter) && resultsWithIds.length === 0 && !doiResult) && (
                <div className="no-results-message">{t('app.noResultsWithFilter')}</div>
              )}
              
              {doiResult && <DoiResult book={doiResult} onDownload={handleDownload} />}
              {resultsWithIds.length > 0 && (
                <ResultsGrid
                  results={resultsWithIds}
                  onDownload={handleDownload}
                  libgenUrl={libgenUrl}
                  downloads={downloads}
                  expandedCard={expandedCard}
                  setExpandedCard={setExpandedCard}
                />
              )}
                </>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </>
  );
};

// NotificationPortal renders the notification at the app root
const NotificationPortal = () => {
  const [notification, setNotification] = useState<{ id: string; message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [notificationQueue, setNotificationQueue] = useState<{ id: string; message: string; type: 'success' | 'error' | 'info' }[]>([]);
  const notificationTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Listen for custom events from AppContent
  useEffect(() => {
    const handleShowNotification = (event: CustomEvent) => {
      setNotificationQueue((q) => [...q, event.detail]);
    };
    window.addEventListener('show-notification', handleShowNotification as EventListener);
    return () => {
      window.removeEventListener('show-notification', handleShowNotification as EventListener);
    };
  }, []);

  useEffect(() => {
    if (!notification && notificationQueue.length > 0) {
      setNotification(notificationQueue[0]);
      notificationTimeoutRef.current = setTimeout(() => {
        setNotification(null);
        setNotificationQueue((q) => q.slice(1));
      }, NOTIFICATION_DISPLAY_TIME);
    }
    return () => {
      if (notificationTimeoutRef.current) clearTimeout(notificationTimeoutRef.current);
    };
  }, [notification, notificationQueue]);

  if (!notification) return null;
  return (
    <Notification
      message={notification.message}
      type={notification.type}
      onClose={() => setNotification(null)}
    />
  );
};

export default App;