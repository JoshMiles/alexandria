import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FiSearch, FiSettings } from 'react-icons/fi';
import { Book } from './types';
import { DownloadProvider, useDownloads } from './contexts/DownloadContext';
import { I18nProvider, useI18n } from './contexts/I18nContext';
import { useSearch } from './hooks/useSearch';
import Sidebar from './components/Sidebar';
import ResultsGrid from './components/ResultsGrid';
import Settings from './components/Settings';
import Header from './components/Header';
import TitleBar from './components/TitleBar';
import WorkCard from './components/WorkCard';
import EditionCard from './components/EditionCard';
import './styles.css';
import { v4 as uuidv4 } from 'uuid';
import SkeletonBookCard from './components/SkeletonBookCard';
import { logger } from './utils/logger';
import Notification from './components/Notification';
import HomeCollections from './components/HomeCollections';
import { LazyBookItem } from './components/HomeCollections';
import { resolveLibgenDownloadLink } from './utils/fileUtils';
import DownloadPopupManager from './components/DownloadPopupManager';

// Helper to get OpenLibrary cover image URL
function getOpenLibraryCoverUrl(coverId: number | string | undefined, size: 'S' | 'M' | 'L' = 'M') {
  if (!coverId) return undefined;
  return `https://covers.openlibrary.org/b/id/${coverId}-${size}.jpg`;
}

// Helper: fetch with timeout
async function fetchWithTimeout(resource: RequestInfo, options: RequestInit = {}, timeoutMs = 8000) {
  return Promise.race([
    fetch(resource, options),
    new Promise<Response>((_, reject) =>
      setTimeout(() => reject(new Error('Timeout')), timeoutMs)
    ),
  ]);
}

