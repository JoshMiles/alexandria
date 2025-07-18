import { useState, useCallback, useRef, useMemo, useEffect } from 'react';
import { Book } from '../types';
import { isDoi } from '../utils/fileUtils';
import { SEARCH_CONFIG } from '../utils/constants';
import { logger } from '../utils/logger';

interface SearchState {
  query: string;
  results: Book[];
  unfilteredResults: Book[];
  loading: boolean;
  error: string;
  noResults: boolean;
}

interface UseSearchReturn extends SearchState {
  search: (query: string) => Promise<void>;
  searchImmediate: (query: string) => Promise<void>;
  clearResults: () => void;
  setQuery: (query: string) => void;
  onSearchComplete?: () => void;
  loadMoreResults: () => void;
  // New for OpenLibrary flow:
  works: any[];
  editions: any[];
  selectedWork: any | null;
  selectedEdition: any | null;
  fetchEditionsForWork: (work: any) => Promise<void>;
  setSelectedWork: (work: any | null) => void;
  setSelectedEdition: (edition: any | null) => void;
  sortMode: 'relevance' | 'rating' | 'pages' | 'title' | 'author';
  setSortMode: (mode: 'relevance' | 'rating' | 'pages' | 'title' | 'author') => void;
}

// Simple in-memory cache for search results
const searchCache = new Map<string, { results: Book[]; timestamp: number }>();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

// Helper to fetch ONLY the first 100 works from OpenLibrary (fetches up to 3 pages, capped at 100)
async function fetchAllOpenLibraryWorks(query: string) {
  let page = 1;
  let allWorks: any[] = [];
  let numFound = 0;
  while (allWorks.length < 100) {
    const url = `https://openlibrary.org/search.json?q=${encodeURIComponent(query)}&limit=40&page=${page}&fields=*`;
    const res = await fetch(url);
    const data = await res.json();
    if (page === 1) numFound = data.numFound || 0;
    const works = (data.docs || []).map((doc: any) => ({
      key: doc.key,
      title: doc.title,
      author: doc.author_name ? doc.author_name.join(', ') : (doc.authors ? doc.authors.map((a: any) => a.name).join(', ') : (doc.contributor ? doc.contributor.join(', ') : '')),
      cover_id: doc.cover_i,
      edition_count: doc.edition_count,
      first_publish_year: doc.first_publish_year,
      subjects: doc.subject,
      language: doc.language,
      place: doc.place,
      publisher: doc.publisher,
      format: doc.format,
      number_of_pages_median: doc.number_of_pages_median,
      first_sentence: doc.first_sentence,
      ddc: doc.ddc,
      ratings_average: doc.ratings_average,
      ratings_count: doc.ratings_count,
      ratings_sortable: doc.ratings_sortable,
    }));
    allWorks = allWorks.concat(works);
    if (works.length === 0 || allWorks.length >= 100) break;
    page++;
    if (page > 3) break; // Only fetch up to 3 pages (limit 100)
  }
  // Cap at 100
  if (allWorks.length > 100) allWorks = allWorks.slice(0, 100);
  return { works: allWorks, numFound };
}

// Helper to fetch ALL editions for a work (fetches all offsets)
async function fetchAllOpenLibraryEditions(workKey: string) {
  let offset = 0;
  let allEditions: any[] = [];
  let total = 0;
  while (true) {
    const url = `https://openlibrary.org${workKey}/editions.json?limit=40&offset=${offset}&fields=*`;
    const res = await fetch(url);
    const data = await res.json();
    if (offset === 0) total = data.size || 0;
    const editions = (data.entries || []).map((ed: any) => {
      // Try to get author from multiple possible fields
      let author = '';
      if (ed.author_name) author = Array.isArray(ed.author_name) ? ed.author_name.join(', ') : ed.author_name;
      else if (ed.authors) author = Array.isArray(ed.authors) ? ed.authors.map((a: any) => a.name).join(', ') : ed.authors.name || '';
      else if (ed.contributor) author = Array.isArray(ed.contributor) ? ed.contributor.join(', ') : ed.contributor;
      return {
        key: ed.key,
        title: ed.title,
        author,
        cover_id: ed.covers ? ed.covers[0] : undefined,
        language: ed.languages ? ed.languages.map((l: any) => l.key.replace('/languages/', '')).join(', ') : '',
        publish_date: ed.publish_date,
        publisher: ed.publishers ? ed.publishers.join(', ') : '',
        isbn: ed.isbn_10 ? ed.isbn_10[0] : (ed.isbn_13 ? ed.isbn_13[0] : ''),
        format: ed.physical_format ? [ed.physical_format] : [],
        number_of_pages_median: ed.number_of_pages_median,
        number_of_pages: ed.number_of_pages,
        contributor: ed.contributor,
        translator: ed.translator,
        ratings_average: ed.ratings_average,
        ratings_count: ed.ratings_count,
        ratings_sortable: ed.ratings_sortable,
      };
    });
    allEditions = allEditions.concat(editions);
    if (allEditions.length >= total || editions.length === 0) break;
    offset += 40;
  }
  return { editions: allEditions, total };
}

