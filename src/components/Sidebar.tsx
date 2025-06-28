import React from 'react';
import { FiDownload, FiXCircle, FiFolder, FiCheckCircle, FiAlertCircle, FiTrash2, FiSettings, FiLoader } from 'react-icons/fi';
import { Download } from '../types';
import './Sidebar.css';
import { Resizable } from 're-resizable';

interface SidebarProps {
  downloads: Download[];
  onClear: () => void;
  onCancel: (clientId: string) => void;
  onOpenFile: (filename: string) => void;
  onOpenFolder: (filename: string) => void;
  onSettingsClick: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ downloads, onClear, onCancel, onOpenFile, onOpenFolder, onSettingsClick }) => {
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
      default:
        return null;
    }
  };

  return (
    <div className="sidebar">
      <Resizable
        defaultSize={{ width: 350, height: '100%' }}
        minWidth={250}
        maxWidth={500}
        enable={{ right: true }}
        className="sidebar-content-wrapper"
      >
        <div className="sidebar-content">
          <div className="sidebar-header">
            <h2>Downloads</h2>
            <button className="clear-button" onClick={onClear}>
              <FiTrash2 />
              <span>Clear Finished</span>
            </button>
          </div>
          <div className="downloads-list">
            {downloads.map((download) => (
              <div key={download.client_id} className="download-card">
                <div className="download-card-header">
                  <div className="download-info">
                    {renderDownloadIcon(download.state)}
                    <div className="download-details">
                      <p className="title">{download.title}</p>
                      <p className="author"><i>{download.author}</i></p>
                    </div>
                  </div>
                  <div className="download-chips">
                    <span className="chip">{download.language}</span>
                    <span className="chip">{download.extension}</span>
                  </div>
                </div>
                {(download.state === 'downloading' || download.state === 'resolving') && (
                  <>
                    <div className="progress-container">
                      <progress value={download.percent} max="1" />
                    </div>
                    <div className="progress-text">
                      <span>{download.state === 'resolving' ? 'Resolving...' : `${Math.round(download.percent * 100)}%`}</span>
                      <span>
                        {download.transferredBytes && download.totalBytes
                          ? `${(download.transferredBytes / 1024 / 1024).toFixed(2)}MB / ${(
                              download.totalBytes /
                              1024 /
                              1024
                            ).toFixed(2)}MB`
                          : ''}
                      </span>
                    </div>
                    <button className="cancel-download-button" onClick={() => onCancel(download.client_id)}>
                      <FiXCircle />
                      <span>Cancel</span>
                    </button>
                  </>
                )}
                {download.state === 'completed' && (
                  <div className="download-actions">
                    <button onClick={() => onOpenFile(download.filename)}>
                      <FiDownload />
                      <span>Open</span>
                    </button>
                    <button onClick={() => onOpenFolder(download.filename)}>
                      <FiFolder />
                      <span>Folder</span>
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </Resizable>
      <div className="sidebar-footer">
        <button className="settings-button" onClick={onSettingsClick}>
          <FiSettings />
          <span>Settings</span>
        </button>
      </div>
    </div>
  );
};

export default Sidebar;