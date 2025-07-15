import React, { createContext, useState, useEffect, useContext, useCallback } from 'react';
import { Download, Book } from '../types';
import { generateClientId } from '../utils/fileUtils';

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

export const DownloadProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [downloads, setDownloads] = useState<Download[]>([]);
  const [notification, setNotification] = useState<{ id: string; message: string; type: 'success' | 'error' | 'info' } | null>(null);

  useEffect(() => {
    window.electron.getDownloads().then((initialDownloads) => {
      const normalizedDownloads = initialDownloads.map((d: Download) => ({
        ...d,
        progress: d.progress || { percent: 0, transferred: 0, total: 0 },
      }));
      setDownloads(normalizedDownloads.sort((a: Download, b: Download) => b.startTime - a.startTime));
    });
    window.electron.onDownloadsUpdated((updatedDownloads) => {
      const normalizedDownloads = updatedDownloads.map((d: Download) => ({
        ...d,
        progress: d.progress || { percent: 0, transferred: 0, total: 0 },
      }));
      setDownloads(normalizedDownloads.sort((a: Download, b: Download) => b.startTime - a.startTime));
    });
    window.electron.onDownloadProgress(({ clientId, progress }) => {
      setDownloads((prevDownloads) =>
        prevDownloads
          .map((d: Download) =>
            d.client_id === clientId
              ? { ...d, progress, state: 'downloading' as Download['state'] }
              : d
          )
          .sort((a: Download, b: Download) => b.startTime - a.startTime)
      );
    });
  }, []);

  const handleDownload = useCallback((book: Book) => {
    // If this is a file from a combined edition, generate a unique client_id
    const clientId = generateClientId();
    // Safely extract downloadLinks if present
    let downloadLinks: string[] | undefined = undefined;
    if ('downloadLinks' in book && Array.isArray((book as any).downloadLinks)) {
      const links = (book as any).downloadLinks;
      if (links.length > 0 && typeof links[0] === 'object' && links[0] !== null && 'url' in links[0]) {
        downloadLinks = links.map((link: any) => link.url);
      } else if (typeof links[0] === 'string') {
        downloadLinks = links;
      }
    }
    const newDownload: Download = {
      ...book,
      client_id: clientId,
      state: 'resolving',
      progress: { percent: 0, transferred: 0, total: 0 },
      startTime: Date.now(),
      filename: '',
      path: '',
      ...(downloadLinks ? { downloadLinks } : {}),
    } as Download;
    setDownloads((prevDownloads) => [newDownload, ...prevDownloads].sort((a: Download, b: Download) => b.startTime - a.startTime));
    window.electron.download({ book: { ...book, client_id: clientId, ...(downloadLinks ? { downloadLinks } : {}) } });
  }, []);

  const handleCancelDownload = useCallback((clientId: string, title: string) => {
    window.electron.cancelDownload(clientId);
    setDownloads((prevDownloads) =>
      prevDownloads.map((d: Download) =>
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

