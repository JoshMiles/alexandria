import React from 'react';
import { Book } from '../types';
import './BookCard.css';

interface BookCardProps {
  book: Book;
  onDownload: (book: Book) => void;
  downloadState?: 'resolving' | 'downloading' | 'completed' | 'failed' | 'cancelled' | 'browser-download';
  isExpanded: boolean;
  onToggleExpand: () => void;
  isLibgenBz?: boolean;
  horizontal?: boolean;
}

// Helper to get OpenLibrary cover image URL
function getOpenLibraryCoverUrl(coverId: number | string | undefined, size: 'S' | 'M' | 'L' = 'M') {
  if (!coverId) return undefined;
  return `https://covers.openlibrary.org/b/id/${coverId}-${size}.jpg`;
}

const BookCard: React.FC<BookCardProps> = React.memo(({ 
  book, 
  onDownload, 
  downloadState, 
  isExpanded, 
  onToggleExpand, 
  isLibgenBz = false,
  horizontal = true
}) => {
  // Get cover URL
  const coverUrl = (book as any).cover_id 
    ? getOpenLibraryCoverUrl((book as any).cover_id, 'L')
    : book.cover_url || book.thumbnail;

  // Display ISBN (first one if multiple)
  const displayIsbn = book.isbn ? book.isbn.split(/[,;]/)[0].trim() : undefined;

  return (
    <div className={`book-card ${horizontal ? 'horizontal' : 'vertical'} ${isExpanded ? 'expanded' : ''}`}>
      {/* Cover Image */}
      <div className="book-cover">
        {coverUrl ? (
          <img
            src={coverUrl}
            alt={book.title}
            className="book-cover-img"
          />
        ) : (
          <div className="cover-placeholder">
            <span>📚</span>
          </div>
        )}
      </div>

      {/* Book Info */}
      <div className="book-info">
        <h3 className="book-title" title={book.title}>
          {book.title}
        </h3>
        {book.author && (
          <p className="book-author" title={book.author}>
            by {book.author}
          </p>
        )}
        
        {/* Metadata */}
        <div className="book-metadata">
          {book.year && <span className="book-year">{book.year}</span>}
          {book.language && <span className="book-language">{book.language}</span>}
          {displayIsbn && <span className="book-isbn">ISBN: {displayIsbn}</span>}
        </div>

        {/* Download button for trending shelves */}
        {!isExpanded && (
          <button
            className="download-btn"
            onClick={() => onDownload(book)}
            disabled={downloadState === 'downloading'}
          >
            {downloadState === 'downloading' ? 'Downloading...' : 'Download'}
          </button>
        )}
      </div>
    </div>
  );
});

export default BookCard;
