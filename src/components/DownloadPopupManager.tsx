import React, { useEffect, useState } from 'react';
import { useDownloads } from '../contexts/DownloadContext';
import { FiDownload, FiXCircle, FiFolder, FiCheckCircle, FiAlertCircle, FiLoader } from 'react-icons/fi';
import '../components/Notification.css'; // Reuse notification popup style

const DownloadPopupManager: React.FC = () => {
  const { downloads, handleCancelDownload, handleOpenFile, handleOpenFolder } = useDownloads();
  const activeDownloads = downloads.filter(d => d.state !== 'completed' && d.state !== 'cancelled' && d.state !== 'failed');
  const completedDownloads = downloads.filter(d => d.state === 'completed');
  const failedDownloads = downloads.filter(d => d.state === 'failed');

  // Track which downloads have shown the complete/failed message
  const [shownMessages, setShownMessages] = useState<{ [clientId: string]: boolean }>({});

  useEffect(() => {
    // Show message for new completed/failed downloads
    [...completedDownloads, ...failedDownloads].forEach(download => {
      if (!shownMessages[download.client_id]) {
        setShownMessages(prev => ({ ...prev, [download.client_id]: true }));
        setTimeout(() => {
          setShownMessages(prev => {
            const copy = { ...prev };
            delete copy[download.client_id];
            return copy;
          });
        }, 4000);
      }
    });
  }, [completedDownloads, failedDownloads, shownMessages]);

  if (activeDownloads.length === 0 && Object.keys(shownMessages).length === 0) return null;

  return (
    <div style={{
      position: 'fixed',
      bottom: 24,
      right: 24,
      zIndex: 2000,
      display: 'flex',
      flexDirection: 'column',
      gap: 12,
      maxWidth: 400,
      width: 'calc(100vw - 48px)',
      pointerEvents: 'none',
    }}>
      {activeDownloads.map(download => (
        <div
          key={download.client_id}
          className={`notification info`}
          style={{
            minWidth: 320,
            maxWidth: 400,
            pointerEvents: 'auto',
            margin: 0,
            boxShadow: '0 4px 16px rgba(0,0,0,0.18)',
            background: '#23223a',
            color: '#fff',
            alignItems: 'flex-start',
          }}
        >
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: '1.08rem', marginBottom: 2, display: 'flex', alignItems: 'center', gap: 8 }}>
              {download.state === 'resolving' && <FiLoader className="icon resolving" />}
              {download.state === 'downloading' && <FiDownload className="icon progress" />}
              {download.state === 'completed' && <FiCheckCircle className="icon completed" />}
              {download.state === 'failed' && <FiAlertCircle className="icon failed" />}
              {download.title}
            </div>
            <div style={{ fontSize: '0.97rem', color: '#bfa16c', marginBottom: 4 }}>{download.author}</div>
            <div style={{ height: 8, background: '#444', borderRadius: 4, overflow: 'hidden', marginBottom: 6 }}>
              <div
                style={{
                  width: `${Math.round((download.progress?.percent || 0) * 100)}%`,
                  height: 8,
                  background: '#bfa16c',
                  transition: 'width 0.2s',
                }}
              />
            </div>
            <div style={{ fontSize: '0.92rem', color: '#ccc', marginBottom: 4 }}>
              {download.state === 'downloading' && download.progress?.total > 0 && (
                <>
                  {`${(download.progress.transferred / 1024 / 1024).toFixed(2)}MB / ${(download.progress.total / 1024 / 1024).toFixed(2)}MB`}
                </>
              )}
              {download.state === 'resolving' && 'Resolving...'}
              {download.state === 'failed' && 'Failed'}
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
              {download.state === 'downloading' && (
                <button
                  style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', fontSize: 18 }}
                  onClick={() => handleCancelDownload(download.client_id, download.title)}
                  title="Cancel"
                >
                  <FiXCircle /> Cancel
                </button>
              )}
              {download.state === 'completed' && (
                <>
                  <button
                    style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', fontSize: 18 }}
                    onClick={() => handleOpenFile(download.filename)}
                    title="Open File"
                  >
                    <FiDownload /> Open
                  </button>
                  <button
                    style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', fontSize: 18 }}
                    onClick={() => handleOpenFolder(download.filename)}
                    title="Open Folder"
                  >
                    <FiFolder /> Folder
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      ))}
      {/* Show download complete/failed messages */}
      {Object.keys(shownMessages).map(clientId => {
        const download = downloads.find(d => d.client_id === clientId);
        if (!download) return null;
        return (
          <div
            key={clientId}
            className={`notification ${download.state === 'completed' ? 'success' : 'error'}`}
            style={{
              minWidth: 320,
              maxWidth: 400,
              pointerEvents: 'auto',
              margin: 0,
              boxShadow: '0 4px 16px rgba(0,0,0,0.18)',
              background: download.state === 'completed' ? '#28a745' : '#dc3545',
              color: '#fff',
              alignItems: 'flex-start',
            }}
          >
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: '1.08rem', marginBottom: 2, display: 'flex', alignItems: 'center', gap: 8 }}>
                {download.state === 'completed' && <FiCheckCircle className="icon completed" />}
                {download.state === 'failed' && <FiAlertCircle className="icon failed" />}
                {download.title}
              </div>
              <div style={{ fontSize: '0.97rem', color: '#fff', marginBottom: 4 }}>
                {download.state === 'completed' ? 'Download complete' : 'Download failed'}
              </div>
              {download.state === 'completed' && download.path && (
                <button
                  style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', fontSize: 18, marginTop: 4 }}
                  onClick={() => handleOpenFolder(download.path)}
                  title="Show in Folder"
                >
                  <FiFolder /> Show in Folder
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default DownloadPopupManager; 