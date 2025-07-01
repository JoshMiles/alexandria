import axios from 'axios';
import * as cheerio from 'cheerio';
import { BrowserWindow } from 'electron';
import type log from 'electron-log';
import { SocksProxyAgent } from 'socks-proxy-agent';

// Constants
const API_URLS = {
  LIBGEN: "https://libgen.is",
  LIBGEN_FICTION: "https://libgen.is/fiction",
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
    asin?: string;
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

// Add a list of LibGen fiction mirrors
const LIBGEN_FICTION_MIRRORS = [
    'https://libgen.is',
    'https://libgen.rs',
    'https://libgen.st',
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

// Cover image cache
const coverCache = new Map<string, string>();

/**
 * Fetches the cover image URL from the /fiction/[md5] page
 */
const fetchFictionCoverUrl = async (md5: string, logger: typeof log): Promise<string | null> => {
    if (coverCache.has(md5)) {
        return coverCache.get(md5)!;
    }
    try {
        const url = `${API_URLS.LIBGEN_FICTION}/${md5}`;
        const html = await httpGet(url, 'text', logger, 2, true);
        const $ = cheerio.load(html);
        // Find the image with src containing 'fictioncovers'
        const img = $('img[src*="fictioncovers"]');
        if (img.length > 0) {
            let src = img.attr('src');
            if (src && !src.startsWith('http')) {
                // Make absolute
                src = `${API_URLS.LIBGEN}${src}`;
            }
            coverCache.set(md5, src!);
            return src!;
        }
    } catch (error) {
        logger.warn(`Could not fetch cover for md5 ${md5}:`, error);
    }
    return null;
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
            const saleInfo = data.items[0].saleInfo;
            logger.info(`Found Google Books info for ISBN: ${isbn}`);
            
            // Extract ASIN from industry identifiers
            let asin = null;
            if (volumeInfo.industryIdentifiers) {
                const asinIdentifier = volumeInfo.industryIdentifiers.find(
                    (id: any) => id.type === 'ASIN'
                );
                if (asinIdentifier) {
                    asin = asinIdentifier.identifier;
                    logger.info(`Extracted ASIN: ${asin} for ISBN: ${isbn}`);
                }
            }
            
            return {
                authors: volumeInfo.authors || [],
                description: volumeInfo.description,
                pages: volumeInfo.pageCount,
                publisher: volumeInfo.publisher,
                publishedDate: volumeInfo.publishedDate,
                categories: volumeInfo.categories || [],
                averageRating: volumeInfo.averageRating,
                thumbnail: volumeInfo.imageLinks?.thumbnail,
                asin: asin,
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
    
    // Find the main results table with class "catalog"
    const table = $('table.catalog');
    if (!table.length) {
        logger.warn('Could not find table with class "catalog" in the HTML.');
        return results;
    }
    
    // Parse each row in the table body
    const rows = table.find('tbody tr');
    logger.info(`Found ${rows.length} data rows in catalog table`);
    
    rows.each((i, row) => {
        const cols = $(row).find('td');
        
        if (cols.length < 7) {
            return; // Skip rows with insufficient columns
        }

        try {
            // Column 0: Authors (ul.catalog_authors)
            const authorsList = cols.eq(0).find('ul.catalog_authors li a');
            const authors = authorsList.map((j, author) => $(author).text().trim()).get();
            const author = authors.join(', ');
            
            // Column 1: Series
            const series = cols.eq(1).text().trim();
            
            // Column 2: Title (with fiction link)
            const titleElement = cols.eq(2).find('p a[href*="/fiction/"]');
            const title = titleElement.text().trim();
            
            // Extract MD5 ID from fiction link
            const fictionLink = titleElement.attr('href');
            if (!fictionLink) {
                return;
            }
            
            const md5Match = fictionLink.match(/\/fiction\/([A-F0-9]+)/);
            if (!md5Match) {
                return;
            }
            
            const md5Id = md5Match[1];
            
            // Extract ISBN from catalog_identifier
            const isbnElement = cols.eq(2).find('p.catalog_identifier');
            let isbn = '';
            if (isbnElement.length > 0) {
                const isbnText = isbnElement.text();
                const isbnMatch = isbnText.match(/ISBN:\s*([0-9,\-\s]+)/);
                if (isbnMatch) {
                    isbn = isbnMatch[1].split(',')[0].trim(); // Take first ISBN
                }
            }
            
            // Column 3: Language
            const language = cols.eq(3).text().trim();
            
            // Column 4: File (format and size)
            const fileText = cols.eq(4).text().trim();
            const fileMatch = fileText.match(/(\w+)\s*\/\s*([0-9.]+)\s*(\w+)/);
            const extension = fileMatch ? fileMatch[1].toLowerCase() : 'unknown';
            const size = fileMatch ? `${fileMatch[2]} ${fileMatch[3]}` : fileText;
            
            // Column 5: Mirrors (ul.record_mirrors_compact)
            const downloadLinks: string[] = [];
            cols.eq(5).find('ul.record_mirrors_compact li a').each((j, link) => {
                const href = $(link).attr('href');
                if (href) {
                    downloadLinks.push(href);
                }
            });

            // Create book object
            const book: Book = {
                id: md5Id,
                title: title || 'Unknown Title',
                author: author || 'Unknown Author',
                language: language || 'Unknown',
                extension: extension,
                size: size,
                isbn: isbn,
                cover_url: `/fiction/${md5Id}`,
                mirror_links: downloadLinks,
                publisher: '',
                year: '',
                pages: '',
            };
            // Set initial cover URL (will be updated if found)
            book.thumbnail = `https://libgen.is/covers/fictioncovers/${md5Id}.jpg`;
            results.push(book);
            
        } catch (error) {
            logger.error(`Error parsing row ${i}:`, error);
        }
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

// Function to fetch metadata from individual book pages
const fetchBookMetadata = async (book: Book, logger: typeof log): Promise<Book> => {
    try {
        const url = `${API_URLS.LIBGEN_FICTION}/${book.id}`;
        const html = await httpGet(url, 'text', logger, 2, true);
        const $ = cheerio.load(html);
        
        // Extract title from the book info table
        const titleCell = $('td:contains("Title")').next();
        if (titleCell.length > 0) {
            book.title = titleCell.text().trim();
        } else {
            // Fallback: use <h1> only if it's not the site header
            const h1 = $('h1');
            if (h1.length > 0) {
                const h1Text = h1.text().trim();
                if (h1Text && h1Text !== 'Library Genesis: Fiction') {
                    book.title = h1Text;
                }
            }
        }
        
        // Extract author information
        const authorElement = $('a[href*="/fiction/?q=author:"]');
        if (authorElement.length > 0) {
            book.author = authorElement.text().trim();
        }
        
        // Extract publisher information
        const publisherElement = $('td:contains("Publisher")').next();
        if (publisherElement.length > 0) {
            book.publisher = publisherElement.text().trim();
        }
        
        // Extract year information
        const yearElement = $('td:contains("Year")').next();
        if (yearElement.length > 0) {
            book.year = yearElement.text().trim();
        }
        
        // Extract pages information
        const pagesElement = $('td:contains("Pages")').next();
        if (pagesElement.length > 0) {
            book.pages = pagesElement.text().trim();
        }
        
        // Extract description
        const descriptionElement = $('.description');
        if (descriptionElement.length > 0) {
            book.description = descriptionElement.text().trim();
        }
        
        // Try to fetch Google Books info if we have an ISBN
        if (book.isbn) {
            const googleInfo = await getGoogleBookInfo(book.isbn, logger);
            if (googleInfo) {
                book.description = googleInfo.description || book.description;
                book.pages = googleInfo.pages || book.pages;
                book.publisher = googleInfo.publisher || book.publisher;
                book.publishedDate = googleInfo.publishedDate;
                book.categories = googleInfo.categories;
                book.averageRating = googleInfo.averageRating;
                book.thumbnail = googleInfo.thumbnail || book.thumbnail;
                book.asin = googleInfo.asin;
            }
        }
        
        logger.info(`Fetched metadata for book: ${book.title}`);
    } catch (error) {
        logger.warn(`Failed to fetch metadata for book ${book.id}:`, error);
    }
    
    return book;
};

// Optimized merge function with parallel processing
const mergeBookData = async (initialResults: Book[], logger: typeof log): Promise<Book[]> => {
    logger.info('Merging book data with metadata and Google Books info.');
    
    // Process books in parallel batches to avoid overwhelming APIs
    const batchSize = 3; // Reduced batch size to avoid overwhelming the server
    const finalResults: Book[] = [];
    
    for (let i = 0; i < initialResults.length; i += batchSize) {
        const batch = initialResults.slice(i, i + batchSize);
        const batchPromises = batch.map(async (book) => {
            return await fetchBookMetadata(book, logger);
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
    
    // Use LibGenAccessManager for fiction search
    const searchPath = `/fiction/?q=${encodedQuery}`;
    let html = null;
    
    try {
        sendStatusUpdate(win, 'Connecting to LibGen Fiction...', logger);
        html = await libgenAccessManager.get(searchPath, 'text', logger);
        const currentMethod = libgenAccessManager.getCurrentMethod();
        sendStatusUpdate(win, `Successfully connected to ${currentMethod?.mirror || 'LibGen Fiction'}`, logger);
    } catch (error) {
        const lastError = libgenAccessManager.getLastError() || (error as any)?.message || String(error);
        logger.error(`All fiction mirrors failed for search:`, lastError);
        sendStatusUpdate(win, `All fiction mirrors failed. Cannot reach LibGen Fiction. Error: ${lastError}`, logger);
        return [];
    }

    sendStatusUpdate(win, 'Parsing search results...', logger);
    const initialResults = parseInitialSearchResults(html, logger);
    if (initialResults.length === 0) {
        logger.warn(`No results for query: '${query}'`);
        sendStatusUpdate(win, `No results found for "${query}"`, logger);
        return [];
    }

    // Sort results: English first, then others
    const englishBooks = initialResults.filter(book => book.language?.toLowerCase() === 'english');
    const otherBooks = initialResults.filter(book => book.language?.toLowerCase() !== 'english');
    const sortedInitialResults = [...englishBooks, ...otherBooks];

    // Fetch metadata and enrich with Google Books data
    sendStatusUpdate(win, 'Fetching book metadata...', logger);
    const enrichedResults = await mergeBookData(sortedInitialResults, logger);
    
    sendStatusUpdate(win, 'Enriching data with Google Books...', logger);

    logger.info(`Search for '${query}' completed, returning ${enrichedResults.length} results.`);
    sendStatusUpdate(win, `Found ${enrichedResults.length} results for "${query}"`, logger);
    return enrichedResults;
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
        // Special handling for libgen.li ads.php links
        if (downloadPageUrl.includes('libgen.li/ads.php?md5=')) {
            logger.info('Resolving libgen.li ads.php link for direct download...');
            const html = await httpGet(downloadPageUrl, 'text', logger, 2, false);
            const $ = cheerio.load(html);
            // Find the get.php link with &key
            const getLink = $('a[href*="get.php"][href*="key="]').attr('href');
            if (getLink) {
                const base = 'https://libgen.li';
                logger.info(`Resolved direct get.php link: ${base}${getLink}`);
                return [`${base}${getLink}`];
            }
            logger.warn('No get.php link with key found on ads.php page.');
            return [];
        }
        
        // For fiction books, prioritize the second mirror link (libgen.li ads.php)
        if (downloadPageUrl.includes('fiction/') || downloadPageUrl.includes('books.ms')) {
            // Extract the MD5 from the URL
            const md5Match = downloadPageUrl.match(/([A-F0-9]{32})/i);
            if (md5Match) {
                const md5 = md5Match[1];
                // Construct the libgen.li ads.php URL
                const libgenLiUrl = `https://libgen.li/ads.php?md5=${md5}`;
                logger.info(`Trying libgen.li ads.php link: ${libgenLiUrl}`);
                
                try {
                    const html = await httpGet(libgenLiUrl, 'text', logger, 2, false);
                    const $ = cheerio.load(html);
                                const getLink = $('a[href*="get.php"][href*="key="]').attr('href');
            if (getLink) {
                const base = 'https://libgen.li';
                const fullUrl = getLink.startsWith('http') ? getLink : `${base}/${getLink}`;
                logger.info(`Found get.php link from libgen.li: ${fullUrl}`);
                return [fullUrl];
            }
                } catch (error) {
                    logger.warn(`Failed to fetch libgen.li ads.php page: ${error}`);
                }
            }
        }
        
        // Use LibGenAccessManager for download page
        let html;
        if (downloadPageUrl.startsWith('http') && (downloadPageUrl.includes('libgen.is') || downloadPageUrl.includes('libgen.rs') || downloadPageUrl.includes('libgen.st'))) {
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

        // For fiction pages, look for direct download links
        const directLink = $('a[href*="get.php"]').attr('href');
        if (directLink) {
            logger.info(`Found LibGen direct link: ${directLink}`);
            const currentMethod = libgenAccessManager.getCurrentMethod();
            const baseUrl = currentMethod?.mirror || API_URLS.LIBGEN;
            return [`${baseUrl}/${directLink}`];
        }
        
        // Also check for other download patterns
        const downloadLinks: string[] = [];
        $('a[href*="download"], a[href*="get.php"], a[href*="dl.php"]').each((i, link) => {
            const href = $(link).attr('href');
            if (href) {
                const currentMethod = libgenAccessManager.getCurrentMethod();
                const baseUrl = currentMethod?.mirror || API_URLS.LIBGEN;
                const fullUrl = href.startsWith('http') ? href : `${baseUrl}${href}`;
                downloadLinks.push(fullUrl);
            }
        });
        
        if (downloadLinks.length > 0) {
            logger.info(`Found ${downloadLinks.length} download links`);
            return downloadLinks;
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
        // Special handling for libgen.li ads.php links
        if (directLink.includes('libgen.li/ads.php?md5=')) {
            logger.info('Resolving libgen.li ads.php link for direct download...');
            const html = await httpGet(directLink, 'text', logger, 2, false);
            const $ = cheerio.load(html);
            const getLink = $('a[href*="get.php"][href*="key="]').attr('href');
            if (getLink) {
                const base = 'https://libgen.li';
                const fullUrl = getLink.startsWith('http') ? getLink : `${base}/${getLink}`;
                logger.info(`Resolved direct get.php link: ${fullUrl}`);
                return fullUrl;
            }
            logger.warn('No get.php link with key found on ads.php page.');
            return directLink;
        }
        
        // For fiction downloads, try libgen.li ads.php first
        if (directLink.includes('fiction/') || directLink.includes('books.ms')) {
            // Extract the MD5 from the URL
            const md5Match = directLink.match(/([A-F0-9]{32})/i);
            if (md5Match) {
                const md5 = md5Match[1];
                // Try libgen.li ads.php first
                const libgenLiUrl = `https://libgen.li/ads.php?md5=${md5}`;
                logger.info(`Trying libgen.li ads.php for fiction download: ${libgenLiUrl}`);
                
                try {
                    const html = await httpGet(libgenLiUrl, 'text', logger, 2, false);
                    const $ = cheerio.load(html);
                    const getLink = $('a[href*="get.php"][href*="key="]').attr('href');
                    if (getLink) {
                        const base = 'https://libgen.li';
                        const fullUrl = getLink.startsWith('http') ? getLink : `${base}/${getLink}`;
                        logger.info(`Found get.php link from libgen.li: ${fullUrl}`);
                        return fullUrl;
                    }
                } catch (error) {
                    logger.warn(`Failed to fetch libgen.li ads.php page: ${error}`);
                }
                
                // Fallback to libgen.is fiction page
                const libgenIsUrl = `https://libgen.is/fiction/${md5}`;
                logger.info(`Fallback to libgen.is fiction page: ${libgenIsUrl}`);
                return libgenIsUrl;
            }
        }
        
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
            // Always use libgen.is for final downloads
            const baseUrl = 'https://libgen.is';
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
    this.mirrors = [...LIBGEN_FICTION_MIRRORS];
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
  logger.info('Starting LibGen Fiction access test...');
  
  // Test the main fiction domain first
  sendStatusUpdate(win, 'Testing main LibGen Fiction domain...', logger);
  try {
    const response = await axios.get(`${API_URLS.LIBGEN_FICTION}/?q=test`, {
      timeout: 10000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });
    if (response.status === 200) {
      logger.info('Main LibGen Fiction domain is accessible');
      sendStatusUpdate(win, 'Main LibGen Fiction domain is working!', logger);
      libgenAccessManager.lastSuccessful = { mirror: API_URLS.LIBGEN_FICTION };
      libgenAccessManager.lastError = null;
      return { success: true, workingMirror: API_URLS.LIBGEN_FICTION, error: null };
    }
  } catch (error) {
    logger.warn('Main LibGen Fiction domain is not accessible, trying mirrors...');
    sendStatusUpdate(win, 'Main domain unavailable, testing mirrors...', logger);
  }

  // Test each fiction mirror
  const mirrors = libgenAccessManager.mirrors;
  for (let i = 0; i < mirrors.length; i++) {
    const mirror = mirrors[i];
    sendStatusUpdate(win, `Testing mirror ${i + 1}/${mirrors.length}: ${new URL(mirror).hostname}`, logger);
    
    try {
      const response = await axios.get(`${mirror}/fiction/?q=test`, {
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
  const errorMsg = 'All LibGen Fiction mirrors are currently unavailable';
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
