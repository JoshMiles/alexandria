import { Book } from '../types';

/**
 * Sanitizes a filename by removing invalid characters
 */
export const sanitizeFilename = (filename: string): string => {
  return filename.replace(/[^\w\s.-]/g, '').trim();
};

/**
 * Generates a filename for a book download
 */
export const generateBookFilename = (book: Book): string => {
  const rawFileName = `${book.title} - ${book.author} (${book.year}) (${book.language}).${book.extension}`;
  return sanitizeFilename(rawFileName);
};

/**
 * Extracts domain from URL
 */
export const extractDomain = (url: string): string => {
  try {
    return new URL(url).hostname;
  } catch {
    return 'unknown';
  }
};

/**
 * Formats file size in human readable format
 */
export const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

/**
 * Creates a unique client ID for downloads
 */
export const generateClientId = (): string => {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

/**
 * Checks if a string is a valid DOI
 */
export const isDoi = (query: string): boolean => {
  const doiRegex = /10\.\d{4,9}\/[-._;()/:A-Z0-9]+$/i;
  return doiRegex.test(query);
};