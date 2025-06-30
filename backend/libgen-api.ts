import axios from 'axios';
import * as cheerio from 'cheerio';
import { BrowserWindow } from 'electron';
import type log from 'electron-log';
import { SocksProxyAgent } from 'socks-proxy-agent';

// Constants
const API_URLS = {
  LIBGEN: "https://libgen.li",
  GOOGLE_BOOKS: "https://www.googleapis.com/books/v1/volumes",
  CROSSREF: "https://api.crossref.org/works",
  SCIHUB: "https://sci-hub.box",
  ANNAS_ARCHIVE: "https://annas-archive.org"
} as const;

interface Book {
    id: string;
    client_id?: string;
    title?: string;
    author?: string;
    publisher?: string;
    year?: string;
    language?: string;
    pages?: string;
    size?: string;
    extension?: string;
    cover_url?: string;
    mirror_links?: string[];
    isbn?: string;
    description?: string;
    publishedDate?: string;
    categories?: string[];
    averageRating?: number;
    thumbnail?: string;
    doi?: string;
}

// Add a list of LibGen mirrors and a proxy generator
const LIBGEN_MIRRORS = [
    'https://libgen.li',
    'https://libgen.gs',
    'https://libgen.vg',
    'https://libgen.la',
    'https://libgen.bz',
    'https://libgen.gl',
];

// Performance optimizations: Caching and connection pooling
const httpCache = new Map<string, { data: any; timestamp: number; ttl: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const MAX_CONCURRENT_REQUESTS = 3;
const requestQueue: Array<() => Promise<any>> = [];
let activeRequests = 0;

// Request queue manager for rate limiting
const executeRequest = async <T>(requestFn: () => Promise<T>): Promise<T> => {
  if (activeRequests >= MAX_CONCURRENT_REQUESTS) {
    return new Promise((resolve, reject) => {
      requestQueue.push(async () => {
        try {
          const result = await requestFn();
          resolve(result);
        } catch (error) {
          reject(error);
        }
      });
    });
  }

  activeRequests++;
  try {
    const result = await requestFn();
    return result;
  } finally {
    activeRequests--;
    if (requestQueue.length > 0) {
      const nextRequest = requestQueue.shift();
      if (nextRequest) {
        executeRequest(nextRequest);
      }
    }
  }
};

// Cache management
const getCachedData = (key: string) => {
  const cached = httpCache.get(key);
  if (cached && Date.now() - cached.timestamp < cached.ttl) {
    return cached.data;
  }
  if (cached) {
    httpCache.delete(key);
  }
  return null;
};

const setCachedData = (key: string, data: any, ttl: number = CACHE_TTL) => {
  httpCache.set(key, { data, timestamp: Date.now(), ttl });
  
  // Cleanup old cache entries
  if (httpCache.size > 100) {
    const now = Date.now();
    for (const [cacheKey, value] of httpCache.entries()) {
      if (now - value.timestamp > value.ttl) {
        httpCache.delete(cacheKey);
      }
    }
  }
};

/**
 * Makes HTTP GET requests with error handling, retry logic, and caching
 */
const httpGet = async (url: string, responseType: 'text' | 'json' = 'text', logger: typeof log, retries: number = 3, useCache: boolean = true): Promise<any> => {
    const cacheKey = `${url}-${responseType}`;
    
    if (useCache) {
      const cached = getCachedData(cacheKey);
      if (cached) {
        logger.info(`Cache hit for: ${url}`);
        return cached;
      }
    }

    logger.info(`Making HTTP GET request to: ${url}`);
    
    return executeRequest(async () => {
      let lastError: any;
      for (let attempt = 1; attempt <= retries; attempt++) {
        try {
          const response = await axios.get(url, { 
            responseType,
            timeout: 30000, // 30 second timeout
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            }
          });
          logger.info(`Successfully fetched data from: ${url} (attempt ${attempt})`);
          
          if (useCache) {
            setCachedData(cacheKey, response.data);
          }
          
          return response.data;
        } catch (error) {
          lastError = error;
          logger.error(`Error fetching ${url} (attempt ${attempt}):`, error);
          
          if (attempt < retries) {
            const delay = Math.pow(2, attempt - 1) * 1000; // Exponential backoff
            logger.info(`Retrying request to ${url} in ${delay}ms...`);
            await new Promise(resolve => setTimeout(resolve, delay));
          }
        }
      }
      
      throw lastError;
    });
};

