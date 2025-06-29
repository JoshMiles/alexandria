import React from 'react';
import { FiDownload, FiXCircle, FiFolder, FiCheckCircle, FiAlertCircle, FiTrash2, FiSettings, FiLoader, FiFileText, FiExternalLink } from 'react-icons/fi';
import { Download } from '../types';
import './Sidebar.css';
import { Resizable } from 're-resizable';

interface SidebarProps {
  downloads: Download[];
  onClear: () => void;
  onCancel: (clientId: string, title: string) => void;
  onOpenFile: (filename: string) => void;
  onOpenFolder: (filename: string) => void;
  onSettingsClick: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ downloads, onClear, onCancel, onOpenFile, onOpenFolder, onSettingsClick }) => {
  const handleClear = () => {
    console.log('Clear Finished button clicked.');
    onClear();
  };

  const handleCancel = (clientId: string, title: string) => {
    console.log(`Cancel button clicked for download: ${title} (ID: ${clientId})`);
    onCancel(clientId, title);
  };

  const handleOpenFile = (filename: string) => {
    console.log(`Open File button clicked for: ${filename}`);
    onOpenFile(filename);
  };

  const handleOpenFolder = (filename: string) => {
    console.log(`Open Folder button clicked for: ${filename}`);
    onOpenFolder(filename);
  };

  const handleSettingsClick = () => {
    console.log('Settings button clicked.');
    onSettingsClick();
  };

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

  const isDoi = (id: string) => {
    return id.startsWith('10.');
  };

  return (
    <Resizable
      defaultSize={{ width: 350 }}
      minWidth={280}
      maxWidth={600}
      enable={{ right: true }}
      className="sidebar-resizable"
    >
      <div className="sidebar">
        <div className="sidebar-content">
          <div className="sidebar-header">
            <h2>Downloads</h2>
            <button className="clear-button" onClick={handleClear}>
              <FiTrash2 />
              <span>Clear Finished</span>
            </button>
          </div>
          <div className="downloads-list">
            {downloads.map((download) => (
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
                    <img 
                      src={download.thumbnail || `https://via.placeholder.com/48x72.png?text=${download.title.charAt(0)}`} 
                      alt={download.title} 
                      className="download-card-cover" 
                    />
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
                    <span>Resolving...</span>
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
                      <span>Downloading...</span>
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
                      <span>Open</span>
                    </button>
                    <button onClick={() => handleOpenFolder(download.filename)}>
                      <FiFolder />
                      <span>Folder</span>
                    </button>
                  </div>
                )}

                {(download.state === 'downloading' || download.state === 'resolving') && (
                  <div className="download-actions">
                    <button className="cancel-download-button" onClick={() => handleCancel(download.client_id, download.title)}>
                      <FiXCircle />
                      <span>Cancel</span>
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
        <div className="sidebar-footer">
          <button className="settings-button" onClick={handleSettingsClick}>
            <FiSettings />
            <span>Settings</span>
          </button>
        </div>
      </div>
    </Resizable>
  );
};

export default Sidebar;