// Smart ranking function for works
function rankWorks(works: any[], query: string, sortMode: 'relevance' | 'rating' | 'pages' | 'title' | 'author' = 'relevance'): any[] {
  if (sortMode === 'rating') {
    return works.slice().sort((a: any, b: any) => {
      if ((b.ratings_average || 0) !== (a.ratings_average || 0)) return (b.ratings_average || 0) - (a.ratings_average || 0);
      if ((b.ratings_count || 0) !== (a.ratings_count || 0)) return (b.ratings_count || 0) - (a.ratings_count || 0);
      return rankWorks([a, b], query, 'relevance')[0] === a ? -1 : 1;
    });
  }
  if (sortMode === 'pages') {
    return works.slice().sort((a: any, b: any) => ((b.number_of_pages_median || 0) - (a.number_of_pages_median || 0)));
  }
  if (sortMode === 'title') {
    return works.slice().sort((a: any, b: any) => (a.title || '').localeCompare(b.title || '', undefined, { sensitivity: 'base' }));
  }
  if (sortMode === 'author') {
    return works.slice().sort((a: any, b: any) => (a.author || '').localeCompare(b.author || '', undefined, { sensitivity: 'base' }));
  }
  // Default: relevance
  const q = query.toLowerCase();
  return works.slice().sort((a: any, b: any) => {
    // Title match
    const aTitle = a.title?.toLowerCase() || '';
    const bTitle = b.title?.toLowerCase() || '';
    const aTitleExact = aTitle === q;
    const bTitleExact = bTitle === q;
    if (aTitleExact !== bTitleExact) return Number(bTitleExact) - Number(aTitleExact);
    const aTitlePartial = aTitle.includes(q);
    const bTitlePartial = bTitle.includes(q);
    if (aTitlePartial !== bTitlePartial) return Number(bTitlePartial) - Number(aTitlePartial);
    // Author match
    const aAuthor = a.author?.toLowerCase() || '';
    const bAuthor = b.author?.toLowerCase() || '';
    const aAuthorMatch = aAuthor.includes(q);
    const bAuthorMatch = bAuthor.includes(q);
    if (aAuthorMatch !== bAuthorMatch) return Number(bAuthorMatch) - Number(aAuthorMatch);
    // Edition count
    if ((b.edition_count || 0) !== (a.edition_count || 0)) return (b.edition_count || 0) - (a.edition_count || 0);
    // Year
    return (b.first_publish_year || 0) - (a.first_publish_year || 0);
  });
}

