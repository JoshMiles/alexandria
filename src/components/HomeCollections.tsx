import React, { useEffect, useState, useRef } from 'react';
import { motion } from 'framer-motion';
import SkeletonBookCard from './SkeletonBookCard';
import { Book } from '../types';

interface HomeCollectionsProps {
  onBookClick: (title: string) => void;
}

const SKELETON_COUNT = 12;
const CACHE_DURATION = 30 * 60 * 1000; // 30 minutes

// Cache for categories
let categoriesCache: { data: { [key: string]: Book[] }; timestamp: number } | null = null;

// Define popular book categories with search terms
const BOOK_CATEGORIES = {
  fiction: {
    romance: 'subject:romance',
    mystery: 'subject:mystery',
    fantasy: 'subject:fantasy',
    scifi: 'subject:"science fiction"',
    thriller: 'subject:thriller',
    historical: 'subject:"historical fiction"'
  },
  nonfiction: {
    history: 'subject:history',
    biography: 'subject:biography',
    science: 'subject:science',
    philosophy: 'subject:philosophy',
    business: 'subject:business',
    psychology: 'subject:psychology'
  }
};

async function fetchBooksByCategory(category: string, searchTerm: string, limit: number = 20): Promise<Book[]> {
  try {
    console.log(`Fetching books for category: ${category} with search: ${searchTerm}`);
    
    // Use OpenLibrary search API
    const url = `https://openlibrary.org/search.json?q=${encodeURIComponent(searchTerm)}&limit=${limit}&fields=key,title,author_name,first_publish_year,cover_i,subject,editions,language&sort=rating`;
    const res = await fetch(url);
    
    if (!res.ok) {
      console.error(`Failed to fetch books for ${category}:`, res.status, res.statusText);
      return [];
    }
    
    const data = await res.json();
    console.log(`Found ${data.numFound} books for ${category}, showing ${data.docs?.length || 0}`);
    
    const books: Book[] = [];
    
    (data.docs || []).forEach((doc: any) => {
      // Only include books with covers and basic info
      if (!doc.title || !doc.author_name) return;
      
      const book: Book = {
        client_id: doc.key,
        id: doc.key,
        title: doc.title,
        author: Array.isArray(doc.author_name) ? doc.author_name.join(', ') : doc.author_name,
        publisher: '',
        year: doc.first_publish_year ? String(doc.first_publish_year) : '',
        language: Array.isArray(doc.language) ? doc.language[0] : '',
        pages: '',
        size: '',
        extension: '',
        cover_url: doc.cover_i ? `https://covers.openlibrary.org/b/id/${doc.cover_i}-L.jpg` : '',
        description: '',
        isbn: '',
        asin: '',
        publishedDate: '',
        categories: doc.subject || [],
        averageRating: undefined,
        thumbnail: '',
        doi: '',
        source: 'openlibrary',
        edition: '',
        series: '',
        translator: '',
        original_title: '',
        identifier: '',
        edition_count: doc.edition_count || 0,
      };
      
      books.push(book);
    });
    
    return books;
  } catch (error) {
    console.error(`Error fetching books for ${category}:`, error);
    return [];
  }
}

async function fetchAllCategories(): Promise<{ [key: string]: Book[] }> {
  const allCategories = { ...BOOK_CATEGORIES.fiction, ...BOOK_CATEGORIES.nonfiction };
  const results: { [key: string]: Book[] } = {};
  
  // Fetch books for each category in parallel
  const promises = Object.entries(allCategories).map(async ([category, searchTerm]) => {
    const books = await fetchBooksByCategory(category, searchTerm, 25);
    results[category] = books;
  });
  
  await Promise.all(promises);
  return results;
}

