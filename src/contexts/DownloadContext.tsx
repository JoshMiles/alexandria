import React, { createContext, useState, useEffect, useContext, useCallback } from 'react';
import { Download, Book } from '../types';

interface DownloadContextType {
  downloads: Download[];
  handleDownload: (book: Book) => void;
  handleCancelDownload: (clientId: string) => void;
  handleOpenFile: (filename: string) => void;
  handleOpenFolder: (filename: string) => void;
  handleClearDownloads: () => void;
}

const DownloadContext = createContext<DownloadContextType | undefined>(undefined);

export const DownloadProvider: React.FC = ({ children }) => {
  const [downloads, setDownloads] = useState<Download[]>([]);

  useEffect(() => {
    window.electron.getDownloads().then(setDownloads);
    window.electron.onDownloadsUpdated((updatedDownloads) => {
      setDownloads(updatedDownloads);
    });
    window.electron.onDownloadProgress(({ clientId, progress }) => {
      setDownloads((prevDownloads) =>
        prevDownloads.map((d) =>
          d.client_id === clientId ? { ...d, ...progress, state: 'downloading' } : d
        )
      );
    });
  }, []);

  const handleDownload = useCallback((book: Book) => {
    window.electron.download({ book });
  }, []);

  const handleCancelDownload = useCallback((clientId: string) => {
    window.electron.cancelDownload(clientId);
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
