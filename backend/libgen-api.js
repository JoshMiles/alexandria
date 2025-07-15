// Converted from libgen-api.ts to JavaScript
const axios = require('axios');
const cheerio = require('cheerio');
const { BrowserWindow } = require('electron');
const logger = require('./logger');
const { SocksProxyAgent } = require('socks-proxy-agent');
const { searchAndFetchLibgenPlus, fetchBibtexMetadata, searchLibgenPlusEditions } = require('./libgen-bz');
const got = require('got');
const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');
const LOGS_RESPONSES_DIR = logger.LOGS_RESPONSES_DIR;

function saveTempLogFile(prefix, ext, content) {
  const filename = `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.tmp`;
  const filePath = path.join(LOGS_RESPONSES_DIR, filename);
  // Ensure the parent directory exists before writing (handles deeply nested or special char paths)
  const parentDir = path.dirname(filePath);
  if (!fs.existsSync(parentDir)) {
    fs.mkdirSync(parentDir, { recursive: true });
  }
  fs.writeFileSync(filePath, content, 'utf8');
  return filePath;
}

const API_URLS = {
  LIBGEN: "https://libgen.is",
  LIBGEN_FICTION: "https://libgen.is/fiction",
  GOOGLE_BOOKS: "https://www.googleapis.com/books/v1/volumes",
  CROSSREF: "https://api.crossref.org/works",
  SCIHUB: "https://sci-hub.box",
  ANNAS_ARCHIVE: "https://annas-archive.org"
};

function cleanLibgenBzAuthor(raw) {
  if (!raw) return '';
  let parts = raw.split(/\\|,/).map(s => s.trim()).filter(Boolean);
  parts = [...new Set(parts)];
  const fullName = parts.reverse().find(a => a.split(' ').length >= 2 && /[a-zA-Z]/.test(a));
  return fullName || parts[0] || '';
}
function cleanLibgenBzTitle(raw) {
  if (!raw) return '';
  return raw.replace(/[\\\-]+/g, ' ').replace(/\s+/g, ' ').trim();
}
function extractIsbnsFromString(identifier) {
  if (!identifier) return [];
  const matches = (identifier.match(/\b(?:97[89][- ]?)?\d{9}[\dXx]\b/g) || []).map(s => s.replace(/[- ]/g, ''));
  return Array.from(new Set(matches));
}
function extractIsbnFromAdd(addObj) {
  if (!addObj || typeof addObj !== 'object') return null;
  for (const key of Object.keys(addObj)) {
    const entry = addObj[key];
    if (entry && entry.name_en === 'ISBN' && typeof entry.value === 'string' && entry.value.length >= 10) {
      const isbns = extractIsbnsFromString(entry.value);
      if (isbns.length > 0) return isbns[0];
    }
  }
  return null;
}

function sendStatusUpdate(win, message) {
  if (win && win.webContents) {
    win.webContents.send('search-status', message);
  }
}

async function getGoogleBookInfo(isbn) {
  try {
    const url = `${API_URLS.GOOGLE_BOOKS}?q=isbn:${isbn}`;
    const res = await axios.get(url);
    if (res.data && res.data.items && res.data.items.length > 0) {
      const info = res.data.items[0].volumeInfo;
      return {
        title: info.title || '',
        subtitle: info.subtitle || '',
        authors: info.authors || [],
        publisher: info.publisher || '',
        publishedDate: info.publishedDate || '',
        description: info.description || '',
        industryIdentifiers: info.industryIdentifiers || [],
        pages: info.pageCount ? info.pageCount.toString() : '',
        categories: info.categories || [],
        averageRating: info.averageRating || null,
        thumbnail: info.imageLinks ? info.imageLinks.thumbnail : '',
        smallThumbnail: info.imageLinks ? info.imageLinks.smallThumbnail : '',
        language: info.language || '',
        previewLink: info.previewLink || '',
        infoLink: info.infoLink || '',
        canonicalVolumeLink: info.canonicalVolumeLink || '',
        maturityRating: info.maturityRating || '',
        printType: info.printType || '',
        readingModes: info.readingModes || {},
        allowAnonLogging: info.allowAnonLogging || false,
        contentVersion: info.contentVersion || '',
        panelizationSummary: info.panelizationSummary || {},
        saleInfo: res.data.items[0].saleInfo || {},
        accessInfo: res.data.items[0].accessInfo || {},
      };
    }
  } catch (e) {
    logger.warn('Google Books API error:', e);
  }
  return null;
}