const App: React.FC = () => (
  <I18nProvider>
    <DownloadProvider>
      <div className="app-container">
        {window.electron.platform !== 'darwin' && <TitleBar />}
        <div className="content-wrapper">
          <AppContent />
        </div>
        <NotificationPortal />
        <DownloadPopupManager />
      </div>
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

// EditionFilesPage component (clean, no logger, no error boundary)
const EditionFilesPage: React.FC<{ edition: any, onBack: () => void }> = ({ edition, onBack }) => {
  const [description, setDescription] = React.useState<string | null>(edition.description || null);
  const [descLoading, setDescLoading] = React.useState(false);
  const [descError, setDescError] = React.useState<string | null>(null);
  const [files, setFiles] = React.useState<any[]>([]);
  const [filesLoading, setFilesLoading] = React.useState(false);
  const [filesError, setFilesError] = React.useState<string | null>(null);
  const [sortKey, setSortKey] = React.useState<'extension' | 'filesize' | 'time_added'>('extension');
  const [fileTypeFilter, setFileTypeFilter] = React.useState<string>('');
  const [googleMeta, setGoogleMeta] = React.useState<{ author?: string; year?: string; language?: string; publisher?: string } | null>(null);

  React.useEffect(() => {
    setDescription(edition.description || null);
    setDescError(null);
    setFiles([]);
    setFilesError(null);
    setGoogleMeta(null);
    // Fetch Google Books description/fallbacks
    const isbns = Array.isArray(edition.isbn) ? edition.isbn : edition.isbn ? [edition.isbn] : [];
    if (isbns.length > 0) {
      setDescLoading(true);
      fetch(`https://www.googleapis.com/books/v1/volumes?q=isbn:${isbns[0]}`)
        .then(res => res.json())
        .then(data => {
          const info = data.items?.[0]?.volumeInfo;
          if (info) {
            setDescription(info.description || edition.description || null);
            setGoogleMeta({
              author: info.authors?.[0],
              year: info.publishedDate ? info.publishedDate.split('-')[0] : undefined,
              language: info.language,
              publisher: info.publisher
            });
          }
          setDescLoading(false);
        })
        .catch(() => {
          setDescError('No description found.');
          setDescLoading(false);
        });
    }
    // Fetch files for this edition (by ISBN)
    if (isbns.length > 0) {
      setFilesLoading(true);
      setFilesError(null);
      fetch(`https://libgen.bz/json.php?object=e&addkeys=*&fields=*&isbn=${isbns[0]}`)
        .then(res => res.json())
        .then(data => {
          if (!data || typeof data !== 'object' || data.error) {
            setFilesError('No files found for this edition.');
            setFiles([]);
            setFilesLoading(false);
            return;
          }
          const editionsArr = Object.values(data);
          let fileObjs: any[] = [];
          editionsArr.forEach((edition: any) => {
            if (edition.files && typeof edition.files === 'object') {
              const filesArr = Object.values(edition.files);
              fileObjs.push(...filesArr);
            }
          });
          if (!fileObjs.length) {
            setFiles([]);
            setFilesLoading(false);
            return;
          }
          fetch(`https://libgen.bz/json.php?object=f&addkeys=*&fields=*&ids=${fileObjs.map((f: any) => f.f_id).filter(Boolean).join(',')}`)
            .then(res2 => res2.json())
            .then(meta => {
              let filesArr: any[] = Object.values(meta || {});
              setFiles(filesArr);
              setFilesLoading(false);
            })
            .catch(() => {
              setFilesError('Failed to load file metadata.');
              setFilesLoading(false);
            });
        })
        .catch(() => {
          setFilesError('Failed to load files for this edition.');
          setFilesLoading(false);
        });
    }
  }, [edition]);

  const coverUrl = edition.cover_id
    ? `https://covers.openlibrary.org/b/id/${edition.cover_id}-L.jpg`
    : edition.cover_url || edition.thumbnail;
  const chips: Array<{ label: string, value: string }> = [];
  if (edition.language) chips.push({ label: 'Language', value: Array.isArray(edition.language) ? edition.language.join(', ') : edition.language });
  if (edition.year) chips.push({ label: 'Year', value: edition.year });
  if (edition.publisher) chips.push({ label: 'Publisher', value: Array.isArray(edition.publisher) ? edition.publisher[0] : edition.publisher });
  if (edition.format) chips.push({ label: 'Format', value: Array.isArray(edition.format) ? edition.format[0] : edition.format });
  if (edition.number_of_pages_median || edition.number_of_pages) chips.push({ label: 'Pages', value: String(edition.number_of_pages_median || edition.number_of_pages) });
  const isbns = Array.isArray(edition.isbn) ? edition.isbn : edition.isbn ? [edition.isbn] : [];
  if (isbns.length > 0) chips.push({ label: 'ISBN', value: isbns[0] });

  return (
    <div style={{ width: '100%', padding: '2rem 0' }}>
      <button onClick={onBack} className="back-btn" type="button" style={{ marginBottom: 24, marginLeft: 12, marginTop: 8, padding: '0.5em 1.2em', borderRadius: 8, border: 'none', background: '#f5f5f5', color: '#bfa16c', fontWeight: 700, cursor: 'pointer', boxShadow: '0 1px 4px #e3e8f011' }}>← Back to Editions</button>
      <div style={{
        display: 'flex',
        alignItems: 'flex-start',
        background: '#fff',
        borderRadius: 16,
        boxShadow: '0 4px 24px 0 #e3e8f0',
        padding: '2.5rem 2.5rem 2.5rem 2rem',
        marginBottom: '2.5rem',
        width: '100%',
        maxWidth: 1200,
        marginLeft: 'auto',
        marginRight: 'auto',
        gap: 32,
      }}>
        <div style={{ minWidth: 180, maxWidth: 180, height: 260, borderRadius: 12, overflow: 'hidden', boxShadow: '0 2px 12px #e3e8f0' }}>
          {coverUrl ? (
            <img src={coverUrl} alt={edition.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : (
            <div style={{ width: '100%', height: '100%', background: '#f5f5f5', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 48 }}>📚</div>
          )}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h2 style={{ fontSize: '2rem', fontWeight: 700, margin: 0, marginBottom: 8, whiteSpace: 'normal', overflow: 'visible', textOverflow: 'unset', maxWidth: 'none' }}>{edition.title}</h2>
          {(edition.author || googleMeta?.author || (Array.isArray(edition.authors) && edition.authors.length > 0 && edition.authors[0])) && (
            <div style={{ fontSize: '1.1rem', color: '#888', margin: 0, marginBottom: 12, whiteSpace: 'normal', overflow: 'visible', textOverflow: 'unset', maxWidth: 'none' }}>
              by {edition.author || googleMeta?.author || (Array.isArray(edition.authors) ? edition.authors[0] : '')}
            </div>
          )}
          {(edition.publisher || googleMeta?.publisher) && (
            <div style={{ fontSize: '1.01rem', color: '#666', marginBottom: 8 }}>
              Publisher: {edition.publisher || googleMeta?.publisher}
            </div>
          )}
          <div style={{ fontSize: '1.01rem', color: '#666', marginBottom: 8 }}>
            {edition.year || edition.publish_date || googleMeta?.year ? `Published: ${edition.year || edition.publish_date || googleMeta?.year}` : ''}
            {edition.language || googleMeta?.language ? ` | Language: ${(edition.language || googleMeta?.language).toUpperCase()}` : ''}
          </div>
          <div style={{ marginBottom: 18, minHeight: 40, color: '#444', fontSize: '1.08rem', lineHeight: 1.5 }}>
            {descLoading ? <span>Loading description...</span> : (description || descError || <span style={{ color: '#bbb' }}>No description available.</span>)}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
            {chips.map(chip => (
              <span key={chip.label} style={{
                background: '#f5f5f5',
                color: '#bfa16c',
                borderRadius: 8,
                padding: '4px 14px',
                fontWeight: 600,
                fontSize: '0.98rem',
                marginRight: 4,
                marginBottom: 4,
                display: 'inline-block',
              }}>{chip.value}</span>
            ))}
          </div>
        </div>
      </div>
      {/* Files section */}
      <div style={{ width: '100%', maxWidth: 1200, margin: '0 auto', padding: '2rem', background: '#f8f5f1', borderRadius: 12, textAlign: 'center', color: '#bbb', fontSize: '1.2rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <label htmlFor="filter-filetype" style={{ marginRight: 8, color: '#888', fontWeight: 500 }}>Filter by type:</label>
            <select
              id="filter-filetype"
              value={fileTypeFilter}
              onChange={e => setFileTypeFilter(e.target.value)}
              style={{ padding: '0.4rem 1rem', borderRadius: 8, border: '1.5px solid #e3e8f0', fontSize: '1rem', color: '#23223a', background: '#fff', marginRight: 24 }}
            >
              <option value="">All</option>
              {[...new Set(files.map((f: any) => f.extension).filter(Boolean).map((ext: string) => ext.toUpperCase()))].sort().map(ext => (
                <option key={ext} value={ext}>{ext}</option>
              ))}
            </select>
          </div>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <label htmlFor="sort-files" style={{ marginRight: 8, color: '#888', fontWeight: 500 }}>Sort by:</label>
            <select
              id="sort-files"
              value={sortKey}
              onChange={e => setSortKey(e.target.value as 'extension' | 'filesize' | 'time_added')}
              style={{ padding: '0.4rem 1rem', borderRadius: 8, border: '1.5px solid #e3e8f0', fontSize: '1rem', color: '#23223a', background: '#fff' }}
            >
              <option value="extension">Extension (A-Z)</option>
              <option value="filesize">File size (largest first)</option>
              <option value="time_added">Time Added (newest first)</option>
            </select>
          </div>
        </div>
        {filesLoading ? (
          <div>Loading files...</div>
        ) : filesError ? (
          <div style={{ color: '#d9534f' }}>{filesError}</div>
        ) : files.length === 0 ? (
          <div>No files found for this edition.</div>
        ) : (
          <div style={{ textAlign: 'left', color: '#222' }}>
            {files
              .filter((f: any) => !fileTypeFilter || (f.extension && f.extension.toUpperCase() === fileTypeFilter))
              .slice()
              .sort((a: any, b: any) => {
                if (sortKey === 'extension') {
                  return (a.extension || '').localeCompare(b.extension || '');
                } else if (sortKey === 'filesize') {
                  return Number(b.filesize || 0) - Number(a.filesize || 0);
                } else if (sortKey === 'time_added') {
                  return Number(b.time_added || 0) - Number(a.time_added || 0);
                }
                return 0;
              })
              .map((file: any, idx: number) => <FileCard key={file.f_id || idx} file={file} editionMeta={{
                ...edition,
                author: edition.author || googleMeta?.author
              }} editionCoverUrl={coverUrl} />)}
          </div>
        )}
      </div>
    </div>
  );
};

// Ensure all logic is inside AppContent and all variables are defined in the correct scope
const AppContent: React.FC = () => {
  const { t, language: appLanguage } = useI18n();
  const { downloads, handleDownload, handleCancelDownload, handleOpenFile, handleOpenFolder, handleClearDownloads, setNotification } = useDownloads();
  
  const [expandedCard, setExpandedCard] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [searchStatus, setSearchStatus] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [sidebarWidth, setSidebarWidth] = useState(350);
  const sidebarResizableRef = useRef<any>(null);

  // Add state for filters
  const [languageFilter, setLanguageFilter] = useState<string>('');
  const [fileTypeFilter, setFileTypeFilter] = useState<string>('');

  const [fileDetails, setFileDetails] = useState<any[]>([]);
  const [fileDetailsLoading, setFileDetailsLoading] = useState(false);
  const [fileDetailsError, setFileDetailsError] = useState('');

  const handleSearchComplete = useCallback(() => {
    setIsSearching(false);
  }, []);

  // Use optimized search hook
  const [loadingEditions, setLoadingEditions] = useState(false);

  // Patch fetchEditionsForWork to set loadingEditions and only update editions after fetch
  const {
    query,
    works,
    editions,
    selectedWork,
    selectedEdition,
    fetchEditionsForWork: _fetchEditionsForWork,
    setSelectedWork,
    setSelectedEdition,
    results,
    unfilteredResults,
    loading,
    error,
    noResults,
    search,
    searchImmediate,
    clearResults,
    setQuery,
    loadMoreResults,
    sortMode,
    setSortMode,
  } = useSearch(handleSearchComplete, setSearchStatus);
  // Add this log after selectedEdition is defined
  console.log('[AppContent] Render', { selectedEdition });

  // Wrap fetchEditionsForWork to set loadingEditions and only update editions after fetch
  const [pendingWork, setPendingWork] = useState<any | null>(null);
  const fetchEditionsForWork = useCallback(async (work: any) => {
    setLoadingEditions(true);
    setPendingWork(work);
    // Do NOT clear editions here
    await _fetchEditionsForWork(work);
    setLoadingEditions(false);
    setPendingWork(null);
  }, [_fetchEditionsForWork]);

  // Memoize editionsWithIsbn only on editions
  const editionsWithIsbn = useMemo(() => {
    return editions.filter(edition => {
      const hasIsbn = edition.isbn && (Array.isArray(edition.isbn) ? edition.isbn.length > 0 : !!edition.isbn);
      const format = (edition.format || '').toString().toLowerCase();
      const isAudio = format.includes('audio cd') || format.includes('audiobook') || format.includes('audio book') || format.includes('cd audio');
      return hasIsbn && !isAudio;
    });
  }, [editions]);

  // Memoize allEditionIsbns only on editionsWithIsbn
  const allEditionIsbns = useMemo(() => {
    const isbnSet = new Set<string>();
    editionsWithIsbn.forEach((edition: any) => {
      const isbnsArr = Array.isArray(edition.isbn) ? edition.isbn : edition.isbn ? [edition.isbn] : [];
      isbnsArr.forEach((isbn: string) => {
        if (isbn) isbnSet.add(isbn);
      });
    });
    return Array.from(isbnSet).sort(); // sort for stable reference
  }, [editionsWithIsbn]);

  // Create stable keys for effect dependencies
  const editionsWithIsbnKey = useMemo(() => JSON.stringify(editionsWithIsbn.map(e => e.key || e.isbn)), [editionsWithIsbn]);
  const allEditionIsbnsKey = useMemo(() => allEditionIsbns.join(','), [allEditionIsbns]);

  const [editionFileCounts, setEditionFileCounts] = useState<Record<string, number>>({});
  const [fileCountsLoading, setFileCountsLoading] = useState(false);
  const [fileCountsProgress, setFileCountsProgress] = useState<{ current: number, total: number }>({ current: 0, total: 0 });
  const inProgressIsbns = useRef<Set<string>>(new Set());
  const [worksDisplayCount, setWorksDisplayCount] = useState(100);

  const handleBack = useCallback(() => {
    clearResults();
    setQuery('');
    setSearchStatus('');
    setIsSearching(false);
  }, [clearResults, setQuery]);

  const handleLogoClick = useCallback(() => {
    setShowSettings(false);
    clearResults();
    setQuery('');
    setSearchStatus('');
    setIsSearching(false);
    setLanguageFilter('');
    setFileTypeFilter('');
  }, [clearResults, setQuery]);

  const handleCollectionBookClick = useCallback((title: string) => {
    setQuery(title);
    clearResults();
    setSearchStatus('');
    setIsSearching(true);
    setSearchStatus(t('app.searching'));
    searchImmediate(title).catch((error) => {
      logger.error('Search error:', error);
      setIsSearching(false);
      setSearchStatus('');
    });
  }, [setQuery, clearResults, setSearchStatus, setIsSearching, t, searchImmediate]);

  const handleToggleSettings = useCallback(() => {
    setShowSettings(prev => !prev);
  }, []);

  const handleQueryChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setQuery(e.target.value);
  }, [setQuery]);

  // Add client IDs to results
  const filteredResults = useMemo(() => {
    const safeUnfiltered = Array.isArray(unfilteredResults) ? unfilteredResults : [];
    let results = safeUnfiltered;
    if (!Array.isArray(results)) results = [];
    if (languageFilter) {
      results = results.filter(book => book.language === languageFilter);
      if (!Array.isArray(results)) results = [];
    }
    if (fileTypeFilter) {
      results = results.filter(book => book.extension === fileTypeFilter);
      if (!Array.isArray(results)) results = [];
    }
    if (appLanguage) {
      const langLower = appLanguage.toLowerCase();
      results = [
        ...results.filter(book => (book.language || '').toLowerCase() === langLower),
        ...results.filter(book => (book.language || '').toLowerCase() !== langLower)
      ];
    }
    results = results.filter(book => book.isbn && (Array.isArray(book.isbn) ? book.isbn.length > 0 : !!book.isbn));
    return results;
  }, [unfilteredResults, languageFilter, fileTypeFilter, appLanguage]);

  const resultsWithIds = useMemo(() => {
    logger.info(`Computing resultsWithIds: ${filteredResults.length} results`);
    return filteredResults.map((book) => ({ 
      ...book, 
      client_id: book.client_id || uuidv4() 
    }));
  }, [filteredResults]);

  // Define handleSearch in the correct scope
  const handleSearch = useCallback(async () => {
    if (!query.trim()) {
      clearResults();
      setQuery('');
      setSearchStatus('');
      setIsSearching(false);
      setLanguageFilter('');
      setFileTypeFilter('');
      return;
    }
    clearResults();
    setSearchStatus('');
    setIsSearching(true);
    setSearchStatus(t('app.searching'));
    try {
      await searchImmediate(query);
    } catch (error) {
      logger.error('Search error:', error);
      setIsSearching(false);
      setSearchStatus('');
    }
  }, [query, searchImmediate, clearResults, setQuery, t]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  }, [handleSearch]);

  useEffect(() => {
    // Log all dependencies
    console.log('[DEBUG] FileCount effect deps', {
      selectedWork,
      selectedEdition,
      editionsWithIsbnKey,
      allEditionIsbnsKey
    });

    // Strict guard: do nothing if selectedEdition is not null/undefined
    if (selectedEdition !== null && selectedEdition !== undefined) return;

    logger.info('[DEBUG] FileCount effect running', {
      selectedWork,
      selectedEdition,
      editionsWithIsbnLength: editionsWithIsbn.length,
      allEditionIsbnsLength: allEditionIsbns.length
    });

    // Only run if editionsWithIsbn is not empty and selectedEdition is NOT set
    if (!selectedWork || editionsWithIsbn.length === 0) return;
    let cancelled = false;

    // Find ISBNs that are missing counts and not already being fetched
    const missingIsbns = allEditionIsbns.filter((isbn: string) => isbn && editionFileCounts[isbn] === undefined && !inProgressIsbns.current.has(isbn));
    if (missingIsbns.length === 0) {
      setFileCountsLoading(false);
      setFileCountsProgress({ current: allEditionIsbns.length, total: allEditionIsbns.length });
      return;
    }

    // Mark all missingIsbns as in-progress immediately to prevent duplicate fetches
    missingIsbns.forEach(isbn => inProgressIsbns.current.add(isbn));

    setFileCountsLoading(true);
    setFileCountsProgress({ current: 0, total: missingIsbns.length });

    let completed = 0;
    // Fetch all missing ISBNs in parallel
    Promise.all(missingIsbns.map(async (isbn) => {
      try {
        logger.info('[FileCount] Fetching file count (frontend)', { isbn });
        const url = `https://libgen.bz/json.php?object=e&addkeys=*&fields=*&isbn=${encodeURIComponent(isbn)}`;
        const resp = await fetch(url, { method: 'GET', headers: { 'Accept': 'application/json' }, cache: 'no-store' });
        let count = 0;
        if (resp.ok) {
          const data = await resp.json();
          if (Array.isArray(data)) {
            count = data.length;
          } else if (typeof data === 'object' && data !== null) {
            count = Object.keys(data).length;
          }
        }
        logger.info('[FileCount] Result (frontend)', { isbn, count });
        setEditionFileCounts(prev => {
          if (prev[isbn] === count) return prev; // Only update if changed
          return { ...prev, [isbn]: count };
        });
      } catch (err) {
        logger.error('[FileCount] Error fetching file count (frontend)', { isbn, error: err });
        setEditionFileCounts(prev => {
          if (prev[isbn] === 0) return prev;
          return { ...prev, [isbn]: 0 };
        });
      } finally {
        inProgressIsbns.current.delete(isbn);
        completed++;
        setFileCountsProgress({ current: completed, total: missingIsbns.length });
      }
    })).then(() => {
      setFileCountsLoading(false);
      setFileCountsProgress({ current: allEditionIsbns.length, total: allEditionIsbns.length });
      logger.info('[FileCount] All file counts loaded (frontend, parallel)');
    });

    return () => { cancelled = true; };
  }, [allEditionIsbnsKey, editionsWithIsbnKey, selectedWork]);

  // Add googleMeta state and effect at the top level
  const [googleMeta, setGoogleMeta] = React.useState<{ author?: string; year?: string; language?: string; publisher?: string } | null>(null);
  React.useEffect(() => {
    if (!selectedEdition) return;
    const isbns = Array.isArray(selectedEdition.isbn) ? selectedEdition.isbn : selectedEdition.isbn ? [selectedEdition.isbn] : [];
    if (((!selectedEdition.author || selectedEdition.author.trim() === '') || (!selectedEdition.year && !selectedEdition.publish_date) || !selectedEdition.language || !selectedEdition.publisher) && isbns.length > 0) {
      fetch(`https://www.googleapis.com/books/v1/volumes?q=isbn:${isbns[0]}`)
        .then(res => res.json())
        .then(data => {
          const info = data.items?.[0]?.volumeInfo;
          if (info) {
            setGoogleMeta({
              author: info.authors?.[0],
              year: info.publishedDate ? info.publishedDate.split('-')[0] : undefined,
              language: info.language,
              publisher: info.publisher
            });
          }
        })
        .catch(() => setGoogleMeta(null));
    }
  }, [selectedEdition]);

  let mainContent: React.ReactNode = null;
  if (selectedEdition) {
    mainContent = (
      <EditionFilesPage edition={selectedEdition} onBack={() => setSelectedEdition(null)} />
    );
  } else if (selectedWork && !selectedEdition) {
    // Compute all ISBNs for filtered editions
    const allEditionIsbns = editionsWithIsbn
      .map((edition: any) => {
        const isbnsArr = Array.isArray(edition.isbn) ? edition.isbn : edition.isbn ? [edition.isbn] : [];
        return isbnsArr[0];
      })
      .filter(Boolean);
    // Check if all ISBNs have a file count (including 0)
    const allFileCountsLoaded = allEditionIsbns.every((isbn: string) => editionFileCounts[isbn] !== undefined);

    // Show loading spinner if loadingEditions is true, or if file counts are loading, or if editionsWithIsbn is empty
    if (loadingEditions || fileCountsLoading || !allFileCountsLoaded || editionsWithIsbn.length === 0) {
      mainContent = (
        <div className="works-page-container" style={{ padding: '2.5rem 2rem', background: '#f8f5f1', minHeight: '100vh', fontFamily: 'Inter, Segoe UI, Arial, sans-serif' }}>
          <style>{`
            .modern-editions-header-row {
              display: flex;
              align-items: center;
              justify-content: space-between;
              margin-bottom: 1.2rem;
              margin-top: 0.5rem;
              gap: 1.5rem;
            }
            .modern-editions-header-left {
              display: flex;
              flex-direction: column;
              align-items: flex-start;
              gap: 0.5rem;
            }
            .modern-editions-header-title {
              font-size: 2rem;
              font-weight: 800;
              color: #23223a;
              letter-spacing: 0.01em;
              margin: 0;
            }
            .modern-editions-header-right {
              display: flex;
              align-items: center;
              gap: 1rem;
            }
            .modern-editions-grid {
              display: grid;
              grid-template-columns: repeat(auto-fit, minmax(380px, 1fr));
              gap: 2.2rem;
              margin: 0 auto;
              max-width: 1200px;
            }
            @media (max-width: 900px) {
              .modern-editions-grid { grid-template-columns: 1fr; }
            }
          `}</style>
          <div className="modern-editions-header-row">
            <div className="modern-editions-header-left">
              <button onClick={handleBack} className="back-btn" type="button" style={{ fontSize: '1.1rem', padding: '0.5em 1.2em', borderRadius: 8, border: 'none', background: '#f5f5f5', color: '#bfa16c', fontWeight: 700, cursor: 'pointer', boxShadow: '0 1px 4px #e3e8f011' }}>← Back</button>
              <h2 className="modern-editions-header-title">Editions of {selectedWork.title}</h2>
            </div>
            <div className="modern-editions-header-right">
              <label htmlFor="sort-editions" style={{ marginRight: 8, color: '#888', fontWeight: 500 }}>Sort by:</label>
              <select
                id="sort-editions"
                value={sortMode}
                onChange={e => setSortMode(e.target.value as 'relevance' | 'rating' | 'pages' | 'title' | 'author')}
                style={{ padding: '0.4rem 1rem', borderRadius: 8, border: '1.5px solid #e3e8f0', fontSize: '1rem', color: '#23223a', background: '#fff' }}
              >
                <option value="relevance">Relevance</option>
                <option value="rating">Rating</option>
                <option value="pages">Pages</option>
                <option value="title">Title</option>
                <option value="author">Author</option>
              </select>
            </div>
          </div>
          <div style={{ textAlign: 'center', margin: '4rem 0' }}>
            <div className="spinner" style={{ margin: '1rem auto' }} />
            <p style={{ color: '#bfa16c', fontWeight: 600, fontSize: '1.1rem', marginTop: 16 }}>Loading file counts ({fileCountsProgress.current} of {fileCountsProgress.total})...</p>
          </div>
        </div>
      );
    } else {
      // Sort editions by highest file count
      const sortedEditions = [...editionsWithIsbn].sort((a: any, b: any) => {
        const isbnsA = Array.isArray(a.isbn) ? a.isbn : a.isbn ? [a.isbn] : [];
        const isbnsB = Array.isArray(b.isbn) ? b.isbn : b.isbn ? [b.isbn] : [];
        const countA = isbnsA.length > 0 ? editionFileCounts[isbnsA[0]] ?? 0 : 0;
        const countB = isbnsB.length > 0 ? editionFileCounts[isbnsB[0]] ?? 0 : 0;
        return countB - countA;
      });
      mainContent = (
        <div className="works-page-container" style={{ padding: '2.5rem 2rem', background: '#f8f5f1', minHeight: '100vh', fontFamily: 'Inter, Segoe UI, Arial, sans-serif' }}>
          <style>{`
            .modern-editions-header-row {
              display: flex;
              align-items: center;
              justify-content: space-between;
              margin-bottom: 1.2rem;
              margin-top: 0.5rem;
              gap: 1.5rem;
            }
            .modern-editions-header-left {
              display: flex;
              flex-direction: column;
              align-items: flex-start;
              gap: 0.5rem;
            }
            .modern-editions-header-title {
              font-size: 2rem;
              font-weight: 800;
              color: #23223a;
              letter-spacing: 0.01em;
              margin: 0;
            }
            .modern-editions-header-right {
              display: flex;
              align-items: center;
              gap: 1rem;
            }
            .modern-editions-grid {
              display: grid;
              grid-template-columns: repeat(auto-fit, minmax(380px, 1fr));
              gap: 2.2rem;
              margin: 0 auto;
              max-width: 1200px;
            }
            @media (max-width: 900px) {
              .modern-editions-grid { grid-template-columns: 1fr; }
            }
          `}</style>
          <div className="modern-editions-header-row">
            <div className="modern-editions-header-left">
              <button onClick={handleBack} className="back-btn" type="button" style={{ fontSize: '1.1rem', padding: '0.5em 1.2em', borderRadius: 8, border: 'none', background: '#f5f5f5', color: '#bfa16c', fontWeight: 700, cursor: 'pointer', boxShadow: '0 1px 4px #e3e8f011' }}>← Back</button>
              <h2 className="modern-editions-header-title">Editions of {selectedWork.title}</h2>
            </div>
            <div className="modern-editions-header-right">
              <label htmlFor="sort-editions" style={{ marginRight: 8, color: '#888', fontWeight: 500 }}>Sort by:</label>
              <select
                id="sort-editions"
                value={sortMode}
                onChange={e => setSortMode(e.target.value as 'relevance' | 'rating' | 'pages' | 'title' | 'author')}
                style={{ padding: '0.4rem 1rem', borderRadius: 8, border: '1.5px solid #e3e8f0', fontSize: '1rem', color: '#23223a', background: '#fff' }}
              >
                <option value="relevance">Relevance</option>
                <option value="rating">Rating</option>
                <option value="pages">Pages</option>
                <option value="title">Title</option>
                <option value="author">Author</option>
              </select>
            </div>
          </div>
          <div className="modern-editions-grid">
            {sortedEditions.map((edition: any, idx: number) => {
              const isbnsArr = Array.isArray(edition.isbn) ? edition.isbn : edition.isbn ? [edition.isbn] : [];
              const isbn = isbnsArr[0];
              return (
                <div key={edition.key || edition.id || idx} className="modern-wide-work-card" tabIndex={0} role="button" onClick={() => setSelectedEdition(edition)} style={{ cursor: 'pointer' }}>
                  {edition.cover_url || edition.thumbnail || edition.cover_id ? (
                    <img
                      src={edition.cover_url || edition.thumbnail || (edition.cover_id ? getOpenLibraryCoverUrl(edition.cover_id, 'L') : undefined)}
                      alt={edition.title}
                      className="modern-wide-work-cover"
                    />
                  ) : (
                    <div className="modern-wide-work-placeholder"><span role="img" aria-label="book">📚</span></div>
                  )}
                  <div className="modern-wide-work-info">
                    <div className="modern-wide-work-title" title={edition.title} style={{ whiteSpace: 'normal', overflow: 'visible', textOverflow: 'unset', maxWidth: 'none' }}>{edition.title}</div>
                    {edition.author && <div className="modern-wide-work-author" title={edition.author} style={{ whiteSpace: 'normal', overflow: 'visible', textOverflow: 'unset', maxWidth: 'none' }}>by {edition.author}</div>}
                    {edition.publisher && <div className="modern-wide-work-publisher">{Array.isArray(edition.publisher) ? edition.publisher[0] : edition.publisher}</div>}
                    <div className="modern-wide-work-chips">
                      {edition.year && <span className="modern-wide-chip">{edition.year}</span>}
                      {edition.language && <span className="modern-wide-work-langchip">{Array.isArray(edition.language) ? edition.language[0] : edition.language}</span>}
                      {edition.format && <span className="modern-wide-chip">{Array.isArray(edition.format) ? edition.format[0] : edition.format}</span>}
                      {edition.number_of_pages_median && <span className="modern-wide-chip">{edition.number_of_pages_median} pages</span>}
                      {typeof editionFileCounts[isbn] === 'number' && <span className="modern-wide-chip">{editionFileCounts[isbn]} file{editionFileCounts[isbn] === 1 ? '' : 's'}</span>}
                    </div>
                    {isbnsArr.length > 0 && <div className="modern-wide-work-editions">ISBN: {isbnsArr[0]}</div>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      );
    }
  } else if ((isSearching || loading) && resultsWithIds.length === 0 && resultsWithIds.length === 0 && !(languageFilter || fileTypeFilter)) {
    // Show loading spinner/message when searching and no results
    mainContent = (
      <div style={{ textAlign: 'center', margin: '4rem 0' }}>
        <div className="spinner" style={{ margin: '1rem auto' }} />
        <p>{searchStatus || 'Searching...'}</p>
      </div>
    );
  } else if (works.length > 0 && !selectedWork) {
    // Modernize Works Page layout: wide cards, 2 per row, cover left, info right
    mainContent = (
      <div className="works-page-container" style={{ padding: '2.5rem 2rem', background: '#f8f5f1', minHeight: '100vh', fontFamily: 'Inter, Segoe UI, Arial, sans-serif' }}>
        <style>{`
          .modern-wide-work-card {
            background: #fff;
            border-radius: 18px;
            box-shadow: 0 4px 16px 0 #e3e8f0, 0 1.5px 6px 0 #6c8eae11;
            overflow: hidden;
            display: flex;
            flex-direction: row;
            align-items: stretch;
            transition: box-shadow 0.18s, transform 0.18s, background 0.18s;
            cursor: pointer;
            min-height: 200px;
            border: 1.5px solid #f0f0f0;
            margin-bottom: 2.2rem;
          }
          .modern-wide-work-card:hover {
            box-shadow: 0 12px 32px 0 #bfa16c22, 0 4px 16px 0 #e3e8f0;
            transform: translateY(-4px) scale(1.02);
            background: #fafdff;
          }
          .modern-wide-work-cover {
            width: 160px;
            min-width: 160px;
            height: 240px;
            object-fit: cover;
            border-radius: 12px;
            margin: 1.5rem 0 1.5rem 1.5rem;
            box-shadow: 0 3px 10px rgba(0,0,0,0.10);
            background: #f5f6fa;
            display: flex;
            align-items: center;
            justify-content: center;
          }
          .modern-wide-work-placeholder {
            width: 160px;
            min-width: 160px;
            height: 240px;
            display: flex;
            align-items: center;
            justify-content: center;
            background: #f5f6fa;
            border-radius: 12px;
            color: #bfa16c;
            font-size: 2.7rem;
            margin: 1.5rem 0 1.5rem 1.5rem;
          }
          .modern-wide-work-info {
            flex: 1;
            display: flex;
            flex-direction: column;
            justify-content: center;
            padding: 1.5rem 2rem 1.5rem 2rem;
            min-width: 0;
          }
          .modern-wide-work-title {
            font-size: 1.35rem;
            font-weight: 700;
            color: #23223a;
            margin: 0 0 0.5rem 0;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            max-width: 420px;
          }
          .modern-wide-work-author {
            font-size: 1.05rem;
            color: #6a6a8a;
            font-style: italic;
            margin-bottom: 0.7rem;
            font-weight: 500;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            max-width: 420px;
          }
          .modern-wide-work-chips {
            display: flex;
            gap: 0.7rem;
            flex-wrap: wrap;
            margin-bottom: 0.5rem;
          }
          .modern-wide-chip {
            background: #eaf1fb;
            color: #6c8eae;
            border-radius: 999px;
            padding: 0.18em 1.1em;
            font-size: 0.98rem;
            font-weight: 600;
            box-shadow: 0 1px 4px #6c8eae11;
            border: none;
            display: inline-flex;
            align-items: center;
            gap: 0.3em;
            min-height: 1.3em;
            line-height: 1.1;
            white-space: nowrap;
          }
          .modern-wide-work-langchip {
            background: linear-gradient(90deg, #6c8eae 0%, #bfa16c 100%);
            color: #fff;
            border-radius: 999px;
            padding: 0.18em 1.1em;
            font-size: 0.98rem;
            font-weight: 700;
            box-shadow: 0 1px 4px #6c8eae22;
            border: none;
            display: inline-flex;
            align-items: center;
            gap: 0.3em;
            min-height: 1.3em;
            line-height: 1.1;
            white-space: nowrap;
            letter-spacing: 0.01em;
          }
          .modern-works-header-row {
            display: flex;
            align-items: center;
            justify-content: space-between;
            margin-bottom: 2.2rem;
            margin-top: 0.5rem;
            gap: 1.5rem;
          }
          .modern-works-header-left {
            flex: 1;
            display: flex;
            align-items: center;
            gap: 1rem;
          }
          .modern-works-header-right {
            display: flex;
            align-items: center;
            gap: 1rem;
          }
        `}</style>
        <div className="modern-works-header-row">
          <div className="modern-works-header-left">
            <button onClick={handleBack} className="back-btn" type="button" style={{ fontSize: '1.1rem', padding: '0.5em 1.2em', borderRadius: 8, border: 'none', background: '#f5f5f5', color: '#bfa16c', fontWeight: 700, cursor: 'pointer', boxShadow: '0 1px 4px #e3e8f011' }}>← Back</button>
          </div>
          <div className="modern-works-header-right">
            <label htmlFor="sort-works" style={{ marginRight: 8, color: '#888', fontWeight: 500 }}>Sort by:</label>
            <select
              id="sort-works"
              value={sortMode}
              onChange={e => setSortMode(e.target.value as 'relevance' | 'rating' | 'pages' | 'title' | 'author')}
              style={{ padding: '0.4rem 1rem', borderRadius: 8, border: '1.5px solid #e3e8f0', fontSize: '1rem', color: '#23223a', background: '#fff' }}
            >
              <option value="relevance">Relevance</option>
              <option value="rating">Rating</option>
              <option value="pages">Pages</option>
              <option value="title">Title</option>
              <option value="author">Author</option>
            </select>
          </div>
        </div>
        <div className="modern-works-grid">
          {works.map((work) => (
            <div key={work.key || work.client_id} className="modern-wide-work-card" onClick={() => fetchEditionsForWork(work)}>
              {work.cover_url || work.thumbnail || work.cover_id ? (
                <img
                  src={work.cover_url || work.thumbnail || (work.cover_id ? getOpenLibraryCoverUrl(work.cover_id, 'L') : undefined)}
                  alt={work.title}
                  className="modern-wide-work-cover"
                  onError={e => {
                    e.currentTarget.onerror = null;
                    e.currentTarget.style.display = 'none';
                    const parent = e.currentTarget.parentElement;
                    if (parent) {
                      const placeholder = parent.querySelector('.modern-wide-work-placeholder') as HTMLElement | null;
                      if (placeholder) placeholder.style.display = 'flex';
                    }
                  }}
                />
              ) : null}
              <div className="modern-wide-work-placeholder" style={{ display: work.cover_url || work.thumbnail || work.cover_id ? 'none' : 'flex' }}>
                <span role="img" aria-label="book">📚</span>
              </div>
              <div className="modern-wide-work-info">
                <div className="modern-wide-work-title" title={work.title}>{work.title}</div>
                {work.author && <div className="modern-wide-work-author" title={work.author}>by {work.author}</div>}
                {work.publisher && (
                  <div className="modern-wide-work-publisher">
                    {Array.isArray(work.publisher) && work.publisher.length > 0 ? (() => {
                      // Count frequency
                      const freq = work.publisher.reduce((acc: Record<string, number>, p: string) => { acc[p] = (acc[p] || 0) + 1; return acc; }, {});
                      const sorted = Object.entries(freq) as [string, number][];
                      sorted.sort((a, b) => b[1] - a[1]);
                      const mostFrequent = sorted[0][0];
                      return (
                        <span>
                          {mostFrequent}{sorted.length > 1 ? ' & others' : ''}
                        </span>
                      );
                    })() : work.publisher}
                  </div>
                )}
                {work.edition_count && <div className="modern-wide-work-editions">{work.edition_count} edition{work.edition_count > 1 ? 's' : ''}</div>}
                <div className="modern-wide-work-chips">
                  {work.year && <span className="modern-wide-chip">{work.year}</span>}
                  {Array.isArray(work.language) && work.language.length > 1 ? (
                    <span className="modern-wide-work-langchip">Multiple</span>
                  ) : work.language && (
                    <span className="modern-wide-work-langchip">{Array.isArray(work.language) ? work.language[0] : work.language}</span>
                  )}
                </div>
                {work.description && <div className="modern-wide-work-desc">{work.description}</div>}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  } else if (resultsWithIds.length === 0 && resultsWithIds.length === 0 && !(languageFilter || fileTypeFilter) && !fileCountsLoading) {
    // Show HomeCollections when there are no search results and no filters are active and not loading file counts and not searching
    mainContent = <HomeCollections onBookClick={handleCollectionBookClick} />;
  }

  return (
    <>
      <div className="main-content">
        <div className="top-bar search-bar-container">
          <div 
            className="app-logo" 
            onClick={handleLogoClick}
            style={{ cursor: 'pointer', userSelect: 'none' }}
          >
            Alexandria <span role="img" aria-label="books">📚</span>
          </div>
          <div className="search-bar" style={{ flex: 1, maxWidth: 520, marginLeft: 32 }}>
            <FiSearch className="search-icon" />
            <input
              ref={searchInputRef}
              type="text"
              value={query}
              onChange={handleQueryChange}
              onKeyDown={handleKeyDown}
              placeholder="Search for books, author(s), and DOIs..."
              className="search-input"
              style={{ background: '#fff', color: '#23223a', border: '1.5px solid #e9e6df', borderRadius: 18, boxShadow: '0 2px 8px #e9e6df', padding: '0.9rem 1.2rem', fontSize: '1.08rem', fontFamily: 'Inter, Segoe UI, Arial, sans-serif' }}
            />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 24, marginLeft: 32 }}>
            <FiSettings size={22} style={{ cursor: 'pointer', color: '#bfa16c' }} onClick={handleToggleSettings} />
            {/* Add bookmark/favorite icon here if desired */}
          </div>
        </div>
        <div className="main-view" style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          <AnimatePresence mode="wait">
            <motion.div
              key={showSettings ? 'settings' : 'main'}
              initial={{ opacity: 0, x: showSettings ? 20 : -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: showSettings ? -20 : 20 }}
              transition={{ duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] }}
              style={{}}
            >
              <div style={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
                {showSettings ? (
                  <Settings onClose={handleToggleSettings} />
                ) : (
                  <>{mainContent}</>
                )}
              </div>
            </motion.div>
          </AnimatePresence>
        </div>
        <div id="infinite-scroll-trigger" style={{ height: 1 }} />
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

// FileCard component
const FileCard: React.FC<{ file: any; editionMeta?: any; editionCoverUrl?: string }> = ({ file, editionMeta, editionCoverUrl }) => {
  // Compute cover art URL
  let coverUrl = '';
  if (file.fiction_id && file.md5) {
    const fictionIdStr = String(file.fiction_id);
    const folder = fictionIdStr.substring(0, 3) + '000';
    coverUrl = `https://libgen.bz/fictioncovers/${folder}/${file.md5}.jpg`;
  }
  const [imageError, setImageError] = React.useState(false);
  const { logger } = require('./utils/logger');
  const { handleDownload, setNotification } = useDownloads();
  const [resolving, setResolving] = React.useState(false);
  // Helper for metadata chips
  const MetaChip = ({ label, value }: { label: string, value: any }) => value ? (
    <span style={{ ...chipStyle, marginRight: 8, marginBottom: 4 }}><b>{label}:</b> {value}</span>
  ) : null;
  return (
    <div style={{
      display: 'flex',
      alignItems: 'flex-start',
      background: '#fff',
      borderRadius: 12,
      boxShadow: '0 2px 8px #e3e8f0',
      padding: '1.2rem',
      marginBottom: '1.2rem',
      gap: 24,
      minHeight: 120,
      position: 'relative',
    }}>
      <div style={{ minWidth: 80, maxWidth: 80, height: 110, borderRadius: 8, overflow: 'hidden', background: '#f5f5f5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {coverUrl && !imageError ? (
          <img 
            src={coverUrl} 
            alt={file.title} 
            style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
            onError={() => setImageError(true)}
          />
        ) : editionCoverUrl ? (
          <img 
            src={editionCoverUrl} 
            alt={file.title} 
            style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
          />
        ) : (
          <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32 }}>📚</div>
        )}
      </div>
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
        <div style={{ fontWeight: 700, fontSize: '1.1rem', marginBottom: 2 }}>
          {file.title || file.original_title || (file.extension ? `Filetype: ${file.extension.toUpperCase()}` : 'Filetype: Unknown')}
        </div>
        {file.author && <div style={{ color: '#888', fontSize: '0.98rem', marginBottom: 4 }}>by {file.author}</div>}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 4, marginBottom: 4 }}>
          <MetaChip label="Ext" value={file.extension && file.extension.toUpperCase()} />
          <MetaChip label="Size" value={file.filesize && `${(Number(file.filesize) / 1024 / 1024).toFixed(2)} MB`} />
          <MetaChip label="Lang" value={file.language} />
          <MetaChip label="Year" value={file.year} />
          <MetaChip label="Publisher" value={file.publisher} />
          <MetaChip label="Pages" value={file.pages && Number(file.pages) > 0 ? file.pages : undefined} />
          <MetaChip label="ISBN" value={file.isbn} />
          <MetaChip label="Series" value={file.series} />
          <MetaChip label="Edition" value={file.edition} />
          <MetaChip label="Orig. Title" value={file.original_title} />
          <MetaChip label="MD5" value={file.md5} />
          <MetaChip label="Time Added" value={file.time_added ? String(file.time_added) : undefined} />
        </div>
        {file.description && (
          <div style={{ fontSize: '0.97rem', color: '#444', margin: '6px 0 0 0', maxHeight: 60, overflow: 'hidden', textOverflow: 'ellipsis' }}>{file.description}</div>
        )}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12 }}>
          <button
            style={{
              background: 'var(--accent, #bfa16c)',
              color: '#fff',
              border: 'none',
              borderRadius: 8,
              padding: '0.6rem 1.4rem',
              fontWeight: 700,
              fontSize: '1.05rem',
              cursor: resolving ? 'not-allowed' : 'pointer',
              boxShadow: '0 1px 4px #e3e8f0',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              opacity: resolving ? 0.7 : 1,
            }}
            onClick={async () => {
              if (resolving) return;
              setResolving(true);
              try {
                const directLink = await resolveLibgenDownloadLink(file.md5);
                // Use editionMeta for download metadata if available
                handleDownload({
                  ...file,
                  title: editionMeta?.title || file.title,
                  author: editionMeta?.author || file.author,
                  year: editionMeta?.year || file.year,
                  language: editionMeta?.language || file.language,
                  downloadLinks: [directLink]
                });
              } catch (err) {
                setNotification && setNotification({ id: 'download-resolve-failed', message: `Failed to resolve download link: ${err}`, type: 'error' });
              } finally {
                setResolving(false);
              }
            }}
            disabled={resolving}
          >
            <svg style={{ marginRight: 4 }} width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            {resolving ? 'Resolving...' : 'Download'}
          </button>
        </div>
      </div>
    </div>
  );
};

const chipStyle = {
  background: '#f5f5f5',
  color: '#bfa16c',
  borderRadius: 8,
  padding: '2px 10px',
  fontWeight: 600,
  fontSize: '0.95rem',
  display: 'inline-block',
};

export default App;