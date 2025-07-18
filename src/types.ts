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
  description?: string;
  /**
   * ISBN(s) for the book. May be a single ISBN or multiple comma-separated ISBNs.
   * The frontend will display only the first valid ISBN.
   */
  isbn?: string;
  asin?: string;
  publishedDate?: string;
  categories?: string[];
  averageRating?: number;
  thumbnail?: string;
  doi?: string;
  source?: string;
  edition?: string;
  series?: string;
  translator?: string;
  original_title?: string;
  identifier?: string;
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

export interface ElectronAPI {
  platform: string;
  minimize: () => void;
  maximize: () => void;
  close: () => void;
  search: (query: string) => Promise<any>;
  download: (options: any) => Promise<any>;
  getDownloadLinks: (link: string) => Promise<any>;
  resolve: (link: string) => Promise<any>;
  openLink: (link: string) => void;
  getDownloads: () => Promise<any>;
  clearDownloads: () => Promise<any>;
  cancelDownload: (clientId: string) => Promise<any>;
  openFile: (filename: string) => Promise<any>;
  openFolder: (filename: string) => Promise<any>;
  openLogsFolder: () => Promise<any>;
  getLatestLog: () => Promise<string>;
  onLogUpdate: (callback: (line: string) => void) => void;
  offLogUpdate?: (callback: (line: string) => void) => void;
  on: (channel: string, callback: (...args: any[]) => void) => void;
  onDownloadsUpdated: (callback: (...args: any[]) => void) => void;
  onDownloadProgress: (callback: (...args: any[]) => void) => void;
  getDownloadLocation: () => Promise<string | null>;
  getVersion: () => Promise<string>;
  checkForUpdates: () => Promise<any>;
  clearAppData: () => Promise<any>;
  invoke?: (channel: string, ...args: any[]) => Promise<any>;
  log: (level: string, message: string, meta?: any) => Promise<any>;
  getNYTBestsellers: () => Promise<{ fiction: any[]; nonfiction: any[] }>;
}

declare global {
  interface Window {
    electron: ElectronAPI;
  }
}