// Update searchLibgenPlus to accept a status callback
async function searchLibgenPlus(query, statusCallback) {
  for (let i = 0; i < LIBGEN_PLUS_MIRRORS.length; i++) {
    const mirror = LIBGEN_PLUS_MIRRORS[i];
    if (statusCallback) {
      statusCallback(`Contacting Library Genesis+ server (mirror ${i + 1}/${LIBGEN_PLUS_MIRRORS.length}): ${mirror}...`);
    }
    try {
      const searchUrl = `${mirror}/index.php?req=${encodeURIComponent(query)}&columns[]=t&columns[]=a&columns[]=s&columns[]=y&columns[]=p&columns[]=i&objects[]=f&objects[]=e&objects[]=s&objects[]=a&objects[]=p&objects[]=w&topics[]=l&topics[]=c&topics[]=f&topics[]=a&topics[]=m&topics[]=r&topics[]=s&res=100&covers=on&filesuns=all`;
      logger.info(`[libgen.bz] Querying search URL: ${searchUrl}`);
      const res = await gotWithLog(searchUrl);
      const $ = cheerio.load(res.body);
      let fileJsonApiUrl = null;
      let fileIds = [];
      $('a').each((i, el) => {
        const href = $(el).attr('href');
        if (href && href.includes('/json.php?object=f&ids=')) {
          fileJsonApiUrl = href.startsWith('http') ? href : `${mirror}${href}`;
          const match = href.match(/ids=([\d,]+)/);
          if (match) {
            fileIds = match[1].split(',');
          }
        }
      });
      if (fileJsonApiUrl) logger.info(`[libgen.bz] Querying file JSON API URL: ${fileJsonApiUrl}`);
      if (fileIds.length > 0) {
        return { fileIds, fileJsonApiUrl, mirror };
      }
    } catch (e) {
      logger.warn(`[libgen.bz] Mirror failed: ${mirror} - ${e.message}`);
      continue;
    }
  }
  return { fileIds: [], fileJsonApiUrl: null, mirror: '' };
}

// Configurable batch stream size for editions
const BATCH_STREAM_SIZE = process.env.LIBGEN_EDITION_BATCH_SIZE ? parseInt(process.env.LIBGEN_EDITION_BATCH_SIZE, 10) : 10;

