import React, { useEffect, useRef, useCallback, useMemo } from 'react';
import BookCard from './BookCard';
import { Book, Download } from '../types';
import './ResultsGrid.css';
import clsx from 'clsx';

interface ResultsGridProps {
  results: Book[];
  onDownload: (book: Book) => void;
  libgenUrl: string;
  downloads: Download[];
  expandedCard: string | null;
  setExpandedCard: (id: string | null) => void;
}

const ResultsGrid: React.FC<ResultsGridProps> = React.memo(({ 
  results, 
  onDownload, 
  libgenUrl, 
  downloads, 
  expandedCard, 
  setExpandedCard 
}) => {
  const cardRefs = useRef(new Map<string, HTMLDivElement>());

  const handleCardClick = useCallback((id: string) => {
    setExpandedCard(expandedCard === id ? null : id);
  }, [expandedCard, setExpandedCard]);

  // Memoize downloads map for faster lookups
  const downloadsMap = useMemo(() => {
    const map = new Map<string, Download>();
    downloads.forEach(download => {
      map.set(download.client_id, download);
    });
    return map;
  }, [downloads]);

  // Memoize displayed results
  const displayedResults = useMemo(() => {
    return expandedCard ? results.filter(book => book.client_id === expandedCard) : results;
  }, [expandedCard, results]);

  // Memoize grid classes
  const gridClasses = useMemo(() => {
    return clsx('results-grid', {
      'card-expanded': expandedCard,
    });
  }, [expandedCard]);

  useEffect(() => {
    if (expandedCard && cardRefs.current.has(expandedCard)) {
      const timeoutId = setTimeout(() => {
        cardRefs.current.get(expandedCard)?.scrollIntoView({ 
          behavior: 'smooth', 
          block: 'start' 
        });
      }, 100);
      
      return () => clearTimeout(timeoutId);
    }
  }, [expandedCard]);

  // Memoize the BookCard components to prevent unnecessary re-renders
  const bookCards = useMemo(() => {
    return displayedResults.map((book) => {
      const download = downloadsMap.get(book.client_id);
      return (
        <div
          key={book.client_id}
          ref={(el) => {
            if (el) cardRefs.current.set(book.client_id, el);
          }}
        >
          <BookCard
            book={book}
            onDownload={onDownload}
            libgenUrl={libgenUrl}
            downloadState={download?.state}
            isExpanded={expandedCard === book.client_id}
            onToggleExpand={() => handleCardClick(book.client_id)}
          />
        </div>
      );
    });
  }, [displayedResults, downloadsMap, onDownload, libgenUrl, expandedCard, handleCardClick]);

  return (
    <div className={gridClasses}>
      {bookCards}
    </div>
  );
});

ResultsGrid.displayName = 'ResultsGrid';

export default ResultsGrid;
