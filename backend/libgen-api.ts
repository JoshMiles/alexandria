
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
}

const httpGet = async (url: string, responseType: 'text' | 'json' = 'text') => {
    try {
        const response = await axios.get(url, { responseType });
        return response.data;
    } catch (error) {
        log.error(`Error fetching ${url}:`, error);
        throw error;
    }
};

const sendStatusUpdate = (win: BrowserWindow, message: string) => {
    if (win) {
        win.webContents.send('search-status', message);
    }
};

const getGoogleBookInfo = async (isbn: string) => {
    if (!isbn) return null;
    const url = `${GOOGLE_BOOKS_API_URL}?q=isbn:${isbn}`;
    try {
        const data = await httpGet(url, 'json');
        if (data.totalItems > 0) {
            const volumeInfo = data.items[0].volumeInfo;
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
    } catch (error) {
        log.error(`Error fetching Google Books info for ISBN ${isbn}:`, error);
    }
    return null;
};

const extractIsbnFromMeta = (meta: any) => {
    try {
        const addNode = meta.add;
        if (!addNode || typeof addNode !== 'object') return null;
        for (const key in addNode) {
            const item = addNode[key];
            if (item && typeof item === 'object' && item.name_en === 'ISBN') {
                return item.value?.split(',')[0].trim();
            }
        }
    } catch (error) {
        log.error('Error extracting ISBN from metadata:', error);
    }
    return null;
};

const parseInitialSearchResults = (html: string): Book[] => {
    const $ = cheerio.load(html);
    const results: Book[] = [];
    const tables = $('table');
    if (tables.length < 2) return results;

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
    return results;
};

const mergeBookData = async (initialResults: Book[], metadata: any): Promise<Book[]> => {
    const finalResults: Book[] = [];
    for (const book of initialResults) {
        const meta = metadata[book.id];
        if (meta) {
            book.title = meta.title || 'Unknown Title';
            const isbn = extractIsbnFromMeta(meta);
            book.isbn = isbn;

            const googleInfo = await getGoogleBookInfo(isbn);
            
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
    return finalResults;
};

export const search = async (win: BrowserWindow, query: string, logger: typeof log): Promise<Book[]> => {
    logger.info(`Searching for '${query}'...`);
    const encodedQuery = query.replace(/ /g, '+');
    const searchUrl = `${LIBGEN_URL}/index.php?req=${encodedQuery}&columns%5B%5D=t&columns%5B%5D=a&columns%5B%5D=s&columns%5B%5D=y&columns%5B%5D=p&columns%5B%5D=i&objects%5B%5D=f&objects%5B%5D=e&objects%5B%5D=s&objects%5B%5D=a&objects%5B%5D=p&objects%5B%5D=w&topics%5B%5D=l&topics%5B%5D=f&res=100&covers=on&filesuns=all`;

    try {
        const html = await httpGet(searchUrl);
        sendStatusUpdate(win, 'Parsing search results...');
        const initialResults = parseInitialSearchResults(html);
        if (initialResults.length === 0) {
            return [];
        }

        const englishBooks = initialResults.filter(book => book.language.toLowerCase() === 'english');
        const otherBooks = initialResults.filter(book => book.language.toLowerCase() !== 'english');
        const sortedResults = [...englishBooks, ...otherBooks];

        const ids = sortedResults.map(book => book.id);
        const metadataUrl = `https://libgen.li/json.php?object=e&addkeys=*&ids=${ids.join(',')}`;
        
        sendStatusUpdate(win, 'Fetching book metadata...');
        const metadata = await httpGet(metadataUrl, 'json');
        
        sendStatusUpdate(win, 'Enriching data with Google Books...');
        const finalResults = await mergeBookData(sortedResults, metadata);
        return finalResults;

    } catch (error) {
        logger.error(`An error occurred during search for '${query}':`, error);
        return [];
    }
};

export const getDownloadLinks = async (downloadPageUrl: string, logger: typeof log): Promise<string[]> => {
    try {
        const html = await httpGet(downloadPageUrl);
        const $ = cheerio.load(html);
        const directLink = $('a[href*="get.php"]').attr('href');
        return directLink ? [`${LIBGEN_URL}/${directLink}`] : [];
    } catch (error) {
        logger.error(`Error fetching download page ${downloadPageUrl}:`, error);
        return [];
    }
};

export const resolveDirectDownloadLink = async (directLink: string, logger: typeof log): Promise<string> => {
    try {
        const html = await httpGet(directLink);
        const $ = cheerio.load(html);
        const finalLink = $('a[href*="get.php"], a[href*=".pdf"], a[href*=".epub"], a[href*=".mobi"], a[href*=".djvu"], a[href*=".azw3"], a[href*=".zip"], a[href*=".rar"]').attr('href');
        if (finalLink) {
            return finalLink.startsWith('http') ? finalLink : `${LIBGEN_URL}/${finalLink}`;
        }
        return directLink;
    } catch (error) {
        logger.error(`Error resolving direct link ${directLink}:`, error);
        return directLink;
    }
};
