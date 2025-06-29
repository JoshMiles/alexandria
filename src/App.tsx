import React, { useState, useEffect, useRef } from 'react';
import { FiSearch, FiSettings } from 'react-icons/fi';
import { Book } from './types';
import { DownloadProvider, useDownloads } from './contexts/DownloadContext';
import { ThemeProvider, useTheme } from './contexts/ThemeContext';
import Sidebar from './components/Sidebar';
import ResultsGrid from './components/ResultsGrid';
import Notification from './components/Notification';
import Settings from './components/Settings';
import Header from './components/Header';
import TitleBar from './components/TitleBar';
import DoiResult from './components/DoiResult';
import './styles.css';
import { v4 as uuidv4 } from 'uuid';

declare global {
  interface Window {
    electron: {
      search: (query: string) => Promise<Book[]>;
      openLink: (link: string) => void;
      on: (channel: string, callback: (...args: any[]) => void) => void;
      minimize: () => void;
      maximize: () => void;
      close: () => void;
    };
  }
}

const App = () => (
  <DownloadProvider>
    <ThemeProvider>
      <div className="app-container">
        {window.electron.platform !== 'darwin' && <TitleBar />}
        <div className="content-wrapper">
          <AppContent />
        </div>
      </div>
    </ThemeProvider>
  </DownloadProvider>
);

const AppContent = () => {
  const { libgenUrl } = useTheme();
  const [query, setQuery] = useState('');
  const [unfilteredResults, setUnfilteredResults] = useState<Book[]>([]);
  const [results, setResults] = useState<Book[]>([]);
  const [doiResult, setDoiResult] = useState<Book | null>(null);
  const [isDoiSearch, setIsDoiSearch] = useState(false);
  const [loading, setLoading] = useState(false);
  const [statusText, setStatusText] = useState('Ready');
  const [error, setError] = useState('');
  const [noResults, setNoResults] = useState(false);
  const [notification, setNotification] = useState<{ id: string; message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const { downloads, handleDownload, handleCancelDownload, handleOpenFile, handleOpenFolder, handleClearDownloads } = useDownloads();
  const [expandedCard, setExpandedCard] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [randomFact, setRandomFact] = useState('');
  const [randomFactAuthor, setRandomFactAuthor] = useState('');
  const [showAllFiles, setShowAllFiles] = useState(false);

  const handleToggleSettings = () => {
    setShowSettings(!showSettings);
  };

  const handleLogoClick = () => {
    setShowSettings(false);
  };

  const handleBack = () => {
    setResults([]);
    setDoiResult(null);
    setIsDoiSearch(false);
    setQuery('');
  };

  useEffect(() => {
    const filtered = showAllFiles ? unfilteredResults : unfilteredResults.filter(book => book.isbn);
    setResults(filtered);
  }, [showAllFiles, unfilteredResults]);

  useEffect(() => {
    searchInputRef.current?.focus();
    window.electron.on('search-status', (message) => {
      setStatusText(message);
    });
    fetch('https://api.quotable.kurokeita.dev/api/quotes/random')
      .then(response => response.json())
      .then(data => {
        setRandomFact(data.quote.content);
        setRandomFactAuthor(data.quote.author.name);
      })
      .catch(err => console.error(err));
  }, []);

  const handleSearch = async () => {
    if (!query) return;
    setLoading(true);
    setStatusText('Searching...');
    setUnfilteredResults([]);
    setResults([]);
    setDoiResult(null);
    setIsDoiSearch(false);
    setError('');
    setNoResults(false);

    const doiRegex = /10\.\d{4,9}\/[-._;()/:A-Z0-9]+$/i;
    const isDoi = doiRegex.test(query);
    setIsDoiSearch(isDoi);

    try {
      const searchResults = await window.electron.search(query);
      if (isDoi && searchResults.length > 0) {
        setDoiResult(searchResults[0]);
        setStatusText('DOI search complete');
      } else {
        const resultsWithIds = searchResults.map((book) => ({ ...book, client_id: uuidv4() }));
        setUnfilteredResults(resultsWithIds);
        if (resultsWithIds.length === 0) {
          setNoResults(true);
          setStatusText('No results found');
        } else {
          setStatusText('Search complete');
        }
      }
    } catch (err) {
      console.error('Search error:', err);
      setError('Failed to search. Please try again.');
      setNotification({ id: 'search-failed', message: 'Search failed. Please check your connection.', type: 'error' });
      setStatusText('Search failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="left-panel">
        <Header onLogoClick={handleLogoClick} />
        <Sidebar
          downloads={downloads}
          onClear={handleClearDownloads}
          onCancel={handleCancelDownload}
          onOpenFile={handleOpenFile}
          onOpenFolder={handleOpenFolder}
          onSettingsClick={handleToggleSettings}
        />
      </div>
      <div className="main-content">
        <div className="main-view">
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
                    onChange={(e) => setQuery(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                    placeholder="Search for books, articles, and more..."
                    className="search-input"
                  />
                </div>
              </div>
              {loading && (
                <div className="loading-container">
                  <div className="spinner"></div>
                  <p className="status-text">{statusText}</p>
                </div>
              )}
              {error && <p className="error-message">{error}</p>}
              {noResults && <p className="no-results-message">No results found for "{query}"</p>}
              {!loading && !error && !noResults && results.length === 0 && !doiResult && (
                <div className="welcome-message">
                  <p><i>"{randomFact}"</i></p>
                  <p><i>- {randomFactAuthor}</i></p>
                </div>
              )}
              {(results.length > 0 || doiResult) && (
                <div className="search-results-header">
                  <button className="back-button" onClick={handleBack}>
                    Back
                  </button>
                  <h2>Search Results</h2>
                  {isDoiSearch ? (
                    <div />
                  ) : (
                    <div className="toggle-container">
                      <label className="toggle-switch">
                        <input
                          type="checkbox"
                          checked={showAllFiles}
                          onChange={() => setShowAllFiles(!showAllFiles)}
                        />
                        <span className="slider"></span>
                      </label>
                      <span>Show all files</span>
                    </div>
                  )}
                </div>
              )}
              {doiResult && <DoiResult book={doiResult} onDownload={handleDownload} />}
              {results.length > 0 && (
                <ResultsGrid
                  results={results}
                  onDownload={handleDownload}
                  libgenUrl={libgenUrl}
                  downloads={downloads}
                  expandedCard={expandedCard}
                  setExpandedCard={setExpandedCard}
                />
              )}
            </>
          )}
        </div>
        {notification && (
          <Notification
            message={notification.message}
            type={notification.type}
            onClose={() => setNotification(null)}
          />
        )}
      </div>
    </>
  );
};

export default App;