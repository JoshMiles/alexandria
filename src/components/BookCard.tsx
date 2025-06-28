import React, { useState, useRef, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Book } from '../types';
import './BookCard.css';
import { FiCalendar, FiFileText, FiGrid, FiHash, FiStar, FiUsers, FiX } from 'react-icons/fi';
import { LazyLoadImage } from 'react-lazy-load-image-component';
import 'react-lazy-load-image-component/src/effects/blur.css';

interface BookCardProps {
  book: Book;
  onDownload: (book: Book) => void;
  libgenUrl: string;
  downloadState?: 'resolving' | 'downloading' | 'completed' | 'failed';
  isExpanded: boolean;
  onToggleExpand: () => void;
}

const BookCard: React.FC<BookCardProps> = ({ book, onDownload, libgenUrl, downloadState, isExpanded, onToggleExpand }) => {
  const [coverUrl, setCoverUrl] = useState(`${libgenUrl}${book.cover_url.replace('_small', '')}`);
  const detailsRef = useRef<HTMLDivElement>(null);

  const handleImageError = () => {
    if (book.thumbnail) {
      setCoverUrl(book.thumbnail);
    }
  };

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

  return (
    <motion.div
      layout
      className={`book-card ${isExpanded ? 'expanded' : ''}`}
      style={{ willChange: 'transform, opacity' }}
    >
      <div className={isExpanded ? 'expanded-book-cover' : 'book-cover'} onClick={onToggleExpand}>
        <LazyLoadImage
          alt={book.title}
          src={coverUrl}
          effect="blur"
          onError={handleImageError}
          width="100%"
          height="100%"
          style={{ objectFit: 'cover' }}
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
      <motion.div
        className="expanded-details-wrapper"
        initial={{ opacity: 0, height: 0 }}
        animate={{
          opacity: isExpanded ? 1 : 0,
          height: isExpanded ? 'auto' : 0,
        }}
        transition={{ duration: 0.3, ease: 'easeInOut' }}
        style={{ willChange: 'height, opacity' }}
      >
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
              <button className="close-button" onClick={(e) => { e.stopPropagation(); onToggleExpand(); }}>
                <FiX />
              </button>
            </div>
          </div>
          {book.description && <p className="description">{book.description}</p>}
          <div className="metadata-grid">
            <div className="detail-item">
              <strong><FiHash /> ISBN</strong>
              <span>{book.isbn}</span>
            </div>
            <div className="detail-item">
              <strong><FiUsers /> Publisher</strong>
              <span>{book.publisher}</span>
            </div>
            <div className="detail-item">
              <strong><FiCalendar /> Published Date</strong>
              <span>{book.publishedDate}</span>
            </div>
            <div className="detail-item">
              <strong><FiFileText /> Pages</strong>
              <span>{book.pages}</span>
            </div>
            <div className="detail-item">
              <strong><FiGrid /> Categories</strong>
              <span>{book.categories?.join(', ')}</span>
            </div>
            <div className="detail-item">
              <strong><FiStar /> Rating</strong>
              <span>{book.averageRating ? `${book.averageRating} / 5` : 'N/A'}</span>
            </div>
          </div>
          <div className="mirror-links">
            <h4>Mirrors:</h4>
            <div className="mirror-buttons">
              {book.mirror_links.map((link, index) => {
                const fullUrl = link.startsWith('http') ? link : `${libgenUrl}${link}`;
                const domain = new URL(fullUrl).hostname;
                return (
                  <a
                    key={index}
                    href={fullUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mirror-button"
                    onClick={(e) => e.stopPropagation()}
                    title="Opens in Browser"
                  >
                    {`Mirror ${index + 1} (${domain})`}
                  </a>
                );
              })}
            </div>
          </div>
          <div className="book-card-download-actions">
            <button
              className="download-button"
              onClick={(e) => {
                e.stopPropagation();
                onDownload(book);
              }}
              disabled={!!downloadState}
            >
              {downloadButtonText}
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
};

export default BookCard;
