import React, { useEffect, useRef, useCallback, useMemo } from 'react';
import BookCard from './BookCard';
import { Book, Download } from '../types';
import './ResultsGrid.css';
import clsx from 'clsx';
import { FixedSizeGrid as Grid } from 'react-window';

interface ResultsGridProps {
  results: any[];
  onDownload: (item: any) => void;
  downloads: any[];
  expandedCard: string | null;
  setExpandedCard: (id: string | null) => void;
  renderCard?: (item: any) => React.ReactNode;
}

const CARD_WIDTH = 320; // px
const CARD_HEIGHT = 420; // px
const GRID_GAP = 32; // px (2rem)
const MIN_COLUMNS = 1;
const MAX_COLUMNS = 5;
const VIRTUALIZE_THRESHOLD = 30;

const ResultsGrid: React.FC<ResultsGridProps> = React.memo(({ 
  results = [], 
  onDownload, 
  downloads = [], 
  expandedCard, 
  setExpandedCard, 
  renderCard
}) => {
  const gridRef = useRef<HTMLDivElement>(null);
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
    const safeResults = Array.isArray(results) ? results : [];
    return expandedCard ? safeResults.filter(book => book.client_id === expandedCard) : safeResults;
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

  // Responsive column count based on container width
  const getColumnCount = () => {
    if (!gridRef.current) return 3;
    const width = gridRef.current.offsetWidth;
    return Math.max(
      MIN_COLUMNS,
      Math.floor((width + GRID_GAP) / (CARD_WIDTH + GRID_GAP))
    );
  };

  // Only virtualize if not expanded and enough results
  const shouldVirtualize = !expandedCard && displayedResults.length > VIRTUALIZE_THRESHOLD;

  // Virtualized grid cell renderer
  const Cell = ({ columnIndex, rowIndex, style, data }: any) => {
    const { items, columns } = data;
    const idx = rowIndex * columns + columnIndex;
    if (idx >= items.length) return null;
    const book = items[idx];
    const download = downloadsMap.get(book.client_id);
    return (
      <div style={{ ...style, left: style.left + GRID_GAP, top: style.top + GRID_GAP, width: style.width - GRID_GAP, height: style.height - GRID_GAP }}>
        <BookCard
          book={book}
          onDownload={onDownload}
          downloadState={download?.state}
          isExpanded={expandedCard === book.client_id}
          onToggleExpand={() => handleCardClick(book.client_id)}
        />
      </div>
    );
  };

  // Virtualized grid state/hooks (always called)
  const [columns, setColumns] = React.useState(3);
  useEffect(() => {
    const handleResize = () => {
      setColumns(getColumnCount());
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const rows = Math.ceil(displayedResults.length / columns);

  // Main render: always use CSS grid for layout
  return (
    <div className={gridClasses} ref={gridRef} style={{ width: '100%', minHeight: 400 }}>
      {displayedResults.map((item) => {
        if (renderCard) {
          return (
            <div key={item.key || item.client_id} className="results-grid-item">
              {renderCard(item)}
            </div>
          );
        }
        const download = downloadsMap.get(item.client_id);
        return (
          <div
            key={item.client_id}
            className="results-grid-item"
            ref={(el) => {
              if (el) cardRefs.current.set(item.client_id, el);
            }}
          >
            <BookCard
              book={item}
              onDownload={onDownload}
              downloadState={download?.state}
              isExpanded={expandedCard === item.client_id}
              onToggleExpand={() => handleCardClick(item.client_id)}
            />
          </div>
        );
      })}
    </div>
  );
});

ResultsGrid.displayName = 'ResultsGrid';

export default ResultsGrid;
