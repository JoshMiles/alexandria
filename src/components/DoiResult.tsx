import React from 'react';
import { Book } from '../types';
import './DoiResult.css';
import { FiCalendar, FiDownload, FiFileText, FiHash, FiUsers } from 'react-icons/fi';

interface DoiResultProps {
  book: Book;
  onDownload: (book: Book) => void;
}

const DoiResult: React.FC<DoiResultProps> = ({ book, onDownload }) => {
  return (
    <div className="doi-result-card">
      <div className="doi-result-cover">
        <FiFileText size={48} />
      </div>
      <div className="doi-result-info">
        <div className="doi-result-header">
          <h3>{book.title}</h3>
          <p>{book.author}</p>
        </div>
        <div className="doi-metadata-grid">
          <div className="doi-detail-item">
            <strong><FiHash /> DOI</strong>
            <span>{book.id}</span>
          </div>
          <div className="doi-detail-item">
            <strong><FiUsers /> Publisher</strong>
            <span>{book.publisher}</span>
          </div>
          <div className="doi-detail-item">
            <strong><FiCalendar /> Published Date</strong>
            <span>{book.year}</span>
          </div>
        </div>
        <div className="doi-result-actions">
          <button
            className="download-button"
            onClick={() => onDownload(book)}
          >
            <FiDownload />
            Download
          </button>
        </div>
      </div>
    </div>
  );
};

export default DoiResult;

