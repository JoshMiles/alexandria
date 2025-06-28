import React, { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
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

const ResultsGrid: React.FC<ResultsGridProps> = ({ results, onDownload, libgenUrl, downloads, expandedCard, setExpandedCard }) => {
  const cardRefs = useRef(new Map<string, HTMLDivElement>());

  const handleCardClick = (id: string) => {
    setExpandedCard(expandedCard === id ? null : id);
  };

  useEffect(() => {
    if (expandedCard && cardRefs.current.has(expandedCard)) {
      setTimeout(() => {
        cardRefs.current.get(expandedCard)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
    }
  }, [expandedCard]);

  const gridClasses = clsx('results-grid', {
    'card-expanded': expandedCard,
  });

  const displayedResults = expandedCard ? results.filter(book => book.client_id === expandedCard) : results;

  return (
    <div className={gridClasses}>
      <AnimatePresence>
        {displayedResults.map((book) => {
          const download = downloads.find(d => d.client_id === book.client_id);
          return (
            <motion.div
              key={book.client_id}
              layout
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
              ref={(el) => el && cardRefs.current.set(book.client_id, el)}
            >
              <BookCard
                book={book}
                onDownload={onDownload}
                libgenUrl={libgenUrl}
                downloadState={download?.state}
                isExpanded={expandedCard === book.client_id}
                onToggleExpand={() => handleCardClick(book.client_id)}
              />
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
};

export default React.memo(ResultsGrid);
