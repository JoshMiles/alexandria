import React, { createContext, useState, useEffect, useContext, useCallback } from 'react';
import { Download, Book } from '../types';

interface DownloadContextType {
  downloads: Download[];
  handleDownload: (book: Book) => void;
  handleCancelDownload: (clientId: string, title: string) => void;
  handleOpenFile: (filename: string) => void;
  handleOpenFolder: (filename: string) => void;
  handleClearDownloads: () => void;
  setNotification: (notification: { id: string; message: string; type: 'success' | 'error' | 'info' } | null) => void;
}

const DownloadContext = createContext<DownloadContextType | undefined>(undefined);

export const DownloadProvider: React.FC = ({ children }) => {
  const [downloads, setDownloads] = useState<Download[]>([]);
  const [notification, setNotification] = useState<{ id: string; message: string; type: 'success' | 'error' | 'info' } | null>(null);

  useEffect(() => {
    window.electron.getDownloads().then((initialDownloads) => {
      const normalizedDownloads = initialDownloads.map((d) => ({
        ...d,
        progress: d.progress || { percent: 0, transferred: 0, total: 0 },
      }));
      setDownloads(normalizedDownloads);
    });
    window.electron.onDownloadsUpdated((updatedDownloads) => {
      const normalizedDownloads = updatedDownloads.map((d) => ({
        ...d,
        progress: d.progress || { percent: 0, transferred: 0, total: 0 },
      }));
      setDownloads(normalizedDownloads);
    });
    window.electron.onDownloadProgress(({ clientId, progress }) => {
      setDownloads((prevDownloads) =>
        prevDownloads.map((d) =>
          d.client_id === clientId
            ? { ...d, progress, state: 'downloading' }
            : d
        )
      );
    });
  }, []);

  const handleDownload = useCallback((book: Book) => {
    const newDownload: Download = {
      ...book,
      state: 'resolving',
      progress: { percent: 0, transferred: 0, total: 0 },
      startTime: Date.now(),
      filename: '',
      path: '',
    };
    setDownloads((prevDownloads) => [...prevDownloads, newDownload]);
    window.electron.download({ book });
  }, []);

  const handleCancelDownload = useCallback((clientId: string, title: string) => {
    window.electron.cancelDownload(clientId);
    setDownloads((prevDownloads) =>
      prevDownloads.map((d) =>
        d.client_id === clientId ? { ...d, state: 'cancelled' } : d
      )
    );
    setNotification({
      id: 'download-cancelled',
      message: `Download for "${title}" cancelled.`,
      type: 'info',
    });
  }, []);

  const handleOpenFile = useCallback((filename: string) => {
    window.electron.openFile(filename);
  }, []);

  const handleOpenFolder = useCallback((filename: string) => {
    window.electron.openFolder(filename);
  }, []);

  const handleClearDownloads = useCallback(async () => {
    await window.electron.clearDownloads();
    setDownloads((prev) => prev.filter(d => d.state === 'downloading' || d.state === 'resolving'));
  }, []);

  return (
    <DownloadContext.Provider
      value={{
        downloads,
        handleDownload,
        handleCancelDownload,
        handleOpenFile,
        handleOpenFolder,
        handleClearDownloads,
        setNotification,
      }}
    >
      {children}
    </DownloadContext.Provider>
  );
};

export const useDownloads = () => {
  const context = useContext(DownloadContext);
  if (!context) {
    throw new Error('useDownloads must be used within a DownloadProvider');
  }
  return context;
};