// Smart ranking function for editions
function rankEditions(editions: any[], query: string, sortMode: 'relevance' | 'rating' | 'pages' | 'title' | 'author' = 'relevance'): any[] {
  if (sortMode === 'rating') {
    return editions.slice().sort((a: any, b: any) => {
      if ((b.ratings_average || 0) !== (a.ratings_average || 0)) return (b.ratings_average || 0) - (a.ratings_average || 0);
      if ((b.ratings_count || 0) !== (a.ratings_count || 0)) return (b.ratings_count || 0) - (a.ratings_count || 0);
      return rankEditions([a, b], query, 'relevance')[0] === a ? -1 : 1;
    });
  }
  if (sortMode === 'pages') {
    return editions.slice().sort((a: any, b: any) => ((b.number_of_pages_median || b.number_of_pages || 0) - (a.number_of_pages_median || a.number_of_pages || 0)));
  }
  if (sortMode === 'title') {
    return editions.slice().sort((a: any, b: any) => (a.title || '').localeCompare(b.title || '', undefined, { sensitivity: 'base' }));
  }
  if (sortMode === 'author') {
    return editions.slice().sort((a: any, b: any) => (a.author || '').localeCompare(b.author || '', undefined, { sensitivity: 'base' }));
  }
  // Default: relevance
  const q = query.toLowerCase();
  return editions.slice().sort((a: any, b: any) => {
    // Title match
    const aTitle = a.title?.toLowerCase() || '';
    const bTitle = b.title?.toLowerCase() || '';
    const aTitleExact = aTitle === q;
    const bTitleExact = bTitle === q;
    if (aTitleExact !== bTitleExact) return Number(bTitleExact) - Number(aTitleExact);
    const aTitlePartial = aTitle.includes(q);
    const bTitlePartial = bTitle.includes(q);
    if (aTitlePartial !== bTitlePartial) return Number(bTitlePartial) - Number(aTitlePartial);
    // Author match (if available)
    const aAuthor = a.author?.toLowerCase() || '';
    const bAuthor = b.author?.toLowerCase() || '';
    const aAuthorMatch = aAuthor.includes(q);
    const bAuthorMatch = bAuthor.includes(q);
    if (aAuthorMatch !== bAuthorMatch) return Number(bAuthorMatch) - Number(aAuthorMatch);
    // Most recent publish date
    const aYear = parseInt(a.publish_date?.match(/\d{4}/)?.[0] || '0', 10);
    const bYear = parseInt(b.publish_date?.match(/\d{4}/)?.[0] || '0', 10);
    return bYear - aYear;
  });
}

