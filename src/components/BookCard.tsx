import React, { useState, useRef, useMemo, useCallback } from 'react';
import { Book } from '../types';
import './BookCard.css';
import { FiCalendar, FiFileText, FiGrid, FiHash, FiStar, FiUsers, FiX } from 'react-icons/fi';
import { LazyLoadImage } from 'react-lazy-load-image-component';
import 'react-lazy-load-image-component/src/effects/blur.css';

interface BookCardProps {
  book: Book;
  onDownload: (book: Book) => void;
  libgenUrl: string;
  downloadState?: 'resolving' | 'downloading' | 'completed' | 'failed' | 'cancelled' | 'browser-download';
  isExpanded: boolean;
  onToggleExpand: () => void;
}

const BookCard: React.FC<BookCardProps> = React.memo(({ 
  book, 
  onDownload, 
  libgenUrl, 
  downloadState, 
  isExpanded, 
  onToggleExpand 
}) => {
  const [coverUrl, setCoverUrl] = useState(() => 
    `${libgenUrl}${book.cover_url.replace('_small', '')}`
  );
  const detailsRef = useRef<HTMLDivElement>(null);

  const handleImageError = useCallback(() => {
    if (book.thumbnail) {
      setCoverUrl(book.thumbnail);
    }
  }, [book.thumbnail]);

  const handleDownloadClick = useCallback((e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    onDownload(book);
  }, [onDownload, book]);

  const handleToggleExpand = useCallback(() => {
    onToggleExpand();
  }, [onToggleExpand]);

  const handleCloseClick = useCallback((e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    onToggleExpand();
  }, [onToggleExpand]);

  const downloadButtonText = useMemo(() => {
    switch (downloadState) {
      case 'resolving':
        return 'Resolving...';
      case 'downloading':
        return 'Downloading...';
      case 'completed':
        return 'Downloaded';
      case 'failed':
        return 'Failed';
      default:
        return 'Download';
    }
  }, [downloadState]);

  const mirrorButtons = useMemo(() => {
    return book.mirror_links.map((link, index) => {
      const fullUrl = link.startsWith('http') ? link : `${libgenUrl}${link}`;
      const domain = new URL(fullUrl).hostname;
      
      return (
        <a
          key={`${link}-${index}`}
          href={fullUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mirror-button"
          onClick={(e) => {
            e.stopPropagation();
          }}
          title="Opens in Browser"
        >
          {`Mirror ${index + 1} (${domain})`}
        </a>
      );
    });
  }, [book.mirror_links, libgenUrl]);

  const metadataItems = useMemo(() => [
    { icon: FiHash, label: 'ISBN', value: book.isbn },
    { icon: FiUsers, label: 'Publisher', value: book.publisher },
    { icon: FiCalendar, label: 'Published Date', value: book.publishedDate },
    { icon: FiFileText, label: 'Pages', value: book.pages },
    { icon: FiGrid, label: 'Categories', value: book.categories?.join(', ') },
    { icon: FiStar, label: 'Rating', value: book.averageRating ? `${book.averageRating} / 5` : 'N/A' },
  ], [book.isbn, book.publisher, book.publishedDate, book.pages, book.categories, book.averageRating]);

  const isDownloadDisabled = !!downloadState;

  return (
    <div
      className={`book-card ${isExpanded ? 'expanded' : ''}`}
    >
      <div 
        className={isExpanded ? 'expanded-book-cover' : 'book-cover'} 
        onClick={handleToggleExpand}
      >
        <LazyLoadImage
          alt={book.title}
          src={coverUrl}
          onError={handleImageError}
          width="100%"
          height="100%"
          style={{ objectFit: 'cover' }}
          effect="blur"
          threshold={100}
          placeholderSrc="data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTIwIiBoZWlnaHQ9IjE4MCIgdmlld0JveD0iMCAwIDEyMCAxODAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIxMjAiIGhlaWdodD0iMTgwIiBmaWxsPSIjM0M0QzU2Ii8+Cjx0ZXh0IHg9IjYwIiB5PSI5MCIgZm9udC1mYW1pbHk9IkFyaWFsIiBmb250LXNpemU9IjE0IiBmaWxsPSJ3aGl0ZSIgdGV4dC1hbmNob3I9Im1pZGRsZSI+TG9hZGluZy4uLjwvdGV4dD4KPC9zdmc+"
        />
      </div>
      
      <div className="book-info">
        <h3>{book.title}</h3>
        <p>{book.author}</p>
        <div className="chip-container">
          <span className="chip">{book.language}</span>
          <span className="chip">{book.extension}</span>
        </div>
      </div>
      
      {isExpanded && (
        <div className="expanded-details-wrapper">
          <div ref={detailsRef} className="expanded-details">
            <div className="expanded-header">
              <div>
                <h3>{book.title}</h3>
                <p>{book.author}</p>
              </div>
              <div className="top-right-actions">
                <div className="top-right-chips">
                  <span className="chip">{book.language}</span>
                  <span className="chip">{book.extension}</span>
                </div>
                <button className="close-button" onClick={handleCloseClick}>
                  <FiX />
                </button>
              </div>
            </div>
            
            {book.description && <p className="description">{book.description}</p>}
            
            <div className="metadata-grid">
              {metadataItems.map(({ icon: Icon, label, value }) => (
                <div key={label} className="detail-item">
                  <strong><Icon /> {label}</strong>
                  <span>{value || 'N/A'}</span>
                </div>
              ))}
            </div>
            
            <div className="mirror-links">
              <h4>Mirrors:</h4>
              <div className="mirror-buttons">
                {mirrorButtons}
              </div>
            </div>
            
            <div className="book-card-download-actions">
              <button
                className="download-button"
                onClick={handleDownloadClick}
                disabled={isDownloadDisabled}
              >
                {downloadButtonText}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});

BookCard.displayName = 'BookCard';

export default BookCard;
