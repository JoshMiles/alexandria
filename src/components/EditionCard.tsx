import React, { useState, useRef, useEffect } from 'react';
import './BookCard.css';
import './EditionCard.css'; // (create this file if it doesn't exist)
import { LazyLoadImage } from 'react-lazy-load-image-component';
import 'react-lazy-load-image-component/src/effects/blur.css';
import { logger } from '../utils/logger';
import { motion } from 'framer-motion';

interface EditionCardProps {
  edition: any;
  onSelect: () => void;
  fileCount?: number;
  wide?: boolean;
}

function getOpenLibraryCoverUrl(coverId: number | string | undefined, size: 'S' | 'M' | 'L' = 'L') {
  if (!coverId) return undefined;
  return `https://covers.openlibrary.org/b/id/${coverId}-${size}.jpg`;
}

const EditionCard: React.FC<EditionCardProps> = ({ edition, onSelect, fileCount, wide = false }) => {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);
  const itemRef = useRef<HTMLDivElement>(null);

  const coverUrl = edition.cover_id
    ? getOpenLibraryCoverUrl(edition.cover_id, 'L')
    : edition.cover_url || edition.thumbnail;

  useEffect(() => {
    setImageLoaded(false);
    setImageError(false);
  }, [coverUrl]);

  // Metadata
  const language = Array.isArray(edition.language) ? edition.language.join(', ') : edition.language;
  const year = edition.year || (Array.isArray(edition.publish_date) ? edition.publish_date[0] : edition.publish_date);
  const publisher = Array.isArray(edition.publisher) ? edition.publisher[0] : edition.publisher;
  const isbns = Array.isArray(edition.isbn) ? edition.isbn : edition.isbn ? [edition.isbn] : [];
  const format = Array.isArray(edition.format) ? edition.format[0] : edition.format;
  const numPages = edition.number_of_pages_median || edition.number_of_pages;
  const contributors = edition.contributor || edition.translator || edition.authors;
  const rating = edition.ratings_average;
  const ratingCount = edition.ratings_count;
  // Add missing variables for non-wide card
  const firstSentence = Array.isArray(edition.first_sentence) ? edition.first_sentence[0] : edition.first_sentence;
  const subjects = Array.isArray(edition.subject) ? edition.subject.slice(0, 3) : edition.subject ? [edition.subject] : [];
  const formats = Array.isArray(edition.format) ? edition.format.slice(0, 2) : edition.format ? [edition.format] : [];
  const ddc = Array.isArray(edition.ddc) ? edition.ddc[0] : edition.ddc;

  if (wide) {
    // Modern wide card layout (like works page)
    return (
      <div className="modern-wide-work-card" tabIndex={0} role="button" onClick={onSelect} style={{ cursor: 'pointer' }}>
        {coverUrl ? (
          <img src={coverUrl} alt={edition.title} className="modern-wide-work-cover" />
        ) : (
          <div className="modern-wide-work-placeholder"><span role="img" aria-label="book">📚</span></div>
        )}
        <div className="modern-wide-work-info">
          <div className="modern-wide-work-title" title={edition.title} style={{ whiteSpace: 'normal', overflow: 'visible', textOverflow: 'unset', maxWidth: 'none' }}>{edition.title}</div>
          {edition.author && <div className="modern-wide-work-author" title={edition.author} style={{ whiteSpace: 'normal', overflow: 'visible', textOverflow: 'unset', maxWidth: 'none' }}>by {edition.author}</div>}
          {publisher && <div className="modern-wide-work-publisher">{publisher}</div>}
          <div className="modern-wide-work-chips">
            {year && <span className="modern-wide-chip">{year}</span>}
            {language && <span className="modern-wide-work-langchip">{language}</span>}
            {format && <span className="modern-wide-chip">{format}</span>}
            {numPages && <span className="modern-wide-chip">{numPages} pages</span>}
            {fileCount !== undefined && <span className="modern-wide-chip">{fileCount} files</span>}
          </div>
          {Array.isArray(isbns) && isbns.length > 0 && <div className="modern-wide-work-editions">ISBN: {isbns[0]}</div>}
        </div>
      </div>
    );
  }

  return (
    <motion.div
      ref={itemRef}
      className="edition-card-root"
      onClick={onSelect}
      tabIndex={0}
      role="button"
      title={firstSentence ? firstSentence : undefined}
    >
      <div className="edition-card-cover">
        {coverUrl && !imageError ? (
          <img
            src={coverUrl}
            alt={edition.title}
            onLoad={() => setImageLoaded(true)}
            onError={() => setImageError(true)}
            className="compact-book-card-img"
          />
        ) : (
          <div className="compact-book-card-fallback">
            📚
          </div>
        )}
      </div>
      <div className="edition-card-info">
        <h4 className="edition-card-title">{edition.title}</h4>
        {edition.author && (
          <p className="edition-card-author">
            by {edition.author}
          </p>
        )}
        <div className="edition-card-meta-row">
          {publisher && <span className="edition-card-meta">{publisher}</span>}
          {language && <span className="edition-card-meta">{language}</span>}
          {subjects && subjects.map((sub: string) => (
            <span key={sub} className="edition-card-meta" title="Subject/Genre">{sub}</span>
          ))}
          {formats && formats.map((fmt: string) => (
            <span key={fmt} className="edition-card-meta" title="Format">{fmt}</span>
          ))}
          {numPages && <span className="edition-card-meta">{numPages} pages</span>}
          {ddc && <span className="edition-card-meta">{ddc}</span>}
        </div>
        {fileCount !== undefined && fileCount !== null && (
          <div className="edition-card-filecount">{fileCount} file{fileCount === 1 ? '' : 's'} available</div>
        )}
      </div>
    </motion.div>
  );
};

export default EditionCard; 