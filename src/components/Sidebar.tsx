import React, { useState, useMemo, forwardRef } from 'react';
import { FiDownload, FiXCircle, FiFolder, FiCheckCircle, FiAlertCircle, FiTrash2, FiSettings, FiLoader, FiFileText, FiExternalLink, FiSearch } from 'react-icons/fi';
import { Download } from '../types';
import { useI18n } from '../contexts/I18nContext';
import './Sidebar.css';
import { Resizable } from 're-resizable';
import Header from './Header';

interface SidebarProps {
  downloads: Download[];
  onClear: () => void;
  onCancel: (clientId: string, title: string) => void;
  onOpenFile: (filename: string) => void;
  onOpenFolder: (filename: string) => void;
  onSettingsClick: () => void;
  onLogoClick: () => void;
}

const Sidebar = forwardRef<Resizable, SidebarProps>(({
  downloads, onClear, onCancel, onOpenFile, onOpenFolder, onSettingsClick, onLogoClick
}, ref) => {
  const [searchQuery, setSearchQuery] = useState('');
  const { t } = useI18n();
  const [imageErrors, setImageErrors] = useState<{ [key: string]: boolean }>({});

  const handleClear = () => {
    onClear();
  };

  const handleCancel = (clientId: string, title: string) => {
    onCancel(clientId, title);
  };

  const handleOpenFile = (filename: string) => {
    onOpenFile(filename);
  };

  const handleOpenFolder = (filename: string) => {
    onOpenFolder(filename);
  };

  const handleSettingsClick = () => {
    onSettingsClick();
  };

  // Filter downloads based on search query
  const filteredDownloads = useMemo(() => {
    if (!searchQuery.trim()) return downloads;
    const query = searchQuery.toLowerCase();
    return downloads.filter(download => 
      download.title.toLowerCase().includes(query) ||
      download.author.toLowerCase().includes(query) ||
      download.filename.toLowerCase().includes(query) ||
      download.extension.toLowerCase().includes(query) ||
      download.language.toLowerCase().includes(query)
    );
  }, [downloads, searchQuery]);

  const renderDownloadIcon = (state: Download['state']) => {
    switch (state) {
      case 'resolving':
        return <FiLoader className="icon resolving" />;
      case 'downloading':
        return <FiDownload className="icon progress" />;
      case 'completed':
        return <FiCheckCircle className="icon completed" />;
      case 'failed':
        return <FiAlertCircle className="icon failed" />;
      case 'cancelled':
        return <FiXCircle className="icon cancelled" />;
      case 'browser-download':
        return <FiExternalLink className="icon browser-download" />;
      default:
        return null;
    }
  };

  const isDoi = (id: string) => id.startsWith('10.');

  return (
    <Resizable
      defaultSize={{ width: 350, height: '100vh' }}
      minWidth={280}
      maxWidth={600}
      enable={{ right: true }}
      className="sidebar-resizable"
      ref={ref}
      style={{ height: '100vh' }}
    >
      <div className="sidebar">
        <Header onLogoClick={onLogoClick} />
        
        {/* Header section */}
        <div className="sidebar-header">
          <h2>{t('downloads.title')}</h2>
          <button className="clear-button" onClick={handleClear}>
            <FiTrash2 />
            <span>{t('downloads.clearFinished')}</span>
          </button>
        </div>

        {/* Search section */}
        <div className="downloads-search">
          <div className="search-input-container">
            <FiSearch className="search-icon" />
            <input
              type="text"
              placeholder="Search downloads..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="downloads-search-input"
            />
          </div>
        </div>

        {/* Downloads list - scrollable area */}
        <div className="downloads-list">
          {filteredDownloads.map((download) => {
            const imageError = imageErrors[download.client_id] || false;
            const handleImageError = () => {
              setImageErrors(prev => ({ ...prev, [download.client_id]: true }));
            };
            return (
              <div key={download.client_id} className="download-card">
                <div className="download-status">
                  {renderDownloadIcon(download.state)}
                </div>
                <div className="download-card-top">
                  {isDoi(download.id) ? (
                    <div className="download-card-cover-icon">
                      <FiFileText size={32} />
                    </div>
                  ) : (
                    !imageError ? (
                      <img
                        src={download.thumbnail || `https://covers.openlibrary.org/b/id/${download.id}-L.jpg`}
                        alt={download.title}
                        className="download-card-cover"
                        onError={handleImageError}
                      />
                    ) : (
                      <div className="download-cover-fallback">
                        <div className="download-cover-fallback-title">{download.title}</div>
                        <div className="download-cover-fallback-author">{download.author}</div>
                      </div>
                    )
                  )}
                  <div className="download-info">
                    <div className="download-details">
                      <p className="title">{download.title}</p>
                      <p className="author">{download.author}</p>
                    </div>
                    <div className="download-metadata">
                      <div className="download-chips">
                        <span className="chip">{download.language}</span>
                        <span className="chip">{download.extension}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {download.state === 'resolving' && (
                  <div className="resolving-area">
                    <FiLoader className="icon resolving" />
                    <span>{t('downloads.resolving')}</span>
                  </div>
                )}

                {download.state === 'downloading' && (
                  <div className="download-progress-area">
                    <div className="progress-container">
                      {download.progress.total > 0 ? (
                        <div className="progress-bar-determinate" style={{ width: `${download.progress.percent * 100}%` }}></div>
                      ) : (
                        <div className="progress-indeterminate"><div className="progress-bar" /></div>
                      )}
                    </div>
                    <div className="progress-text">
                      <span>{t('downloads.downloading')}</span>
                      {download.progress.total > 0 && (
                        <span>
                          {`${(download.progress.transferred / 1024 / 1024).toFixed(2)}MB / ${(
                            download.progress.total /
                            1024 /
                            1024
                          ).toFixed(2)}MB`}
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {download.state === 'completed' && (
                  <div className="download-actions">
                    <button onClick={() => handleOpenFile(download.filename)}>
                      <FiDownload />
                      <span>{t('downloads.open')}</span>
                    </button>
                    <button onClick={() => handleOpenFolder(download.filename)}>
                      <FiFolder />
                      <span>{t('downloads.folder')}</span>
                    </button>
                  </div>
                )}

                {(download.state === 'downloading' || download.state === 'resolving') && (
                  <div className="download-actions">
                    <button className="cancel-download-button" onClick={() => handleCancel(download.client_id, download.title)}>
                      <FiXCircle />
                      <span>{t('downloads.cancel')}</span>
                    </button>
                  </div>
                )}
              </div>
            );
          })}
          {filteredDownloads.length === 0 && downloads.length > 0 && (
            <div className="no-downloads-found">
              <p>{t('downloads.noDownloadsMatch')}</p>
            </div>
          )}
          {downloads.length === 0 && (
            <div className="no-downloads">
              <p>{t('downloads.noDownloadsYet')}</p>
            </div>
          )}
        </div>
      </div>
    </Resizable>
  );
});

export default Sidebar;