export const useSearch = (onSearchComplete?: () => void, onStatusUpdate?: (msg: string) => void): UseSearchReturn => {
  const [state, setState] = useState<SearchState>({
    query: '',
    results: [],
    unfilteredResults: [],
    loading: false,
    error: '',
    noResults: false,
  });

  const [sortMode, setSortMode] = useState<'relevance' | 'rating' | 'pages' | 'title' | 'author'>('relevance');

  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Add state for pagination
  // Remove PAGE_SIZE, hasMoreResults, isFetchingNextPage, resultLimit if only used for infinite scroll
  // Remove from return type and interface

  // Add state for OpenLibrary works/editions flow
  const [works, setWorks] = useState<any[]>([]);
  const [editions, setEditions] = useState<any[]>([]);
  const [selectedWork, setSelectedWork] = useState<any | null>(null);
  const [selectedEdition, setSelectedEdition] = useState<any | null>(null);
  // Remove pagination state

  // Add a function to load more results (for local limit)
  const loadMoreResults = () => {
    // This function is no longer used for infinite scroll, but kept for now
    // If it were to be used, it would need to be re-evaluated based on the new state
  };

  // Remove fetchNextPage and all infinite scroll logic
  // Remove PAGE_SIZE, hasMoreResults, isFetchingNextPage, resultLimit if only used for infinite scroll
  // Remove from return type and interface

  const clearResults = useCallback(() => {
    setState(prev => ({
      ...prev,
      results: [],
      unfilteredResults: [],
      loading: false,
      error: '',
      noResults: false,
    }));
    // Also clear OpenLibrary state
    setWorks([]);
    setEditions([]);
    setSelectedWork(null);
    setSelectedEdition(null);
  }, []);

  const setQuery = useCallback((query: string) => {
    setState(prev => ({ ...prev, query }));
  }, []);

  useEffect(() => {
    if (!onStatusUpdate) return;
    const handler = (msg: string) => onStatusUpdate(msg);
    window.electron.on('search-status', handler);
    return () => {
      window.electron.on('search-status', () => {});
    };
  }, [onStatusUpdate]);

  // --- Streaming search result handling ---
  useEffect(() => {
    // Handler for streamed book results
    const handleSearchResult = (book: Book) => {
      setState(prev => {
        // Ensure each result has a unique client_id
        const client_id = book.client_id || book.id || `${book.title}-${book.author}-${book.year}`;
        // Filter out duplicates by client_id
        const exists = prev.results.some(b => (b.client_id || b.id) === client_id);
        if (exists) return prev;
        return {
          ...prev,
          results: [...prev.results, { ...book, client_id }],
          unfilteredResults: [...prev.unfilteredResults, { ...book, client_id }],
          loading: false,
          noResults: false,
        };
      });
    };
    window.electron.on('search-result', handleSearchResult);
    return () => {
      if ((window.electron as any).off) {
        (window.electron as any).off('search-result', handleSearchResult);
      } else {
        window.electron.on('search-result', () => {});
      }
    };
  }, []);

  // New: OpenLibrary search for works
  async function performSearch(query: string) {
    logger.info('[DEBUG] performSearch called', { query });
    setWorks([]);
    setSelectedWork(null);
    setSelectedEdition(null);
    setEditions([]);
    setState(prev => ({ ...prev, loading: true, error: '', noResults: false }));
    try {
      logger.info('[DEBUG] Fetching OpenLibrary works', { query });
      const worksResp = await fetchAllOpenLibraryWorks(query);
      logger.info('[DEBUG] OpenLibrary worksResp', { worksResp });
      const ranked = rankWorks(worksResp.works, query, sortMode);
      logger.info('[DEBUG] ranked works', { ranked });
      setWorks(ranked);
      logger.info('[DEBUG] setWorks called', { count: ranked.length });
      setState(prev => ({ ...prev, loading: false, noResults: ranked.length === 0 }));
      if (onSearchComplete) onSearchComplete();
    } catch (error: any) {
      setState(prev => ({ ...prev, loading: false, error: error.message || 'Error searching works' }));
    }
  }

  // New: fetch editions for a selected work
  async function fetchEditionsForWork(work: any) {
    setSelectedWork(work); // Ensure selectedWork is set
    setEditions([]);
    setSelectedEdition(null);
    setState(prev => ({ ...prev, loading: true, error: '' }));
    try {
      logger.info('Fetching OpenLibrary editions for work', { workKey: work.key });
      const editionsResp = await fetchAllOpenLibraryEditions(work.key);
      const ranked = rankEditions(editionsResp.editions, work.title, sortMode);
      setEditions(ranked);
      setState(prev => ({ ...prev, loading: false }));
    } catch (error: any) {
      setState(prev => ({ ...prev, loading: false, error: error.message || 'Error fetching editions' }));
    }
  }

  // Immediate search (for Enter key or button click)
  const searchImmediate = useCallback(async (query: string) => {
    // Clear any pending debounced search
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
      searchTimeoutRef.current = null;
    }
    
    await performSearch(query);
  }, [performSearch]);

  // Debounced search for input changes
  const search = useCallback(async (query: string) => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    searchTimeoutRef.current = setTimeout(() => {
      performSearch(query);
    }, 300); // 300ms debounce
  }, [performSearch]);

  // Cleanup on unmount
  const cleanup = useCallback(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  }, []);

  // Cleanup cache periodically
  useMemo(() => {
    const now = Date.now();
    for (const [key, value] of searchCache.entries()) {
      if (now - value.timestamp > CACHE_DURATION) {
        searchCache.delete(key);
      }
    }
  }, [state.query]); // Trigger cleanup when query changes

  // Remove Libgen file count prefetching effect

  // Load more works (infinite scroll)
  // Remove loadMoreWorks and loadMoreEditions

  return {
    ...state,
    search,
    searchImmediate,
    clearResults,
    setQuery,
    loadMoreResults,
    // New for OpenLibrary flow:
    works: sortMode === 'rating' ? rankWorks(works, state.query, 'rating') : rankWorks(works, state.query, 'relevance'),
    editions: sortMode === 'rating' ? rankEditions(editions, state.query, 'rating') : rankEditions(editions, state.query, 'relevance'),
    selectedWork,
    selectedEdition,
    fetchEditionsForWork,
    setSelectedWork,
    setSelectedEdition,
    sortMode,
    setSortMode,
  };
}; 