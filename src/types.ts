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
}

export interface Download extends Book {
  filename: string;
  path: string;
  state: 'resolving' | 'downloading' | 'completed' | 'failed';
  percent: number;
  transferredBytes: number;
  totalBytes: number;
  startTime: number;
}

declare global {
  interface Window {
    electron: {
      getVersion: () => Promise<string>;
    };
  }
}
