export interface Book {
  client_id: string;
  id: string;
  title: string;
  author: string;
  publisher: string;
  year: string;
  language: string;
  pages: string;
  size: string;
  extension: string;
  cover_url: string;
  mirror_links: string[];
  description?: string;
  isbn?: string;
  publishedDate?: string;
  categories?: string[];
  averageRating?: number;
  thumbnail?: string;
  doi?: string;
}

export interface Download extends Book {
  filename: string;
  path: string;
  state: 'resolving' | 'downloading' | 'completed' | 'failed' | 'cancelled' | 'browser-download';
  progress: {
    percent: number;
    transferred: number;
    total: number;
  };
  startTime: number;
}

declare global {
  interface Window {
    electron: {
      platform: string;
      getVersion: () => Promise<string>;
      search: (query: string) => Promise<Book[]>;
      openLink: (link: string) => void;
      on: (channel: string, callback: (...args: any[]) => void) => void;
      minimize: () => void;
      maximize: () => void;
      close: () => void;
      download: (options: { book: Book }) => void;
      cancelDownload: (clientId: string) => void;
      openFile: (filename: string) => void;
      openFolder: (filename: string) => void;
      clearDownloads: () => void;
      getDownloads: () => Promise<Download[]>;
      onDownloadsUpdated: (callback: (downloads: Download[]) => void) => void;
      onDownloadProgress: (callback: (progress: { clientId: string; progress: any }) => void) => void;
    };
  }
}