const sendStatusUpdate = (win: BrowserWindow, message: string, logger: typeof log) => {
    if (win) {
        logger.info(`Sending search status update: ${message}`);
        win.webContents.send('search-status', message);
    }
};

/**
 * Fetches Google Books information for a given ISBN with error handling and caching
 */
const getGoogleBookInfo = async (isbn: string, logger: typeof log) => {
    if (!isbn) return null;
    
    const url = `${API_URLS.GOOGLE_BOOKS}?q=isbn:${isbn}`;
    logger.info(`Fetching Google Books info for ISBN: ${isbn}`);
    
    try {
        const data = await httpGet(url, 'json', logger, 2, true);
        if (data.totalItems > 0) {
            const volumeInfo = data.items[0].volumeInfo;
            logger.info(`Found Google Books info for ISBN: ${isbn}`);
            return {
                authors: volumeInfo.authors || [],
                description: volumeInfo.description,
                pages: volumeInfo.pageCount,
                publisher: volumeInfo.publisher,
                publishedDate: volumeInfo.publishedDate,
                categories: volumeInfo.categories || [],
                averageRating: volumeInfo.averageRating,
                thumbnail: volumeInfo.imageLinks?.thumbnail,
            };
        }
        logger.warn(`No Google Books info found for ISBN: ${isbn}`);
    } catch (error) {
        logger.error(`Error fetching Google Books info for ISBN ${isbn}:`, error);
    }
    return null;
};

const extractIsbnFromMeta = (meta: any, logger: typeof log) => {
    try {
        const addNode = meta.add;
        if (!addNode || typeof addNode !== 'object') return null;
        for (const key in addNode) {
            const item = addNode[key];
            if (item && typeof item === 'object' && item.name_en === 'ISBN') {
                const isbn = item.value?.split(',')[0].trim();
                logger.info(`Extracted ISBN: ${isbn}`);
                return isbn;
            }
        }
    } catch (error) {
        logger.error('Error extracting ISBN from metadata:', error);
    }
    return null;
};

const parseInitialSearchResults = (html: string, logger: typeof log): Book[] => {
    logger.info('Parsing initial search results from HTML.');
    const $ = cheerio.load(html);
    const results: Book[] = [];
    const tables = $('table');
    if (tables.length < 2) {
        logger.warn('Could not find the results table in the HTML.');
        return results;
    }

    tables.eq(1).find('tr').slice(1).each((i, row) => {
        const cols = $(row).find('td');
        if (cols.length < 10) return;

        const editLink = cols.eq(0).find('a[href*="edition.php"]');
        const bookIdMatch = editLink.attr('href')?.match(/id=(\d+)/);
        if (!bookIdMatch) return;

        results.push({
            id: bookIdMatch[1],
            author: cols.eq(1).text().trim(), // Store table author directly
            publisher: cols.eq(3).text().trim(),
            year: cols.eq(4).text().trim(),
            language: cols.eq(5).text().trim(),
            pages: cols.eq(6).text().trim(),
            size: cols.eq(7).text().trim(),
            extension: cols.eq(8).text().trim(),
            cover_url: cols.eq(0).find('img').attr('src') || '',
            mirror_links: cols.eq(9).find('a').map((i, a) => $(a).attr('href')).get(),
        });
    });
    logger.info(`Parsed ${results.length} initial search results.`);
    return results;
};