// Update search to use the new editions-based search
const search = async (win, query) => {
  logger.info(`Searching for '${query}' (editions mode, dynamic streaming)...`);
  const streamedResults = [];
  try {
    const editionResults = await searchLibgenPlusEditions(query, (msg) => sendStatusUpdate(win, msg));
    const editionResultsFile = saveTempLogFile('libgenapi-editions', 'json', JSON.stringify(editionResults, null, 2));
    logger.info(`[libgen.bz editions] Saved JSON results to ${editionResultsFile}`);
    if (editionResults.length > 0) {
      for (let idx = 0; idx < editionResults.length; idx++) {
        const { edition, files } = editionResults[idx];
        sendStatusUpdate(win, `Processing Edition ${idx + 1} out of ${editionResults.length}...`);
        const firstFile = files[0] || {};
        // Use first file metadata to resolve ISBN and summary fields
        let isbnRaw = '';
        if (firstFile.metadata && firstFile.metadata.isbn) isbnRaw = firstFile.metadata.isbn;
        else if (edition.isbn) isbnRaw = edition.isbn;
        else if (edition.identifier) isbnRaw = edition.identifier;
        isbnRaw = isbnRaw && typeof isbnRaw === 'string' ? isbnRaw.split(';')[0].trim() : '';
        const author = firstFile.metadata && firstFile.metadata.author || edition.author || '';
        const title = edition.title || (firstFile.metadata && firstFile.metadata.title) || '';
        const year = edition.year || (firstFile.metadata && firstFile.metadata.year) || '';
        const publisher = edition.publisher || (firstFile.metadata && firstFile.metadata.publisher) || '';
        const language = edition.language || (firstFile.metadata && firstFile.metadata.language) || '';
        const cover_url = (firstFile.metadata && firstFile.metadata.coverurl) || edition.coverurl || '';
        const description = edition.description || (firstFile.metadata && firstFile.metadata.description) || '';
        const pages = edition.pages || (firstFile.metadata && firstFile.metadata.pages) || '';
        const extension = firstFile.metadata && firstFile.metadata.extension || '';
        const size = firstFile.metadata && firstFile.metadata.filesize ? `${(parseInt(firstFile.metadata.filesize, 10) / 1024 / 1024).toFixed(2)} MB` : '';
        // Only send summary info and the first file's metadata
        const bookObj = {
          id: firstFile.metadata && firstFile.metadata.md5 || isbnRaw || title + author + year,
          title,
          author,
          publisher,
          year,
          language,
          pages,
          size,
          extension,
          cover_url,
          description,
          isbn: isbnRaw,
          files: files.length > 0 ? [{
            fileId: firstFile.fileId,
            md5: firstFile.metadata && firstFile.metadata.md5,
            extension: firstFile.metadata && firstFile.metadata.extension,
            filesize: firstFile.metadata && firstFile.metadata.filesize,
            mirror: firstFile.mirror,
            source: 'libgen.bz',
            locator: firstFile.metadata && firstFile.metadata.locator,
          }] : [],
          file_count: files.length,
          source: 'libgen.bz',
        };
        saveTempLogFile(`libgenapi-edition-book-summary-${idx + 1}`, 'json', JSON.stringify(bookObj, null, 2));
        // Stream this edition summary to the frontend immediately
        if (win && win.webContents) {
          win.webContents.send('search-result', bookObj);
        }
        streamedResults.push(bookObj);
      }
      sendStatusUpdate(win, `Search complete! Found ${editionResults.length} editions for "${query}".`);
      return streamedResults;
    } else {
      sendStatusUpdate(win, `No editions found for "${query}" on Library Genesis+.`);
    }
  } catch (err) {
    logger.error('Error in Library Genesis+ editions search:', err);
    sendStatusUpdate(win, `Library Genesis+ editions search failed: ${err}`);
  }
  return [];
};

// Helper for HTTP GET (used in getDownloadLinks, etc.)
async function httpGet(url, responseType = 'text', retries = 2, logError = true) {
  try {
    const res = await axios.get(url, { responseType });
    return res.data;
  } catch (err) {
    if (retries > 0) {
      return httpGet(url, responseType, retries - 1, logError);
    }
    if (logError) logger.error('httpGet failed:', err);
    throw err;
  }
}

