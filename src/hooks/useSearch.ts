import { useState, useCallback, useRef, useMemo, useEffect } from 'react';
import { Book } from '../types';
import { isDoi } from '../utils/fileUtils';
import { SEARCH_CONFIG } from '../utils/constants';

interface SearchState {
  query: string;
  results: Book[];
  unfilteredResults: Book[];
  doiResult: Book | null;
  isDoiSearch: boolean;
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
}

// Simple in-memory cache for search results
const searchCache = new Map<string, { results: Book[]; timestamp: number }>();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

export const useSearch = (onSearchComplete?: () => void, onStatusUpdate?: (msg: string) => void): UseSearchReturn => {
  const [state, setState] = useState<SearchState>({
    query: '',
    results: [],
    unfilteredResults: [],
    doiResult: null,
    isDoiSearch: false,
    loading: false,
    error: '',
    noResults: false,
  });

  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const clearResults = useCallback(() => {
    setState(prev => ({
      ...prev,
      results: [],
      unfilteredResults: [],
      doiResult: null,
      isDoiSearch: false,
      error: '',
      noResults: false,
    }));
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
      setState(prev => ({
        ...prev,
        results: [...prev.results, book],
        unfilteredResults: [...prev.unfilteredResults, book],
        loading: false,
        noResults: false,
      }));
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

  const performSearch = useCallback(async (query: string) => {
    if (!query.trim()) {
      clearResults();
      return;
    }

    // Cancel previous search
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    // Clear results and set loading
    setState(prev => ({
      ...prev,
      query: query.trim(),
      loading: true,
      error: '',
      noResults: false,
      results: [],
      unfilteredResults: [],
      doiResult: null,
      isDoiSearch: false,
    }));

    try {
      // Start the search (which will stream results)
      await window.electron.search(query);
      // No need to set results here; they will be appended as streamed
      if (onSearchComplete) {
        onSearchComplete();
      }
    } catch (error) {
      console.error('Search error:', error);
      if (error instanceof Error && error.name === 'AbortError') {
        return; // Search was cancelled
      }
      setState(prev => ({
        ...prev,
        loading: false,
        error: 'Failed to search. Please try again.',
      }));
      if (onSearchComplete) {
        onSearchComplete();
      }
    }
  }, [clearResults, onSearchComplete]);

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

  return {
    ...state,
    search,
    searchImmediate,
    clearResults,
    setQuery,
  };
}; 