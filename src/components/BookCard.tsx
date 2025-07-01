import React, { useState, useRef, useMemo, useCallback, useEffect } from 'react';
import { Book } from '../types';
import { useI18n } from '../contexts/I18nContext';
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
  const { t } = useI18n();
  const [coverUrl, setCoverUrl] = useState(() => {
    // Use thumbnail if available (from Google Books or LibGen cover fetch)
    if (book.thumbnail) {
      return book.thumbnail;
    }
    // For fiction books, construct the cover URL from the MD5
    if (book.id && book.id.length === 32) {
      return `https://libgen.is/covers/fictioncovers/${book.id}.jpg`;
    }
    // Fallback to unknown cover
    return 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTIwIiBoZWlnaHQ9IjE4MCIgdmlld0JveD0iMCAwIDEyMCAxODAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIxMjAiIGhlaWdodD0iMTgwIiBmaWxsPSIjM0M0QzU2Ii8+Cjx0ZXh0IHg9IjYwIiB5PSI5MCIgZm9udC1mYW1pbHk9IkFyaWFsIiBmb250LXNpemU9IjE0IiBmaWxsPSJ3aGl0ZSIgdGV4dC1hbmNob3I9Im1pZGRsZSI+TG9hZGluZy4uLjwvdGV4dD4KPC9zdmc+';
  });

  // Update cover URL when book.thumbnail changes
  useEffect(() => {
    if (book.thumbnail) {
      setCoverUrl(book.thumbnail);
    }
  }, [book.thumbnail]);
  const detailsRef = useRef<HTMLDivElement>(null);

  const handleImageError = useCallback(() => {
    // Try Google Books thumbnail if available
    if (book.thumbnail && book.thumbnail !== coverUrl) {
      setCoverUrl(book.thumbnail);
    } else {
      // Fallback to placeholder
      setCoverUrl('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTIwIiBoZWlnaHQ9IjE4MCIgdmlld0JveD0iMCAwIDEyMCAxODAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIxMjAiIGhlaWdodD0iMTgwIiBmaWxsPSIjM0M0QzU2Ii8+Cjx0ZXh0IHg9IjYwIiB5PSI5MCIgZm9udC1mYW1pbHk9IkFyaWFsIiBmb250LXNpemU9IjE0IiBmaWxsPSJ3aGl0ZSIgdGV4dC1hbmNob3I9Im1pZGRsZSI+TG9hZGluZy4uLjwvdGV4dD4KPC9zdmc+');
    }
  }, [book.thumbnail, coverUrl]);

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
        return t('downloads.resolving');
      case 'downloading':
        return t('downloads.downloading');
      case 'completed':
        return t('downloads.completed');
      case 'failed':
        return t('downloads.failed');
      default:
        return t('downloads.download');
    }
  }, [downloadState, t]);

  const mirrorButtons = useMemo(() => {
    const buttons = book.mirror_links.map((link, index) => {
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
          title={t('book.opensInBrowser')}
        >
          {`Mirror ${index + 1} (${domain})`}
        </a>
      );
    });
    // Add Anna's Archive button
    if (book.id) {
      const annasUrl = `https://annas-archive.org/slow_download/${book.id}/0/0`;
      buttons.push(
        <a
          key="annas-archive"
          href={annasUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mirror-button"
          style={{ fontWeight: 600, color: '#8a2be2', border: '1.5px solid #8a2be2' }}
          onClick={(e) => { e.stopPropagation(); }}
          title="Check Anna's Archive for this book"
        >
          Check Anna's Archive
        </a>
      );
    }
    return buttons;
  }, [book.mirror_links, libgenUrl, book.id]);

  const metadataItems = useMemo(() => [
    { icon: FiHash, label: 'ISBN', value: book.isbn },
    { icon: FiHash, label: 'ASIN', value: book.asin },
    { icon: FiUsers, label: t('book.publisher'), value: book.publisher },
    { icon: FiCalendar, label: 'Published Date', value: book.publishedDate },
    { icon: FiFileText, label: 'Pages', value: book.pages },
    { icon: FiGrid, label: 'Categories', value: book.categories?.join(', ') },
    { icon: FiStar, label: 'Rating', value: book.averageRating ? `${book.averageRating} / 5` : 'N/A' },
  ], [book.isbn, book.asin, book.publisher, book.publishedDate, book.pages, book.categories, book.averageRating, t]);

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
              <h4>{t('libgen.mirrors')}:</h4>
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
