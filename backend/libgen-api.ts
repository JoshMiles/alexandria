
import axios from 'axios';
import * as cheerio from 'cheerio';
import { BrowserWindow } from 'electron';
import type log from 'electron-log';

const LIBGEN_URL = "https://libgen.li";
const GOOGLE_BOOKS_API_URL = "https://www.googleapis.com/books/v1/volumes";

interface Book {
    id: string;
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

const httpGet = async (url: string, responseType: 'text' | 'json' = 'text', logger: typeof log) => {
    logger.info(`Making HTTP GET request to: ${url}`);
    try {
        const response = await axios.get(url, { responseType });
        logger.info(`Successfully fetched data from: ${url}`);
        return response.data;
    } catch (error) {
        logger.error(`Error fetching ${url}:`, error);
        throw error;
    }
};

const sendStatusUpdate = (win: BrowserWindow, message: string, logger: typeof log) => {
    if (win) {
        logger.info(`Sending search status update: ${message}`);
        win.webContents.send('search-status', message);
    }
};

const getGoogleBookInfo = async (isbn: string, logger: typeof log) => {
    if (!isbn) return null;
    const url = `${GOOGLE_BOOKS_API_URL}?q=isbn:${isbn}`;
    logger.info(`Fetching Google Books info for ISBN: ${isbn}`);
    try {
        const data = await httpGet(url, 'json', logger);
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
            table_author: cols.eq(1).text().trim(),
            publisher: cols.eq(3).text().trim(),
            year: cols.eq(4).text().trim(),
            language: cols.eq(5).text().trim(),
            pages: cols.eq(6).text().trim(),
            size: cols.eq(7).text().trim(),
            extension: cols.eq(8).text().trim(),
            cover_url: cols.eq(0).find('img').attr('src'),
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
        const metadata = await httpGet(crossrefUrl, 'json', logger);
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

const mergeBookData = async (initialResults: Book[], metadata: any, logger: typeof log): Promise<Book[]> => {
    logger.info('Merging book data with metadata and Google Books info.');
    const finalResults: Book[] = [];
    for (const book of initialResults) {
        const meta = metadata[book.id];
        if (meta) {
            book.title = meta.title || 'Unknown Title';
            const isbn = extractIsbnFromMeta(meta, logger);
            book.isbn = isbn;

            const googleInfo = await getGoogleBookInfo(isbn, logger);
            
            let author = meta.author;
            if (googleInfo?.authors?.length) {
                author = googleInfo.authors.join(', ');
            } else if (!author) {
                author = book.table_author;
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
        finalResults.push(book);
    }
    logger.info('Finished merging book data.');
    return finalResults;
};

export const search = async (win: BrowserWindow, query: string, logger: typeof log): Promise<Book[]> => {
    const doiRegex = /10\.\d{4,9}\/[-._;()/:A-Z0-9]+$/i;
    if (doiRegex.test(query)) {
        logger.info(`DOI detected: ${query}`);
        sendStatusUpdate(win, 'DOI detected', logger);
        return searchByDoi(win, query, logger);
    }

    logger.info(`Searching for '${query}'...`);
    const encodedQuery = query.replace(/ /g, '+');
    const searchUrl = `${LIBGEN_URL}/index.php?req=${encodedQuery}&columns%5B%5D=t&columns%5B%5D=a&columns%5B%5D=s&columns%5B%5D=y&columns%5B%5D=p&columns%5B%5D=i&objects%5B%5D=f&objects%5B%5D=e&objects%5B%5D=s&objects%5B%5D=a&objects%5B%5D=p&objects%5B%5D=w&topics%5B%5D=l&topics%5B%5D=f&res=100&covers=on&filesuns=all`;

    try {
        const html = await httpGet(searchUrl, 'text', logger);
        sendStatusUpdate(win, 'Parsing search results...', logger);
        const initialResults = parseInitialSearchResults(html, logger);
        if (initialResults.length === 0) {
            logger.warn(`No initial results for query: '${query}'`);
            return [];
        }

        const englishBooks = initialResults.filter(book => book.language.toLowerCase() === 'english');
        const otherBooks = initialResults.filter(book => book.language.toLowerCase() !== 'english');
        const sortedResults = [...englishBooks, ...otherBooks];

        const ids = sortedResults.map(book => book.id);
        const metadataUrl = `https://libgen.li/json.php?object=e&addkeys=*&ids=${ids.join(',')}`;
        
        sendStatusUpdate(win, 'Fetching book metadata...', logger);
        const metadata = await httpGet(metadataUrl, 'json', logger);
        
        sendStatusUpdate(win, 'Enriching data with Google Books...', logger);
        const finalResults = await mergeBookData(sortedResults, metadata, logger);
        logger.info(`Search for '${query}' completed, returning ${finalResults.length} results.`);
        return finalResults;

    } catch (error) {
        logger.error(`An error occurred during search for '${query}':`, error);
        return [];
    }
};

export const getDownloadLinks = async (downloadPageUrl: string, logger: typeof log): Promise<string[]> => {
    logger.info(`Getting download links from page: ${downloadPageUrl}`);
    try {
        const html = await httpGet(downloadPageUrl, 'text', logger);
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
            return [`${LIBGEN_URL}/${directLink}`];
        }
        logger.warn(`No LibGen direct link found on ${downloadPageUrl}`);
        return [];
    } catch (error) {
        logger.error(`Error fetching download page ${downloadPageUrl}:`, error);
        return [];
    }
};

export const getSciHubDownloadLink = async (doi: string, logger: typeof log): Promise<string | null> => {
    const sciHubUrl = `https://sci-hub.box/${doi}`;
    logger.info(`Attempting to get Sci-Hub download link from: ${sciHubUrl}`);
    try {
        const html = await httpGet(sciHubUrl, 'text', logger);
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
        if (directLink.includes('annas-archive.org/md5')) {
            const html = await httpGet(directLink, 'text', logger);
            const $ = cheerio.load(html);
            const slowDownloadLink = $('a[href^="/slow_download"]').attr('href');
            if (slowDownloadLink) {
                const fullLink = `https://annas-archive.org${slowDownloadLink}`;
                logger.info(`Resolved to Anna's Archive slow download link: ${fullLink}`);
                return fullLink;
            }
        }
        
        const html = await httpGet(directLink, 'text', logger);
        const $ = cheerio.load(html);
        const finalLink = $('a[href*="get.php"]').attr('href');
        if (finalLink) {
            const fullFinalLink = finalLink.startsWith('http') ? finalLink : `${LIBGEN_URL}/${finalLink}`;
            logger.info(`Resolved to final LibGen link: ${fullFinalLink}`);
            return fullFinalLink;
        }
        logger.warn(`Could not resolve a more direct link from ${directLink}. Returning original.`);
        return directLink;
    } catch (error) {
        logger.error(`Error resolving direct link ${directLink}:`, error);
        return directLink;
    }
};