const searchByDoi = async (win: BrowserWindow, doi: string, logger: typeof log): Promise<Book[]> => {
    logger.info(`Searching by DOI: ${doi}`);
    const crossrefUrl = `https://api.crossref.org/works/${doi}`;
    const annasUrl = `https://annas-archive.org/scidb/${doi}`;

    try {
        logger.info(`Fetching metadata from Crossref for DOI: ${doi}`);
        const metadata = await httpGet(crossrefUrl, 'json', logger, 2, true);
        if (metadata.status !== 'ok') {
            logger.error(`Could not retrieve metadata for DOI ${doi} from Crossref.`);
            return [];
        }

        const message = metadata.message;
        const title = message.title && message.title.length > 0 ? message.title[0] : 'No title found';
        const author = message.author && message.author.length > 0 ? message.author.map((a: any) => `${a.given} ${a.family}`).join(', ') : 'No author found';
        const publisher = message.publisher;
        const year = message.published ? new Date(message.published['date-parts'][0][0]).getFullYear().toString() : '';

        const book: Book = {
            id: doi,
            client_id: `${doi}-${Date.now()}`,
            title,
            author,
            publisher,
            year,
            language: 'English',
            pages: 'N/A',
            size: 'N/A',
            extension: 'pdf',
            cover_url: '',
            mirror_links: [annasUrl],
            doi: doi,
        };
        logger.info(`Successfully created book object from DOI metadata for: ${title}`);
        return [book];

    } catch (error) {
        logger.error(`Error processing DOI ${doi}:`, error);
        return [];
    }
}

// Optimized merge function with parallel processing
const mergeBookData = async (initialResults: Book[], metadata: any, logger: typeof log): Promise<Book[]> => {
    logger.info('Merging book data with metadata and Google Books info.');
    
    // Process books in parallel batches to avoid overwhelming APIs
    const batchSize = 5;
    const finalResults: Book[] = [];
    
    for (let i = 0; i < initialResults.length; i += batchSize) {
        const batch = initialResults.slice(i, i + batchSize);
        const batchPromises = batch.map(async (book) => {
            const meta = metadata[book.id];
            if (meta) {
                book.title = meta.title || 'Unknown Title';
                const isbn = extractIsbnFromMeta(meta, logger);
                book.isbn = isbn;

                // Only fetch Google Books info if we have an ISBN
                let googleInfo = null;
                if (isbn) {
                    googleInfo = await getGoogleBookInfo(isbn, logger);
                }

                // Robust author parsing
                let author = '';
                if (googleInfo?.authors?.length) {
                    author = googleInfo.authors.join(', ');
                } else if (Array.isArray(meta.author) && meta.author.length > 0) {
                    author = meta.author.join(', ');
                } else if (typeof meta.author === 'string') {
                    author = meta.author;
                } else if (book.author) {
                    author = book.author;
                } else {
                    author = 'Unknown Author';
                }
                book.author = author;

                if (googleInfo) {
                    book.description = googleInfo.description;
                    book.pages = googleInfo.pages || book.pages;
                    book.publisher = googleInfo.publisher || book.publisher;
                    book.publishedDate = googleInfo.publishedDate;
                    book.categories = googleInfo.categories;
                    book.averageRating = googleInfo.averageRating;
                    book.thumbnail = googleInfo.thumbnail;
                }
            }
            return book;
        });
        
        const batchResults = await Promise.all(batchPromises);
        finalResults.push(...batchResults);
    }
    
    logger.info('Finished merging book data.');
    return finalResults;
};