// Update getDownloadLinks to accept a mirror argument and use it as the base for get.php links
const getDownloadLinks = async (downloadPageUrl, mirror) => {
  logger.info(`Getting download links from page: ${downloadPageUrl}`);
  try {
    if (downloadPageUrl.includes('ads.php?md5=')) {
      logger.info('Resolving ads.php link for direct download...');
      const html = await httpGet(downloadPageUrl, 'text', 2, false);
      const downloadHtmlFile = saveTempLogFile('libgenapi-download', 'html', html);
      logger.info(`Saved raw HTML response to ${downloadHtmlFile}`);
      const $ = cheerio.load(html);
      const getLink = $('a[href*="get.php"][href*="key="]').attr('href');
      if (getLink) {
        const base = mirror || 'https://libgen.bz';
        logger.info(`Resolved direct get.php link: ${base}${getLink}`);
        return [`${base}${getLink}`];
      }
      logger.warn('No get.php link with key found on ads.php page.');
      return [];
    }
    if (downloadPageUrl.includes('fiction/') || downloadPageUrl.includes('books.ms')) {
      const md5Match = downloadPageUrl.match(/([A-F0-9]{32})/i);
      if (md5Match) {
        const md5 = md5Match[1];
        const libgenLiUrl = `https://libgen.li/ads.php?md5=${md5}`;
        logger.info(`Trying libgen.li ads.php link: ${libgenLiUrl}`);
        try {
          const html = await httpGet(libgenLiUrl, 'text', 2, false);
          const downloadHtmlFile = saveTempLogFile('libgenapi-download', 'html', html);
          logger.info(`Saved raw HTML response to ${downloadHtmlFile}`);
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
    let html;
    if (downloadPageUrl.startsWith('http') && (downloadPageUrl.includes('libgen.is') || downloadPageUrl.includes('libgen.rs') || downloadPageUrl.includes('libgen.st'))) {
      const url = new URL(downloadPageUrl);
      html = await httpGet(url.pathname + url.search, 'text');
    } else {
      html = await httpGet(downloadPageUrl, 'text', 2, false);
    }
    const downloadHtmlFile = saveTempLogFile('libgenapi-download', 'html', html);
    logger.info(`Saved raw HTML response to ${downloadHtmlFile}`);
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
      return [directLink];
    }
    const downloadLinks = [];
    $('a[href*="download"], a[href*="get.php"], a[href*="dl.php"]').each((i, link) => {
      const href = $(link).attr('href');
      if (href) {
        const fullUrl = href.startsWith('http') ? href : href;
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
    logger.error(`Error fetching download page ${downloadPageUrl}:`, error);
    return [];
  }
};

const getSciHubDownloadLink = async (doi) => {
  const sciHubUrl = `https://sci-hub.box/${doi}`;
  logger.info(`Attempting to get Sci-Hub download link from: ${sciHubUrl}`);
  try {
    const html = await httpGet(sciHubUrl, 'text', 2, false);
    const resolveHtmlFile = saveTempLogFile('libgenapi-resolve', 'html', html);
    logger.info(`Saved raw HTML response to ${resolveHtmlFile}`);
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

// Update resolveDirectDownloadLink to accept a mirror argument and use it as the base for get.php links
const resolveDirectDownloadLink = async (directLink, mirror) => {
  logger.info(`Resolving direct download link: ${directLink}`);
  try {
    if (directLink.includes('ads.php?md5=')) {
      logger.info('Resolving ads.php link for direct download...');
      const html = await httpGet(directLink, 'text', 2, false);
      const resolveHtmlFile = saveTempLogFile('libgenapi-resolve', 'html', html);
      logger.info(`Saved raw HTML response to ${resolveHtmlFile}`);
      const $ = cheerio.load(html);
      const getLink = $('a[href*="get.php"][href*="key="]').attr('href');
      if (getLink) {
        const base = mirror || 'https://libgen.bz';
        const fullUrl = getLink.startsWith('http') ? getLink : `${base}${getLink}`;
        logger.info(`Resolved direct get.php link: ${fullUrl}`);
        return fullUrl;
      }
      logger.warn('No get.php link with key found on ads.php page.');
      return directLink;
    }
    if (directLink.includes('fiction/') || directLink.includes('books.ms')) {
      const md5Match = directLink.match(/([A-F0-9]{32})/i);
      if (md5Match) {
        const md5 = md5Match[1];
        const libgenLiUrl = `https://libgen.li/ads.php?md5=${md5}`;
        logger.info(`Trying libgen.li ads.php for fiction download: ${libgenLiUrl}`);
        try {
          const html = await httpGet(libgenLiUrl, 'text', 2, false);
          const resolveHtmlFile = saveTempLogFile('libgenapi-resolve', 'html', html);
          logger.info(`Saved raw HTML response to ${resolveHtmlFile}`);
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
        const libgenIsUrl = `https://libgen.is/fiction/${md5}`;
        logger.info(`Fallback to libgen.is fiction page: ${libgenIsUrl}`);
        return libgenIsUrl;
      }
    }
    let html;
    if (directLink.startsWith('http') && directLink.includes('libgen')) {
      const url = new URL(directLink);
      html = await httpGet(url.pathname + url.search, 'text');
    } else {
      html = await httpGet(directLink, 'text', 2, false);
    }
    const resolveHtmlFile = saveTempLogFile('libgenapi-resolve', 'html', html);
    logger.info(`Saved raw HTML response to ${resolveHtmlFile}`);
    const $ = cheerio.load(html);
    const finalLink = $('a[href*="get.php"]').attr('href');
    if (finalLink) {
      const baseUrl = 'https://libgen.is';
      const fullFinalLink = finalLink.startsWith('http') ? finalLink : `${baseUrl}/${finalLink}`;
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

const getLibgenAccessInfo = async () => {
  // Dummy implementation for JS version
  return { mirrors: [], currentMethod: null, lastError: null };
};

const getLibgenStatusFromOpenSlum = async () => {
  try {
    const res = await got('https://open-slum.org/api/badge/10/status');
    const svg = res.body;
    const match = svg.match(/<title>Status: (Up|Down)<\/title>/i) || svg.match(/<text[^>]*>(Up|Down)<\/text>/i);
    if (match && match[1]) {
      return match[1].toLowerCase() === 'up' ? 'up' : 'down';
    }
    return 'unknown';
  } catch (e) {
    return 'unknown';
  }
};

const getLibgenPlusStatusFromOpenSlum = async () => {
  try {
    const res = await got('https://open-slum.org/api/badge/11/status');
    const svg = res.body;
    const match = svg.match(/<title>Status: (Up|Down)<\/title>/i) || svg.match(/<text[^>]*>(Up|Down)<\/text>/i);
    if (match && match[1]) {
      return match[1].toLowerCase() === 'up' ? 'up' : 'down';
    }
    return 'unknown';
  } catch (e) {
    return 'unknown';
  }
};

const testLibgenAccess = async (win) => {
  // Dummy implementation for JS version
  return { success: false, workingMirror: null, error: 'Not implemented in JS version' };
};

const resetLibgenAccessMethod = () => true;
const addLibgenMirror = (url) => getLibgenAccessInfo();
const removeLibgenMirror = (url) => getLibgenAccessInfo();

// Helper to map ISO 639-1 codes to human-readable language names
const ISO_LANG_MAP = {
  en: 'English',
  fr: 'French',
  de: 'German',
  es: 'Spanish',
  it: 'Italian',
  ru: 'Russian',
  zh: 'Chinese',
  ja: 'Japanese',
  ko: 'Korean',
  pt: 'Portuguese',
  pl: 'Polish',
  nl: 'Dutch',
  ar: 'Arabic',
  tr: 'Turkish',
  sv: 'Swedish',
  fi: 'Finnish',
  da: 'Danish',
  no: 'Norwegian',
  cs: 'Czech',
  hu: 'Hungarian',
  ro: 'Romanian',
  el: 'Greek',
  he: 'Hebrew',
  th: 'Thai',
  hi: 'Hindi',
  id: 'Indonesian',
  vi: 'Vietnamese',
  uk: 'Ukrainian',
  fa: 'Persian',
  bg: 'Bulgarian',
  hr: 'Croatian',
  sk: 'Slovak',
  sl: 'Slovenian',
  sr: 'Serbian',
  et: 'Estonian',
  lv: 'Latvian',
  lt: 'Lithuanian',
  ms: 'Malay',
  bn: 'Bengali',
  ta: 'Tamil',
  te: 'Telugu',
  ur: 'Urdu',
  // Add more as needed
};

// IPC handler to fetch all file metadata for an edition (on demand, no download links)
async function fetchEditionFiles(editionId, fileIds, mirror) {
  // fileIds: array of file IDs for this edition
  if (!Array.isArray(fileIds) || fileIds.length === 0) return [];
  const fileMetas = await require('./libgen-bz').fetchFileMetadata(fileIds, mirror);
  // Return only metadata, not download links
  return fileMetas.map(f => ({
    fileId: f.fileId,
    metadata: f.metadata,
    mirror: f.mirror,
  }));
}

// IPC handler to fetch download links for a file (on demand)
async function fetchDownloadLinks(fileId, mirror) {
  if (!fileId) return [];
  const links = await require('./libgen-bz').fetchFileDownloadLinks(fileId, mirror || 'https://libgen.bz');
  return links;
}

module.exports = {
  search,
  getDownloadLinks,
  getSciHubDownloadLink,
  resolveDirectDownloadLink,
  getLibgenAccessInfo,
  getLibgenStatusFromOpenSlum,
  getLibgenPlusStatusFromOpenSlum,
  testLibgenAccess,
  resetLibgenAccessMethod,
  addLibgenMirror,
  removeLibgenMirror,
  fetchEditionFiles,
  fetchDownloadLinks,
}; 