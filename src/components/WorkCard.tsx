import React, { useState, useRef, useEffect } from 'react';
import './BookCard.css';
import { LazyLoadImage } from 'react-lazy-load-image-component';
import 'react-lazy-load-image-component/src/effects/blur.css';

interface WorkCardProps {
  work: any;
  onSelect: () => void;
}

function getOpenLibraryCoverUrl(coverId: number | string | undefined, size: 'S' | 'M' | 'L' = 'L') {
  if (!coverId) return undefined;
  return `https://covers.openlibrary.org/b/id/${coverId}-${size}.jpg`;
}

const WorkCard: React.FC<WorkCardProps> = ({ work, onSelect }) => {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);
  const itemRef = useRef<HTMLDivElement>(null);

  const coverUrl = work.cover_id
    ? getOpenLibraryCoverUrl(work.cover_id, 'L')
    : work.cover_url || work.thumbnail;

  useEffect(() => {
    setImageLoaded(false);
    setImageError(false);
  }, [coverUrl]);

  // Metadata
  const editionCount = work.edition_count;
  const language = Array.isArray(work.language) ? work.language.join(', ') : work.language;
  const firstPublishYear = work.first_publish_year;
  const publisher = Array.isArray(work.publisher) ? work.publisher[0] : work.publisher;
  const subjects = Array.isArray(work.subject) ? work.subject.slice(0, 3) : work.subject ? [work.subject] : [];
  const formats = Array.isArray(work.format) ? work.format.slice(0, 2) : work.format ? [work.format] : [];
  const numPages = work.number_of_pages_median;
  const firstSentence = Array.isArray(work.first_sentence) ? work.first_sentence[0] : work.first_sentence;
  const ddc = Array.isArray(work.ddc) ? work.ddc[0] : work.ddc;
  const rating = work.ratings_average;
  const ratingCount = work.ratings_count;

  return (
    <div
      ref={itemRef}
      className="compact-book-card"
      onClick={onSelect}
      tabIndex={0}
      role="button"
      title={firstSentence ? firstSentence : undefined}
    >
      <div className="compact-book-card-cover">
        {coverUrl && !imageError ? (
          <img
            src={coverUrl}
            alt={work.title}
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
      <div className="compact-book-card-info">
        <h4 className="compact-book-card-title">{work.title}</h4>
        {work.author && (
          <p className="compact-book-card-author">
            by {work.author}
          </p>
        )}
        {firstPublishYear && (
          <span className="compact-book-card-meta">{firstPublishYear}</span>
        )}
        {editionCount && (
          <span className="compact-book-card-meta">{editionCount} editions</span>
        )}
        <div className="compact-book-card-meta-row">
          {publisher && <span className="compact-book-card-meta">{publisher}</span>}
          {language && <span className="compact-book-card-meta">{language}</span>}
          {subjects && subjects.map((sub: string) => (
            <span key={sub} className="compact-book-card-meta" title="Subject/Genre">{sub}</span>
          ))}
          {formats && formats.map((fmt: string) => (
            <span key={fmt} className="compact-book-card-meta" title="Format">{fmt}</span>
          ))}
          {numPages && <span className="compact-book-card-meta">{numPages} pages</span>}
          {ddc && <span className="compact-book-card-meta" title={`Dewey: ${ddc}`}>DDC</span>}
          {rating && (
            <span className="compact-book-card-meta" title={`Average rating: ${rating}${ratingCount ? ` (${ratingCount} ratings)` : ''}`}>
              ★ {rating.toFixed(2)}{ratingCount ? ` (${ratingCount})` : ''}
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

export default WorkCard; 