export const search = async (win: BrowserWindow, query: string, logger: typeof log): Promise<Book[]> => {
    const doiRegex = /10\.\d{4,9}\/[\-._;()\/:A-Z0-9]+$/i;
    if (doiRegex.test(query)) {
        logger.info(`DOI detected: ${query}`);
        sendStatusUpdate(win, 'DOI detected', logger);
        return searchByDoi(win, query, logger);
    }

    logger.info(`Searching for '${query}'...`);
    const encodedQuery = query.replace(/ /g, '+');
    let html = null;
    let usedDomain = null;
    let lastError = null;

    // Use LibGenAccessManager for search
    const searchPath = `/index.php?req=${encodedQuery}&columns%5B%5D=t&columns%5B%5D=a&columns%5B%5D=s&columns%5B%5D=y&columns%5B%5D=p&columns%5B%5D=i&objects%5B%5D=f&objects%5B%5D=e&objects%5B%5D=s&objects%5B%5D=a&objects%5B%5D=p&objects%5B%5D=w&topics%5B%5D=l&topics%5B%5D=f&res=100&covers=on&filesuns=all`;
    try {
        sendStatusUpdate(win, 'Connecting to LibGen...', logger);
        html = await libgenAccessManager.get(searchPath, 'text', logger);
        const currentMethod = libgenAccessManager.getCurrentMethod();
        sendStatusUpdate(win, `Successfully connected to ${currentMethod?.mirror || 'LibGen'}`, logger);
    } catch (error) {
        lastError = libgenAccessManager.getLastError() || (error as any)?.message || String(error);
        logger.error(`All mirrors and proxies failed for search:`, lastError);
        sendStatusUpdate(win, `All mirrors and proxy failed. Cannot reach LibGen. Error: ${lastError}`, logger);
        return [];
    }

    sendStatusUpdate(win, 'Parsing search results...', logger);
    const initialResults = parseInitialSearchResults(html, logger);
    if (initialResults.length === 0) {
        logger.warn(`No initial results for query: '${query}'`);
        return [];
    }

    const englishBooks = initialResults.filter(book => book.language?.toLowerCase() === 'english');
    const otherBooks = initialResults.filter(book => book.language?.toLowerCase() !== 'english');
    const sortedResults = [...englishBooks, ...otherBooks];

    const ids = sortedResults.map(book => book.id);
    // Use LibGenAccessManager for metadata
    const metadataPath = `/json.php?object=e&addkeys=*&ids=${ids.join(',')}`;
    let metadata;
    try {
        sendStatusUpdate(win, 'Fetching book metadata...', logger);
        metadata = await libgenAccessManager.get(metadataPath, 'json', logger);
    } catch (error) {
        lastError = libgenAccessManager.getLastError() || (error as any)?.message || String(error);
        logger.error(`Failed to fetch metadata:`, lastError);
        sendStatusUpdate(win, `Failed to fetch metadata. Error: ${lastError}`, logger);
        return [];
    }

    sendStatusUpdate(win, 'Enriching data with Google Books...', logger);
    const finalResults = await mergeBookData(sortedResults, metadata, logger);
    logger.info(`Search for '${query}' completed, returning ${finalResults.length} results.`);
    sendStatusUpdate(win, `Found ${finalResults.length} results for "${query}"`, logger);
    return finalResults;
};

/**
 * Searches for books on LibGen (and related sources) based on a query string.
 * 
 * - If the query matches a DOI pattern, it delegates to a DOI-specific search.
 * - Otherwise, it performs a standard LibGen search, prioritizing English results.
 * - Fetches initial search results, then retrieves detailed metadata for each book.
 * - Enriches results with Google Books data where available.
 * - Returns a list of Book objects with merged metadata.
 * 
 * @param win - The Electron BrowserWindow instance for sending status updates.
 * @param query - The search query (title, author, ISBN, or DOI).
 * @param logger - Logger instance for logging info, warnings, and errors.
 * @returns Promise<Book[]> - A promise resolving to an array of Book objects.
 */
export const getDownloadLinks = async (downloadPageUrl: string, logger: typeof log): Promise<string[]> => {
    logger.info(`Getting download links from page: ${downloadPageUrl}`);
    try {
        // Use LibGenAccessManager for download page
        let html;
        if (downloadPageUrl.startsWith('http') && downloadPageUrl.includes('libgen')) {
            const url = new URL(downloadPageUrl);
            html = await libgenAccessManager.get(url.pathname + url.search, 'text', logger);
        } else {
            // Fallback to old logic for Anna's Archive or other domains
            html = await httpGet(downloadPageUrl, 'text', logger, 2, false);
        }
        const $ = cheerio.load(html);

        if (downloadPageUrl.includes('annas-archive.org/scidb')) {
            const downloadLink = $('a[href^="/md5/"]').attr('href');
            if (downloadLink) {
                logger.info(`Found Anna's Archive download link: ${downloadLink}`);
                return [`https://annas-archive.org${downloadLink}`];
            }
            logger.warn(`No Anna's Archive download link found on ${downloadPageUrl}`);
            return [];
        }

        const directLink = $('a[href*="get.php"]').attr('href');
        if (directLink) {
            logger.info(`Found LibGen direct link: ${directLink}`);
            const currentMethod = libgenAccessManager.getCurrentMethod();
            const baseUrl = currentMethod?.mirror || API_URLS.LIBGEN;
            return [`${baseUrl}/${directLink}`];
        }
        logger.warn(`No LibGen direct link found on ${downloadPageUrl}`);
        return [];
    } catch (error) {
        const lastError = libgenAccessManager.getLastError() || (error as any)?.message || String(error);
        logger.error(`Error fetching download page ${downloadPageUrl}:`, lastError);
        return [];
    }
};