// Lazy loading book item component
const LazyBookItem: React.FC<{ book: Book; onClick: () => void }> = ({ book, onClick }) => {
  const [isVisible, setIsVisible] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);
  const itemRef = useRef<HTMLDivElement>(null);

  const coverUrl = (book as any).cover_id 
    ? `https://covers.openlibrary.org/b/id/${(book as any).cover_id}-L.jpg`
    : book.cover_url || book.thumbnail;

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      {
        rootMargin: '50px', // Start loading 50px before the item comes into view
        threshold: 0.1
      }
    );

    if (itemRef.current) {
      observer.observe(itemRef.current);
    }

    return () => observer.disconnect();
  }, []);

  const handleImageLoad = () => {
    setImageLoaded(true);
  };

  const handleImageError = () => {
    setImageError(true);
  };

  return (
    <motion.div 
      ref={itemRef}
      className="lazy-book-item" 
      onClick={onClick}
      whileHover={{ 
        scale: 1.05,
        boxShadow: '0 8px 25px rgba(0,0,0,0.15)',
        transition: { duration: 0.2 }
      }}
      whileTap={{ scale: 0.98 }}
      style={{
        display: 'flex',
        flexDirection: 'column',
        width: '180px',
        margin: '0 8px 16px 0',
        cursor: 'pointer',
        borderRadius: '12px',
        overflow: 'hidden',
        boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
        backgroundColor: 'white',
        flexShrink: 0,
        border: '1px solid #f0f0f0'
      }}
    >
      <div style={{ height: '220px', overflow: 'hidden', position: 'relative' }}>
        {!isVisible ? (
          // Show skeleton while not visible
          <div style={{
            width: '100%',
            height: '100%',
            backgroundColor: '#f0f0f0',
            animation: 'pulse 1.5s ease-in-out infinite'
          }} />
        ) : coverUrl && !imageError ? (
          <>
            {/* Show skeleton while image is loading */}
            {!imageLoaded && (
              <div style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                backgroundColor: '#f0f0f0',
                animation: 'pulse 1.5s ease-in-out infinite',
                zIndex: 1
              }} />
            )}
            <img
              src={coverUrl}
              alt={book.title}
              onLoad={handleImageLoad}
              onError={handleImageError}
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                opacity: imageLoaded ? 1 : 0,
                transition: 'opacity 0.3s ease-in-out',
                zIndex: 2,
                position: 'relative'
              }}
            />
          </>
        ) : (
          <div style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#f5f5f5',
            fontSize: '36px'
          }}>
            📚
          </div>
        )}
      </div>
      <div style={{ padding: '8px' }}>
        <h4 style={{
          margin: '0 0 4px 0',
          fontSize: '12px',
          fontWeight: 'bold',
          lineHeight: '1.2',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical'
        }}>
          {book.title}
        </h4>
        {/* Edition count badge */}
        {typeof (book as any).edition_count === 'number' && (book as any).edition_count > 0 && (
          <span style={{
            display: 'inline-block',
            background: '#f5b042',
            color: '#fff',
            borderRadius: '8px',
            fontSize: '9px',
            fontWeight: 600,
            padding: '2px 7px',
            marginBottom: 2,
            marginRight: 4
          }}>
            {(book as any).edition_count} editions
          </span>
        )}
        {book.author && (
          <p style={{
            margin: '0 0 2px 0',
            fontSize: '10px',
            color: '#666',
            fontStyle: 'italic',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap'
          }}>
            by {book.author}
          </p>
        )}
        {/* Metadata row */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 2 }}>
          {book.year && (
            <span style={{ fontSize: '9px', color: '#888', marginRight: 6 }}>{book.year}</span>
          )}
          {book.language && (
            <span style={{ fontSize: '9px', color: '#888', marginRight: 6 }}>{book.language}</span>
          )}
        </div>
      </div>
    </motion.div>
  );
};

// Pulsing skeleton component
const PulsingSkeleton: React.FC = () => (
  <div style={{
    display: 'flex',
    flexDirection: 'column',
    width: '180px',
    margin: '0 8px 16px 0',
    borderRadius: '12px',
    overflow: 'hidden',
    backgroundColor: 'white',
    flexShrink: 0,
    animation: 'pulse 1.5s ease-in-out infinite',
    border: '1px solid #f0f0f0'
  }}>
    <div style={{ 
      height: '220px', 
      backgroundColor: '#f0f0f0',
      animation: 'pulse 1.5s ease-in-out infinite'
    }} />
    <div style={{ padding: '8px' }}>
      <div style={{
        height: '12px',
        backgroundColor: '#f0f0f0',
        marginBottom: '4px',
        borderRadius: '2px',
        animation: 'pulse 1.5s ease-in-out infinite'
      }} />
      <div style={{
        height: '10px',
        backgroundColor: '#f0f0f0',
        marginBottom: '2px',
        borderRadius: '2px',
        width: '70%',
        animation: 'pulse 1.5s ease-in-out infinite'
      }} />
      <div style={{
        height: '9px',
        backgroundColor: '#f0f0f0',
        borderRadius: '2px',
        width: '40%',
        animation: 'pulse 1.5s ease-in-out infinite'
      }} />
    </div>
  </div>
);

