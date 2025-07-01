import React from 'react';
import { Book } from '../types';
import { useI18n } from '../contexts/I18nContext';
import './DoiResult.css';
import { FiCalendar, FiDownload, FiFileText, FiHash, FiUsers } from 'react-icons/fi';

interface DoiResultProps {
  book: Book;
  onDownload: (book: Book) => void;
}

const DoiResult: React.FC<DoiResultProps> = ({ book, onDownload }) => {
  const { t } = useI18n();
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
            <strong><FiHash /> {t('doi.doi')}</strong>
            <span>{book.id}</span>
          </div>
          <div className="doi-detail-item">
            <strong><FiUsers /> {t('doi.publisher')}</strong>
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
            {t('downloads.download')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default DoiResult;

