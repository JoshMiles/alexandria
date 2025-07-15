import React from 'react';
import './BookCard.css';

const SkeletonBookCard: React.FC = () => (
  <div className="book-card skeleton">
    <div className="book-cover skeleton-cover" />
    <div className="book-info">
      <div className="skeleton-title skeleton-bar" />
      <div className="skeleton-author skeleton-bar" />
      <div className="chip-container">
        <span className="chip skeleton-chip" />
        <span className="chip skeleton-chip" />
      </div>
    </div>
  </div>
);

export default SkeletonBookCard; 