export const getSciHubDownloadLink = async (doi: string, logger: typeof log): Promise<string | null> => {
    const sciHubUrl = `https://sci-hub.box/${doi}`;
    logger.info(`Attempting to get Sci-Hub download link from: ${sciHubUrl}`);
    try {
        const html = await httpGet(sciHubUrl, 'text', logger, 2, false);
        const $ = cheerio.load(html);
        let pdfLink = $('#pdf').attr('src');
        logger.info(`Extracted PDF link from #pdf element: ${pdfLink}`);

        if (pdfLink) {
            if (pdfLink.startsWith('//')) {
                pdfLink = `https:${pdfLink}`;
            } else if (pdfLink.startsWith('/')) {
                pdfLink = `https://sci-hub.box${pdfLink}`;
            }
            
            logger.info(`Constructed Sci-Hub PDF link: ${pdfLink}`);
            return pdfLink;
        }
        
        logger.warn(`Could not find PDF link on Sci-Hub page for DOI: ${doi}`);
        return null;
    } catch (error) {
        logger.error(`Error fetching or parsing Sci-Hub page for DOI ${doi}:`, error);
        return null;
    }
};

export const resolveDirectDownloadLink = async (directLink: string, logger: typeof log): Promise<string> => {
    logger.info(`Resolving direct download link: ${directLink}`);
    try {
        let html;
        if (directLink.startsWith('http') && directLink.includes('libgen')) {
            const url = new URL(directLink);
            html = await libgenAccessManager.get(url.pathname + url.search, 'text', logger);
        } else {
            // Fallback to old logic for Anna's Archive or other domains
            html = await httpGet(directLink, 'text', logger, 2, false);
        }
        const $ = cheerio.load(html);
        const finalLink = $('a[href*="get.php"]').attr('href');
        if (finalLink) {
            const currentMethod = libgenAccessManager.getCurrentMethod();
            const baseUrl = currentMethod?.mirror || API_URLS.LIBGEN;
            const fullFinalLink = finalLink.startsWith('http') ? finalLink : `${baseUrl}/${finalLink}`;
            logger.info(`Resolved to final LibGen link: ${fullFinalLink}`);
            return fullFinalLink;
        }
        logger.warn(`Could not resolve a more direct link from ${directLink}. Returning original.`);
        return directLink;
    } catch (error) {
        const lastError = libgenAccessManager.getLastError() || (error as any)?.message || String(error);
        logger.error(`Error resolving direct link ${directLink}:`, lastError);
        return directLink;
    }
};

// LibGenAccessManager class and singleton (moved from libgenAccessManager.ts)
class LibGenAccessManager {
  mirrors: string[];
  lastSuccessful: { mirror: string | null };
  lastError: string | null;

  constructor() {
    this.mirrors = [...LIBGEN_MIRRORS];
    this.lastSuccessful = { mirror: null };
    this.lastError = null;
  }

  addMirror(url: string) {
    if (!this.mirrors.includes(url)) {
      this.mirrors.push(url);
    }
  }

  removeMirror(url: string) {
    this.mirrors = this.mirrors.filter(m => m !== url);
    if (this.lastSuccessful.mirror && this.lastSuccessful.mirror === url) {
      this.reset();
    }
  }