const HomeCollections: React.FC<HomeCollectionsProps> = ({ onBookClick }) => {
  const [categories, setCategories] = useState<{ [key: string]: Book[] }>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isCached, setIsCached] = useState(false);
  const rowRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [scrollStates, setScrollStates] = useState<{ [idx: number]: { atStart: boolean; atEnd: boolean; page: number; pageCount: number } }>({});

  console.log('HomeCollections render state:', { loading, error, categoriesCount: Object.keys(categories).length, isCached });

  useEffect(() => {
    let cancelled = false;
    
    async function loadAllCategories() {
      setLoading(true);
      setError(null);
      
      try {
        // Check cache first
        if (categoriesCache && Date.now() - categoriesCache.timestamp < CACHE_DURATION) {
          console.log('Using cached categories');
          setCategories(categoriesCache.data);
          setIsCached(true);
          setLoading(false);
          return;
        }
        
        console.log('Loading all book categories...');
        const allCategories = await fetchAllCategories();
        
        if (cancelled) return;
        
        console.log('Loaded categories:', Object.keys(allCategories));
        
        // Update cache
        categoriesCache = { data: allCategories, timestamp: Date.now() };
        
        setCategories(allCategories);
        setIsCached(false);
        setLoading(false);
      } catch (err) {
        if (cancelled) return;
        console.error('Failed to load book categories:', err);
        setError('Failed to load book categories.');
        // Clear cache on error to force fresh load next time
        categoriesCache = null;
        setLoading(false);
      }
    }
    
    loadAllCategories();
    return () => { cancelled = true; };
  }, []);

  // Helper to update scroll state for indicators/arrows
  const updateScrollState = (idx: number) => {
    const el = rowRefs.current[idx];
    if (!el) return;
    const cardWidth = 240 + 27; // card width + gap
    const visibleCards = Math.floor(el.offsetWidth / cardWidth) || 1;
    const totalCards = el.children.length;
    const pageCount = Math.max(1, Math.ceil(totalCards / visibleCards));
    const scrollLeft = el.scrollLeft;
    const maxScroll = el.scrollWidth - el.offsetWidth;
    const atStart = scrollLeft <= 2;
    const atEnd = scrollLeft >= maxScroll - 2;
    const page = Math.round(scrollLeft / (cardWidth * visibleCards));
    setScrollStates(s => ({ ...s, [idx]: { atStart, atEnd, page, pageCount } }));
  };

  useEffect(() => {
    rowRefs.current.forEach((el, idx) => {
      if (!el) return;
      let isDown = false;
      let startX = 0;
      let scrollLeft = 0;
      let lastTouchX = 0;
      const onMouseDown = (e: MouseEvent) => {
        isDown = true;
        el.classList.add('dragging');
        startX = e.pageX - el.offsetLeft;
        scrollLeft = el.scrollLeft;
        document.body.style.userSelect = 'none';
      };
      const onMouseLeave = () => {
        isDown = false;
        el.classList.remove('dragging');
        document.body.style.userSelect = '';
      };
      const onMouseUp = () => {
        isDown = false;
        el.classList.remove('dragging');
        document.body.style.userSelect = '';
      };
      const onMouseMove = (e: MouseEvent) => {
        if (!isDown) return;
        e.preventDefault();
        const x = e.pageX - el.offsetLeft;
        const walk = (x - startX) * 1.2;
        el.scrollLeft = scrollLeft - walk;
        updateScrollState(idx);
      };
      const onTouchStart = (e: TouchEvent) => {
        isDown = true;
        lastTouchX = e.touches[0].pageX;
        scrollLeft = el.scrollLeft;
      };
      const onTouchMove = (e: TouchEvent) => {
        if (!isDown) return;
        const x = e.touches[0].pageX;
        const walk = (x - lastTouchX) * 1.2;
        el.scrollLeft = scrollLeft - walk;
        updateScrollState(idx);
      };
      const onTouchEnd = () => {
        isDown = false;
      };
      const onScroll = () => updateScrollState(idx);
      el.addEventListener('mousedown', onMouseDown);
      el.addEventListener('mouseleave', onMouseLeave);
      el.addEventListener('mouseup', onMouseUp);
      el.addEventListener('mousemove', onMouseMove);
      el.addEventListener('touchstart', onTouchStart);
      el.addEventListener('touchmove', onTouchMove);
      el.addEventListener('touchend', onTouchEnd);
      el.addEventListener('scroll', onScroll);
      // Initial state
      updateScrollState(idx);
      // Cleanup
      return () => {
        el.removeEventListener('mousedown', onMouseDown);
        el.removeEventListener('mouseleave', onMouseLeave);
        el.removeEventListener('mouseup', onMouseUp);
        el.removeEventListener('mousemove', onMouseMove);
        el.removeEventListener('touchstart', onTouchStart);
        el.removeEventListener('touchmove', onTouchMove);
        el.removeEventListener('touchend', onTouchEnd);
        el.removeEventListener('scroll', onScroll);
        document.body.style.userSelect = '';
      };
    });
  }, [Object.keys(categories).length]);

  const renderShelf = (title: string, books: Book[] | null) => {
    console.log(`Rendering shelf "${title}":`, { books: books?.length, loading, error });
    return (
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        style={{ 
          marginBottom: '3rem',
          padding: '0 2rem'
        }}
      >
        <motion.h2 
          className="section-title"
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          style={{
            fontSize: '1.8rem',
            fontWeight: '600',
            marginBottom: '1.5rem',
            color: '#2c3e50',
            borderBottom: '2px solid #e9e6df',
            paddingBottom: '0.5rem'
          }}
        >
          {title}
        </motion.h2>
        {loading || !books ? (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            style={{
              display: 'flex',
              overflowX: 'auto',
              padding: '24px 0',
              gap: '16px',
              width: '100vw',
              marginLeft: 'calc(-50vw + 50%)',
              paddingLeft: 'calc(50vw - 50%)',
              paddingRight: 'calc(50vw - 50%)',
              scrollbarWidth: 'thin',
              scrollbarColor: '#ccc transparent'
            }}
          >
            {[...Array(SKELETON_COUNT)].map((_, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.3, delay: i * 0.05 }}
              >
                <PulsingSkeleton />
              </motion.div>
            ))}
          </motion.div>
        ) : error ? (
          <div className="error-message">{error}</div>
        ) : books && books.length > 0 ? (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            style={{
              display: 'flex',
              overflowX: 'auto',
              padding: '24px 0',
              gap: '16px',
              width: '100vw',
              marginLeft: 'calc(-50vw + 50%)',
              paddingLeft: 'calc(50vw - 50%)',
              paddingRight: 'calc(50vw - 50%)',
              scrollbarWidth: 'thin',
              scrollbarColor: '#ccc transparent'
            }}
          >
            {books.map((book, index) => (
              <motion.div
                key={book.id}
                initial={{ opacity: 0, scale: 0.8, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                transition={{ 
                  duration: 0.4, 
                  delay: index * 0.03,
                  ease: "easeOut"
                }}
                whileHover={{ 
                  scale: 1.05,
                  transition: { duration: 0.2 }
                }}
              >
                <LazyBookItem
                  book={book}
                  onClick={() => onBookClick(book.title)}
                />
              </motion.div>
            ))}
          </motion.div>
        ) : (
          <div style={{ color: '#888', padding: '2rem', textAlign: 'center' }}>No books found.</div>
        )}
      </motion.div>
    );
  };

  // Helper function to get display name for category
  const getCategoryDisplayName = (category: string): string => {
    const displayNames: { [key: string]: string } = {
      romance: 'Romance',
      mystery: 'Mystery & Thriller',
      fantasy: 'Fantasy',
      scifi: 'Science Fiction',
      thriller: 'Thriller',
      historical: 'Historical Fiction',
      history: 'History',
      biography: 'Biography & Memoir',
      science: 'Science',
      philosophy: 'Philosophy',
      business: 'Business & Economics',
      psychology: 'Psychology'
    };
    return displayNames[category] || category;
  };

  // Define category order by popularity
  const categoryOrder = [
    'romance', 'mystery', 'fantasy', 'history', 'biography', 'science',
    'scifi', 'thriller', 'historical', 'philosophy', 'business', 'psychology'
  ];

  // Sort categories by popularity order
  const sortedCategories = Object.entries(categories).sort(([a], [b]) => {
    const aIndex = categoryOrder.indexOf(a);
    const bIndex = categoryOrder.indexOf(b);
    return aIndex - bIndex;
  });

  return (
    <div style={{ padding: '2.5rem 2rem', background: '#f8f5f1', minHeight: '100vh' }}>
      <h2 style={{ marginBottom: '2.5rem', fontSize: '2.3rem', fontWeight: 800, letterSpacing: '-0.5px', color: '#23223a' }}>Browse Popular Collections</h2>
      {Object.entries(categories).map(([category, books], idx) => {
        const scrollState = scrollStates[idx] || { atStart: true, atEnd: false, page: 0, pageCount: 1 };
        return (
          <div key={category} style={{ marginBottom: '3.5rem', paddingBottom: '2.5rem', position: 'relative' }}>
            <h3 style={{ fontSize: '1.35rem', fontWeight: 700, marginBottom: '1.3rem', marginLeft: '0.5rem', color: '#23223a', letterSpacing: '-0.2px' }}>{category.charAt(0).toUpperCase() + category.slice(1)}</h3>
            {!scrollState.atStart && (
              <button
                className="carousel-arrow carousel-arrow-left"
                aria-label={`Scroll ${category} left`}
                tabIndex={0}
                style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', zIndex: 4, background: 'rgba(255,255,255,0.92)', border: 'none', borderRadius: '50%', width: 44, height: 44, boxShadow: '0 2px 12px #e3e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: 28, color: '#bfa16c', opacity: 0.92, transition: 'opacity 0.18s, box-shadow 0.18s' }}
                onClick={() => {
                  const el = rowRefs.current[idx];
                  if (el) el.scrollBy({ left: -240, behavior: 'smooth' });
                }}
                onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); const el = rowRefs.current[idx]; if (el) el.scrollBy({ left: -240, behavior: 'smooth' }); } }}
              >
                &#8592;
              </button>
            )}
            {!scrollState.atEnd && (
              <button
                className="carousel-arrow carousel-arrow-right"
                aria-label={`Scroll ${category} right`}
                tabIndex={0}
                style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', zIndex: 4, background: 'rgba(255,255,255,0.92)', border: 'none', borderRadius: '50%', width: 44, height: 44, boxShadow: '0 2px 12px #e3e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: 28, color: '#bfa16c', opacity: 0.92, transition: 'opacity 0.18s, box-shadow 0.18s' }}
                onClick={() => {
                  const el = rowRefs.current[idx];
                  if (el) el.scrollBy({ left: 240, behavior: 'smooth' });
                }}
                onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); const el = rowRefs.current[idx]; if (el) el.scrollBy({ left: 240, behavior: 'smooth' }); } }}
              >
                &#8594;
              </button>
            )}
            <div className="book-row-scroll" ref={el => rowRefs.current[idx] = el} style={{ paddingLeft: 32, paddingRight: 32 }}>
              {books.map((book, idx) => {
                const coverUrl = book.cover_url || book.thumbnail;
                return (
                  <div
                    key={book.id || idx}
                    className="book-cover-card"
                    tabIndex={0}
                    role="button"
                    onClick={() => onBookClick(book.title)}
                    style={{ cursor: 'pointer', minWidth: 220, maxWidth: 240, height: 340, borderRadius: 22, boxShadow: '0 4px 18px 0 #e3e8f0', background: '#fff', position: 'relative', overflow: 'hidden', margin: 0, padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  >
                    {coverUrl ? (
                      <img src={coverUrl} alt={book.title} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 22, display: 'block' }} />
                    ) : (
                      <div className="modern-wide-work-placeholder" style={{ width: '100%', height: '100%', borderRadius: 22, fontSize: 56, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f5f6fa' }}>📚</div>
                    )}
                    <div className="book-cover-overlay">
                      <div className="book-overlay-content">
                        <div className="book-title" style={{ fontWeight: 700, fontSize: '1.18rem', color: '#fff', marginBottom: 6, textAlign: 'center', textShadow: '0 2px 8px #0008' }}>{book.title}</div>
                        {book.author && <div className="book-author" style={{ fontSize: '1.05rem', color: '#e0e0e0', fontStyle: 'italic', marginBottom: 4, textAlign: 'center', textShadow: '0 2px 8px #0008' }}>by {book.author}</div>}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            {/* Scroll indicators (dots) */}
            <div className="carousel-indicators" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 7, marginTop: 10, marginBottom: 0 }}>
              {Array.from({ length: scrollState.pageCount }).map((_, i) => (
                <span key={i} className={i === scrollState.page ? 'carousel-dot active' : 'carousel-dot'} style={{ width: 10, height: 10, borderRadius: '50%', background: i === scrollState.page ? '#bfa16c' : '#e3e8f0', transition: 'background 0.18s', display: 'inline-block' }} />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export { LazyBookItem };
export default HomeCollections; 