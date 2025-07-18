import React from 'react';
import './BookCard.css';

const SkeletonBookCard: React.FC = () => (
  <div className="book-card skeleton" style={{ background: '#fff', borderRadius: 18, boxShadow: '0 6px 32px 0 #e3e8f0, 0 2px 8px 0 #6c8eae22', border: 'none', padding: '2.5rem 2rem 2rem 2rem', color: '#23223a', minHeight: 340, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
    <div className="skeleton-cover" style={{ width: 160, height: 230, borderRadius: 14, background: '#f5f6fa', marginBottom: 24 }} />
    <div className="skeleton-title" style={{ width: '70%', height: 18, background: '#e3e8f0', borderRadius: 8, margin: '0.5rem auto' }} />
    <div className="skeleton-author" style={{ width: '50%', height: 14, background: '#e3e8f0', borderRadius: 8, margin: '0.5rem auto' }} />
    <div className="skeleton-bar" style={{ width: '60%', height: 12, background: '#e3e8f0', borderRadius: 8, margin: '0.5rem auto' }} />
    <div className="skeleton-chip" style={{ width: 60, height: 18, background: '#eaf1fb', borderRadius: 999, margin: '0.5rem auto' }} />
  </div>
);

export default SkeletonBookCard; 