  async get(path: string, responseType: 'text' | 'json', logger: typeof log): Promise<any> {
    // Try last successful first
    if (this.lastSuccessful.mirror) {
      try {
        const url = `${this.lastSuccessful.mirror}${path}`;
        logger.info(`[LibGenAccessManager] Trying last successful mirror: ${url}`);
        const response = await axios.get(url, { 
          responseType, 
          timeout: 30000,
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
          }
        });
        this.lastError = null;
        return response.data;
      } catch (error) {
        logger.error(`[LibGenAccessManager] Last successful mirror failed:`, {
          error: (typeof error === 'object' && error && 'message' in error) ? error.message : error,
          url: `${this.lastSuccessful.mirror}${path}`,
          type: 'direct',
        });
        this.lastError = String((typeof error === 'object' && error && 'message' in error) ? error.message : error);
        this.lastSuccessful = { mirror: null };
      }
    }
    // Try all mirrors directly
    for (const mirror of this.mirrors) {
      try {
        const url = `${mirror}${path}`;
        logger.info(`[LibGenAccessManager] Trying mirror directly: ${url}`);
        const response = await axios.get(url, { 
          responseType, 
          timeout: 30000,
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
          }
        });
        this.lastSuccessful = { mirror };
        this.lastError = null;
        return response.data;
      } catch (error) {
        logger.error(`[LibGenAccessManager] Mirror direct connection failed:`, {
          error: (typeof error === 'object' && error && 'message' in error) ? error.message : error,
          url: `${mirror}${path}`,
          type: 'direct',
        });
        this.lastError = String((typeof error === 'object' && error && 'message' in error) ? error.message : error);
      }
    }
    throw new Error(this.lastError || 'All mirrors failed');
  }

  getCurrentMethod() {
    return this.lastSuccessful;
  }

  async getAllMethods() {
    return {
      mirrors: this.mirrors,
    };
  }

  getLastError() {
    return this.lastError;
  }

  reset() {
    this.lastSuccessful = { mirror: null };
    this.lastError = null;
  }
}

const libgenAccessManager = new LibGenAccessManager();

// Export IPC helpers for main.js
export async function getLibgenAccessInfo() {
  const methods = await libgenAccessManager.getAllMethods();
  return {
    mirrors: methods.mirrors,
    currentMethod: libgenAccessManager.getCurrentMethod(),
    lastError: libgenAccessManager.getLastError(),
  };
}

// New function to test LibGen access with detailed status updates
export async function testLibgenAccess(win: BrowserWindow, logger: typeof log): Promise<{ success: boolean; workingMirror: string | null; error: string | null }> {
  logger.info('Starting LibGen access test...');
  
  // Test the main domain first
  sendStatusUpdate(win, 'Testing main LibGen domain...', logger);
  try {
    const response = await axios.get(`${API_URLS.LIBGEN}/index.php`, {
      timeout: 10000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });
    if (response.status === 200) {
      logger.info('Main LibGen domain is accessible');
      sendStatusUpdate(win, 'Main LibGen domain is working!', logger);
      libgenAccessManager.lastSuccessful = { mirror: API_URLS.LIBGEN };
      libgenAccessManager.lastError = null;
      return { success: true, workingMirror: API_URLS.LIBGEN, error: null };
    }
  } catch (error) {
    logger.warn('Main LibGen domain is not accessible, trying mirrors...');
    sendStatusUpdate(win, 'Main domain unavailable, testing mirrors...', logger);
  }

  // Test each mirror
  const mirrors = libgenAccessManager.mirrors;
  for (let i = 0; i < mirrors.length; i++) {
    const mirror = mirrors[i];
    sendStatusUpdate(win, `Testing mirror ${i + 1}/${mirrors.length}: ${new URL(mirror).hostname}`, logger);
    
    try {
      const response = await axios.get(`${mirror}/index.php`, {
        timeout: 10000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
      });
      
      if (response.status === 200) {
        logger.info(`Mirror ${mirror} is working`);
        sendStatusUpdate(win, `Found working mirror: ${new URL(mirror).hostname}`, logger);
        libgenAccessManager.lastSuccessful = { mirror };
        libgenAccessManager.lastError = null;
        return { success: true, workingMirror: mirror, error: null };
      }
    } catch (error) {
      const errorMsg = (error as any)?.message || 'Connection failed';
      logger.warn(`Mirror ${mirror} failed: ${errorMsg}`);
      libgenAccessManager.lastError = errorMsg;
    }
  }

  // All mirrors failed
  const errorMsg = 'All LibGen mirrors are currently unavailable';
  logger.error(errorMsg);
  sendStatusUpdate(win, errorMsg, logger);
  libgenAccessManager.lastSuccessful = { mirror: null };
  return { success: false, workingMirror: null, error: errorMsg };
}

export function resetLibgenAccessMethod() {
  libgenAccessManager.reset();
  return true;
}

export function addLibgenMirror(url: string) {
  libgenAccessManager.addMirror(url);
  return getLibgenAccessInfo();
}

export function removeLibgenMirror(url: string) {
  libgenAccessManager.removeMirror(url);
  return getLibgenAccessInfo();
}
