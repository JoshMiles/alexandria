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
  isLibgenBz?: boolean;
}

// Add file_count to Book type for this component
interface BookWithCount extends Book {
  file_count?: number;
}

const BookCard: React.FC<BookCardProps> = React.memo(({ 
  book, 
  onDownload, 
  libgenUrl, 
  downloadState, 
  isExpanded, 
  onToggleExpand, 
  isLibgenBz = false
}) => {
  const { t } = useI18n();
  const typedBook = book as BookWithCount;
  // --- COVER ART TIMEOUT LOGIC ---
  const [coverUrl, setCoverUrl] = useState(() => {
    if (book.cover_url && typeof book.cover_url === 'string' && book.cover_url.trim()) return book.cover_url;
    if (book.thumbnail && typeof book.thumbnail === 'string' && book.thumbnail.trim()) return book.thumbnail;
    if (book.id && book.id.length === 32) return `https://libgen.is/covers/fictioncovers/${book.id}.jpg`;
    return 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTIwIiBoZWlnaHQ9IjE4MCIgdmlld0JveD0iMCAwIDEyMCAxODAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIxMjAiIGhlaWdodD0iMTgwIiBmaWxsPSIjM0M0QzU2Ii8+Cjx0ZXh0IHg9IjYwIiB5PSI5MCIgZm9udC1mYW1pbHk9IkFyaWFsIiBmb250LXNpemU9IjE0IiBmaWxsPSJ3aGl0ZSIgdGV4dC1hbmNob3I9Im1pZGRsZSI+TG9hZGluZy4uLjwvdGV4dD4KPC9zdmc+';
  });
  const [imageError, setImageError] = useState(false);
  const [coverLoaded, setCoverLoaded] = useState(false);
  const [coverTimedOut, setCoverTimedOut] = useState(false);
  const coverTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    setImageError(false);
    setCoverLoaded(false);
    setCoverTimedOut(false);
    if (coverTimeoutRef.current) clearTimeout(coverTimeoutRef.current);
    coverTimeoutRef.current = setTimeout(() => {
      if (!coverLoaded) setCoverTimedOut(true);
    }, 3000); // 3 second timeout
    return () => {
      if (coverTimeoutRef.current) clearTimeout(coverTimeoutRef.current);
    };
  }, [book.cover_url, book.thumbnail, book.id]);

  const handleImageError = useCallback(() => {
    setImageError(true);
  }, []);
  const handleImageLoad = useCallback(() => {
    setCoverLoaded(true);
    if (coverTimeoutRef.current) clearTimeout(coverTimeoutRef.current);
  }, []);

  // --- Dynamic file list loading logic ---
  const [fullFiles, setFullFiles] = useState<Array<any> | null>(null);
  const [loadingFiles, setLoadingFiles] = useState(false);
  const [filesError, setFilesError] = useState<string | null>(null);

  // Helper to get editionId and fileIds for this book
  const editionId = book.id || (book.files && book.files[0] && book.files[0].fileId);
  const fileIds = useMemo(() => {
    if (Array.isArray(book.files)) {
      // If summary, only first file; if expanded, want all fileIds
      return book.files.map(f => f.fileId).filter(Boolean);
    }
    return [];
  }, [book.files]);
  const mirror = book.files && book.files[0] && book.files[0].mirror ? book.files[0].mirror : 'https://libgen.bz';

  // Fetch full file list when expanded
  useEffect(() => {
    if (isExpanded && fullFiles === null && fileIds.length > 0 && isLibgenBz) {
      setLoadingFiles(true);
      setFilesError(null);
      if (window.electron && typeof window.electron.invoke === 'function') {
        window.electron.invoke('fetchEditionFiles', editionId, fileIds, mirror)
          .then((files: any[]) => {
            setFullFiles(files);
            setLoadingFiles(false);
          })
          .catch((err: any) => {
            setFilesError('Failed to load file list');
            setLoadingFiles(false);
          });
      } else {
        setFilesError('Electron API not available');
        setLoadingFiles(false);
      }
    }
    if (!isExpanded) {
      // Optionally, clear file list on collapse (or keep cached)
      // setFullFiles(null);
    }
  }, [isExpanded, editionId, fileIds, mirror, isLibgenBz, fullFiles]);

  // Use fullFiles if loaded, else summary file
  const filesToShow = isExpanded && fullFiles ? fullFiles : book.files;

  // --- FILE TYPE CHIP LOGIC ---
  const fileTypes = useMemo(() => {
    if (!Array.isArray(filesToShow)) return [];
    return Array.from(new Set(filesToShow.map(f => f.extension).filter(Boolean)));
  }, [filesToShow]);
  const showFileTypeChip = fileTypes.length === 1;

  // --- Download link fetching logic ---
  const [downloadingFileId, setDownloadingFileId] = useState<string | null>(null);
  const [downloadLinksCache, setDownloadLinksCache] = useState<{ [fileId: string]: any[] }>({});

  const handleDownloadClick = useCallback(
    async (file: any) => {
      if (file.downloadLinks && file.downloadLinks.length > 0) {
        onDownload({ ...book, ...file });
        return;
      }
      if (downloadLinksCache[file.fileId]) {
        onDownload({ ...book, ...file, downloadLinks: downloadLinksCache[file.fileId] });
        return;
      }
      setDownloadingFileId(file.fileId);
      if (window.electron && typeof window.electron.invoke === 'function') {
        try {
          const links = await window.electron.invoke('fetchDownloadLinks', file.fileId, file.mirror);
          setDownloadLinksCache(prev => ({ ...prev, [file.fileId]: links }));
          setDownloadingFileId(null);
          onDownload({ ...book, ...file, downloadLinks: links });
        } catch (err) {
          setDownloadingFileId(null);
          // Optionally show error to user
        }
      } else {
        setDownloadingFileId(null);
        // Optionally show error to user
      }
    },
    [book, onDownload, downloadLinksCache]
  );

  // --- RENDER ---
  return (
    <div className={`book-card ${isExpanded ? 'expanded' : ''}`}> 
      <div className={isExpanded ? 'expanded-book-cover' : 'book-cover'} onClick={onToggleExpand}>
        {/* Always render the image, but hide it if fallback is showing */}
        <LazyLoadImage
          alt={book.title}
          src={coverUrl}
          onError={handleImageError}
          onLoad={handleImageLoad}
          width="100%"
          height="100%"
          style={{ objectFit: 'cover', display: (!imageError && !coverTimedOut) ? 'block' : 'none' }}
          effect="blur"
          threshold={100}
          placeholderSrc="data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTIwIiBoZWlnaHQ9IjE4MCIgdmlld0JveD0iMCAwIDEyMCAxODAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIxMjAiIGhlaWdodD0iMTgwIiBmaWxsPSIjM0M0QzU2Ii8+Cjx0ZXh0IHg9IjYwIiB5PSI5MCIgZm9udC1mYW1pbHk9IkFyaWFsIiBmb250LXNpemU9IjE0IiBmaWxsPSJ3aGl0ZSIgdGV4dC1hbmNob3I9Im1pZGRsZSI+TG9hZGluZy4uLjwvdGV4dD4KPC9zdmc+"
        />
        {(imageError || coverTimedOut) && (
          <div className="cover-fallback">
            <div className="cover-fallback-title">{book.title}</div>
            <div className="cover-fallback-author">{book.author}</div>
          </div>
        )}
      </div>
      <div className="book-info">
        <h3>{book.title}</h3>
        <p>{book.author}</p>
        {/* ISBN always visible on collapsed card */}
        {book.isbn && !isExpanded && (
          <div className="isbn-chip">ISBN: {book.isbn}</div>
        )}
        <div className="chip-container">
          <span className="chip">{book.language && typeof book.language === 'string' && book.language.trim() ? book.language : 'Unknown'}</span>
          {showFileTypeChip && <span className="chip">{fileTypes[0]}</span>}
          {book.size && <span className="chip size-chip">{book.size}</span>}
          {typeof typedBook.file_count === 'number' && typedBook.file_count > 1 && (
            <span className="chip file-count-chip">{typedBook.file_count} files</span>
          )}
        </div>
      </div>
      {isExpanded && (
        <div className="expanded-details-wrapper">
          <div className="expanded-details">
            <div className="expanded-header">
              <div>
                <h3>{book.title}</h3>
                <p>{book.author}</p>
                {book.isbn && <div className="isbn-chip">ISBN: {book.isbn}</div>}
              </div>
              <div className="top-right-chips">
                <span className="chip">{book.language && typeof book.language === 'string' && book.language.trim() ? book.language : 'Unknown'}</span>
                {showFileTypeChip && <span className="chip">{fileTypes[0]}</span>}
                {book.size && <span className="chip size-chip">{book.size}</span>}
                {typeof typedBook.file_count === 'number' && typedBook.file_count > 1 && (
                  <span className="chip file-count-chip">{typedBook.file_count} files</span>
                )}
                {/* X (close) button */}
                <button className="close-button" title="Close" onClick={onToggleExpand}>
                  ×
                </button>
              </div>
            </div>
            {/* Expanded metadata grid */}
            <div className="metadata-grid">
              {book.pages && (
                <div className="detail-item"><strong>Pages</strong><span>{book.pages}</span></div>
              )}
              {book.isbn && (
                <div className="detail-item"><strong>ISBN</strong><span>{book.isbn}</span></div>
              )}
              {book.publisher && (
                <div className="detail-item"><strong>Publisher</strong><span>{book.publisher}</span></div>
              )}
              {book.year && (
                <div className="detail-item"><strong>Year</strong><span>{book.year}</span></div>
              )}
              {book.categories && book.categories.length > 0 && (
                <div className="detail-item"><strong>Categories</strong><span>{book.categories.join(', ')}</span></div>
              )}
              {book.averageRating && (
                <div className="detail-item"><strong>Rating</strong><span>{book.averageRating}</span></div>
              )}
              {book.asin && (
                <div className="detail-item"><strong>ASIN</strong><span>{book.asin}</span></div>
              )}
              {book.doi && (
                <div className="detail-item"><strong>DOI</strong><span>{book.doi}</span></div>
              )}
              {book.publishedDate && (
                <div className="detail-item"><strong>Published</strong><span>{book.publishedDate}</span></div>
              )}
            </div>
            {book.description && <p className="description">{book.description}</p>}
            {/* File list table/grid */}
            {loadingFiles && (
              <div className="edition-files-table"><em>Loading file list...</em></div>
            )}
            {filesError && (
              <div className="edition-files-table"><span style={{color: 'red'}}>{filesError}</span></div>
            )}
            {Array.isArray(filesToShow) && filesToShow.length > 0 && !loadingFiles && !filesError && (
              <div className="edition-files-table">
                <h4>Available Formats</h4>
                <table className="file-table">
                  <thead>
                    <tr>
                      <th>Format</th>
                      <th>Size</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {filesToShow.map((file, idx) => (
                      <tr key={file.fileId || idx}>
                        <td>{file.extension}</td>
                        <td>{file.filesize ? `${(file.filesize / 1024 / 1024).toFixed(2)} MB` : ''}</td>
                        <td>
                          <button
                            className="download-file-btn"
                            onClick={(e) => { e.stopPropagation(); handleDownloadClick(file); }}
                            disabled={downloadingFileId === file.fileId}
                          >
                            {downloadingFileId === file.fileId ? 'Loading...' : 'Download'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {/* Mirrors at the bottom */}
            {Array.isArray(book.mirror_links) && book.mirror_links.length > 0 && (
              <div className="expanded-mirrors">
                <h4>Mirrors</h4>
                <div className="mirror-buttons">
                  {book.mirror_links.map((link, idx) => {
                    let host = '';
                    try {
                      host = new URL(link).host.replace(/^www\./, '');
                    } catch {}
                    let label = host;
                    if (host.includes('libgen')) label = 'libgen.li';
                    else if (host.includes('annas-archive')) label = "Anna's Archive";
                    else if (host.includes('books.ms')) label = 'books.ms';
                    // Add more custom labels as needed
                    return (
                      <a
                        key={link + idx}
                        href={link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mirror-button"
                        onClick={e => e.stopPropagation()}
                      >
                        {label} (Mirror {idx + 1})
                      </a>
                    );
                  })}
                </div>
              </div>
            )}
            {/* Optionally, add more metadata or links here */}
            {/* Note for backend: Ensure Google Books API language is merged into book.language if available */}
          </div>
        </div>
      )}
    </div>
  );
});

BookCard.displayName = 'BookCard';

export default BookCard;
