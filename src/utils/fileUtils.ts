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

/**
 * Resolves the direct Libgen download link for a given md5 by fetching ads.php and parsing the get.php link.
 * Returns the full direct download URL, or throws if not found.
 */
export async function resolveLibgenDownloadLink(md5: string, baseUrl: string = 'https://libgen.bz'): Promise<string> {
  const adsUrl = `${baseUrl}/ads.php?md5=${md5}`;
  const res = await fetch(adsUrl);
  if (!res.ok) throw new Error(`Failed to fetch ads.php for md5: ${md5}`);
  const html = await res.text();
  // Find the get.php link (e.g. href="get.php?md5=...&key=...")
  const match = html.match(/href=["'](get\.php\?md5=[^"'&]+&key=[^"'&]+)["']/i);
  if (!match) throw new Error('Could not find get.php download link on ads.php page');
  const getLink = match[1];
  // Construct the full download URL
  return `${baseUrl}/${getLink}`;
}